import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/src/state/AuthContext';
import { colors, glassCard, radii } from '@/src/theme';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const { t } = useTranslation('auth');
  const { token, error: webError } = useLocalSearchParams<{ token?: string; error?: string }>();
  const { signInWithToken } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (webError) {
        setError(t('callback.errors.webFailed'));
        return;
      }
      if (!token) {
        setError(t('callback.errors.missingToken'));
        return;
      }
      try {
        await signInWithToken(token);
        router.replace('/(tabs)/chases');
      } catch {
        setError(t('callback.errors.invalidToken'));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, webError]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {error ? (
          <>
            <Text style={styles.title}>{t('callback.failedTitle')}</Text>
            <Text style={styles.text}>{error}</Text>
            <Pressable style={styles.button} onPress={() => router.replace('/(auth)/login')}>
              <Text style={styles.buttonText}>{t('callback.backToLogin')}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <ActivityIndicator color={colors.gold} />
            <Text style={styles.text}>{t('callback.loading')}</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { ...glassCard, padding: 24, alignItems: 'center', alignSelf: 'stretch' },
  title: { color: colors.foreground, fontSize: 18, fontWeight: '900', marginBottom: 8 },
  text: { color: colors.textMuted, textAlign: 'center', marginTop: 10, lineHeight: 20 },
  button: { backgroundColor: colors.gold, borderRadius: radii.md, paddingHorizontal: 18, paddingVertical: 12, marginTop: 16 },
  buttonText: { color: colors.background, fontWeight: '900' },
});
