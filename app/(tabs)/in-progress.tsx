import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chaseApi, type Chase } from '@/src/lib/chase-api';
import { useHunts } from '@/src/state/HuntsContext';
import { colors, glassCard, radii } from '@/src/theme';

export default function InProgressScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { acceptedHunts, abandonHunt } = useHunts();
  const [hunts, setHunts] = useState<Chase[]>([]);

  useEffect(() => {
    chaseApi.getChases().then(setHunts).catch(() => setHunts([]));
  }, []);

  const inProgress = useMemo(
    () => hunts.filter((hunt) => Boolean(acceptedHunts[hunt.id])),
    [hunts, acceptedHunts]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <Text style={styles.header}>🎯 Chasses en cours</Text>
      <Text style={styles.subheader}>
        {inProgress.length === 0
          ? 'Aucune chasse acceptée pour le moment'
          : `${inProgress.length} chasse${inProgress.length > 1 ? 's' : ''} active${inProgress.length > 1 ? 's' : ''}`}
      </Text>

      <FlatList
        data={inProgress}
        keyExtractor={(hunt) => hunt.id}
        contentContainerStyle={{ paddingBottom: 24, gap: 12 }}
        ListEmptyComponent={
          <Pressable style={styles.emptyCard} onPress={() => router.push('/(tabs)/chases')}>
            <Text style={styles.emptyTitle}>Pars à l'aventure !</Text>
            <Text style={styles.emptyText}>
              Découvre les chasses disponibles autour de toi et accepte ta première quête.
            </Text>
            <Text style={styles.emptyCta}>Voir les chasses disponibles →</Text>
          </Pressable>
        }
        renderItem={({ item: hunt }) => {
          const progress = acceptedHunts[hunt.id];
          const completed = progress?.completedStepIds.length ?? 0;
          const total = hunt.steps.length;
          const ratio = total > 0 ? completed / total : 0;
          const nextStep = hunt.steps.find((step) => !progress?.completedStepIds.includes(step.id));

          return (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{hunt.title}</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(ratio * 100)}%` }]} />
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardMeta}>
                  Étape {Math.min(completed + 1, total)}/{total}
                  {nextStep ? ` · ${nextStep.title}` : ' · Terminée 🎉'}
                </Text>
                <Pressable style={styles.resumeButton} onPress={() => router.push(`/chases/${hunt.id}`)}>
                  <Text style={styles.resumeText}>Reprendre</Text>
                </Pressable>
              </View>
              <Pressable onPress={() => abandonHunt(hunt.id)}>
                <Text style={styles.abandon}>Abandonner la chasse</Text>
              </Pressable>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 16 },
  header: { fontSize: 26, fontWeight: '900', color: colors.foreground },
  subheader: { color: colors.textMuted, fontSize: 13, marginTop: 4, marginBottom: 16 },
  card: { ...glassCard, padding: 16 },
  cardTitle: { color: colors.foreground, fontSize: 16, fontWeight: '900' },
  progressTrack: { height: 9, borderRadius: radii.pill, backgroundColor: colors.glass, borderColor: colors.glassBorder, borderWidth: 1, overflow: 'hidden', marginTop: 12 },
  progressFill: { height: '100%', backgroundColor: colors.teal },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  cardMeta: { color: colors.textMuted, fontSize: 12, fontWeight: '600', flexShrink: 1, marginRight: 8 },
  resumeButton: { backgroundColor: colors.gold, borderRadius: radii.pill, paddingHorizontal: 14, paddingVertical: 7 },
  resumeText: { color: colors.background, fontWeight: '900', fontSize: 12 },
  abandon: { color: colors.textFaint, fontSize: 11, marginTop: 12, textDecorationLine: 'underline' },
  emptyCard: { ...glassCard, padding: 24, alignItems: 'center', marginTop: 24 },
  emptyTitle: { color: colors.foreground, fontSize: 17, fontWeight: '900' },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 19 },
  emptyCta: { color: colors.teal, fontWeight: '800', fontSize: 13, marginTop: 14 },
});
