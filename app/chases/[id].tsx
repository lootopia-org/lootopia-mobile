import React, { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, Text, View, Pressable, StyleSheet, ImageBackground } from 'react-native';
import { useAuth } from '@/src/state/AuthContext';
import { useHunts } from '@/src/state/HuntsContext';
import { ChaseMap } from '@/src/components/ChaseMap';
import { chaseApi, type Chase, type UserProgress } from '@/src/lib/chase-api';
import { colors, glassCard, radii } from '@/src/theme';

export default function ChaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { isAccepted, acceptHunt } = useHunts();
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

  // Bouton de lancement UNIQUE : un seul geste accepte la chasse si besoin
  // (POST /hunt/join via HuntsContext), initialise la progression, puis ouvre
  // directement l'étape courante en AR. Plus de parcours en plusieurs étapes.
  const handleLaunch = async () => {
    if (!chase) return;

    try {
      if (!isAccepted(chase.id)) {
        await acceptHunt(chase.id);
      }
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
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  if (!chase) {
    return <View style={styles.center}><Text style={styles.notFoundText}>Chasse introuvable.</Text></View>;
  }

  const accepted = isAccepted(chase.id);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
      <ImageBackground source={{ uri: chase.image }} style={styles.hero} imageStyle={styles.heroImage}>
        <View style={styles.heroOverlay}>
          <Text style={styles.title}>{chase.title}</Text>
          <Text style={styles.description}>{chase.description}</Text>
        </View>
      </ImageBackground>

      {/* Statut : l'acceptation passe désormais par le bouton de lancement unique. */}
      {accepted && (
        <View style={styles.acceptedBanner}>
          <Text style={styles.acceptedBannerText}>Chasse en cours ✓</Text>
        </View>
      )}

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
          // Seules les étapes géolocalisées (checkpoint) ont une position ;
          // les étapes "riddle" (réponse) n'apparaissent pas sur la carte.
          markers={chase.steps
            .filter((step) => step.location)
            .map((step) => ({
              latitude: step.location!.latitude,
              longitude: step.location!.longitude,
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
      <Pressable style={styles.actionButton} onPress={handleLaunch}>
        <Text style={styles.actionText}>
          {progress || accepted ? '▶ Continuer la chasse' : '🚀 Lancer la chasse'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  notFoundText: { color: colors.textMuted, fontWeight: '700' },
  hero: { height: 220, marginTop: 56, marginHorizontal: 16, justifyContent: 'flex-end' },
  heroImage: { borderRadius: radii.lg },
  heroOverlay: { backgroundColor: 'rgba(11,15,26,0.55)', borderRadius: radii.lg, padding: 16 },
  title: { color: colors.foreground, fontSize: 24, fontWeight: '900' },
  description: { color: colors.textMuted, marginTop: 6 },
  acceptButton: { marginHorizontal: 16, marginTop: 16, backgroundColor: colors.gold, paddingVertical: 16, borderRadius: radii.md, alignItems: 'center' },
  acceptButtonText: { color: colors.background, fontWeight: '900', fontSize: 15 },
  acceptedBanner: { marginHorizontal: 16, marginTop: 16, backgroundColor: colors.tealSoft, borderColor: colors.teal, borderWidth: 1, paddingVertical: 14, borderRadius: radii.md, alignItems: 'center' },
  acceptedBannerText: { color: colors.teal, fontWeight: '900', fontSize: 15 },
  card: { ...glassCard, padding: 18, margin: 16, marginBottom: 0 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.foreground, marginBottom: 8 },
  meta: { color: colors.textMuted, marginTop: 6 },
  step: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.glassBorder },
  stepTitle: { fontWeight: '700', color: colors.foreground },
  stepText: { color: colors.textMuted, marginTop: 4 },
  secondaryButton: { marginTop: 10, alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.teal, backgroundColor: colors.tealSoft, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 10 },
  secondaryButtonText: { color: colors.teal, fontWeight: '800', fontSize: 12 },
  actionButton: { marginHorizontal: 16, marginTop: 16, marginBottom: 24, backgroundColor: colors.gold, paddingVertical: 16, borderRadius: radii.md, alignItems: 'center' },
  actionText: { color: colors.background, fontWeight: '900' },
  error: { marginHorizontal: 16, marginTop: 16, color: colors.danger, fontWeight: '700' },
});