import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { colors, glassCard, radii } from '@/src/theme';
import { haversineDistanceMeters } from '@/src/lib/geo';
import { buildChest } from '@/src/components/three/buildCharacter';
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
  fullScreen?: boolean;
  photoClueUri?: string;
  audioHintUri?: string;
  liveOverride?: {
    huntPaused?: boolean;
    stepPaused?: boolean;
    redirect?: { location: { latitude: number; longitude: number }; note?: string };
  };
  onComplete?: (answer?: string) => void | Promise<void>;
};

const PHOTO_CLUE_RADIUS_METERS = 15;

type ArPhase = 'access_code' | 'active' | 'qr_display' | 'qr_scanning' | 'qr_revealed' | 'completed';

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
  fullScreen = false,
  photoClueUri,
  audioHintUri,
  liveOverride,
  onComplete,
}: ARExperienceProps) {
  const { t } = useTranslation('hunts');
  const [permission, requestPermission] = useCameraPermissions();
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [validationMessage, setValidationMessage] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState('');
  const [scannedPayload, setScannedPayload] = useState<string | null>(null);

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

  const effectiveTarget = liveOverride?.redirect?.location ?? targetLocation;
  const isLiveBlocked = Boolean(liveOverride?.huntPaused || liveOverride?.stepPaused);
  const chestUnlocked = phase === 'active' || phase === 'completed';
  const hasLaunched = phase === 'completed';

  const chestOpenRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const appActiveRef = useAppActiveRef();
  const proximityCompletedRef = useRef(false);
  const lastScanAtRef = useRef(0);
  const unlockedAnswerRef = useRef<string | undefined>(undefined);

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
    if (!currentLocation) {
      return null;
    }
    return Math.round(haversineDistanceMeters(currentLocation, effectiveTarget));
  }, [currentLocation, effectiveTarget]);

  const isWithinRange = distanceMeters !== null && distanceMeters <= radiusMeters;
  const isPhotoClueUnlocked = distanceMeters !== null && distanceMeters <= PHOTO_CLUE_RADIUS_METERS;
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

  useEffect(() => {
    if (phase !== 'active' || isLiveBlocked) {
      return;
    }
    if (!isWithinRange || proximityCompletedRef.current) {
      return;
    }

    proximityCompletedRef.current = true;
    void completeStep(t('ar.messages.validatedChest'), unlockedAnswerRef.current);
  }, [phase, isLiveBlocked, isWithinRange, t]);

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

      {!showQrMode && chestUnlocked ? (
        <View pointerEvents="none" style={styles.chestAnchor}>
          <GLView style={styles.chestCanvas} onContextCreate={onContextCreate} />
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
              {locationPermissionGranted
                ? t('ar.status.distance', { distance: distanceMeters ?? '?' })
                : t('ar.status.geoUnavailable')}
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
  chestAnchor: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingBottom: 120 },
  chestCanvas: { width: 200, height: 200 },
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
