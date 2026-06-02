import React, { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ARExperience } from '@/src/components/ARExperience';
import { chaseApi, type Chase } from '@/src/lib/chase-api';

export default function ARScreen() {
  const router = useRouter();
  const { id, clue, stepId } = useLocalSearchParams<{ id: string; clue?: string; stepId?: string }>();
  const [chase, setChase] = useState<Chase | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      return;
    }

    (async () => {
      try {
        setIsLoading(true);
        setChase(await chaseApi.getChase(id));
      } finally {
        setIsLoading(false);
      }
    })();
  }, [id]);

  const step = chase?.steps.find((item) => item.id === stepId) ?? chase?.steps[0];

  const handleComplete = async () => {
    if (!chase || !step) {
      router.back();
      return;
    }

    await chaseApi.completeStep(chase.id, step.id);
    router.back();
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#ff6b35" />
      </View>
    );
  }

  if (!chase) {
    return (
      <View style={styles.center}>
        <Text>Chasse introuvable.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 28 }}>
      <Text style={styles.header}>AR</Text>
      <Text style={styles.subheader}>{chase.title}</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Indice à révéler</Text>
        <Text style={styles.cardText}>{step?.arHint ?? clue ?? 'Utilise la caméra pour révéler l’indice de la chasse.'}</Text>
      </View>

      <ARExperience
        clue={step?.clue ?? clue ?? 'Indice indisponible'}
        targetLocation={step?.location ?? { latitude: 43.2965, longitude: 5.3698 }}
        radiusMeters={step?.radiusMeters ?? 100}
        onComplete={handleComplete}
      />
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>Retour à la chasse</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff9f5', paddingHorizontal: 16 },
  header: { fontSize: 28, fontWeight: '900', color: '#1f2937', marginTop: 64 },
  subheader: { color: '#6b7280', marginTop: 4, marginBottom: 14 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#f2ddd2', borderRadius: 24, padding: 18, marginBottom: 14 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  cardText: { color: '#6b7280', marginTop: 8, lineHeight: 21 },
  backButton: { marginTop: 14, backgroundColor: '#1f2937', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  backButtonText: { color: '#fff', fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});