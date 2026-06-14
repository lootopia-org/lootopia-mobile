import React, { useState } from 'react';
import { Text, TextInput, Pressable, StyleSheet, View } from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/src/state/AuthContext';
import { colors, glassCard, radii } from '@/src/theme';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { t } = useTranslation(['auth', 'common']);
  const { token: tokenParam } = useLocalSearchParams<{ token?: string }>();
  const { resetPassword } = useAuth();
  const [token, setToken] = useState(tokenParam ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (newPassword.length < 8) {
      setError(t('auth:resetPassword.errors.passwordTooShort'));
      return;
    }
    if (newPassword !== confirm) {
      setError(t('auth:resetPassword.errors.passwordMismatch'));
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await resetPassword(token.trim(), newPassword);
      router.replace('/(auth)/login');
    } catch (resetError: any) {
      setError(
        resetError?.status === 400 || resetError?.status === 401
          ? t('auth:resetPassword.errors.invalidToken')
          : t('auth:resetPassword.errors.generic')
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('auth:resetPassword.title')}</Text>
      <Text style={styles.subtitle}>{t('auth:resetPassword.subtitle')}</Text>

      <TextInput
        style={styles.input}
        value={token}
        onChangeText={setToken}
        placeholder={t('auth:resetPassword.tokenPlaceholder')}
        placeholderTextColor={colors.textFaint}
        autoCapitalize="none"
      />
      <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} placeholder={t('auth:resetPassword.newPasswordPlaceholder')} placeholderTextColor={colors.textFaint} secureTextEntry />
      <TextInput style={styles.input} value={confirm} onChangeText={setConfirm} placeholder={t('auth:resetPassword.confirmPlaceholder')} placeholderTextColor={colors.textFaint} secureTextEntry />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={isLoading || !token.trim() || !newPassword}
      >
        <Text style={styles.buttonText}>{t('auth:resetPassword.submit')}</Text>
      </Pressable>
      <Text style={styles.note}>{t('auth:resetPassword.sessionsNote')}</Text>

      <Link href="/(auth)/login" style={styles.link}>
        {t('auth:resetPassword.backToLogin')}
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.background },
  title: { fontSize: 28, fontWeight: '900', color: colors.foreground, marginBottom: 10 },
  subtitle: { color: colors.textMuted, marginBottom: 18, lineHeight: 20 },
  input: { ...glassCard, borderRadius: radii.md, padding: 16, marginBottom: 12, color: colors.foreground },
  button: { backgroundColor: colors.gold, paddingVertical: 16, borderRadius: radii.md, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: colors.background, fontWeight: '900', fontSize: 16 },
  note: { color: colors.textFaint, fontSize: 11, textAlign: 'center', marginTop: 10 },
  error: { color: colors.danger, marginBottom: 8 },
  link: { textAlign: 'center', marginTop: 18, color: colors.teal, fontWeight: '600' },
});
