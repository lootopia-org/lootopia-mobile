import React, { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, Text, View, Pressable, StyleSheet, ImageBackground } from 'react-native';
import { useAuth } from '@/src/state/AuthContext';
import { ChaseMap } from '@/src/components/ChaseMap';
import { chaseApi, type Chase, type UserProgress } from '@/src/lib/chase-api';

export default function ChaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [chase, setChase] = useState<Chase | null>(null);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      return;
    }

    (async () => {
      try {
        setIsLoading(true);
        setError(null);
        const [nextChase, nextProgress] = await Promise.all([
          chaseApi.getChase(id),
          chaseApi.getProgress(id),
        ]);
        setChase(nextChase);
        setProgress(nextProgress);
      } catch {
        setError('Chasse introuvable.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [id]);

  const activeStep = useMemo(() => {
    if (!progress || !chase) {
      return null;
    }

    return chase.steps[Math.max(0, progress.currentStep - 1)] ?? chase.steps[0];
  }, [chase, progress]);

  const handleStartOrContinue = async () => {
    if (!chase) return;

    try {
      const nextProgress = progress ?? (await chaseApi.startChase(chase.id));
      setProgress(nextProgress);
      router.push(`/ar/${chase.id}?stepId=${activeStep?.id ?? chase.steps[0]?.id}`);
    } catch {
      setError('Impossible de démarrer la chasse.');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ff6b35" />
      </View>
    );
  }

  if (!chase) {
    return <View style={styles.center}><Text>Chasse introuvable.</Text></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
      <ImageBackground source={{ uri: chase.image }} style={styles.hero} imageStyle={styles.heroImage}>
        <View style={styles.heroOverlay}>
          <Text style={styles.title}>{chase.title}</Text>
          <Text style={styles.description}>{chase.description}</Text>
        </View>
      </ImageBackground>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Détail</Text>
        <Text style={styles.meta}>Difficulté: {chase.difficulty}</Text>
          <Text style={styles.meta}>Durée: {chase.estimatedDuration} min</Text>
          <Text style={styles.meta}>Partenaire: {chase.partner.name}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Carte</Text>
        <ChaseMap
          center={chase.location}
          markers={chase.steps.map((step, index) => ({
            latitude: step.location.latitude,
            longitude: step.location.longitude,
            title: step.title,
            description: step.clue,
          }))}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Progression / étapes</Text>
        <Text style={styles.meta}>Étape courante: {progress?.currentStep ?? 1} / {chase.steps.length}</Text>
        {chase.steps.map((step, index) => (
          <View key={step.id} style={styles.step}>
            <Text style={styles.stepTitle}>{index + 1}. {step.title}</Text>
            <Text style={styles.stepText}>{step.clue}</Text>
            <Pressable style={styles.secondaryButton} onPress={() => router.push(`/ar/${chase.id}?stepId=${step.id}&clue=${encodeURIComponent(step.clue)}`)}>
              <Text style={styles.secondaryButtonText}>Ouvrir l’AR</Text>
            </Pressable>
          </View>
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={styles.actionButton} onPress={handleStartOrContinue}>
        <Text style={styles.actionText}>Lancer / Continuer la chasse</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff9f5' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { height: 220, marginTop: 56, marginHorizontal: 16, justifyContent: 'flex-end' },
  heroImage: { borderRadius: 24 },
  heroOverlay: { backgroundColor: 'rgba(17,24,39,0.45)', borderRadius: 24, padding: 16 },
  title: { color: '#fff', fontSize: 24, fontWeight: '800' },
  description: { color: '#f3f4f6', marginTop: 6 },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 18, margin: 16, borderWidth: 1, borderColor: '#f2ddd2' },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1f2937', marginBottom: 8 },
  meta: { color: '#374151', marginTop: 6 },
  step: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f3e1d5' },
  stepTitle: { fontWeight: '700', color: '#111827' },
  stepText: { color: '#6b7280', marginTop: 4 },
  secondaryButton: { marginTop: 10, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#ff6b35', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  secondaryButtonText: { color: '#ff6b35', fontWeight: '800', fontSize: 12 },
  actionButton: { marginHorizontal: 16, marginTop: 4, marginBottom: 24, backgroundColor: '#ff6b35', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  actionText: { color: '#fff', fontWeight: '800' },
  error: { marginHorizontal: 16, marginTop: 4, color: '#b91c1c', fontWeight: '700' },
});