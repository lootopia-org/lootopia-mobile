import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { StoredImage } from '@/src/components/StoredImage';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useAudioPlayer } from 'expo-audio';
import * as Location from 'expo-location';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { colors, glassCard, radii } from '@/src/theme';
import { haversineDistanceMeters } from '@/src/lib/geo';
import { buildChest } from '@/src/components/three/buildCharacter';
import { createFrameLimiter, useAppActiveRef } from '@/src/hooks/useAppActiveRef';
import { recordFrame } from '@/src/lib/perf';
import { CombatModal } from '@/src/components/CombatModal';

type ARExperienceProps = {
  clue: string;
  targetLocation: {
    latitude: number;
    longitude: number;
  };
  radiusMeters: number;
  qrPayload?: string;
  fullScreen?: boolean;
  photoClueUri?: string;
  audioHintUri?: string;
  liveOverride?: {
    huntPaused?: boolean;
    stepPaused?: boolean;
    redirect?: { location: { latitude: number; longitude: number }; note?: string };
  };
  combatEnabled?: boolean;
  onComplete?: (answer?: string) => void;
};

const PHOTO_CLUE_RADIUS_METERS = 15;

export function ARExperience({
  clue,
  targetLocation,
  radiusMeters,
  qrPayload,
  fullScreen = false,
  photoClueUri,
  audioHintUri,
  liveOverride,
  combatEnabled = true,
  onComplete,
}: ARExperienceProps) {
  const { t } = useTranslation('hunts');
  const [permission, requestPermission] = useCameraPermissions();
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [hasLaunched, setHasLaunched] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const [showCombat, setShowCombat] = useState(false);
  const audioPlayer = useAudioPlayer(audioHintUri ?? null);

  const effectiveTarget = liveOverride?.redirect?.location ?? targetLocation;
  const isLiveBlocked = Boolean(liveOverride?.huntPaused || liveOverride?.stepPaused);

  const chestOpenRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const appActiveRef = useAppActiveRef();

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    (async () => {
      const permissionResult = await Location.requestForegroundPermissionsAsync();
      if (!permissionResult.granted) {
        setLocationPermissionGranted(false);
        return;
      }

      setLocationPermissionGranted(true);

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCurrentLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    })();
  }, []);

  useEffect(
    () => () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    },
    []
  );

  const distanceMeters = useMemo(() => {
    if (!currentLocation) {
      return null;
    }
    return Math.round(haversineDistanceMeters(currentLocation, effectiveTarget));
  }, [currentLocation, effectiveTarget]);

  const isWithinRange = distanceMeters !== null && distanceMeters <= radiusMeters;
  const isReadyToValidate = isWithinRange && !isLiveBlocked;
  const isPhotoClueUnlocked = distanceMeters !== null && distanceMeters <= PHOTO_CLUE_RADIUS_METERS;

  const completeStep = (message: string, answer?: string) => {
    if (hasLaunched) {
      return;
    }
    chestOpenRef.current = true;
    setHasLaunched(true);
    setValidationMessage(message);
    onComplete?.(answer);
  };

  const handleValidate = () => {
    if (isLiveBlocked) {
      setValidationMessage(t('ar.messages.stepSuspended'));
      return;
    }
    if (!isReadyToValidate) {
      setValidationMessage(t('ar.messages.tooFar'));
      return;
    }
    if (combatEnabled && !hasLaunched) {
      setShowCombat(true);
      return;
    }
    completeStep(t('ar.messages.validatedChest'));
  };

  const pendingAnswerRef = useRef<string | undefined>(undefined);

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    if (hasLaunched || showCombat) {
      return;
    }
    if (isLiveBlocked) {
      setValidationMessage(t('ar.messages.stepSuspended'));
      return;
    }
    const expected = qrPayload ?? null;
    const matches = expected ? result.data === expected : result.data.startsWith('lootopia:');
    if (matches) {
      pendingAnswerRef.current = result.data;
      if (combatEnabled) {
        setValidationMessage(t('ar.messages.qrRecognizedGuardian'));
        setShowCombat(true);
      } else {
        completeStep(t('ar.messages.qrValidated'), result.data);
      }
    } else {
      setValidationMessage(t('ar.messages.qrUnknown'));
    }
  };

  const handleCombatWon = () => {
    setShowCombat(false);
    completeStep(t('ar.messages.guardianDefeated'), pendingAnswerRef.current);
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
      40,
      gl.drawingBufferWidth / gl.drawingBufferHeight,
      0.1,
      50
    );
    camera.position.set(0, 1.2, 3.2);
    camera.lookAt(0, 0.45, 0);

    scene.add(new THREE.HemisphereLight(0xf8fafc, 0x1c2333, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(2, 4, 3);
    scene.add(sun);

    const chest = buildChest();
    scene.add(chest.group);

    let tick = 0;
    let lastTick = Date.now();
    const shouldRender = createFrameLimiter(30);

    const renderLoop = () => {
      frameRef.current = requestAnimationFrame(renderLoop);
      if (!appActiveRef.current || !shouldRender()) {
        return;
      }
      const now = Date.now();
      tick += Math.min((now - lastTick) / 1000, 0.1);
      lastTick = now;
      recordFrame('ar-chest');

      chest.group.rotation.y = Math.sin(tick * 0.6) * 0.5;
      chest.group.position.y = Math.sin(tick * 1.4) * 0.05;

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

  return (
    <View style={[styles.wrapper, fullScreen && styles.wrapperFullScreen]}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={hasLaunched ? undefined : handleBarcodeScanned}
      />

      <View pointerEvents="none" style={styles.chestAnchor}>
        <GLView style={styles.chestCanvas} onContextCreate={onContextCreate} />
      </View>

      <View style={styles.overlay}>
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
        <Text style={styles.kicker}>{t('ar.kicker')}</Text>
        <Text style={styles.title}>{t('ar.title')}</Text>
        <Text style={styles.text}>{clue}</Text>

        {(photoClueUri || audioHintUri) && (
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
          {locationPermissionGranted
            ? t('ar.status.distance', { distance: distanceMeters ?? '?' })
            : t('ar.status.geoUnavailable')}
        </Text>
        <Text style={styles.helperText}>{validationMessage || t('ar.helperDefault')}</Text>
        <Pressable style={[styles.button, !isReadyToValidate && !hasLaunched && styles.buttonDisabled]} onPress={handleValidate}>
          <Text style={styles.buttonText}>
            {hasLaunched
              ? t('ar.validateButton.validated')
              : isReadyToValidate
                ? t('ar.validateButton.ready')
                : t('ar.validateButton.blocked')}
          </Text>
        </Pressable>
      </View>

      <CombatModal visible={showCombat} onWin={handleCombatWon} onFlee={() => setShowCombat(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { height: 460, borderRadius: radii.xl, overflow: 'hidden', backgroundColor: colors.background, borderColor: colors.glassBorder, borderWidth: 1 },
  wrapperFullScreen: { flex: 1, height: undefined, borderRadius: 0, borderWidth: 0 },
  chestAnchor: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingBottom: 120 },
  chestCanvas: { width: 200, height: 200 },
  overlay: { flex: 1, justifyContent: 'flex-end', padding: 18, backgroundColor: 'rgba(11,15,26,0.35)' },
  kicker: { color: colors.gold, fontWeight: '900', fontSize: 12, letterSpacing: 1.2 },
  title: { color: colors.foreground, fontWeight: '900', fontSize: 24, marginTop: 6 },
  text: { color: colors.foreground, marginTop: 10, lineHeight: 21 },
  statusText: { color: colors.teal, marginTop: 8, fontWeight: '700' },
  helperText: { color: colors.textMuted, marginTop: 10, lineHeight: 20 },
  button: { marginTop: 16, alignSelf: 'flex-start', backgroundColor: colors.gold, paddingHorizontal: 16, paddingVertical: 14, borderRadius: radii.md },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { color: colors.background, fontWeight: '900' },
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
