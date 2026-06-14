import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { stepPhotoApi } from '@/src/lib/step-photo-api';
import { uploadStepImage } from '@/src/lib/upload-api';
import { useAuth } from '@/src/state/AuthContext';
import { colors, glassCard, radii } from '@/src/theme';

/**
 * Deep link `lootopia://capture/{sessionId}` — le partenaire photographie
 * la référence d'une étape photo depuis son téléphone ; l'image apparaît
 * instantanément dans le wizard web via WebSocket.
 */
export default function CaptureScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { isAuthenticated } = useAuth();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [capturing, setCapturing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ensureCamera = async () => {
    if (permission?.granted) {
      return true;
    }
    const result = await requestPermission();
    return result.granted;
  };

  const takePhoto = async () => {
    if (capturing || uploading) {
      return;
    }
    setError(null);
    const allowed = await ensureCamera();
    if (!allowed) {
      setError('Permission caméra refusée.');
      return;
    }
    setCapturing(true);
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.85 });
      if (photo?.uri) {
        setPreviewUri(photo.uri);
      }
    } catch {
      setError('Échec de la capture, réessaie.');
    } finally {
      setCapturing(false);
    }
  };

  const submitPhoto = async () => {
    if (!sessionId || !previewUri || uploading) {
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const photoUrl = await uploadStepImage(previewUri);
      await stepPhotoApi.submitPhoto(sessionId, photoUrl);
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)/field');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Envoi échoué.';
      if (/forbidden|unauthorized|403|401/i.test(message)) {
        setError('Connecte-toi avec le même compte partenaire que sur le web.');
      } else if (/invalid|expired|404/i.test(message)) {
        setError('Session expirée — relance la capture depuis le wizard web.');
      } else {
        setError(message);
      }
    } finally {
      setUploading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
        <View style={styles.card}>
          <Text style={styles.title}>Connexion requise</Text>
          <Text style={styles.subtitle}>
            Connecte-toi avec ton compte partenaire pour envoyer la photo de référence.
          </Text>
          <Pressable style={styles.primaryButton} onPress={() => router.replace('/(auth)/login')}>
            <Text style={styles.primaryButtonText}>Se connecter</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!sessionId) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
        <View style={styles.card}>
          <Text style={styles.title}>Lien invalide</Text>
          <Text style={styles.subtitle}>Scanne le QR code depuis le wizard web.</Text>
          <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
            <Text style={styles.secondaryButtonText}>Fermer</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fullScreen}>
      {previewUri ? (
        <Image source={{ uri: previewUri }} style={styles.camera} />
      ) : (
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />
      )}

      <View style={[styles.overlay, { paddingBottom: insets.bottom + 16, paddingTop: insets.top + 12 }]}>
        <Text style={styles.overlayTitle}>Photo de référence</Text>
        <Text style={styles.overlayHint}>
          {previewUri
            ? 'Vérifie la photo puis envoie-la au wizard web.'
            : 'Cadre l’indice sur place, puis prends la photo.'}
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.controls}>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => (previewUri ? setPreviewUri(null) : router.back())}
            disabled={uploading}
          >
            <Text style={styles.secondaryButtonText}>{previewUri ? 'Reprendre' : 'Annuler'}</Text>
          </Pressable>

          {previewUri ? (
            <Pressable style={styles.primaryButton} onPress={() => void submitPhoto()} disabled={uploading}>
              {uploading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.primaryButtonText}>Envoyer</Text>
              )}
            </Pressable>
          ) : (
            <Pressable style={styles.shutter} onPress={() => void takePhoto()} disabled={capturing}>
              {capturing ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <View style={styles.shutterInner} />
              )}
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
  },
  fullScreen: { flex: 1, backgroundColor: colors.background },
  camera: { flex: 1 },
  card: { ...glassCard, padding: 24, gap: 12 },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '900' },
  subtitle: { color: colors.textMuted, lineHeight: 20 },
  preview: {
    width: '100%',
    height: 220,
    borderRadius: radii.lg,
    marginTop: 8,
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(11,15,26,0.88)',
    paddingHorizontal: 20,
    gap: 8,
  },
  overlayTitle: { color: colors.foreground, fontSize: 18, fontWeight: '900' },
  overlayHint: { color: colors.textMuted, fontSize: 13 },
  error: { color: colors.danger, fontSize: 12 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: colors.gold,
    borderRadius: radii.pill,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minWidth: 120,
    alignItems: 'center',
  },
  primaryButtonText: { color: colors.background, fontWeight: '900' },
  secondaryButton: {
    borderColor: colors.glassBorderStrong,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryButtonText: { color: colors.textMuted, fontWeight: '800' },
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
