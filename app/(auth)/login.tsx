import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Linking } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/src/state/AuthContext';
import { colors, glassCard, radii } from '@/src/theme';

const WEB_APP_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'http://localhost:3000';
const PASSKEY_LOGIN_URL = `${WEB_APP_URL}/auth/mobile?redirect_uri=${encodeURIComponent('lootopia://auth/callback')}`;

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useTranslation(['auth', 'common']);
  const { signIn, verifyTotp, clearMfaState, loginStage, pendingMethods, resendVerification } = useAuth();
  const [email, setEmail] = useState('player@lootopia.app');
  const [password, setPassword] = useState('password');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const showAuthError = (authError: any) => {
    const status: number | undefined = authError?.status;
    const text: string = authError?.body ?? authError?.message ?? '';

    if (status === 403 || /verif/i.test(text) || /not_verified/i.test(text)) {
      setNeedsVerification(true);
      setError(t('auth:login.errors.emailNotVerified'));
    } else if (status === 401) {
      setNeedsVerification(false);
      setError(t('auth:login.errors.invalidCredentials'));
    } else {
      setNeedsVerification(false);
      setError(text || t('auth:login.errors.generic'));
    }
  };

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setInfo(null);

      if (loginStage === 'mfa') {
        if (pendingMethods.includes('totp')) {
          await verifyTotp(code);
          router.replace('/(tabs)/chases');
        } else {
          setInfo(t('auth:login.info.passkeyMfaRequired'));
        }
        return;
      }

      const response = await signIn(email, password);
      if (!response.mfaRequired) {
        router.replace('/(tabs)/chases');
      } else if (pendingMethods.includes('totp')) {
        setInfo(t('auth:login.info.totpRequired'));
      } else {
        setInfo(t('auth:login.info.passkeyRequired'));
      }
    } catch (authError: any) {
      showAuthError(authError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setInfo(null);
      await resendVerification(email);
      setInfo(t('auth:login.info.verificationSent'));
    } catch {
      setError(t('auth:login.errors.resendFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetMfa = () => {
    clearMfaState();
    setCode('');
    setInfo(null);
  };

  const handlePasskeyLogin = async () => {
    try {
      setError(null);
      await Linking.openURL(PASSKEY_LOGIN_URL);
    } catch {
      setError(t('auth:login.errors.passkeyBrowserFailed'));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('auth:login.mobileTitle')}</Text>
      <Text style={styles.subtitle}>{t('auth:login.mobileSubtitle')}</Text>

      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder={t('auth:login.fields.email')}
        placeholderTextColor={colors.textFaint}
        autoCapitalize="none"
      />

      {loginStage === 'credentials' ? (
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder={t('auth:login.fields.password')}
          placeholderTextColor={colors.textFaint}
          secureTextEntry
        />
      ) : (
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder={t('auth:login.fields.totp')}
          placeholderTextColor={colors.textFaint}
          keyboardType="number-pad"
        />
      )}

      {error && <Text style={styles.error}>{error}</Text>}
      {info && <Text style={styles.info}>{info}</Text>}

      <Pressable style={[styles.button, isLoading && styles.buttonDisabled]} onPress={handleLogin} disabled={isLoading}>
        <Text style={styles.buttonText}>
          {loginStage === 'mfa' ? t('auth:login.actions.validateCode') : t('auth:login.actions.signIn')}
        </Text>
      </Pressable>

      {loginStage === 'credentials' && (
        <Link href="/(auth)/forgot-password" style={styles.forgotLink}>
          {t('auth:login.links.forgotPassword')}
        </Link>
      )}

      <View style={styles.separatorRow}>
        <View style={styles.separatorLine} />
        <Text style={styles.separatorText}>{t('common:or')}</Text>
        <View style={styles.separatorLine} />
      </View>

      <Pressable style={[styles.passkeyButton, isLoading && styles.buttonDisabled]} onPress={handlePasskeyLogin} disabled={isLoading}>
        <Text style={styles.passkeyButtonText}>{t('auth:login.actions.signInWithPasskeyMobile')}</Text>
      </Pressable>
      <Text style={styles.passkeyHint}>{t('auth:login.passkeyHint')}</Text>

      {loginStage === 'mfa' && (
        <Pressable style={styles.linkButton} onPress={handleResetMfa}>
          <Text style={styles.link}>{t('auth:login.actions.backToCredentials')}</Text>
        </Pressable>
      )}

      {needsVerification && (
        <Pressable style={styles.linkButton} onPress={handleResendVerification} disabled={isLoading}>
          <Text style={styles.link}>{t('auth:login.actions.resendVerification')}</Text>
        </Pressable>
      )}

      <Link href="/(auth)/register" style={styles.link}>
        {t('auth:login.links.createAccount')}
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.background },
  title: { fontSize: 34, fontWeight: '900', color: colors.foreground, marginBottom: 8 },
  subtitle: { fontSize: 16, color: colors.textMuted, marginBottom: 24 },
  input: { ...glassCard, borderRadius: radii.md, padding: 16, marginBottom: 12, color: colors.foreground },
  button: { backgroundColor: colors.gold, paddingVertical: 16, borderRadius: radii.md, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: colors.background, fontWeight: '900', fontSize: 16 },
  forgotLink: { textAlign: 'right', marginTop: 10, color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  separatorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, marginBottom: 6 },
  separatorLine: { flex: 1, height: 1, backgroundColor: colors.glassBorderStrong },
  separatorText: { color: colors.textFaint, fontSize: 12, fontWeight: '700' },
  passkeyButton: { borderColor: colors.teal, borderWidth: 1, backgroundColor: colors.tealSoft, paddingVertical: 14, borderRadius: radii.md, alignItems: 'center', marginTop: 8 },
  passkeyButtonText: { color: colors.teal, fontWeight: '900', fontSize: 15 },
  passkeyHint: { color: colors.textFaint, fontSize: 11, textAlign: 'center', marginTop: 8, lineHeight: 16 },
  error: { color: colors.danger, marginBottom: 8 },
  info: { color: colors.teal, marginBottom: 8 },
  linkButton: { marginTop: 10 },
  link: { textAlign: 'center', marginTop: 18, color: colors.teal, fontWeight: '600' },
});
