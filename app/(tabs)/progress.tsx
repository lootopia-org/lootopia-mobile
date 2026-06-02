import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View, StyleSheet } from 'react-native';
import { useAuth } from '@/src/state/AuthContext';
import { chaseApi, type Chase, type UserProgress } from '@/src/lib/chase-api';

export default function ProgressScreen() {
  const { user } = useAuth();
  const [activeChase, setActiveChase] = useState<Chase | null>(null);
  const [progress, setProgress] = useState<UserProgress | null>(null);

  useEffect(() => {
    (async () => {
      const chases = await chaseApi.getChases();
      const firstChase = chases[0] ?? null;
      setActiveChase(firstChase);

      if (firstChase) {
        setProgress(await chaseApi.getProgress(firstChase.id));
      }
    })();
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
      <Text style={styles.header}>Progression</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Points gagnés</Text>
        <Text style={styles.points}>{progress?.points ?? 0}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Étape actuelle</Text>
        <Text style={styles.value}>{progress?.currentStep ?? 1} / {progress?.totalSteps ?? 5}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>À faire</Text>
        <Text style={styles.value}>
          {activeChase
            ? `Ouvrir ${activeChase.title}, suivre la carte, valider les étapes et terminer la chasse.`
            : 'Ouvrir une chasse, suivre la carte, valider les étapes et terminer la chasse.'}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff9f5' },
  header: { fontSize: 28, fontWeight: '800', color: '#1f2937', marginTop: 64, marginHorizontal: 16, marginBottom: 16 },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 18, marginHorizontal: 16, marginBottom: 14, borderWidth: 1, borderColor: '#f2ddd2' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#374151', marginBottom: 6 },
  points: { fontSize: 40, fontWeight: '900', color: '#ff6b35' },
  value: { fontSize: 18, color: '#111827', lineHeight: 24 },
});