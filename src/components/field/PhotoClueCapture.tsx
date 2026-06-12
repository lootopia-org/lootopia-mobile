import React, { useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { formatDistance, haversineDistanceMeters, type GeoPoint } from '@/src/lib/geo';
import { colors, radii } from '@/src/theme';

/**
 * "Photo secrète" d'une étape de brouillon Terrain : capture autorisée
 * uniquement à ≤ 15 m du point de l'étape (le partenaire photographie
 * l'indice exactement là où le joueur devra le trouver).
 */

const MAX_CAPTURE_DISTANCE_METERS = 15;

type Props = {
  stepLocation: GeoPoint;
  photoClueUri?: string;
  onCaptured: (uri: string) => void;
};

export function PhotoClueCapture({ stepLocation, photoClueUri, onCaptured }: Props) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [checking, setChecking] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCamera = async () => {
    setError(null);
    setChecking(true);
    try {
      if (!permission?.granted) {
        const cameraResult = await requestPermission();
        if (!cameraResult.granted) {
          setError('Permission caméra refusée.');
          return;
        }
      }
      const locationResult = await Location.requestForegroundPermissionsAsync();
      if (!locationResult.granted) {
        setError('Permission localisation refusée.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const distance = haversineDistanceMeters(
        { latitude: position.coords.latitude, longitude: position.coords.longitude },
        stepLocation
      );
      if (distance > MAX_CAPTURE_DISTANCE_METERS) {
        setError(`Approche-toi à moins de 15 m du point (tu es à ${formatDistance(distance)}).`);
        return;
      }
      setCameraOpen(true);
    } catch {
      setError('Position GPS indisponible — réessaie en extérieur.');
    } finally {
      setChecking(false);
    }
  };

  const capture = async () => {
    if (capturing) {
      return;
    }
    setCapturing(true);
    try {
      const photo = await cameraRef.current?.takePictureAsync();
      if (photo?.uri) {
        onCaptured(photo.uri);
      }
      setCameraOpen(false);
    } catch {
      setError('Échec de la capture, réessaie.');
      setCameraOpen(false);
    } finally {
      setCapturing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Pressable style={styles.button} onPress={openCamera} disabled={checking}>
          {checking ? (
            <ActivityIndicator size="small" color={colors.teal} />
          ) : (
            <Text style={styles.buttonText}>
              📷 {photoClueUri ? 'Reprendre la photo secrète' : 'Photo secrète'}
            </Text>
          )}
        </Pressable>
        {photoClueUri ? <Image source={{ uri: photoClueUri }} style={styles.thumbnail} /> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal visible={cameraOpen} animationType="slide" onRequestClose={() => setCameraOpen(false)}>
        <View style={styles.modal}>
          <CameraView ref={cameraRef} style={styles.camera} facing="back" />
          <View style={styles.controls}>
            <Pressable style={styles.cancelButton} onPress={() => setCameraOpen(false)}>
              <Text style={styles.cancelText}>Annuler</Text>
            </Pressable>
            <Pressable style={styles.shutter} onPress={capture} disabled={capturing}>
              {capturing ? <ActivityIndicator color={colors.background} /> : <View style={styles.shutterInner} />}
            </Pressable>
            <View style={styles.controlsSpacer} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  button: {
    borderColor: colors.glassBorderStrong,
    borderWidth: 1,
    borderRadius: radii.pill,
    backgroundColor: colors.tealSoft,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  buttonText: { color: colors.teal, fontWeight: '800', fontSize: 12 },
  thumbnail: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.glassBorderStrong,
  },
  error: { color: colors.danger, fontSize: 11, marginTop: 6 },
  modal: { flex: 1, backgroundColor: colors.background },
  camera: { flex: 1 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 18,
    backgroundColor: colors.background,
  },
  cancelButton: { width: 80 },
  cancelText: { color: colors.textMuted, fontWeight: '800', fontSize: 14 },
  controlsSpacer: { width: 80 },
  shutter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 3,
    borderColor: colors.background,
  },
});
