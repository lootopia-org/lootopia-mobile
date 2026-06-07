import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/state/AuthContext';
import { playerStats } from '@/src/data/mock';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrateur',
  partner: 'Partenaire',
  player: 'Joueur',
};

export default function AccountScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Compte joueur</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Pseudo</Text>
        <Text style={styles.value}>{user?.username ?? 'Invité'}</Text>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user?.email ?? '-'}</Text>
        <Text style={styles.label}>Rôle</Text>
        <Text style={styles.value}>{user?.role ? ROLE_LABELS[user.role] : 'Joueur'}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{playerStats.points}</Text>
          <Text style={styles.statLabel}>Points</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{playerStats.level}</Text>
          <Text style={styles.statLabel}>Niveau</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{playerStats.completedChases}</Text>
          <Text style={styles.statLabel}>Terminées</Text>
        </View>
      </View>

      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Déconnexion</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff9f5', paddingTop: 64, paddingHorizontal: 16 },
  header: { fontSize: 28, fontWeight: '800', color: '#1f2937', marginBottom: 16 },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 18, borderWidth: 1, borderColor: '#f2ddd2' },
  label: { color: '#6b7280', fontSize: 13, marginTop: 8 },
  value: { color: '#111827', fontSize: 18, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 20, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: '#f2ddd2' },
  statValue: { fontSize: 24, fontWeight: '900', color: '#ff6b35' },
  statLabel: { color: '#6b7280', marginTop: 4, fontSize: 12, fontWeight: '700' },
  logoutButton: { marginTop: 20, backgroundColor: '#1f2937', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  logoutText: { color: '#fff', fontWeight: '700' },
});