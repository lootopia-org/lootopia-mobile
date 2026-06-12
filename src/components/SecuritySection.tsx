import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  authApi,
  type TotpEnrollBeginResponse,
  type WebauthnCredential,
} from '@/src/lib/auth-api';
import { useAuth } from '@/src/state/AuthContext';
import { getTotpStatus, setTotpStatus } from '@/src/lib/totp-status';
import { colors, glassCard, radii } from '@/src/theme';

/**
 * Section Sécurité du profil — consomme les endpoints authentifiés du contrat :
 * POST /auth/totp/enroll/begin → {secret, otpauthUri}
 * POST /auth/totp/enroll/verify {code}
 * POST /auth/totp/disable {code}
 * GET  /auth/webauthn/credentials
 * (L'ajout d'une passkey reste côté web : WebAuthn n'existe pas dans Expo Go.)
 */
export function SecuritySection() {
  const { token } = useAuth();

  const [enrollment, setEnrollment] = useState<TotpEnrollBeginResponse | null>(null);
  const [totpEnabled, setTotpEnabled] = useState<boolean | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [disableMode, setDisableMode] = useState(false);
  const [credentials, setCredentials] = useState<WebauthnCredential[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const realToken = token;

  const loadCredentials = useCallback(async () => {
    if (!realToken) {
      return;
    }
    try {
      const list = await authApi.listWebauthnCredentials(realToken);
      // Garde : le backend peut répondre 200 avec un corps vide/null ou une
      // forme inattendue — on ne garde que les vrais tableaux.
      setCredentials(Array.isArray(list) ? list : []);
    } catch {
      setCredentials(null);
    }
  }, [realToken]);

  useEffect(() => {
    void loadCredentials();
    void getTotpStatus().then(setTotpEnabled);
  }, [loadCredentials]);

  if (!realToken) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🔐 Sécurité</Text>
        <Text style={styles.muted}>Connecte-toi pour gérer la sécurité de ton compte.</Text>
      </View>
    );
  }

  const run = async (action: () => Promise<void>) => {
    try {
      setIsLoading(true);
      setError(null);
      setMessage(null);
      await action();
    } catch (apiError: any) {
      setError(apiError?.message || 'Opération impossible.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBeginEnroll = () =>
    run(async () => {
      setDisableMode(false);
      setEnrollment(await authApi.beginTotpEnroll(realToken));
    });

  const handleVerifyEnroll = () =>
    run(async () => {
      await authApi.verifyTotpEnroll(realToken, totpCode.trim());
      setEnrollment(null);
      setTotpCode('');
      setTotpEnabled(true);
      await setTotpStatus(true);
      setMessage('TOTP activé sur ton compte ✓');
    });

  const handleDisable = () =>
    run(async () => {
      await authApi.disableTotp(realToken, totpCode.trim());
      setDisableMode(false);
      setTotpCode('');
      setTotpEnabled(false);
      await setTotpStatus(false);
      setMessage('TOTP désactivé.');
    });

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>🔐 Sécurité</Text>

      {/* --- TOTP --- */}
      <View style={styles.totpHeader}>
        <Text style={styles.sectionLabel}>Double authentification (TOTP)</Text>
        <View
          style={[
            styles.statusPill,
            totpEnabled === true && styles.statusPillOn,
            totpEnabled === false && styles.statusPillOff,
          ]}
        >
          <Text
            style={[
              styles.statusPillText,
              totpEnabled === true && { color: colors.success },
              totpEnabled === false && { color: colors.danger },
            ]}
          >
            {totpEnabled === true ? '● Activé' : totpEnabled === false ? '○ Désactivé' : '? Inconnu'}
          </Text>
        </View>
      </View>

      {enrollment ? (
        <View style={styles.enrollBox}>
          <Text style={styles.muted}>
            Ajoute ce secret dans ton app d’authentification (Google Authenticator, Authy…) puis saisis le code généré :
          </Text>
          <Text selectable style={styles.secret}>
            {enrollment.secret}
          </Text>
          <TextInput
            style={styles.input}
            value={totpCode}
            onChangeText={setTotpCode}
            placeholder="Code à 6 chiffres"
            placeholderTextColor={colors.textFaint}
            keyboardType="number-pad"
          />
          <View style={styles.row}>
            <Pressable style={styles.primaryButton} onPress={handleVerifyEnroll} disabled={isLoading || totpCode.trim().length < 6}>
              <Text style={styles.primaryButtonText}>Confirmer</Text>
            </Pressable>
            <Pressable style={styles.ghostButton} onPress={() => setEnrollment(null)}>
              <Text style={styles.ghostButtonText}>Annuler</Text>
            </Pressable>
          </View>
        </View>
      ) : disableMode ? (
        <View style={styles.enrollBox}>
          <Text style={styles.muted}>Saisis un code TOTP valide pour confirmer la désactivation :</Text>
          <TextInput
            style={styles.input}
            value={totpCode}
            onChangeText={setTotpCode}
            placeholder="Code à 6 chiffres"
            placeholderTextColor={colors.textFaint}
            keyboardType="number-pad"
          />
          <View style={styles.row}>
            <Pressable style={[styles.primaryButton, styles.dangerButton]} onPress={handleDisable} disabled={isLoading || totpCode.trim().length < 6}>
              <Text style={styles.dangerButtonText}>Désactiver</Text>
            </Pressable>
            <Pressable style={styles.ghostButton} onPress={() => setDisableMode(false)}>
              <Text style={styles.ghostButtonText}>Annuler</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.row}>
          <Pressable style={styles.primaryButton} onPress={handleBeginEnroll} disabled={isLoading}>
            <Text style={styles.primaryButtonText}>Activer TOTP</Text>
          </Pressable>
          <Pressable
            style={styles.ghostButton}
            onPress={() => {
              setDisableMode(true);
              setTotpCode('');
            }}
          >
            <Text style={styles.ghostButtonText}>Désactiver…</Text>
          </Pressable>
        </View>
      )}

      {/* --- Passkeys --- */}
      <Text style={styles.sectionLabel}>Passkeys enregistrées</Text>
      {!Array.isArray(credentials) ? (
        <Text style={styles.muted}>Liste indisponible.</Text>
      ) : credentials.length === 0 ? (
        <Text style={styles.muted}>Aucune passkey. Ajoute-en une depuis le site web (Paramètres → Sécurité).</Text>
      ) : (
        credentials.map((credential) => (
          <View key={credential.id} style={styles.credentialRow}>
            <Text style={styles.credentialName}>🔑 {credential.name || 'Passkey'}</Text>
            <Text style={styles.credentialMeta}>
              créée le {new Date(credential.createdAt).toLocaleDateString('fr-FR')}
              {credential.lastUsedAt ? ` · utilisée le ${new Date(credential.lastUsedAt).toLocaleDateString('fr-FR')}` : ''}
            </Text>
          </View>
        ))
      )}

      {isLoading && <ActivityIndicator color={colors.gold} style={{ marginTop: 10 }} />}
      {message && <Text style={styles.success}>{message}</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...glassCard, padding: 16, marginTop: 12 },
  cardTitle: { color: colors.foreground, fontWeight: '900', fontSize: 16 },
  sectionLabel: { color: colors.gold, fontWeight: '800', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 14, marginBottom: 8 },
  totpHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  statusPill: { borderColor: colors.glassBorderStrong, borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: colors.glass, marginTop: 6 },
  statusPillOn: { borderColor: colors.success, backgroundColor: 'rgba(52,211,153,0.10)' },
  statusPillOff: { borderColor: colors.danger, backgroundColor: 'rgba(248,113,113,0.10)' },
  statusPillText: { color: colors.textMuted, fontSize: 10, fontWeight: '900' },
  muted: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  enrollBox: { gap: 10 },
  secret: { color: colors.teal, fontWeight: '800', fontSize: 14, letterSpacing: 1.2, backgroundColor: colors.glass, borderColor: colors.glassBorderStrong, borderWidth: 1, borderRadius: radii.sm, padding: 10, textAlign: 'center' },
  input: { backgroundColor: colors.glass, borderColor: colors.glassBorderStrong, borderWidth: 1, borderRadius: radii.sm, padding: 12, color: colors.foreground },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  primaryButton: { backgroundColor: colors.gold, borderRadius: radii.pill, paddingHorizontal: 16, paddingVertical: 9 },
  primaryButtonText: { color: colors.background, fontWeight: '900', fontSize: 12 },
  dangerButton: { backgroundColor: 'rgba(248,113,113,0.12)', borderColor: colors.danger, borderWidth: 1 },
  dangerButtonText: { color: colors.danger, fontWeight: '900', fontSize: 12 },
  ghostButton: { borderColor: colors.glassBorderStrong, borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: colors.glass },
  ghostButtonText: { color: colors.textMuted, fontWeight: '800', fontSize: 12 },
  credentialRow: { borderColor: colors.glassBorder, borderWidth: 1, borderRadius: radii.sm, padding: 10, marginBottom: 8, backgroundColor: colors.glass },
  credentialName: { color: colors.foreground, fontWeight: '800', fontSize: 13 },
  credentialMeta: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  success: { color: colors.success, fontWeight: '700', fontSize: 12, marginTop: 10 },
  error: { color: colors.danger, fontWeight: '700', fontSize: 12, marginTop: 10 },
});
