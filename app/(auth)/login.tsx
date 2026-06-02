import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/src/state/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, verifyTotp, clearMfaState, loginStage, pendingMethods, resendVerification } = useAuth();
  const [email, setEmail] = useState('player@lootopia.app');
  const [password, setPassword] = useState('password');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setInfo(null);

      if (loginStage === 'mfa' && pendingMethods.includes('totp')) {
        await verifyTotp(code);
        router.replace('/(tabs)/chases');
        return;
      }

      const response = await signIn(email, password);
      if (!response.mfaRequired) {
        router.replace('/(tabs)/chases');
      } else {
        setInfo('Un code TOTP est requis pour terminer la connexion.');
      }
    } catch (authError: any) {
      const apiCode = authError?.code;

      if (apiCode === 'email_not_verified') {
        setError('Ton email n’est pas encore vérifié.');
      } else {
        setError('Connexion impossible. Vérifie tes identifiants.');
      }
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
      setInfo('Un nouveau lien de vérification a été envoyé.');
    } catch {
      setError('Impossible de renvoyer le lien de vérification.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetMfa = () => {
    clearMfaState();
    setCode('');
    setInfo(null);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Lootopia Mobile</Text>
      <Text style={styles.subtitle}>Accès joueur pour les chasses, les étapes et le compte.</Text>

      <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" />

      {loginStage === 'credentials' ? (
        <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Mot de passe" secureTextEntry />
      ) : (
        <TextInput style={styles.input} value={code} onChangeText={setCode} placeholder="Code TOTP" keyboardType="number-pad" />
      )}

      {error && <Text style={styles.error}>{error}</Text>}
      {info && <Text style={styles.info}>{info}</Text>}

      <Pressable style={[styles.button, isLoading && styles.buttonDisabled]} onPress={handleLogin} disabled={isLoading}>
        <Text style={styles.buttonText}>{loginStage === 'mfa' ? 'Valider le code' : 'Se connecter'}</Text>
      </Pressable>

      {loginStage === 'mfa' && (
        <Pressable style={styles.linkButton} onPress={handleResetMfa}>
          <Text style={styles.link}>Revenir aux identifiants</Text>
        </Pressable>
      )}

      {error?.includes('vérifié') && (
        <Pressable style={styles.linkButton} onPress={handleResendVerification} disabled={isLoading}>
          <Text style={styles.link}>Renvoyer le lien de vérification</Text>
        </Pressable>
      )}

      <Link href="/(auth)/register" style={styles.link}>
        Créer un compte
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff9f5' },
  title: { fontSize: 34, fontWeight: '800', color: '#1f2937', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#6b7280', marginBottom: 24 },
  input: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#f2ddd2' },
  button: { backgroundColor: '#ff6b35', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  error: { color: '#b91c1c', marginBottom: 8 },
  info: { color: '#075985', marginBottom: 8 },
  linkButton: { marginTop: 10 },
  link: { textAlign: 'center', marginTop: 18, color: '#ff6b35', fontWeight: '600' },
});