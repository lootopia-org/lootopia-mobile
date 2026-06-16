import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { StoredImage } from '@/src/components/StoredImage';
import { ArSecretReveal } from '@/src/components/ar/ArSecretReveal';
import { qrPayloadsMatch } from '@/src/lib/qr-utils';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useAudioPlayer } from 'expo-audio';
import * as Location from 'expo-location';
import { DeviceMotion } from 'expo-sensors';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { colors, glassCard, radii } from '@/src/theme';
import { formatDistance, haversineDistanceMeters, isReliableDeviceLocation, isValidGeoPoint } from '@/src/lib/geo';
import { useLiveEventsContext } from '@/src/state/LiveEventsContext';
import {
  buildChest,
  buildDynamite,
  buildExplosion,
  buildGrassMound,
  CHEST_AR_DISTANCE,
} from '@/src/components/three/buildCharacter';
import {
  applyDeviceOrientationToCamera,
  getCameraForward,
  getChestAnchorPosition,
  type DeviceRotation,
} from '@/src/components/three/applyDeviceOrientation';
import { createFrameLimiter, useAppActiveRef } from '@/src/hooks/useAppActiveRef';
import { recordFrame } from '@/src/lib/perf';

type ARExperienceProps = {
  clue: string;
  targetLocation: {
    latitude: number;
    longitude: number;
  };
  radiusMeters: number;
  accessCode?: string;
  qrPayload?: string;
  qrRevealContent?: string;
  requireQrScan?: boolean;
  enableArChest?: boolean;
  fullScreen?: boolean;
  photoClueUri?: string;
  audioHintUri?: string;
  liveOverride?: {
    huntPaused?: boolean;
    stepPaused?: boolean;
    redirect?: { location: { latitude: number; longitude: number }; note?: string };
  };
  onComplete?: (answer?: string) => void | Promise<void>;
  onBombsExhausted?: () => void;
};

const PHOTO_CLUE_RADIUS_METERS = 30;
const CHEST_BURIED_Y = -0.05;
const CHEST_REVEALED_Y = 0.05;
const GRAVITY = -14;
const REQUIRED_BOMB_HITS = 3;
const MAX_BOMB_ATTEMPTS = 6;
const MOUND_SCENE_SCALE = 1.18;
const MOUND_HIT_RADIUS = 1.4;

type ArPhase = 'access_code' | 'active' | 'qr_display' | 'qr_scanning' | 'qr_revealed' | 'completed';

type DynamiteFlight = {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
};

type ExplosionKind = 'miss' | 'partial' | 'final';

type ExplosionState = {
  active: boolean;
  elapsed: number;
  kind: ExplosionKind;
  worldX: number;
  worldY: number;
  worldZ: number;
  startMoundScale: number;
  endMoundScale: number;
};

function normalizeCode(value: string): string {
  return value.trim().toLowerCase();
}

export function ARExperience({
  clue,
  targetLocation,
  radiusMeters,
  accessCode,
  qrPayload,
  qrRevealContent,
  requireQrScan = false,
  enableArChest = false,
  fullScreen = false,
  photoClueUri,
  audioHintUri,
  liveOverride,
  onComplete,
  onBombsExhausted,
}: ARExperienceProps) {
  const { t } = useTranslation('hunts');
  const { requestLocationSend } = useLiveEventsContext();
  const [permission, requestPermission] = useCameraPermissions();
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number | null;
  } | null>(null);
  const [validationMessage, setValidationMessage] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState('');
  const [scannedPayload, setScannedPayload] = useState<string | null>(null);
  const bombHitsRef = useRef(0);
  const bombsRemainingRef = useRef(MAX_BOMB_ATTEMPTS);
  const bombsDepletedHandledRef = useRef(false);
  const moundScaleRef = useRef(1);
  const [bombHits, setBombHits] = useState(0);
  const [bombsRemaining, setBombsRemaining] = useState(MAX_BOMB_ATTEMPTS);
  const [bombsFailed, setBombsFailed] = useState(false);
  const showQrMode = requireQrScan && !!qrPayload?.trim();
  const requiredCode = accessCode?.trim() || undefined;

  const [phase, setPhase] = useState<ArPhase>(() => {
    if (requireQrScan && qrPayload?.trim()) {
      return 'qr_display';
    }
    if (accessCode?.trim()) {
      return 'access_code';
    }
    return 'active';
  });

  const qrPulse = useRef(new Animated.Value(1)).current;
  const scanLine = useRef(new Animated.Value(0)).current;

  const effectiveTarget = isValidGeoPoint(liveOverride?.redirect?.location)
    ? liveOverride!.redirect!.location
    : isValidGeoPoint(targetLocation)
      ? targetLocation
      : null;
  const isLiveBlocked = Boolean(liveOverride?.huntPaused || liveOverride?.stepPaused);
  const chestUnlocked = phase === 'active' || phase === 'completed';
  const hasLaunched = phase === 'completed';

  const chestOpenRef = useRef(false);
  const chestRevealedRef = useRef(false);
  const dynamiteFlightRef = useRef<DynamiteFlight | null>(null);
  const explosionRef = useRef<ExplosionState>({
    active: false,
    elapsed: 0,
    kind: 'final',
    worldX: 0,
    worldY: 0,
    worldZ: 0,
    startMoundScale: MOUND_SCENE_SCALE,
    endMoundScale: MOUND_SCENE_SCALE,
  });
  const frameRef = useRef<number | null>(null);
  const appActiveRef = useAppActiveRef();
  const proximityCompletedRef = useRef(false);
  const lastScanAtRef = useRef(0);
  const unlockedAnswerRef = useRef<string | undefined>(undefined);
  const onChestUnburiedRef = useRef<() => void>(() => {});
  const onBombImpactRef = useRef<(result: 'miss' | 'partial' | 'final', hits: number) => void>(() => {});
  const onBombsExhaustedRef = useRef<() => void>(() => {});
  const checkBombsDepletedRef = useRef<() => void>(() => {});
  const deviceRotationRef = useRef<DeviceRotation | null>(null);
  const referenceAlphaRef = useRef<number | null>(null);
  const anchorPlacedRef = useRef(false);
  const anchorPositionRef = useRef({ x: 0, y: 0, z: -CHEST_AR_DISTANCE });
  const cameraForwardRef = useRef({ x: 0, y: 0, z: -1 });

  const [chestRevealed, setChestRevealed] = useState(false);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    requestLocationSend();
  }, [requestLocationSend]);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    const applyPosition = (coords: Location.LocationObjectCoords) => {
      if (!isReliableDeviceLocation(coords)) {
        return;
      }
      setCurrentLocation({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy ?? null,
      });
    };

    void (async () => {
      const permissionResult = await Location.requestForegroundPermissionsAsync();
      if (cancelled) {
        return;
      }
      if (!permissionResult.granted) {
        setLocationPermissionGranted(false);
        return;
      }

      setLocationPermissionGranted(true);

      const lastKnown = await Location.getLastKnownPositionAsync();
      if (!cancelled && lastKnown) {
        applyPosition(lastKnown.coords);
      }

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (!cancelled) {
        applyPosition(position.coords);
      }

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 3,
          timeInterval: 2000,
        },
        (update) => {
          applyPosition(update.coords);
        }
      );
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  useEffect(
    () => () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (phase !== 'qr_display') {
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(qrPulse, { toValue: 1.04, duration: 900, useNativeDriver: true }),
        Animated.timing(qrPulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [phase, qrPulse]);

  useEffect(() => {
    if (phase !== 'qr_scanning') {
      return;
    }
    scanLine.setValue(0);
    const sweep = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLine, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(scanLine, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    );
    sweep.start();
    return () => sweep.stop();
  }, [phase, scanLine]);

  const distanceMeters = useMemo(() => {
    if (!currentLocation || !effectiveTarget || !isReliableDeviceLocation(currentLocation)) {
      return null;
    }
    return haversineDistanceMeters(currentLocation, effectiveTarget);
  }, [currentLocation, effectiveTarget]);

  const hasReliableLocation = currentLocation != null && isReliableDeviceLocation(currentLocation);
  const distanceLabel = distanceMeters !== null ? formatDistance(distanceMeters) : '?';

  const isWithinRange = distanceMeters !== null && distanceMeters <= radiusMeters;
  const isPhotoClueUnlocked = distanceMeters !== null && distanceMeters <= PHOTO_CLUE_RADIUS_METERS;
  const showArScene = enableArChest && chestUnlocked && isWithinRange;
  const audioPlayer = useAudioPlayer(audioHintUri ?? null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const completeStep = async (message: string, answer?: string) => {
    if (phase === 'completed' || isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    try {
      await onComplete?.(answer);
      chestOpenRef.current = true;
      setPhase('completed');
      setValidationMessage(message);
    } catch (err) {
      proximityCompletedRef.current = false;
      if (unlockedAnswerRef.current) {
        setValidationMessage(t('ar.accessCode.incorrect'));
      } else if (err instanceof Error && err.message) {
        setValidationMessage(err.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isArChestActive = enableArChest && !showQrMode;

  onChestUnburiedRef.current = () => {
    if (chestRevealedRef.current) {
      return;
    }
    chestRevealedRef.current = true;
    setChestRevealed(true);
    setValidationMessage(t('ar.helperChestRevealed'));
    setTimeout(() => {
      chestOpenRef.current = true;
      if (!proximityCompletedRef.current) {
        proximityCompletedRef.current = true;
        void completeStep(t('ar.messages.validatedChest'), unlockedAnswerRef.current);
      }
    }, 1200);
  };

  onBombImpactRef.current = (result, hits) => {
    setBombHits(hits);
    if (result === 'miss') {
      setValidationMessage(t('ar.messages.bombMiss'));
      return;
    }
    if (result === 'partial') {
      setValidationMessage(t('ar.messages.bombHit', { hits, required: REQUIRED_BOMB_HITS }));
      return;
    }
    setValidationMessage(t('ar.messages.bombHitFinal', { hits, required: REQUIRED_BOMB_HITS }));
  };

  onBombsExhaustedRef.current = () => {
    if (bombsDepletedHandledRef.current || chestRevealedRef.current) {
      return;
    }
    bombsDepletedHandledRef.current = true;
    setBombsFailed(true);
    setValidationMessage(t('ar.messages.bombsExhausted'));
    setTimeout(() => onBombsExhausted?.(), 2500);
  };

  checkBombsDepletedRef.current = () => {
    if (
      bombsRemainingRef.current <= 0 &&
      bombHitsRef.current < REQUIRED_BOMB_HITS &&
      !chestRevealedRef.current &&
      !bombsDepletedHandledRef.current
    ) {
      onBombsExhaustedRef.current();
    }
  };

  const launchDynamite = useCallback((screenDx: number, throwPower: number) => {
    if (
      chestRevealedRef.current ||
      bombsDepletedHandledRef.current ||
      bombsRemainingRef.current <= 0 ||
      dynamiteFlightRef.current?.active ||
      explosionRef.current.active
    ) {
      return;
    }

    bombsRemainingRef.current -= 1;
    setBombsRemaining(bombsRemainingRef.current);

    const anchorPos = anchorPositionRef.current;
    const targetDist = Math.hypot(anchorPos.x, anchorPos.z) || CHEST_AR_DISTANCE;
    const dirX = anchorPos.x / targetDist;
    const dirZ = anchorPos.z / targetDist;
    const perpX = -dirZ;
    const perpZ = dirX;
    const sideOffset = Math.max(-1.5, Math.min(1.5, screenDx / 140));
    const power = Math.max(0.25, Math.min(2.5, throwPower));
    const idealSpeed = targetDist / 0.95;
    const horizontalSpeed = idealSpeed * (0.5 + power * 0.34);
    const vx = dirX * horizontalSpeed + perpX * sideOffset * 1.5;
    const vz = dirZ * horizontalSpeed + perpZ * sideOffset * 1.5;
    const vy = 4 + power * 3;

    dynamiteFlightRef.current = {
      active: true,
      x: dirX * 0.55,
      y: 1.2,
      z: dirZ * 0.55,
      vx,
      vy,
      vz,
    };
  }, []);

  useEffect(() => {
    if (!showArScene) {
      deviceRotationRef.current = null;
      referenceAlphaRef.current = null;
      anchorPlacedRef.current = false;
      anchorPositionRef.current = { x: 0, y: 0, z: -CHEST_AR_DISTANCE };
      bombHitsRef.current = 0;
      bombsRemainingRef.current = MAX_BOMB_ATTEMPTS;
      bombsDepletedHandledRef.current = false;
      moundScaleRef.current = 1;
      setBombHits(0);
      setBombsRemaining(MAX_BOMB_ATTEMPTS);
      setBombsFailed(false);
      return;
    }

    let subscription: { remove: () => void } | undefined;

    void (async () => {
      const available = await DeviceMotion.isAvailableAsync();
      if (!available) {
        return;
      }

      DeviceMotion.setUpdateInterval(50);
      subscription = DeviceMotion.addListener(({ rotation }) => {
        if (!rotation) {
          return;
        }
        deviceRotationRef.current = rotation;
      });
    })();

    return () => {
      subscription?.remove();
      deviceRotationRef.current = null;
      referenceAlphaRef.current = null;
      anchorPlacedRef.current = false;
      anchorPositionRef.current = { x: 0, y: 0, z: -CHEST_AR_DISTANCE };
    };
  }, [showArScene]);

  useEffect(() => {
    if (enableArChest || showQrMode || phase !== 'active' || isLiveBlocked) {
      return;
    }
    if (!isWithinRange || proximityCompletedRef.current) {
      return;
    }

    proximityCompletedRef.current = true;
    void completeStep(t('ar.messages.validatedChest'), unlockedAnswerRef.current);
  }, [enableArChest, showQrMode, phase, isLiveBlocked, isWithinRange, t]);

  const throwPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () =>
          isArChestActive &&
          phase === 'active' &&
          isWithinRange &&
          !chestRevealed &&
          bombsRemaining > 0 &&
          !bombsDepletedHandledRef.current,
        onMoveShouldSetPanResponder: (_, gesture) =>
          isArChestActive &&
          phase === 'active' &&
          isWithinRange &&
          !chestRevealed &&
          bombsRemaining > 0 &&
          !bombsDepletedHandledRef.current &&
          Math.abs(gesture.dy) > 6,
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy < -60 && gesture.vy < -0.15) {
            const throwPower = Math.min(2.4, Math.max(0.2, -gesture.vy * 1.35 - gesture.dy / 220));
            launchDynamite(gesture.dx, throwPower);
          }
        },
      }),
    [isArChestActive, phase, isWithinRange, chestRevealed, bombsRemaining, launchDynamite]
  );

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    if (phase !== 'qr_scanning' || isLiveBlocked) {
      return;
    }

    const now = Date.now();
    if (now - lastScanAtRef.current < 1200) {
      return;
    }
    lastScanAtRef.current = now;

    const expected = qrPayload?.trim() ?? '';
    const scanned = result.data?.trim() ?? '';
    const matches =
      expected.length > 0
        ? qrPayloadsMatch(scanned, expected)
        : scanned.startsWith('lootopia:');

    if (matches) {
      setScannedPayload(scanned);
      setValidationMessage('');
      setPhase('qr_revealed');
      return;
    }
    setValidationMessage(t('ar.messages.qrUnknown'));
  };

  const handleUnlockCode = () => {
    if (!requiredCode) {
      setPhase('active');
      return;
    }
    if (normalizeCode(codeInput) !== normalizeCode(requiredCode)) {
      setCodeError(t('ar.accessCode.incorrect'));
      return;
    }
    unlockedAnswerRef.current = requiredCode;
    setCodeError('');
    setValidationMessage(t('ar.accessCode.unlocked'));
    setPhase('active');
  };

  const handleQrRevealContinue = () => {
    void completeStep(t('ar.messages.qrValidated'), scannedPayload ?? qrPayload);
  };

  const playAudioHint = () => {
    audioPlayer.seekTo(0);
    audioPlayer.play();
  };

  const onContextCreate = (gl: any) => {
    const renderer = new Renderer({ gl });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      42,
      gl.drawingBufferWidth / gl.drawingBufferHeight,
      0.1,
      100
    );
    camera.position.set(0, 1.65, 0);

    scene.add(new THREE.HemisphereLight(0xf8fafc, 0x1c2333, 1.15));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(3, 6, 2);
    scene.add(sun);

    const anchor = new THREE.Group();
    anchor.position.set(0, 0, -CHEST_AR_DISTANCE);
    scene.add(anchor);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 8),
      new THREE.MeshStandardMaterial({ color: 0x2f6b2f, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    anchor.add(ground);

    const chest = buildChest();
    chest.group.position.y = CHEST_BURIED_Y;
    chest.group.scale.setScalar(0.82);
    anchor.add(chest.group);

    const mound = buildGrassMound();
    mound.group.position.y = 0.05;
    mound.group.scale.setScalar(MOUND_SCENE_SCALE);
    anchor.add(mound.group);

    const dynamite = buildDynamite();
    dynamite.visible = false;
    scene.add(dynamite);

    const explosion = buildExplosion();
    explosion.group.position.set(0, 0.35, 0);
    anchor.add(explosion.group);

    let revealProgress = 0;
    let lastTick = Date.now();
    const shouldRender = createFrameLimiter(30);

    const syncAnchorFromSpawn = (rotation: DeviceRotation, referenceAlpha: number) => {
      if (anchorPlacedRef.current) {
        return;
      }
      const spawnPosition = getChestAnchorPosition(rotation, referenceAlpha, CHEST_AR_DISTANCE);
      anchor.position.copy(spawnPosition);
      anchorPositionRef.current = { x: spawnPosition.x, y: spawnPosition.y, z: spawnPosition.z };
      anchorPlacedRef.current = true;
    };

    const setExplosionAtWorld = (wx: number, wy: number, wz: number) => {
      const local = new THREE.Vector3(wx, wy, wz);
      anchor.worldToLocal(local);
      explosion.group.position.copy(local);
    };

    const startExplosion = (
      kind: ExplosionKind,
      wx: number,
      wy: number,
      wz: number,
      startMoundScale = moundScaleRef.current * MOUND_SCENE_SCALE,
      endMoundScale = startMoundScale
    ) => {
      explosionRef.current = {
        active: true,
        elapsed: 0,
        kind,
        worldX: wx,
        worldY: wy,
        worldZ: wz,
        startMoundScale,
        endMoundScale,
      };
      explosion.group.visible = true;
      setExplosionAtWorld(wx, wy, wz);
      const particleScale = kind === 'miss' ? 0.55 : kind === 'partial' ? 0.8 : 1;
      for (const particle of explosion.particles) {
        particle.mesh.position.set(0, 0, 0);
        particle.mesh.material.opacity = 1;
        particle.mesh.scale.setScalar(particleScale);
      }
    };

    const resolveBombImpact = (flight: DynamiteFlight) => {
      dynamite.visible = false;
      dynamiteFlightRef.current = null;

      const anchorPos = anchorPositionRef.current;
      const horizDist = Math.hypot(flight.x - anchorPos.x, flight.z - anchorPos.z);
      const effectiveRadius = MOUND_HIT_RADIUS * moundScaleRef.current;
      const onMound = horizDist < effectiveRadius && flight.y > -0.2 && flight.y < 2.4;

      if (!onMound) {
        startExplosion('miss', flight.x, Math.max(flight.y, 0.02), flight.z);
        setTimeout(() => onBombImpactRef.current('miss', bombHitsRef.current), 0);
        return;
      }

      bombHitsRef.current += 1;
      const hits = bombHitsRef.current;
      const moundY = anchorPos.y + 0.35;

      if (hits >= REQUIRED_BOMB_HITS) {
        startExplosion('final', anchorPos.x, moundY, anchorPos.z, moundScaleRef.current * MOUND_SCENE_SCALE, 0);
        setTimeout(() => onBombImpactRef.current('final', hits), 0);
        return;
      }

      const startScale = moundScaleRef.current * MOUND_SCENE_SCALE;
      moundScaleRef.current = Math.max(0.42, 1 - hits * 0.22);
      const endScale = moundScaleRef.current * MOUND_SCENE_SCALE;
      startExplosion('partial', anchorPos.x, moundY, anchorPos.z, startScale, endScale);
      setTimeout(() => onBombImpactRef.current('partial', hits), 0);
    };

    const renderLoop = () => {
      frameRef.current = requestAnimationFrame(renderLoop);
      if (!appActiveRef.current || !shouldRender()) {
        return;
      }
      const now = Date.now();
      const dt = Math.min((now - lastTick) / 1000, 0.1);
      lastTick = now;
      recordFrame('ar-chest');

      const deviceRotation = deviceRotationRef.current;
      if (deviceRotation) {
        if (referenceAlphaRef.current === null) {
          referenceAlphaRef.current = deviceRotation.alpha;
        }
        syncAnchorFromSpawn(deviceRotation, referenceAlphaRef.current);
        applyDeviceOrientationToCamera(camera, deviceRotation, referenceAlphaRef.current);
      } else {
        camera.position.set(0, 1.65, 0);
        camera.lookAt(anchorPositionRef.current.x, 0.25, anchorPositionRef.current.z);
      }

      const forward = getCameraForward(camera);
      cameraForwardRef.current = { x: forward.x, y: forward.y, z: forward.z };

      const flight = dynamiteFlightRef.current;
      if (flight?.active) {
        dynamite.visible = true;
        flight.vy += GRAVITY * dt;
        flight.x += flight.vx * dt;
        flight.y += flight.vy * dt;
        flight.z += flight.vz * dt;
        dynamite.position.set(flight.x, flight.y, flight.z);
        dynamite.rotation.x += dt * 9;
        dynamite.rotation.y += dt * 5;

        const anchorPos = anchorPositionRef.current;
        const horizDist = Math.hypot(flight.x - anchorPos.x, flight.z - anchorPos.z);
        const relX = flight.x - anchorPos.x;
        const relZ = flight.z - anchorPos.z;
        const passedTarget =
          horizDist > MOUND_HIT_RADIUS * moundScaleRef.current &&
          flight.vx * relX + flight.vz * relZ > 0;
        const groundHit = flight.y < 0.02;
        const nearMound = horizDist < MOUND_HIT_RADIUS * moundScaleRef.current * 1.2;
        if (groundHit || passedTarget || nearMound) {
          flight.active = false;
          resolveBombImpact(flight);
        }
      }

      const burst = explosionRef.current;
      if (burst.active) {
        burst.elapsed += dt;
        const t = burst.elapsed;
        const duration = burst.kind === 'miss' ? 0.45 : burst.kind === 'partial' ? 0.75 : 1.1;
        const particleDrag = burst.kind === 'miss' ? 3.5 : 5;
        const particleFade = Math.max(0, 1 - t / duration);

        for (const particle of explosion.particles) {
          const speedScale = burst.kind === 'miss' ? 0.55 : burst.kind === 'partial' ? 0.75 : 1;
          particle.mesh.position.x += particle.vx * dt * speedScale;
          particle.mesh.position.y += particle.vy * dt * speedScale;
          particle.mesh.position.z += particle.vz * dt * speedScale;
          particle.vy -= particleDrag * dt;
          particle.mesh.material.opacity = particleFade;
          particle.mesh.scale.setScalar(
            (burst.kind === 'miss' ? 0.55 : 1) + t * (burst.kind === 'miss' ? 0.4 : 0.8)
          );
        }

        if (burst.kind === 'partial') {
          const progress = Math.min(1, t / duration);
          const scale =
            burst.startMoundScale + (burst.endMoundScale - burst.startMoundScale) * progress;
          mound.group.scale.setScalar(scale);
          mound.group.position.y = 0.05 - progress * 0.1;
          if (t > duration) {
            burst.active = false;
            explosion.group.visible = false;
            mound.group.scale.setScalar(burst.endMoundScale);
            mound.group.position.y = 0.05 - 0.1;
            setTimeout(() => checkBombsDepletedRef.current(), 0);
          }
        } else if (burst.kind === 'final') {
          const grassScale = Math.max(0, burst.startMoundScale * (1 - t * 2.2));
          mound.group.scale.setScalar(grassScale);
          mound.group.position.y = 0.05 + t * 0.4;

          revealProgress = Math.min(1, t / 0.9);
          chest.group.position.y = CHEST_BURIED_Y + (CHEST_REVEALED_Y - CHEST_BURIED_Y) * revealProgress;

          if (t > 1.05) {
            burst.active = false;
            explosion.group.visible = false;
            mound.group.visible = false;
            setTimeout(() => onChestUnburiedRef.current(), 0);
          }
        } else if (t > duration) {
          burst.active = false;
          explosion.group.visible = false;
          setTimeout(() => checkBombsDepletedRef.current(), 0);
        }
      }

      if (chestRevealedRef.current) {
        chest.group.rotation.y = Math.sin(now / 900) * 0.08;
      }

      const targetLid = chestOpenRef.current ? -1.7 : 0;
      chest.lid.rotation.x += (targetLid - chest.lid.rotation.x) * 0.06;

      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    renderLoop();
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionCard}>
        <Text style={styles.permissionTitle}>{t('ar.permission.title')}</Text>
        <Text style={styles.permissionText}>{t('ar.permission.body')}</Text>
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>{t('ar.permission.button')}</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === 'access_code') {
    return (
      <View style={[styles.wrapper, fullScreen && styles.wrapperFullScreen, styles.codeGate]}>
        <View style={styles.codeGateCard}>
          <Text style={styles.kicker}>{t('ar.accessCode.kicker')}</Text>
          <Text style={styles.title}>{t('ar.accessCode.title')}</Text>
          <Text style={styles.text}>{clue}</Text>
          <TextInput
            style={styles.codeInput}
            placeholder={t('ar.accessCode.placeholder')}
            placeholderTextColor={colors.textFaint}
            value={codeInput}
            onChangeText={(value) => {
              setCodeInput(value);
              setCodeError('');
            }}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleUnlockCode}
          />
          {codeError ? <Text style={styles.codeError}>{codeError}</Text> : null}
          <Pressable
            style={[styles.button, !codeInput.trim() && styles.buttonDisabled]}
            onPress={handleUnlockCode}
            disabled={!codeInput.trim()}
          >
            <Text style={styles.buttonText}>{t('ar.accessCode.unlock')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const helperText =
    validationMessage ||
    (phase === 'qr_display'
      ? t('ar.helperTapScan')
      : phase === 'qr_scanning'
        ? t('ar.helperScanning')
        : isArChestActive && phase === 'active' && !isWithinRange
          ? t('ar.helperGetCloserChest', { radius: radiusMeters })
          : isArChestActive && phase === 'active' && chestRevealed
            ? t('ar.helperChestRevealed')
            : isArChestActive && phase === 'active' && isWithinRange && bombHits > 0 && !chestRevealed
              ? t('ar.helperBombProgress', { hits: bombHits, required: REQUIRED_BOMB_HITS })
              : isArChestActive && phase === 'active' && isWithinRange && bombsFailed
                ? t('ar.messages.bombsExhausted')
              : isArChestActive && phase === 'active' && isWithinRange
                ? t('ar.helperBuriedChest', { required: REQUIRED_BOMB_HITS, bombs: bombsRemaining })
              : phase === 'active' && isWithinRange
                ? t('ar.helperNear')
                : showQrMode
                  ? t('ar.helperScanPhysicalQr')
                  : t('ar.helperDefault'));

  const scanLineTranslate = scanLine.interpolate({ inputRange: [0, 1], outputRange: [-90, 90] });
  const revealSecret = qrRevealContent?.trim() || scannedPayload || qrPayload?.trim() || '';

  return (
    <View style={[styles.wrapper, fullScreen && styles.wrapperFullScreen]}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={phase === 'qr_scanning' ? handleBarcodeScanned : undefined}
      />

      {showQrMode && phase === 'qr_display' ? (
        <View pointerEvents="box-none" style={styles.qrAnchor}>
          <Animated.View style={[styles.qrPanelWrap, { transform: [{ scale: qrPulse }] }]}>
            <View style={styles.holoTag}>
              <View style={styles.holoTagInner}>
                <Ionicons name="qr-code" size={72} color={colors.gold} />
                <Text style={styles.holoTagLabel}>{t('ar.qrOverlay.label')}</Text>
              </View>
              <View style={styles.qrLockVeil}>
                <Ionicons name="lock-closed" size={28} color={colors.gold} />
                <Text style={styles.qrLockText}>{t('ar.qrOverlay.locked')}</Text>
                <Text style={styles.qrLockHint}>{t('ar.qrOverlay.physicalHint')}</Text>
              </View>
            </View>
          </Animated.View>
        </View>
      ) : null}

      {showQrMode && phase === 'qr_scanning' ? (
        <View style={styles.scanFrame} pointerEvents="none">
          <View style={[styles.scanCorner, styles.scanCornerTL]} />
          <View style={[styles.scanCorner, styles.scanCornerTR]} />
          <View style={[styles.scanCorner, styles.scanCornerBL]} />
          <View style={[styles.scanCorner, styles.scanCornerBR]} />
          <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanLineTranslate }] }]} />
        </View>
      ) : null}

      {showArScene ? (
        <View pointerEvents="box-none" style={styles.arScene} {...throwPanResponder.panHandlers}>
          <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
          {!chestRevealed ? (
            <View pointerEvents="none" style={styles.throwHint}>
              <Text style={styles.throwHintText}>
                {bombHits > 0
                  ? `💣 ${bombHits}/${REQUIRED_BOMB_HITS} · ${bombsRemaining} left`
                  : `💣 ↑ · ${bombsRemaining} left`}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {phase === 'qr_revealed' && (
        <ArSecretReveal secret={revealSecret} onContinue={handleQrRevealContinue} />
      )}

      <View style={styles.overlay} pointerEvents="box-none">
        {isLiveBlocked && (
          <View style={styles.liveBanner}>
            <Text style={styles.liveBannerText}>
              {liveOverride?.huntPaused
                ? t('ar.live.pausedByOrganizer', { scope: t('ar.live.huntPaused') })
                : t('ar.live.pausedByOrganizer', { scope: t('ar.live.stepPaused') })}
            </Text>
          </View>
        )}
        {liveOverride?.redirect && !isLiveBlocked && (
          <View style={[styles.liveBanner, styles.redirectBanner]}>
            <Text style={styles.redirectBannerText}>
              {t('ar.live.redirect', {
                note: liveOverride.redirect.note ? ` — ${liveOverride.redirect.note}` : '',
              })}
            </Text>
          </View>
        )}

        {phase !== 'qr_revealed' && (
          <>
            <Text style={styles.kicker}>{showQrMode ? t('ar.qrOverlay.kicker') : t('ar.kicker')}</Text>
            <Text style={styles.title}>{showQrMode ? t('ar.qrOverlay.title') : t('ar.title')}</Text>
            {phase !== 'qr_scanning' && <Text style={styles.text}>{clue}</Text>}

            {(photoClueUri || audioHintUri) && phase === 'active' && (
              <View style={styles.cluesRow}>
                {photoClueUri &&
                  (isPhotoClueUnlocked ? (
                    <StoredImage storedUrl={photoClueUri} style={styles.photoClue} />
                  ) : (
                    <View style={styles.photoClueLocked}>
                      <Text style={styles.photoClueLockedIcon}>🔒</Text>
                      <Text style={styles.photoClueLockedText}>
                        {t('ar.clues.photoLocked', { meters: PHOTO_CLUE_RADIUS_METERS })}
                      </Text>
                    </View>
                  ))}
                {audioHintUri && (
                  <Pressable style={styles.audioButton} onPress={playAudioHint}>
                    <Text style={styles.audioButtonText}>{t('ar.clues.audioButton')}</Text>
                  </Pressable>
                )}
              </View>
            )}

            <Text style={styles.statusText}>
              {!locationPermissionGranted
                ? t('ar.status.geoUnavailable')
                : !hasReliableLocation
                  ? t('ar.status.acquiringGps')
                  : t('ar.status.distance', { distance: distanceLabel })}
            </Text>
            <Text style={styles.helperText}>{helperText}</Text>

            {showQrMode && phase === 'qr_display' && !isLiveBlocked && (
              <Pressable style={styles.scanButton} onPress={() => setPhase('qr_scanning')}>
                <Ionicons name="qr-code-outline" size={18} color={colors.background} />
                <Text style={styles.scanButtonText}>{t('ar.qrScan.button')}</Text>
              </Pressable>
            )}

            {showQrMode && phase === 'qr_scanning' && (
              <Pressable style={styles.cancelScanButton} onPress={() => setPhase('qr_display')}>
                <Text style={styles.cancelScanButtonText}>{t('ar.qrScan.cancel')}</Text>
              </Pressable>
            )}

            {hasLaunched && (
              <Text style={styles.validatedText}>{t('ar.validateButton.validated')}</Text>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { height: 460, borderRadius: radii.xl, overflow: 'hidden', backgroundColor: colors.background, borderColor: colors.glassBorder, borderWidth: 1 },
  wrapperFullScreen: { flex: 1, height: undefined, borderRadius: 0, borderWidth: 0 },
  codeGate: { justifyContent: 'center', padding: 20, backgroundColor: colors.background },
  codeGateCard: { ...glassCard, padding: 22 },
  codeInput: {
    marginTop: 16,
    backgroundColor: colors.glassStrong,
    borderColor: colors.glassBorderStrong,
    borderWidth: 1,
    borderRadius: radii.md,
    color: colors.foreground,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    letterSpacing: 2,
    textAlign: 'center',
  },
  codeError: { color: colors.danger, marginTop: 10, fontWeight: '700', textAlign: 'center' },
  arScene: { ...StyleSheet.absoluteFillObject },
  throwHint: {
    position: 'absolute',
    bottom: 160,
    alignSelf: 'center',
    backgroundColor: 'rgba(11,15,26,0.55)',
    borderColor: colors.gold,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  throwHintText: { color: colors.gold, fontWeight: '900', fontSize: 14, letterSpacing: 1 },
  qrAnchor: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingBottom: 120 },
  qrPanelWrap: { alignItems: 'center' },
  holoTag: {
    width: 220,
    height: 220,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(11,15,26,0.55)',
    borderColor: colors.gold,
    borderWidth: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  holoTagInner: { alignItems: 'center', gap: 8 },
  holoTagLabel: { color: colors.gold, fontWeight: '900', fontSize: 11, letterSpacing: 0.8 },
  qrLockVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11,15,26,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    paddingHorizontal: 16,
  },
  qrLockText: { color: colors.gold, fontWeight: '900', fontSize: 12, marginTop: 8, letterSpacing: 0.6 },
  qrLockHint: { color: colors.textMuted, fontWeight: '700', fontSize: 10, marginTop: 6, textAlign: 'center', lineHeight: 14 },
  scanFrame: {
    position: 'absolute',
    top: '28%',
    alignSelf: 'center',
    width: 240,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanCorner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: colors.teal,
  },
  scanCornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  scanCornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  scanCornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  scanCornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  scanLine: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: 2,
    backgroundColor: colors.teal,
    shadowColor: colors.teal,
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  overlay: { flex: 1, justifyContent: 'flex-end', padding: 18, backgroundColor: 'rgba(11,15,26,0.35)' },
  kicker: { color: colors.gold, fontWeight: '900', fontSize: 12, letterSpacing: 1.2 },
  title: { color: colors.foreground, fontWeight: '900', fontSize: 24, marginTop: 6 },
  text: { color: colors.foreground, marginTop: 10, lineHeight: 21 },
  statusText: { color: colors.teal, marginTop: 8, fontWeight: '700' },
  helperText: { color: colors.textMuted, marginTop: 10, lineHeight: 20 },
  validatedText: { color: colors.teal, marginTop: 12, fontWeight: '900' },
  button: { marginTop: 16, alignSelf: 'stretch', backgroundColor: colors.gold, paddingHorizontal: 16, paddingVertical: 14, borderRadius: radii.md, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.background, fontWeight: '900' },
  scanButton: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.gold,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: radii.pill,
    alignSelf: 'center',
  },
  scanButtonText: { color: colors.background, fontWeight: '900', fontSize: 14 },
  cancelScanButton: {
    marginTop: 12,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  cancelScanButtonText: { color: colors.foreground, fontWeight: '800', fontSize: 13 },
  liveBanner: { backgroundColor: 'rgba(248,113,113,0.16)', borderColor: colors.danger, borderWidth: 1, borderRadius: radii.md, padding: 10, marginBottom: 10 },
  liveBannerText: { color: colors.danger, fontWeight: '900', fontSize: 12 },
  redirectBanner: { backgroundColor: colors.tealSoft, borderColor: colors.teal },
  redirectBannerText: { color: colors.teal, fontWeight: '800', fontSize: 12 },
  cluesRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  photoClue: { width: 86, height: 86, borderRadius: radii.md, borderColor: colors.gold, borderWidth: 1 },
  photoClueLocked: { width: 130, height: 86, borderRadius: radii.md, borderColor: colors.glassBorderStrong, borderWidth: 1, backgroundColor: colors.glass, alignItems: 'center', justifyContent: 'center', padding: 8 },
  photoClueLockedIcon: { fontSize: 18 },
  photoClueLockedText: { color: colors.textMuted, fontSize: 9, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  audioButton: { backgroundColor: colors.tealSoft, borderColor: colors.teal, borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: 14, paddingVertical: 9 },
  audioButtonText: { color: colors.teal, fontWeight: '900', fontSize: 12 },
  permissionCard: { ...glassCard, padding: 18 },
  permissionTitle: { fontSize: 18, fontWeight: '900', color: colors.foreground },
  permissionText: { color: colors.textMuted, marginTop: 8, lineHeight: 21 },
  center: { height: 280, alignItems: 'center', justifyContent: 'center' },
});
