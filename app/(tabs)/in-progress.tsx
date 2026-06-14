import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chaseApi, type Chase } from '@/src/lib/chase-api';
import { useHunts } from '@/src/state/HuntsContext';
import { useLiveEventsContext } from '@/src/state/LiveEventsContext';
import { colors, glassCard, radii } from '@/src/theme';

export default function InProgressScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { acceptedHunts, abandonHunt, setHuntPaused } = useHunts();
  const { subscribeHuntEvents } = useLiveEventsContext();
  const [hunts, setHunts] = useState<Chase[]>([]);

  const loadHunts = useCallback(() => {
    chaseApi.getJoinedHunts().then(setHunts).catch(() => setHunts([]));
  }, []);

  useEffect(() => {
    loadHunts();
  }, [loadHunts]);

  useEffect(() => subscribeHuntEvents(() => loadHunts()), [subscribeHuntEvents, loadHunts]);

  const inProgress = hunts;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <Text style={styles.header}>En cours</Text>

      <FlatList
        data={inProgress}
        keyExtractor={(hunt) => hunt.id}
        contentContainerStyle={{ paddingBottom: 24, gap: 12 }}
        ListEmptyComponent={
          <Pressable style={styles.emptyCard} onPress={() => router.push('/(tabs)/chases')}>
            <Text style={styles.emptyText}>Aucune chasse en cours</Text>
            <Text style={styles.emptyCta}>Voir les chasses</Text>
          </Pressable>
        }
        renderItem={({ item: hunt }) => {
          const progress = acceptedHunts[hunt.id];
          const completed = progress?.completedStepIds.length ?? 0;
          const total = hunt.steps.length;
          const ratio = total > 0 ? completed / total : 0;
          const nextStep = hunt.steps.find((step) => !progress?.completedStepIds.includes(step.id));
          const playerPaused = Boolean(progress?.paused);
          const livePaused = hunt.status === 'paused';

          return (
            <View style={[styles.card, (playerPaused || livePaused) && styles.cardPaused]}>
              <View style={styles.titleRow}>
                <Text style={styles.cardTitle}>{hunt.title}</Text>
                {livePaused ? (
                  <View style={[styles.statusPill, styles.statusPillDanger]}>
                    <Text style={styles.statusPillDangerText}>⛔ Suspendue par l'organisateur</Text>
                  </View>
                ) : playerPaused ? (
                  <View style={styles.statusPill}>
                    <Text style={styles.statusPillText}>⏸ En pause</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(ratio * 100)}%` }]} />
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardMeta}>
                  Étape {Math.min(completed + 1, total)}/{total}
                  {nextStep ? ` · ${nextStep.title}` : ' · Terminée 🎉'}
                </Text>
                <View style={styles.actionsRow}>
                  {!livePaused && (
                    <Pressable
                      style={styles.pauseButton}
                      onPress={() => setHuntPaused(hunt.id, !playerPaused)}
                    >
                      <Text style={styles.pauseText}>{playerPaused ? '▶ Reprendre' : '⏸ Pause'}</Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={[styles.resumeButton, (playerPaused || livePaused) && styles.resumeDisabled]}
                    disabled={playerPaused || livePaused}
                    onPress={() => router.push(`/chases/${hunt.id}`)}
                  >
                    <Text style={styles.resumeText}>Jouer</Text>
                  </Pressable>
                </View>
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
  header: { fontSize: 26, fontWeight: '900', color: colors.foreground, marginBottom: 16 },
  card: { ...glassCard, padding: 16 },
  cardPaused: { opacity: 0.75 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  statusPill: { backgroundColor: colors.goldSoft, borderColor: colors.gold, borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: 9, paddingVertical: 3 },
  statusPillText: { color: colors.gold, fontSize: 10, fontWeight: '900' },
  statusPillDanger: { backgroundColor: 'rgba(248,113,113,0.12)', borderColor: colors.danger },
  statusPillDangerText: { color: colors.danger, fontSize: 10, fontWeight: '900' },
  actionsRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  pauseButton: { borderColor: colors.glassBorderStrong, borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: colors.glass },
  pauseText: { color: colors.foreground, fontWeight: '800', fontSize: 11 },
  resumeDisabled: { opacity: 0.45 },
  cardTitle: { color: colors.foreground, fontSize: 16, fontWeight: '900', flexShrink: 1 },
  progressTrack: { height: 9, borderRadius: radii.pill, backgroundColor: colors.glass, borderColor: colors.glassBorder, borderWidth: 1, overflow: 'hidden', marginTop: 12 },
  progressFill: { height: '100%', backgroundColor: colors.teal },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  cardMeta: { color: colors.textMuted, fontSize: 12, fontWeight: '600', flexShrink: 1, marginRight: 8 },
  resumeButton: { backgroundColor: colors.gold, borderRadius: radii.pill, paddingHorizontal: 14, paddingVertical: 7 },
  resumeText: { color: colors.background, fontWeight: '900', fontSize: 12 },
  abandon: { color: colors.textFaint, fontSize: 11, marginTop: 12, textDecorationLine: 'underline' },
  emptyCard: { ...glassCard, padding: 24, alignItems: 'center', marginTop: 24 },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },
  emptyCta: { color: colors.teal, fontWeight: '800', fontSize: 13, marginTop: 10 },
});
