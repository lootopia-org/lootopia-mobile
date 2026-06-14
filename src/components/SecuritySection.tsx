import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  authApi,
  type TotpEnrollBeginResponse,
  type WebauthnCredential,
} from '@/src/lib/auth-api';
import { useAuth } from '@/src/state/AuthContext';
import { getTotpStatus, setTotpStatus } from '@/src/lib/totp-status';
import { getDateLocale } from '@/src/i18n';
import { colors, glassCard, radii } from '@/src/theme';

export function SecuritySection() {
  const { t, i18n } = useTranslation(['common']);
  const { token } = useAuth();

  const [enrollment, setEnrollment] = useState<TotpEnrollBeginResponse | null>(null);
  const [totpEnabled, setTotpEnabled] = useState<boolean | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [disableMode, setDisableMode] = useState(false);
  const [credentials, setCredentials] = useState<WebauthnCredential[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const realToken = token;
  void i18n.language;
  const dateLocale = getDateLocale();

  const loadCredentials = useCallback(async () => {
    if (!realToken) {
      return;
    }
    try {
      const list = await authApi.listWebauthnCredentials(realToken);
      setCredentials(Array.isArray(list) ? list : []);
    } catch {
      setCredentials(null);
    }
  }, [realToken]);

  useEffect(() => {
    void loadCredentials();
    void getTotpStatus().then(setTotpEnabled);
  }, [loadCredentials]);

  if (!realToken) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('common:security.title')}</Text>
        <Text style={styles.muted}>{t('common:security.loginRequired')}</Text>
      </View>
    );
  }

  const run = async (action: () => Promise<void>) => {
    try {
      setIsLoading(true);
      setError(null);
      setMessage(null);
      await action();
    } catch (apiError: any) {
      setError(apiError?.message || t('common:errors.operationFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleBeginEnroll = () =>
    run(async () => {
      setDisableMode(false);
      setEnrollment(await authApi.beginTotpEnroll(realToken));
    });

  const handleVerifyEnroll = () =>
    run(async () => {
      await authApi.verifyTotpEnroll(realToken, totpCode.trim());
      setEnrollment(null);
      setTotpCode('');
      setTotpEnabled(true);
      await setTotpStatus(true);
      setMessage(t('common:security.totp.successEnabled'));
    });

  const handleDisable = () =>
    run(async () => {
      await authApi.disableTotp(realToken, totpCode.trim());
      setDisableMode(false);
      setTotpCode('');
      setTotpEnabled(false);
      await setTotpStatus(false);
      setMessage(t('common:security.totp.successDisabled'));
    });

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t('common:security.title')}</Text>

      <View style={styles.totpHeader}>
        <Text style={styles.sectionLabel}>{t('common:security.totp.sectionLabel')}</Text>
        <View
          style={[
            styles.statusPill,
            totpEnabled === true && styles.statusPillOn,
            totpEnabled === false && styles.statusPillOff,
          ]}
        >
          <Text
            style={[
              styles.statusPillText,
              totpEnabled === true && { color: colors.success },
              totpEnabled === false && { color: colors.danger },
            ]}
          >
            {totpEnabled === true
              ? t('common:security.totp.status.enabled')
              : totpEnabled === false
                ? t('common:security.totp.status.disabled')
                : t('common:security.totp.status.unknown')}
          </Text>
        </View>
      </View>

      {enrollment ? (
        <View style={styles.enrollBox}>
          <Text style={styles.muted}>{t('common:security.totp.enrollInstructions')}</Text>
          <Text selectable style={styles.secret}>
            {enrollment.secret}
          </Text>
          <TextInput
            style={styles.input}
            value={totpCode}
            onChangeText={setTotpCode}
            placeholder={t('common:security.totp.placeholder')}
            placeholderTextColor={colors.textFaint}
            keyboardType="number-pad"
          />
          <View style={styles.row}>
            <Pressable style={styles.primaryButton} onPress={handleVerifyEnroll} disabled={isLoading || totpCode.trim().length < 6}>
              <Text style={styles.primaryButtonText}>{t('common:confirm')}</Text>
            </Pressable>
            <Pressable style={styles.ghostButton} onPress={() => setEnrollment(null)}>
              <Text style={styles.ghostButtonText}>{t('common:cancel')}</Text>
            </Pressable>
          </View>
        </View>
      ) : disableMode ? (
        <View style={styles.enrollBox}>
          <Text style={styles.muted}>{t('common:security.totp.disableInstructions')}</Text>
          <TextInput
            style={styles.input}
            value={totpCode}
            onChangeText={setTotpCode}
            placeholder={t('common:security.totp.placeholder')}
            placeholderTextColor={colors.textFaint}
            keyboardType="number-pad"
          />
          <View style={styles.row}>
            <Pressable style={[styles.primaryButton, styles.dangerButton]} onPress={handleDisable} disabled={isLoading || totpCode.trim().length < 6}>
              <Text style={styles.dangerButtonText}>{t('common:security.totp.disable')}</Text>
            </Pressable>
            <Pressable style={styles.ghostButton} onPress={() => setDisableMode(false)}>
              <Text style={styles.ghostButtonText}>{t('common:cancel')}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.row}>
          <Pressable style={styles.primaryButton} onPress={handleBeginEnroll} disabled={isLoading}>
            <Text style={styles.primaryButtonText}>{t('common:security.totp.activate')}</Text>
          </Pressable>
          <Pressable
            style={styles.ghostButton}
            onPress={() => {
              setDisableMode(true);
              setTotpCode('');
            }}
          >
            <Text style={styles.ghostButtonText}>{t('common:security.totp.disableEllipsis')}</Text>
          </Pressable>
        </View>
      )}

      <Text style={styles.sectionLabel}>{t('common:security.passkeys.sectionLabel')}</Text>
      {!Array.isArray(credentials) ? (
        <Text style={styles.muted}>{t('common:security.passkeys.listUnavailable')}</Text>
      ) : credentials.length === 0 ? (
        <Text style={styles.muted}>{t('common:security.passkeys.empty')}</Text>
      ) : (
        credentials.map((credential) => (
          <View key={credential.id} style={styles.credentialRow}>
            <Text style={styles.credentialName}>🔑 {credential.name || t('common:security.passkeys.defaultName')}</Text>
            <Text style={styles.credentialMeta}>
              {t('common:security.passkeys.metaCreated', {
                date: new Date(credential.createdAt).toLocaleDateString(dateLocale),
              })}
              {credential.lastUsedAt
                ? t('common:security.passkeys.metaLastUsed', {
                    date: new Date(credential.lastUsedAt).toLocaleDateString(dateLocale),
                  })
                : ''}
            </Text>
          </View>
        ))
      )}

      {isLoading && <ActivityIndicator color={colors.gold} style={{ marginTop: 10 }} />}
      {message && <Text style={styles.success}>{message}</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...glassCard, padding: 16, marginTop: 12 },
  cardTitle: { color: colors.foreground, fontWeight: '900', fontSize: 16 },
  sectionLabel: { color: colors.gold, fontWeight: '800', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 14, marginBottom: 8 },
  totpHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  statusPill: { borderColor: colors.glassBorderStrong, borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: colors.glass, marginTop: 6 },
  statusPillOn: { borderColor: colors.success, backgroundColor: 'rgba(52,211,153,0.10)' },
  statusPillOff: { borderColor: colors.danger, backgroundColor: 'rgba(248,113,113,0.10)' },
  statusPillText: { color: colors.textMuted, fontSize: 10, fontWeight: '900' },
  muted: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  enrollBox: { gap: 10 },
  secret: { color: colors.teal, fontWeight: '800', fontSize: 14, letterSpacing: 1.2, backgroundColor: colors.glass, borderColor: colors.glassBorderStrong, borderWidth: 1, borderRadius: radii.sm, padding: 10, textAlign: 'center' },
  input: { backgroundColor: colors.glass, borderColor: colors.glassBorderStrong, borderWidth: 1, borderRadius: radii.sm, padding: 12, color: colors.foreground },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  primaryButton: { backgroundColor: colors.gold, borderRadius: radii.pill, paddingHorizontal: 16, paddingVertical: 9 },
  primaryButtonText: { color: colors.background, fontWeight: '900', fontSize: 12 },
  dangerButton: { backgroundColor: 'rgba(248,113,113,0.12)', borderColor: colors.danger, borderWidth: 1 },
  dangerButtonText: { color: colors.danger, fontWeight: '900', fontSize: 12 },
  ghostButton: { borderColor: colors.glassBorderStrong, borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: colors.glass },
  ghostButtonText: { color: colors.textMuted, fontWeight: '800', fontSize: 12 },
  credentialRow: { borderColor: colors.glassBorder, borderWidth: 1, borderRadius: radii.sm, padding: 10, marginBottom: 8, backgroundColor: colors.glass },
  credentialName: { color: colors.foreground, fontWeight: '800', fontSize: 13 },
  credentialMeta: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  success: { color: colors.success, fontWeight: '700', fontSize: 12, marginTop: 10 },
  error: { color: colors.danger, fontWeight: '700', fontSize: 12, marginTop: 10 },
});
