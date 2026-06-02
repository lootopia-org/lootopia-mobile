import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/state/AuthContext';
import { chaseApi, type Chase, type UserProgress } from '@/src/lib/chase-api';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [chases, setChases] = useState<Chase[]>([]);
  const [progress, setProgress] = useState<UserProgress | null>(null);

  useEffect(() => {
    (async () => {
      const nextChases = await chaseApi.getChases();
      setChases(nextChases);

      if (nextChases[0]) {
        setProgress(await chaseApi.getProgress(nextChases[0].id));
      }
    })();
  }, []);

  const activeChase = chases[0];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 28 }}>
      <LinearGradient colors={['#ff6b35', '#ff8c5a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Text style={styles.kicker}>Lootopia Mobile</Text>
        <Text style={styles.title}>Bienvenue {user?.username ?? 'joueur'}</Text>
        <Text style={styles.subtitle}>Lance une chasse, suis ta progression et garde l’essentiel dans ta poche.</Text>

        <View style={styles.heroStats}>
          <View style={styles.heroStatCard}>
            <Text style={styles.heroStatValue}>{progress?.points ?? 0}</Text>
            <Text style={styles.heroStatLabel}>Points</Text>
          </View>
          <View style={styles.heroStatCard}>
            <Text style={styles.heroStatValue}>{progress?.currentStep ?? 1}</Text>
            <Text style={styles.heroStatLabel}>Étape</Text>
          </View>
          <View style={styles.heroStatCard}>
            <Text style={styles.heroStatValue}>{chases.length || 0}</Text>
            <Text style={styles.heroStatLabel}>Chasses</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Reprendre rapidement</Text>
        <Pressable onPress={() => router.push('/(tabs)/chases')}>
          <Text style={styles.sectionAction}>Voir tout</Text>
        </Pressable>
      </View>

      {activeChase && (
        <Pressable style={styles.quickCard} onPress={() => router.push(`/chases/${activeChase.id}`)}>
          <View style={styles.quickCardTop}>
            <Ionicons name="compass-outline" size={22} color="#ff6b35" />
            <Text style={styles.quickCardBadge}>{activeChase.difficulty}</Text>
          </View>
          <Text style={styles.quickCardTitle}>{activeChase.title}</Text>
          <Text style={styles.quickCardText}>{activeChase.description}</Text>
          <Text style={styles.quickCardMeta}>{activeChase.estimatedDuration} min · {activeChase.partner.name}</Text>
        </Pressable>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Accès rapide</Text>
      </View>

      <View style={styles.grid}>
        <Pressable style={styles.actionCard} onPress={() => router.push('/(tabs)/chases')}>
          <Ionicons name="map-outline" size={28} color="#ff6b35" />
          <Text style={styles.actionTitle}>Chasses</Text>
        </Pressable>
        <Pressable style={styles.actionCard} onPress={() => router.push('/(tabs)/progress')}>
          <Ionicons name="trophy-outline" size={28} color="#ff6b35" />
          <Text style={styles.actionTitle}>Progression</Text>
        </Pressable>
        <Pressable style={styles.actionCard} onPress={() => router.push('/(tabs)/account')}>
          <Ionicons name="person-circle-outline" size={28} color="#ff6b35" />
          <Text style={styles.actionTitle}>Compte</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff9f5' },
  hero: { marginTop: 56, marginHorizontal: 16, borderRadius: 28, padding: 20 },
  kicker: { color: '#fff4ec', fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: '#fff', fontSize: 30, fontWeight: '900', marginTop: 8 },
  subtitle: { color: '#fff7f2', fontSize: 15, lineHeight: 22, marginTop: 8, maxWidth: 320 },
  heroStats: { flexDirection: 'row', gap: 10, marginTop: 18 },
  heroStatCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20, paddingVertical: 14, alignItems: 'center' },
  heroStatValue: { color: '#fff', fontSize: 24, fontWeight: '900' },
  heroStatLabel: { color: '#fff7f2', marginTop: 4, fontSize: 12, fontWeight: '700' },
  sectionHeader: { marginHorizontal: 16, marginTop: 22, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#1f2937' },
  sectionAction: { color: '#ff6b35', fontWeight: '700' },
  quickCard: { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 24, padding: 18, borderWidth: 1, borderColor: '#f2ddd2' },
  quickCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  quickCardBadge: { backgroundColor: '#fff4ec', color: '#ff6b35', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  quickCardTitle: { fontSize: 20, fontWeight: '900', color: '#111827', marginTop: 14 },
  quickCardText: { color: '#6b7280', marginTop: 6, lineHeight: 21 },
  quickCardMeta: { color: '#ff6b35', marginTop: 8, fontWeight: '700' },
  grid: { marginHorizontal: 16, flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  actionCard: { width: '31.7%', minWidth: 100, backgroundColor: '#fff', borderRadius: 22, paddingVertical: 18, alignItems: 'center', borderWidth: 1, borderColor: '#f2ddd2' },
  actionTitle: { marginTop: 10, fontWeight: '800', color: '#111827', fontSize: 13 },
});