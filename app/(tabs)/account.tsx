import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/state/AuthContext';
import { useHunts, type AvatarModel } from '@/src/state/HuntsContext';
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
  const { user, signOut } = useAuth();
  const { avatarModel, setAvatarModel, acceptedHunts } = useHunts();

  const handleLogout = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  const xpRatio = Math.min(playerStats.points / XP_TARGET, 1);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32, paddingHorizontal: 16 }}
    >
      <Text style={styles.header}>Profil</Text>

      {/* Aperçu du personnage + choix du modèle (MVP : aperçu sprite, remplacé
          plus tard par le rendu GLB — voir conception-prototype-AR-lootopia.md). */}
      <View style={[styles.avatarCard]}>
        <Text style={styles.avatarSprite}>{avatarModel === 'male' ? '🧍‍♂️' : '🧍‍♀️'}</Text>
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
          <Text style={styles.levelText}>⭐ Niveau {playerStats.level}</Text>
          <Text style={styles.xpText}>
            {playerStats.points} / {XP_TARGET} XP
          </Text>
        </View>
        <View style={styles.xpTrack}>
          <View style={[styles.xpFill, { width: `${Math.round(xpRatio * 100)}%` }]} />
        </View>
      </View>

      {/* Statistiques */}
      <View style={styles.statsGrid}>
        <Stat value={String(playerStats.points)} label="Points" gold />
        <Stat value={String(playerStats.completedChases)} label="Chasses finies" />
        <Stat value={String(Object.keys(acceptedHunts).length)} label="En cours" teal />
        <Stat value={`${playerStats.progressPercentage}%`} label="Progression" />
      </View>

      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Déconnexion</Text>
      </Pressable>
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
});
