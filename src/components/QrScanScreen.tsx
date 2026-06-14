import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { ArSecretReveal } from '@/src/components/ar/ArSecretReveal';
import { qrPayloadsMatch } from '@/src/lib/qr-utils';
import { colors, glassStrongCard, radii } from '@/src/theme';

type QrScanScreenProps = {
  title: string;
  description?: string;
  expectedPayload: string;
  onComplete: (payload: string) => void;
  onClose: () => void;
};

export function QrScanScreen({
  title,
  description,
  expectedPayload,
  onComplete,
  onClose,
}: QrScanScreenProps) {
  const { t } = useTranslation(['hunts', 'common']);
  const [permission, requestPermission] = useCameraPermissions();
  const [message, setMessage] = useState('');
  const [revealedPayload, setRevealedPayload] = useState<string | null>(null);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    if (revealedPayload) {
      return;
    }
    const scanned = result.data?.trim() ?? '';
    if (qrPayloadsMatch(scanned, expectedPayload)) {
      setRevealedPayload(scanned);
      setMessage('');
      return;
    }
    setMessage(t('hunts:ar.messages.qrUnknown'));
  };

  const handleRevealContinue = () => {
    if (revealedPayload) {
      onComplete(revealedPayload);
    }
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
        <Text style={styles.permissionTitle}>{t('hunts:ar.permission.title')}</Text>
        <Text style={styles.permissionText}>{t('hunts:ar.permission.body')}</Text>
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>{t('hunts:ar.permission.button')}</Text>
        </Pressable>
        <Pressable style={styles.closeLink} onPress={onClose}>
          <Text style={styles.closeLinkText}>{t('common:back')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={revealedPayload ? undefined : handleBarcodeScanned}
      />
      {revealedPayload ? (
        <ArSecretReveal secret={revealedPayload} onContinue={handleRevealContinue} />
      ) : null}
      <View style={styles.overlay}>
        <View style={styles.header}>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={20} color={colors.foreground} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>{title}</Text>
            {description ? <Text style={styles.subtitle}>{description}</Text> : null}
          </View>
        </View>
        <View style={styles.footer}>
          <Text style={styles.helper}>{message || t('hunts:qrScan.helper')}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  overlay: { flex: 1, justifyContent: 'space-between', padding: 16, backgroundColor: 'rgba(11,15,26,0.25)' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 48 },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(11,15,26,0.85)',
    borderColor: colors.glassBorderStrong,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, ...glassStrongCard, padding: 12 },
  title: { color: colors.foreground, fontWeight: '900', fontSize: 16 },
  subtitle: { color: colors.textMuted, marginTop: 4, lineHeight: 18 },
  footer: { marginBottom: 24, ...glassStrongCard, padding: 14 },
  helper: { color: colors.foreground, fontWeight: '700', lineHeight: 20 },
  permissionCard: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.background },
  permissionTitle: { fontSize: 18, fontWeight: '900', color: colors.foreground },
  permissionText: { color: colors.textMuted, marginTop: 8, lineHeight: 21 },
  button: {
    marginTop: 16,
    alignSelf: 'flex-start',
    backgroundColor: colors.gold,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: radii.md,
  },
  buttonText: { color: colors.background, fontWeight: '900' },
  closeLink: { marginTop: 16 },
  closeLinkText: { color: colors.gold, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
