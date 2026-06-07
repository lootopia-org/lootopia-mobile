import React from 'react';
import { ScrollView, Text, View, StyleSheet } from 'react-native';
import { useAuth } from '@/src/state/AuthContext';
import { playerStats, leaderboard } from '@/src/data/mock';

export default function ProgressScreen() {
  const { user } = useAuth();

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
      <Text style={styles.header}>Progression</Text>

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

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Progression vers le niveau suivant</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${playerStats.progressPercentage}%` }]} />
        </View>
        <Text style={styles.progressText}>{playerStats.progressPercentage}%</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Classement global</Text>
        {leaderboard.map((entry) => {
          const isMe = entry.name === user?.username;
          return (
            <View key={entry.rank} style={[styles.row, isMe && styles.rowMe]}>
              <Text style={[styles.rank, isMe && styles.rankMe]}>#{entry.rank}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{entry.name}</Text>
                <Text style={styles.sub}>{entry.chasesCompleted} chasses terminées</Text>
              </View>
              <Text style={styles.points}>{entry.points} pts</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff9f5' },
  header: { fontSize: 28, fontWeight: '800', color: '#1f2937', marginTop: 64, marginHorizontal: 16, marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 14 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 20, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: '#f2ddd2' },
  statValue: { fontSize: 26, fontWeight: '900', color: '#ff6b35' },
  statLabel: { color: '#6b7280', marginTop: 4, fontSize: 12, fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 18, marginHorizontal: 16, marginBottom: 14, borderWidth: 1, borderColor: '#f2ddd2' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#374151', marginBottom: 12 },
  progressTrack: { height: 12, borderRadius: 999, backgroundColor: '#f3e1d5', overflow: 'hidden' },
  progressFill: { height: 12, borderRadius: 999, backgroundColor: '#ff6b35' },
  progressText: { marginTop: 8, color: '#6b7280', fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f6ece4' },
  rowMe: { backgroundColor: '#fff4ec', borderRadius: 14, paddingHorizontal: 10, borderTopWidth: 0 },
  rank: { fontWeight: '900', color: '#9ca3af', width: 36 },
  rankMe: { color: '#ff6b35' },
  name: { fontWeight: '800', color: '#111827' },
  sub: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  points: { fontWeight: '800', color: '#ff6b35' },
});
