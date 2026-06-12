import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Linking } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/src/state/AuthContext';
import { colors, glassCard, radii } from '@/src/theme';

// Connexion passkey : WebAuthn n'existe pas en natif dans Expo Go, on suit donc
// le standard RFC 8252 — navigateur système vers la page web dédiée, qui
// authentifie la passkey du domaine puis renvoie le JWT par deep link
// (lootopia://auth/callback?token=...), géré par app/auth/callback.tsx.
// La page web `/auth/mobile` doit lire `redirect_uri` et y rediriger le token.
const WEB_APP_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'http://localhost:3000';
const PASSKEY_LOGIN_URL = `${WEB_APP_URL}/auth/mobile?redirect_uri=${encodeURIComponent('lootopia://auth/callback')}`;

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, verifyTotp, clearMfaState, loginStage, pendingMethods, resendVerification } = useAuth();
  const [email, setEmail] = useState('player@lootopia.app');
  const [password, setPassword] = useState('password');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Même logique que le web : l'API renvoie des erreurs en texte brut, donc on
  // branche sur le STATUT HTTP (403 = email non vérifié, 401 = identifiants),
  // avec repli sur le texte serveur.
  const showAuthError = (authError: any) => {
    const status: number | undefined = authError?.status;
    const text: string = authError?.body ?? authError?.message ?? '';

    if (status === 403 || /verif/i.test(text) || /not_verified/i.test(text)) {
      setError('Ton email n’est pas encore vérifié.');
    } else if (status === 401) {
      setError('Connexion impossible. Vérifie tes identifiants.');
    } else {
      setError(text || 'Connexion impossible. Réessaie plus tard.');
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
          // L'API exige une passkey (WebAuthn) : on passe par le navigateur.
          setInfo('Cette connexion exige une passkey — utilise le bouton ci-dessous.');
        }
        return;
      }

      const response = await signIn(email, password);
      if (!response.mfaRequired) {
        router.replace('/(tabs)/chases');
      } else if (pendingMethods.includes('totp')) {
        setInfo('Un code TOTP est requis pour terminer la connexion.');
      } else {
        setInfo('Une passkey est requise pour ce compte — utilise le bouton passkey ci-dessous.');
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

  const handlePasskeyLogin = async () => {
    try {
      setError(null);
      // Navigateur système (jamais une WebView : les passkeys y sont bloquées
      // et c'est la recommandation RFC 8252). Le retour se fait par deep link.
      await Linking.openURL(PASSKEY_LOGIN_URL);
    } catch {
      setError('Impossible d’ouvrir le navigateur pour la connexion passkey.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Lootopia Mobile</Text>
      <Text style={styles.subtitle}>Accès joueur pour les chasses, les étapes et le compte.</Text>

      <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={colors.textFaint} autoCapitalize="none" />

      {loginStage === 'credentials' ? (
        <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Mot de passe" placeholderTextColor={colors.textFaint} secureTextEntry />
      ) : (
        <TextInput style={styles.input} value={code} onChangeText={setCode} placeholder="Code TOTP" placeholderTextColor={colors.textFaint} keyboardType="number-pad" />
      )}

      {error && <Text style={styles.error}>{error}</Text>}
      {info && <Text style={styles.info}>{info}</Text>}

      <Pressable style={[styles.button, isLoading && styles.buttonDisabled]} onPress={handleLogin} disabled={isLoading}>
        <Text style={styles.buttonText}>{loginStage === 'mfa' ? 'Valider le code' : 'Se connecter'}</Text>
      </Pressable>

      {loginStage === 'credentials' && (
        <Link href="/(auth)/forgot-password" style={styles.forgotLink}>
          Mot de passe oublié ?
        </Link>
      )}

      <View style={styles.separatorRow}>
        <View style={styles.separatorLine} />
        <Text style={styles.separatorText}>ou</Text>
        <View style={styles.separatorLine} />
      </View>

      <Pressable style={[styles.passkeyButton, isLoading && styles.buttonDisabled]} onPress={handlePasskeyLogin} disabled={isLoading}>
        <Text style={styles.passkeyButtonText}>🔑 Se connecter avec une passkey</Text>
      </Pressable>
      <Text style={styles.passkeyHint}>
        S’ouvre dans le navigateur : ta passkey du site Lootopia (Face ID / empreinte) te reconnecte ici automatiquement.
      </Text>

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