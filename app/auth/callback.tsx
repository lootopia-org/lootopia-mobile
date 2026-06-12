import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/src/state/AuthContext';
import { colors, glassCard, radii } from '@/src/theme';

/**
 * Retour du flow passkey via navigateur (RFC 8252) :
 * la page web `/auth/mobile` authentifie l'utilisateur en WebAuthn puis
 * redirige vers `lootopia://auth/callback?token=<JWT>` — expo-router route
 * automatiquement ce deep link vers cet écran.
 *
 * Sécurité : le token est validé via /me avant d'ouvrir la session ; un token
 * invalide ou expiré renvoie vers le login avec une erreur.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const { token, error: webError } = useLocalSearchParams<{ token?: string; error?: string }>();
  const { signInWithToken } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (webError) {
        setError('La connexion par passkey a échoué côté web.');
        return;
      }
      if (!token) {
        setError('Lien de connexion invalide (token manquant).');
        return;
      }
      try {
        await signInWithToken(token);
        router.replace('/(tabs)/chases');
      } catch {
        setError('Token de connexion invalide ou expiré.');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, webError]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {error ? (
          <>
            <Text style={styles.title}>Connexion échouée</Text>
            <Text style={styles.text}>{error}</Text>
            <Pressable style={styles.button} onPress={() => router.replace('/(auth)/login')}>
              <Text style={styles.buttonText}>Retour à la connexion</Text>
            </Pressable>
          </>
        ) : (
          <>
            <ActivityIndicator color={colors.gold} />
            <Text style={styles.text}>Connexion par passkey en cours…</Text>
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
