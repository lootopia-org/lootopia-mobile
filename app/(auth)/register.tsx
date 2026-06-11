import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/src/state/AuthContext';
import { colors, glassCard, radii } from '@/src/theme';

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setInfo(null);
      await signUp({ email, password });
      setInfo('Compte créé. Vérifie ton email pour activer l’accès.');
      router.replace('/(auth)/login');
    } catch {
      setError('Impossible de créer le compte.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Créer un compte joueur</Text>
      <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={colors.textFaint} autoCapitalize="none" />
      <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Mot de passe" placeholderTextColor={colors.textFaint} secureTextEntry />

      {error && <Text style={styles.error}>{error}</Text>}
      {info && <Text style={styles.info}>{info}</Text>}

      <Pressable style={[styles.button, isLoading && styles.buttonDisabled]} onPress={handleRegister} disabled={isLoading}>
        <Text style={styles.buttonText}>Créer mon compte</Text>
      </Pressable>

      <Link href="/(auth)/login" style={styles.link}>
        J’ai déjà un compte
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.background },
  title: { fontSize: 28, fontWeight: '900', color: colors.foreground, marginBottom: 18 },
  input: { ...glassCard, borderRadius: radii.md, padding: 16, marginBottom: 12, color: colors.foreground },
  button: { backgroundColor: colors.gold, paddingVertical: 16, borderRadius: radii.md, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: colors.background, fontWeight: '900', fontSize: 16 },
  error: { color: colors.danger, marginBottom: 8 },
  info: { color: colors.teal, marginBottom: 8 },
  link: { textAlign: 'center', marginTop: 18, color: colors.teal, fontWeight: '600' },
});