import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
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
  onComplete?: () => void;
};

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
export function ARExperience({ clue, targetLocation, radiusMeters, qrPayload, fullScreen = false, onComplete }: ARExperienceProps) {
  const { demoMode } = useDemo();
  const [permission, requestPermission] = useCameraPermissions();
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [hasLaunched, setHasLaunched] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');

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
    return Math.round(haversineDistanceMeters(currentLocation, targetLocation));
  }, [currentLocation, targetLocation]);

  const isWithinRange = distanceMeters !== null && distanceMeters <= radiusMeters;
  const isReadyToValidate = demoMode || isWithinRange;

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
    if (!isReadyToValidate) {
      setValidationMessage('Tu dois être à proximité du point (ou scanner son QR code) avant de valider.');
      return;
    }
    completeStep('Étape validée — le coffre est à toi !');
  };

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    if (hasLaunched) {
      return;
    }
    const expected = qrPayload ?? null;
    const matches = expected ? result.data === expected : result.data.startsWith('lootopia:');
    if (matches) {
      completeStep('QR code reconnu — étape validée !');
    } else {
      setValidationMessage('QR code inconnu pour cette étape.');
    }
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
        <Text style={styles.kicker}>AR EXPERIENCE</Text>
        <Text style={styles.title}>Indice en réalité augmentée</Text>
        <Text style={styles.text}>{clue}</Text>
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
  permissionCard: { ...glassCard, padding: 18 },
  permissionTitle: { fontSize: 18, fontWeight: '900', color: colors.foreground },
  permissionText: { color: colors.textMuted, marginTop: 8, lineHeight: 21 },
  center: { height: 280, alignItems: 'center', justifyContent: 'center' },
});
