import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useAudioPlayer } from 'expo-audio';
import * as Location from 'expo-location';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { useDemo } from '@/src/state/DemoContext';
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
  // Contenu attendu d'un QR code physique validant l'étape (alternative au GPS).
  qrPayload?: string;
  // Occupe tout l'écran (vue AR immersive) au lieu d'une carte de 460 px.
  fullScreen?: boolean;
  // Indice photo capturé sur site : révélé uniquement à moins de 15 m.
  photoClueUri?: string;
  // Indice audio enregistré sur site par l'organisateur.
  audioHintUri?: string;
  // Overrides live de l'organisateur (Emergency Pause / Redirect).
  liveOverride?: {
    huntPaused?: boolean;
    stepPaused?: boolean;
    redirect?: { location: { latitude: number; longitude: number }; note?: string };
  };
  // Combat du gardien avant validation (désactivable pour les tests).
  combatEnabled?: boolean;
  onComplete?: () => void;
};

const PHOTO_CLUE_RADIUS_METERS = 15;

/**
 * Expérience AR-lite (phase "fonctionnalités avancées") :
 * - flux caméra plein cadre
 * - coffre au trésor 3D (three.js sur GLView transparent) superposé au flux,
 *   qui s'ouvre à la validation de l'étape
 * - validation par proximité GPS (rayon de l'étape) OU scan d'un QR code
 *   correspondant à `qrPayload` (utile en intérieur)
 * Le vrai ancrage ARKit/ARCore (ViroReact + dev build) remplacera la
 * superposition fixe sans changer cette interface.
 */
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
  const { demoMode } = useDemo();
  const [permission, requestPermission] = useCameraPermissions();
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [hasLaunched, setHasLaunched] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const [showCombat, setShowCombat] = useState(false);
  const audioPlayer = useAudioPlayer(audioHintUri ?? null);

  // Redirection live : la cible effective remplace celle d'origine.
  const effectiveTarget = liveOverride?.redirect?.location ?? targetLocation;
  const isLiveBlocked = Boolean(liveOverride?.huntPaused || liveOverride?.stepPaused);

  // Lu par la boucle de rendu GL (pas de re-création de scène sur validation).
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
  const isReadyToValidate = (demoMode || isWithinRange) && !isLiveBlocked;
  // "Photo secrecy" : l'indice photo n'est révélé qu'à moins de 15 m du point.
  const isPhotoClueUnlocked = demoMode || (distanceMeters !== null && distanceMeters <= PHOTO_CLUE_RADIUS_METERS);

  const completeStep = (message: string) => {
    if (hasLaunched) {
      return;
    }
    chestOpenRef.current = true;
    setHasLaunched(true);
    setValidationMessage(message);
    onComplete?.();
  };

  const handleValidate = () => {
    if (isLiveBlocked) {
      setValidationMessage('⛔ Étape suspendue par l’organisateur — réessaie plus tard.');
      return;
    }
    if (!isReadyToValidate) {
      setValidationMessage('Tu dois être à proximité du point (ou scanner son QR code) avant de valider.');
      return;
    }
    if (combatEnabled && !hasLaunched) {
      // Un gardien protège le coffre : duel de timing avant la validation.
      setShowCombat(true);
      return;
    }
    completeStep('Étape validée — le coffre est à toi !');
  };

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    if (hasLaunched || showCombat) {
      return;
    }
    if (isLiveBlocked) {
      setValidationMessage('⛔ Étape suspendue par l’organisateur — réessaie plus tard.');
      return;
    }
    const expected = qrPayload ?? null;
    const matches = expected ? result.data === expected : result.data.startsWith('lootopia:');
    if (matches) {
      if (combatEnabled) {
        setValidationMessage('QR code reconnu — mais un gardien protège le coffre !');
        setShowCombat(true);
      } else {
        completeStep('QR code reconnu — étape validée !');
      }
    } else {
      setValidationMessage('QR code inconnu pour cette étape.');
    }
  };

  const handleCombatWon = () => {
    setShowCombat(false);
    completeStep('Gardien vaincu — étape validée, le coffre est à toi !');
  };

  const playAudioHint = () => {
    audioPlayer.seekTo(0);
    audioPlayer.play();
  };

  // Scène three.js : coffre au trésor sur fond transparent, couvercle animé.
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

    // 30 fps max + pause complète en arrière-plan (caméra + GL = gros poste batterie).
    let t = 0;
    let lastTick = Date.now();
    const shouldRender = createFrameLimiter(30);

    const renderLoop = () => {
      frameRef.current = requestAnimationFrame(renderLoop);
      if (!appActiveRef.current || !shouldRender()) {
        return;
      }
      const now = Date.now();
      t += Math.min((now - lastTick) / 1000, 0.1);
      lastTick = now;
      recordFrame('ar-chest');

      // Présentation : lente rotation + flottement.
      chest.group.rotation.y = Math.sin(t * 0.6) * 0.5;
      chest.group.position.y = Math.sin(t * 1.4) * 0.05;

      // Ouverture progressive du couvercle à la validation.
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
        <Text style={styles.permissionTitle}>AR mobile</Text>
        <Text style={styles.permissionText}>Autorise la caméra pour activer l’expérience AR de la chasse.</Text>
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Autoriser la caméra</Text>
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

      {/* Coffre 3D superposé au flux caméra (fond GL transparent). */}
      <View pointerEvents="none" style={styles.chestAnchor}>
        <GLView style={styles.chestCanvas} onContextCreate={onContextCreate} />
      </View>

      <View style={styles.overlay}>
        {isLiveBlocked && (
          <View style={styles.liveBanner}>
            <Text style={styles.liveBannerText}>
              ⛔ {liveOverride?.huntPaused ? 'Chasse suspendue' : 'Étape suspendue'} par l’organisateur
            </Text>
          </View>
        )}
        {liveOverride?.redirect && !isLiveBlocked && (
          <View style={[styles.liveBanner, styles.redirectBanner]}>
            <Text style={styles.redirectBannerText}>
              📍 Étape déplacée par l’organisateur{liveOverride.redirect.note ? ` — ${liveOverride.redirect.note}` : ''}
            </Text>
          </View>
        )}
        <Text style={styles.kicker}>AR EXPERIENCE</Text>
        <Text style={styles.title}>Indice en réalité augmentée</Text>
        <Text style={styles.text}>{clue}</Text>

        {(photoClueUri || audioHintUri) && (
          <View style={styles.cluesRow}>
            {photoClueUri &&
              (isPhotoClueUnlocked ? (
                <Image source={{ uri: photoClueUri }} style={styles.photoClue} />
              ) : (
                <View style={styles.photoClueLocked}>
                  <Text style={styles.photoClueLockedIcon}>🔒</Text>
                  <Text style={styles.photoClueLockedText}>Indice photo à moins de {PHOTO_CLUE_RADIUS_METERS} m</Text>
                </View>
              ))}
            {audioHintUri && (
              <Pressable style={styles.audioButton} onPress={playAudioHint}>
                <Text style={styles.audioButtonText}>🔊 Indice audio</Text>
              </Pressable>
            )}
          </View>
        )}
        <Text style={styles.statusText}>
          {demoMode
            ? '🧪 Mode démo — validation autorisée partout'
            : locationPermissionGranted
              ? `Position: ${distanceMeters ?? '?'} m du point`
              : 'Géolocalisation indisponible'}
        </Text>
        <Text style={styles.helperText}>
          {validationMessage || 'Approche-toi du point — ou scanne le QR code de l’étape avec la caméra.'}
        </Text>
        <Pressable style={[styles.button, !isReadyToValidate && !hasLaunched && styles.buttonDisabled]} onPress={handleValidate}>
          <Text style={styles.buttonText}>
            {hasLaunched ? 'Étape validée ✓' : isReadyToValidate ? 'Valider l’étape' : 'Validation bloquée'}
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
