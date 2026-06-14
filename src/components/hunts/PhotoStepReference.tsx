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
import { colors, radii } from '@/src/theme';

type Props = {
  answer?: string;
  onAnswerChange: (url: string) => void;
};

export function PhotoStepReference({ answer, onAnswerChange }: Props) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCamera = async () => {
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

  const captureAndUpload = async () => {
    if (uploading) {
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.85 });
      if (!photo?.uri) {
        throw new Error('Capture échouée');
      }
      const url = await uploadStepImage(photo.uri);
      onAnswerChange(url);
      setCameraOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload échoué');
      setCameraOpen(false);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.wrap}>
      {answer ? (
        <Image source={{ uri: answer }} style={styles.preview} />
      ) : (
        <Text style={styles.hint}>Photo de référence requise</Text>
      )}
      <Pressable style={styles.button} onPress={() => void openCamera()} disabled={uploading}>
        {uploading ? (
          <ActivityIndicator color={colors.background} size="small" />
        ) : (
          <Text style={styles.buttonText}>{answer ? 'Reprendre' : 'Capturer'}</Text>
        )}
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal visible={cameraOpen} animationType="slide">
        <View style={styles.modal}>
          <CameraView ref={cameraRef} style={styles.camera} />
          <View style={styles.modalActions}>
            <Pressable style={styles.modalButton} onPress={() => setCameraOpen(false)}>
              <Text style={styles.modalButtonText}>Annuler</Text>
            </Pressable>
            <Pressable style={[styles.modalButton, styles.modalButtonPrimary]} onPress={() => void captureAndUpload()}>
              <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>Capturer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  preview: { width: '100%', height: 120, borderRadius: radii.md },
  hint: { color: colors.textFaint, fontSize: 12 },
  button: {
    backgroundColor: colors.teal,
    borderRadius: radii.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  buttonText: { color: colors.background, fontWeight: '800', fontSize: 12 },
  error: { color: colors.danger, fontSize: 11 },
  modal: { flex: 1, backgroundColor: colors.background },
  camera: { flex: 1 },
  modalActions: { flexDirection: 'row', gap: 12, padding: 16 },
  modalButton: {
    flex: 1,
    borderColor: colors.glassBorderStrong,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalButtonPrimary: { backgroundColor: colors.gold, borderColor: colors.gold },
  modalButtonText: { color: colors.foreground, fontWeight: '800' },
  modalButtonTextPrimary: { color: colors.background },
});
