import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/state/AuthContext';
import { useHunts, type AvatarModel } from '@/src/state/HuntsContext';
import { PlayerCharacter3D } from '@/src/components/PlayerCharacter3D';
import { SecuritySection } from '@/src/components/SecuritySection';
import { fetchOrCreateProfile, profileApi, type Profile } from '@/src/lib/profile-api';
import { playerStats } from '@/src/data/mock';
import { colors, glassCard, glassStrongCard, radii } from '@/src/theme';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrateur',
  partner: 'Partenaire',
  player: 'Joueur',
};

const XP_TARGET = 2000;

export default function AccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut, token, isDemoSession } = useAuth();
  const { avatarModel, setAvatarModel, acceptedHunts } = useHunts();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Profil serveur (GET /profile, créé via POST au premier passage). En mode
  // démo ou hors-ligne, on retombe sur les stats mock.
  const realToken = token && !isDemoSession ? token : null;
  useEffect(() => {
    if (!realToken) {
      setProfile(null);
      return;
    }
    fetchOrCreateProfile(realToken)
      .then(setProfile)
      .catch(() => setProfile(null));
  }, [realToken]);

  const handleLogout = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  const handleDeleteProfile = async () => {
    if (!realToken) {
      return;
    }
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await profileApi.delete(realToken);
      setProfile(null);
    } finally {
      setConfirmDelete(false);
    }
  };

  const points = profile?.points ?? playerStats.points;
  const level = profile?.level ?? playerStats.level;
  const completedHunts = profile?.completedHunts ?? playerStats.completedChases;
  const xpRatio = Math.min(points / XP_TARGET, 1);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32, paddingHorizontal: 16 }}
    >
      <Text style={styles.header}>Profil</Text>

      {/* Aperçu du personnage + choix du modèle (MVP : aperçu sprite, remplacé
          plus tard par le rendu GLB — voir conception-prototype-AR-lootopia.md). */}
      <View style={[styles.avatarCard]}>
        <PlayerCharacter3D model={avatarModel} walking={false} headingDegrees={25} size={150} showBadge={false} />
        <View style={styles.toggleRow}>
          <ModelToggle current={avatarModel} value="male" label="Homme" onSelect={setAvatarModel} />
          <ModelToggle current={avatarModel} value="female" label="Femme" onSelect={setAvatarModel} />
        </View>
        <Text style={styles.username}>{user?.username ?? 'Invité'}</Text>
        <Text style={styles.role}>{user?.role ? ROLE_LABELS[user.role] : 'Joueur'} · {user?.email ?? '-'}</Text>
      </View>

      {/* Niveau + XP */}
      <View style={styles.levelCard}>
        <View style={styles.levelRow}>
          <Text style={styles.levelText}>⭐ Niveau {level}</Text>
          <Text style={styles.xpText}>
            {points} / {XP_TARGET} XP{profile ? '' : ' · données démo'}
          </Text>
        </View>
        <View style={styles.xpTrack}>
          <View style={[styles.xpFill, { width: `${Math.round(xpRatio * 100)}%` }]} />
        </View>
      </View>

      {/* Statistiques */}
      <View style={styles.statsGrid}>
        <Stat value={String(points)} label="Points" gold />
        <Stat value={String(completedHunts)} label="Chasses finies" />
        <Stat value={String(Object.keys(acceptedHunts).length)} label="En cours" teal />
        <Stat value={`${playerStats.progressPercentage}%`} label="Progression" />
      </View>

      <SecuritySection />

      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Déconnexion</Text>
      </Pressable>

      {realToken && (
        <Pressable onPress={handleDeleteProfile}>
          <Text style={styles.deleteProfile}>
            {confirmDelete
              ? '⚠️ Appuie à nouveau pour confirmer la suppression du profil (points et progression perdus)'
              : 'Supprimer mon profil'}
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function ModelToggle({
  current,
  value,
  label,
  onSelect,
}: {
  current: AvatarModel;
  value: AvatarModel;
  label: string;
  onSelect: (model: AvatarModel) => void;
}) {
  const active = current === value;
  return (
    <Pressable style={[styles.toggle, active && styles.toggleActive]} onPress={() => onSelect(value)}>
      <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Stat({ value, label, gold, teal }: { value: string; label: string; gold?: boolean; teal?: boolean }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, gold && { color: colors.gold }, teal && { color: colors.teal }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { fontSize: 28, fontWeight: '900', color: colors.foreground, marginBottom: 16 },
  avatarCard: { ...glassStrongCard, alignItems: 'center', padding: 20 },
  avatarSprite: { fontSize: 72 },
  toggleRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  toggle: { borderColor: colors.glassBorderStrong, borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: 18, paddingVertical: 7, backgroundColor: colors.glass },
  toggleActive: { backgroundColor: colors.goldSoft, borderColor: colors.gold },
  toggleText: { color: colors.textMuted, fontWeight: '800', fontSize: 13 },
  toggleTextActive: { color: colors.gold },
  username: { color: colors.foreground, fontSize: 20, fontWeight: '900', marginTop: 14 },
  role: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  levelCard: { ...glassCard, padding: 16, marginTop: 12 },
  levelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  levelText: { color: colors.gold, fontWeight: '900', fontSize: 15 },
  xpText: { color: colors.textMuted, fontWeight: '700', fontSize: 12 },
  xpTrack: { height: 10, borderRadius: radii.pill, backgroundColor: colors.glass, borderColor: colors.glassBorder, borderWidth: 1, overflow: 'hidden' },
  xpFill: { height: '100%', backgroundColor: colors.gold },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  statCard: { ...glassCard, flexBasis: '47%', flexGrow: 1, paddingVertical: 16, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '900', color: colors.foreground },
  statLabel: { color: colors.textMuted, marginTop: 4, fontSize: 11, fontWeight: '700' },
  logoutButton: { marginTop: 20, borderColor: colors.danger, borderWidth: 1, paddingVertical: 15, borderRadius: radii.md, alignItems: 'center', backgroundColor: 'rgba(248,113,113,0.08)' },
  logoutText: { color: colors.danger, fontWeight: '800' },
  deleteProfile: { color: colors.textFaint, fontSize: 11, textAlign: 'center', marginTop: 14, textDecorationLine: 'underline' },
});
