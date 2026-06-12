import React, { useState } from 'react';
import { Text, TextInput, Pressable, StyleSheet, View } from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/src/state/AuthContext';
import { colors, glassCard, radii } from '@/src/theme';

/**
 * Réinitialisation du mot de passe. Le token (usage unique, expirant) vient du
 * lien email : soit pré-rempli via deep link `lootopia://reset-password?token=…`,
 * soit collé manuellement. Le succès révoque les sessions existantes (contrat
 * API), donc on renvoie l'utilisateur vers la connexion.
 */
export default function ResetPasswordScreen() {
  const router = useRouter();
  const { token: tokenParam } = useLocalSearchParams<{ token?: string }>();
  const { resetPassword } = useAuth();
  const [token, setToken] = useState(tokenParam ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (newPassword.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caractères.');
      return;
    }
    if (newPassword !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await resetPassword(token.trim(), newPassword);
      router.replace('/(auth)/login');
    } catch (resetError: any) {
      // Token invalide/expiré : message clair, le lien est à usage unique.
      setError(
        resetError?.status === 400 || resetError?.status === 401
          ? 'Lien invalide ou expiré. Redemande un email de réinitialisation.'
          : 'Réinitialisation impossible. Réessaie plus tard.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nouveau mot de passe</Text>
      <Text style={styles.subtitle}>
        Colle le code reçu par email (ou ouvre le lien depuis ce téléphone), puis choisis un nouveau mot de passe.
      </Text>

      <TextInput
        style={styles.input}
        value={token}
        onChangeText={setToken}
        placeholder="Code de réinitialisation"
        placeholderTextColor={colors.textFaint}
        autoCapitalize="none"
      />
      <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} placeholder="Nouveau mot de passe" placeholderTextColor={colors.textFaint} secureTextEntry />
      <TextInput style={styles.input} value={confirm} onChangeText={setConfirm} placeholder="Confirme le mot de passe" placeholderTextColor={colors.textFaint} secureTextEntry />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={isLoading || !token.trim() || !newPassword}
      >
        <Text style={styles.buttonText}>Réinitialiser</Text>
      </Pressable>
      <Text style={styles.note}>Toutes les sessions existantes seront déconnectées.</Text>

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
  button: { backgroundColor: colors.gold, paddingVertical: 16, borderRadius: radii.md, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: colors.background, fontWeight: '900', fontSize: 16 },
  note: { color: colors.textFaint, fontSize: 11, textAlign: 'center', marginTop: 10 },
  error: { color: colors.danger, marginBottom: 8 },
  link: { textAlign: 'center', marginTop: 18, color: colors.teal, fontWeight: '600' },
});
