import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/src/state/AuthContext';
import { useDemo } from '@/src/state/DemoContext';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, signInDemo, verifyTotp, clearMfaState, loginStage, pendingMethods, resendVerification } = useAuth();
  const { demoMode, toggleDemo } = useDemo();
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

      if (demoMode) {
        await signInDemo();
        router.replace('/(tabs)/chases');
        return;
      }

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

  const handleDemo = async (role: 'admin' | 'partner' | 'player') => {
    try {
      setIsLoading(true);
      setError(null);
      setInfo(null);
      await signInDemo(role);
      router.replace('/(tabs)/chases');
    } catch {
      setError('Connexion démo impossible.');
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

      <Pressable
        style={[styles.demoButton, demoMode && styles.demoButtonActive]}
        onPress={toggleDemo}
        accessibilityRole="switch"
        accessibilityState={{ checked: demoMode }}
      >
        <Text style={[styles.demoButtonText, demoMode && styles.demoButtonTextActive]}>
          {demoMode ? '🧪 Mode démo activé — validation sans GPS' : 'Activer le mode démo (mock)'}
        </Text>
      </Pressable>

      {demoMode ? (
        <View>
          <Text style={styles.demoHint}>Choisis un profil de démonstration :</Text>
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable style={[styles.button, isLoading && styles.buttonDisabled]} onPress={() => handleDemo('player')} disabled={isLoading}>
            <Text style={styles.buttonText}>🎮 Démo Joueur</Text>
          </Pressable>
          <Pressable style={[styles.roleButton, isLoading && styles.buttonDisabled]} onPress={() => handleDemo('partner')} disabled={isLoading}>
            <Text style={styles.roleButtonText}>🧰 Démo Partenaire (Studio)</Text>
          </Pressable>
          <Pressable style={[styles.roleButton, isLoading && styles.buttonDisabled]} onPress={() => handleDemo('admin')} disabled={isLoading}>
            <Text style={styles.roleButtonText}>🛡️ Démo Admin (Studio)</Text>
          </Pressable>
        </View>
      ) : (
        <>
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
        </>
      )}

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
  demoHint: { color: '#6b7280', fontWeight: '600', marginBottom: 6 },
  roleButton: { backgroundColor: '#1f2937', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 10 },
  roleButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  demoButton: { borderWidth: 1, borderColor: '#ff6b35', borderStyle: 'dashed', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 16, alignItems: 'center' },
  demoButtonActive: { backgroundColor: '#fff1e9', borderStyle: 'solid' },
  demoButtonText: { color: '#ff6b35', fontWeight: '700', fontSize: 14 },
  demoButtonTextActive: { color: '#c2410c' },
  error: { color: '#b91c1c', marginBottom: 8 },
  info: { color: '#075985', marginBottom: 8 },
  linkButton: { marginTop: 10 },
  link: { textAlign: 'center', marginTop: 18, color: '#ff6b35', fontWeight: '600' },
});