import React, { useState } from 'react';
import { Text, TextInput, Pressable, StyleSheet, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/src/state/AuthContext';
import { colors, glassCard, radii } from '@/src/theme';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await forgotPassword(email.trim());
      // L'API répond toujours par un message générique (pas d'énumération de
      // comptes) : on affiche donc la même confirmation quoi qu'il arrive.
      setSent(true);
    } catch {
      // Même en cas d'erreur réseau on n'expose rien sur l'existence du compte.
      setSent(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mot de passe oublié</Text>

      {sent ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📬 C’est envoyé</Text>
          <Text style={styles.cardText}>
            Si un compte existe pour cette adresse, un lien de réinitialisation à usage unique vient d’être envoyé.
            Ouvre-le depuis ton téléphone, ou saisis le code reçu :
          </Text>
          <Pressable style={styles.button} onPress={() => router.push('/(auth)/reset-password')}>
            <Text style={styles.buttonText}>J’ai reçu mon code</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={styles.subtitle}>
            Indique ton email : on t’enverra un lien de réinitialisation à usage unique.
          </Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable style={[styles.button, isLoading && styles.buttonDisabled]} onPress={handleSubmit} disabled={isLoading || !email.trim()}>
            <Text style={styles.buttonText}>Envoyer le lien</Text>
          </Pressable>
        </>
      )}

      <Link href="/(auth)/login" style={styles.link}>
        Retour à la connexion
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.background },
  title: { fontSize: 28, fontWeight: '900', color: colors.foreground, marginBottom: 10 },
  subtitle: { color: colors.textMuted, marginBottom: 18, lineHeight: 20 },
  input: { ...glassCard, borderRadius: radii.md, padding: 16, marginBottom: 12, color: colors.foreground },
  card: { ...glassCard, padding: 18 },
  cardTitle: { color: colors.foreground, fontWeight: '900', fontSize: 16 },
  cardText: { color: colors.textMuted, marginTop: 8, lineHeight: 20, marginBottom: 14 },
  button: { backgroundColor: colors.gold, paddingVertical: 15, borderRadius: radii.md, alignItems: 'center' },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: colors.background, fontWeight: '900', fontSize: 15 },
  error: { color: colors.danger, marginBottom: 8 },
  link: { textAlign: 'center', marginTop: 18, color: colors.teal, fontWeight: '600' },
});
