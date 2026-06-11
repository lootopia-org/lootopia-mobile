import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useDemo } from '@/src/state/DemoContext';
import { colors, glassCard, radii } from '@/src/theme';

type ARExperienceProps = {
  clue: string;
  targetLocation: {
    latitude: number;
    longitude: number;
  };
  radiusMeters: number;
  onComplete?: () => void;
};

const haversineDistanceMeters = (
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
) => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);

  const aValue = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  const c = 2 * Math.atan2(Math.sqrt(aValue), Math.sqrt(1 - aValue));

  return earthRadius * c;
};

export function ARExperience({ clue, targetLocation, radiusMeters, onComplete }: ARExperienceProps) {
  const { demoMode } = useDemo();
  const [permission, requestPermission] = useCameraPermissions();
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [hasLaunched, setHasLaunched] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');

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

  const distanceMeters = useMemo(() => {
    if (!currentLocation) {
      return null;
    }

    return Math.round(haversineDistanceMeters(currentLocation, targetLocation));
  }, [currentLocation, targetLocation]);

  const isWithinRange = distanceMeters !== null && distanceMeters <= radiusMeters;
  const isReadyToValidate = demoMode || isWithinRange;

  const handleValidate = () => {
    if (!isReadyToValidate) {
      setValidationMessage('Tu dois être à proximité du point avant de valider.');
      return;
    }

    setHasLaunched(true);
    setValidationMessage('Étape validée.');
    onComplete?.();
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
    <View style={styles.wrapper}>
      <CameraView style={StyleSheet.absoluteFill} facing="back" />
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
        <Text style={styles.helperText}>{validationMessage || 'Approche-toi du point pour valider l’étape.'}</Text>
        <Pressable style={[styles.button, !isReadyToValidate && styles.buttonDisabled]} onPress={handleValidate}>
          <Text style={styles.buttonText}>{hasLaunched ? 'Étape validée' : isReadyToValidate ? 'Valider l’étape' : 'Validation bloquée'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { height: 420, borderRadius: radii.xl, overflow: 'hidden', backgroundColor: colors.background, borderColor: colors.glassBorder, borderWidth: 1 },
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