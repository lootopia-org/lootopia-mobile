import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { uploadStepImage } from '@/src/lib/upload-api';
import { colors, glassCard, radii } from '@/src/theme';

type Props = {
  description: string;
  onSubmit: (photoUrl: string) => Promise<void>;
};

export function StepPhotoCapture({ description, onSubmit }: Props) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const openCamera = async () => {
    if (done) {
      return;
    }
    setError(null);
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setError('Permission caméra refusée.');
        return;
      }
    }
    setCameraOpen(true);
  };

  const takePhoto = async () => {
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.85 });
      if (photo?.uri) {
        setPreviewUri(photo.uri);
        setCameraOpen(false);
      }
    } catch {
      setError('Capture échouée');
      setCameraOpen(false);
    }
  };

  const submit = async () => {
    if (!previewUri || submitting || done) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const url = await uploadStepImage(previewUri);
      await onSubmit(url);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Photo non reconnue');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.description}>{description}</Text>
      {previewUri ? <Image source={{ uri: previewUri }} style={styles.preview} /> : null}
      {!done && (
        <Pressable style={styles.button} onPress={() => void openCamera()} disabled={submitting}>
          <Text style={styles.buttonText}>{previewUri ? 'Reprendre' : 'Prendre une photo'}</Text>
        </Pressable>
      )}
      {previewUri && !done ? (
        <Pressable style={[styles.button, styles.submitButton]} onPress={() => void submit()} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color={colors.background} size="small" />
          ) : (
            <Text style={styles.buttonText}>Envoyer</Text>
          )}
        </Pressable>
      ) : null}
      {done ? <Text style={styles.success}>Étape validée ✓</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal visible={cameraOpen} animationType="slide">
        <View style={styles.modal}>
          <CameraView ref={cameraRef} style={styles.camera} />
          <View style={styles.modalActions}>
            <Pressable style={styles.modalButton} onPress={() => setCameraOpen(false)}>
              <Text style={styles.modalButtonText}>Annuler</Text>
            </Pressable>
            <Pressable style={[styles.modalButton, styles.modalButtonPrimary]} onPress={() => void takePhoto()}>
              <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>Capturer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  description: { color: colors.foreground, fontSize: 16, lineHeight: 24, marginBottom: 20 },
  preview: { width: '100%', height: 200, borderRadius: radii.lg, marginBottom: 16 },
  button: {
    backgroundColor: colors.teal,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  submitButton: { backgroundColor: colors.gold },
  buttonText: { color: colors.background, fontWeight: '900', fontSize: 14 },
  success: { color: colors.success, fontWeight: '900', textAlign: 'center', marginTop: 12 },
  error: { color: colors.danger, marginTop: 12, fontWeight: '700', textAlign: 'center' },
  modal: { flex: 1, backgroundColor: colors.background },
  camera: { flex: 1 },
  modalActions: { flexDirection: 'row', gap: 12, padding: 16 },
  modalButton: {
    flex: 1,
    ...glassCard,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalButtonPrimary: { backgroundColor: colors.gold, borderColor: colors.gold },
  modalButtonText: { color: colors.foreground, fontWeight: '800' },
  modalButtonTextPrimary: { color: colors.background },
});
