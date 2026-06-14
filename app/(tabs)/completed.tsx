import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StoredImageBackground } from '@/src/components/StoredImage';
import { chaseApi, type Chase } from '@/src/lib/chase-api';
import { useHunts } from '@/src/state/HuntsContext';
import { colors, glassCard, radii } from '@/src/theme';

export default function CompletedHuntsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation(['hunts', 'common']);
  const { canPlayHunts, refreshFromServer } = useHunts();
  const [hunts, setHunts] = useState<Chase[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadHunts = useCallback(async () => {
    try {
      setHunts(await chaseApi.getCompletedHunts());
    } catch {
      setHunts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canPlayHunts) {
      void refreshFromServer();
    }
    void loadHunts();
  }, [canPlayHunts, loadHunts, refreshFromServer]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      if (canPlayHunts) {
        void refreshFromServer();
      }
      void loadHunts();
    }, [canPlayHunts, loadHunts, refreshFromServer])
  );

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <Text style={styles.header}>{t('hunts:completedList.heading')}</Text>
      <FlatList
        data={hunts}
        keyExtractor={(hunt) => hunt.id}
        contentContainerStyle={{ paddingBottom: 24, gap: 12 }}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{t('hunts:completedList.empty')}</Text>
          </View>
        }
        renderItem={({ item: hunt }) => (
          <Pressable style={styles.cardWrap} onPress={() => router.push(`/chases/${hunt.id}`)}>
            {hunt.image ? (
              <StoredImageBackground storedUrl={hunt.image} style={styles.cardImage} imageStyle={styles.cardImageStyle}>
                <View style={styles.overlay}>{renderCardContent(hunt)}</View>
              </StoredImageBackground>
            ) : (
              <View style={[styles.cardImage, styles.cardPlain]}>{renderCardContent(hunt)}</View>
            )}
          </Pressable>
        )}
      />
    </View>
  );

  function renderCardContent(hunt: Chase) {
    return (
      <>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, styles.badgeCompleted]}>
            <Text style={[styles.badgeText, styles.badgeCompletedText]}>
              {t('hunts:participants.status.completed')}
            </Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{t(`hunts:shared.difficultyLabels.${hunt.difficulty}`)}</Text>
          </View>
        </View>
        <Text style={styles.cardTitle}>{hunt.title}</Text>
        <Text style={styles.cardSubtitle} numberOfLines={2}>
          {hunt.description}
        </Text>
        <Text style={styles.meta}>
          {t('hunts:shared.meta.stepsAndDuration', { count: hunt.steps.length, minutes: hunt.estimatedDuration })}
        </Text>
      </>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  header: { fontSize: 26, fontWeight: '900', color: colors.foreground, marginBottom: 16 },
  cardWrap: { borderRadius: radii.lg, overflow: 'hidden', borderColor: colors.glassBorder, borderWidth: 1 },
  cardImage: { minHeight: 140, justifyContent: 'flex-end' },
  cardImageStyle: { borderRadius: radii.lg },
  cardPlain: { ...glassCard, padding: 16 },
  overlay: { backgroundColor: 'rgba(11,15,26,0.55)', padding: 16 },
  badgeRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  badge: {
    backgroundColor: 'rgba(11,15,26,0.75)',
    borderColor: colors.glassBorderStrong,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  badgeCompleted: { borderColor: colors.teal, backgroundColor: colors.tealSoft },
  badgeText: { color: colors.foreground, fontSize: 10, fontWeight: '800' },
  badgeCompletedText: { color: colors.teal },
  cardTitle: { color: colors.foreground, fontSize: 18, fontWeight: '900' },
  cardSubtitle: { color: 'rgba(248,250,252,0.75)', marginTop: 4, fontSize: 12, lineHeight: 17 },
  meta: { color: colors.textMuted, fontWeight: '700', fontSize: 11, marginTop: 10 },
  emptyCard: { ...glassCard, padding: 24, alignItems: 'center', marginTop: 24 },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },
});
