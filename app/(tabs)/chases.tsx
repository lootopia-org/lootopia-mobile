import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { StoredImageBackground } from '@/src/components/StoredImage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chaseApi, type Chase } from '@/src/lib/chase-api';
import { huntJoinErrorMessage } from '@/src/lib/hunt-join-errors';
import { useHunts } from '@/src/state/HuntsContext';
import { colors, glassCard, radii } from '@/src/theme';
import { formatDistance, haversineDistanceMeters, type GeoPoint } from '@/src/lib/geo';

export default function ChasesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation(['hunts', 'common']);
  const { isAccepted, acceptHunt, abandonHunt, canPlayHunts, refreshFromServer } = useHunts();
  const [chases, setChases] = useState<Chase[]>([]);
  const [position, setPosition] = useState<GeoPoint | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (canPlayHunts) {
      void refreshFromServer();
    }
  }, [canPlayHunts, refreshFromServer]);

  const loadChases = useCallback(async () => {
    try {
      setError(null);
      setChases(await chaseApi.getChases());
    } catch {
      setError(t('hunts:catalog.errors.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      void loadChases();
    }, [loadChases])
  );

  useEffect(() => {
    (async () => {
      const permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted) {
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setPosition({ latitude: current.coords.latitude, longitude: current.coords.longitude });
    })();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  const sorted = position
    ? [...chases].sort(
        (a, b) =>
          haversineDistanceMeters(position, a.location) - haversineDistanceMeters(position, b.location)
      )
    : chases;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <Text style={styles.header}>{t('hunts:catalog.pageHeading')}</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24, gap: 14 }}
        renderItem={({ item }) => {
          const accepted = isAccepted(item.id);
          const distance = position ? haversineDistanceMeters(position, item.location) : null;
          return (
            <Pressable onPress={() => router.push(`/chases/${item.id}`)} style={styles.cardWrap}>
              {item.image ? (
                <StoredImageBackground storedUrl={item.image} style={styles.cardImage} imageStyle={styles.cardImageStyle}>
                  <View style={styles.overlay}>{renderCardContent(item, accepted, distance)}</View>
                </StoredImageBackground>
              ) : (
                <View style={[styles.cardImage, styles.cardPlain]}>
                  {renderCardContent(item, accepted, distance)}
                </View>
              )}
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>{t('hunts:catalog.mobileEmpty')}</Text>}
      />
    </View>
  );

  function renderCardContent(item: Chase, accepted: boolean, distance: number | null) {
    return (
      <>
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{t(`hunts:shared.difficultyLabels.${item.difficulty}`)}</Text>
          </View>
          {distance !== null && (
            <View style={[styles.badge, styles.badgeTeal]}>
              <Text style={[styles.badgeText, { color: colors.teal }]}>{formatDistance(distance)}</Text>
            </View>
          )}
          {accepted && (
            <View style={[styles.badge, styles.badgeGold]}>
              <Text style={[styles.badgeText, { color: colors.gold }]}>{t('hunts:catalog.badgeInProgress')}</Text>
            </View>
          )}
        </View>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardSubtitle} numberOfLines={2}>
          {item.description}
        </Text>
        <View style={styles.bottomRow}>
          <Text style={styles.meta}>
            {t('hunts:shared.meta.stepsAndDuration', { count: item.steps.length, minutes: item.estimatedDuration })}
          </Text>
          {!accepted && canPlayHunts && (
            <Pressable
              style={styles.acceptButton}
              disabled={joiningId === item.id}
              onPress={(event) => {
                event.stopPropagation();
                void (async () => {
                  setJoiningId(item.id);
                  try {
                    await acceptHunt(item.id);
                  } catch (err) {
                    Alert.alert(t('hunts:shared.errors.joinFailed'), huntJoinErrorMessage(err, t));
                  } finally {
                    setJoiningId(null);
                  }
                })();
              }}
            >
              <Text style={styles.acceptText}>
                {joiningId === item.id ? '…' : t('common:buttons.accept')}
              </Text>
            </Pressable>
          )}
          {accepted && canPlayHunts && (
            <Pressable
              style={styles.leaveButton}
              disabled={leavingId === item.id}
              onPress={(event) => {
                event.stopPropagation();
                void (async () => {
                  setLeavingId(item.id);
                  try {
                    await abandonHunt(item.id);
                  } catch (err) {
                    Alert.alert(t('hunts:shared.errors.leaveFailed'), huntJoinErrorMessage(err, t));
                  } finally {
                    setLeavingId(null);
                  }
                })();
              }}
            >
              <Text style={styles.leaveText}>
                {leavingId === item.id ? '…' : t('hunts:shared.abandon')}
              </Text>
            </Pressable>
          )}
        </View>
      </>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 16 },
  header: { fontSize: 26, fontWeight: '900', color: colors.foreground, marginBottom: 16 },
  cardWrap: { borderRadius: radii.lg, overflow: 'hidden', borderColor: colors.glassBorder, borderWidth: 1 },
  cardImage: { minHeight: 160, justifyContent: 'flex-end' },
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
  badgeTeal: { borderColor: colors.teal },
  badgeGold: { borderColor: colors.gold },
  badgeText: { color: colors.foreground, fontSize: 10, fontWeight: '800' },
  cardTitle: { color: colors.foreground, fontSize: 19, fontWeight: '900' },
  cardSubtitle: { color: 'rgba(248,250,252,0.75)', marginTop: 4, fontSize: 12, lineHeight: 17 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  meta: { color: colors.gold, fontWeight: '700', fontSize: 11 },
  acceptButton: { backgroundColor: colors.gold, borderRadius: radii.pill, paddingHorizontal: 14, paddingVertical: 6 },
  acceptText: { color: colors.background, fontWeight: '900', fontSize: 12 },
  leaveButton: {
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  leaveText: { color: colors.danger, fontWeight: '900', fontSize: 12 },
  error: { color: colors.danger, marginBottom: 12, fontWeight: '700' },
  empty: { textAlign: 'center', marginTop: 24, color: colors.textMuted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
