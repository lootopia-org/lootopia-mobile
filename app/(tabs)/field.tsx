import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import MapView, { Circle, PROVIDER_DEFAULT } from 'react-native-maps';
import { useAuth } from '@/src/state/AuthContext';
import { useLiveOps } from '@/src/state/LiveOpsContext';
import { useLiveEventsContext } from '@/src/state/LiveEventsContext';
import { chaseApi, type Chase } from '@/src/lib/chase-api';
import { clearHeatmap, getHeatCells, type HeatCell } from '@/src/lib/heatmap';
import type { GeoPoint } from '@/src/lib/geo';
import { colors, darkMapStyle, glassCard, glassStrongCard, radii } from '@/src/theme';

type Section = 'creation' | 'liveops' | 'heatmap';

const SECTION_KEYS: Section[] = ['creation', 'liveops', 'heatmap'];

const HEATMAP_FALLBACK_CENTER: GeoPoint = { latitude: 37.8044, longitude: -122.2712 };

const getCurrentPoint = async (): Promise<GeoPoint | null> => {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    return null;
  }
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { latitude: position.coords.latitude, longitude: position.coords.longitude };
};

export default function FieldScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation(['hunts', 'common']);
  const { user } = useAuth();
  const [section, setSection] = useState<Section>('creation');

  const allowed = user?.role === 'partner' || user?.role === 'admin';

  if (!allowed) {
    return (
      <View style={[styles.container, styles.blockedContainer, { paddingTop: insets.top + 16 }]}>
        <View style={styles.blockedCard}>
          <Text style={styles.blockedTitle}>{t('common:organizerOnly.fieldTab')}</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32, paddingHorizontal: 16 }}
    >
      <Text style={styles.header}>{t('partner:field.header')}</Text>

      <View style={styles.segments}>
        {SECTION_KEYS.map((key) => {
          const active = section === key;
          return (
            <Pressable
              key={key}
              style={[styles.segment, active && styles.segmentActive]}
              onPress={() => setSection(key)}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {t(`partner:field.segments.${key}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {section === 'creation' ? <CreationSection /> : null}
      {section === 'liveops' ? <LiveOpsSection /> : null}
      {section === 'heatmap' ? <HeatmapSection /> : null}
    </ScrollView>
  );
}

function CreationSection() {
  const router = useRouter();
  const { t } = useTranslation(['hunts', 'common']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startHere = async () => {
    setError(null);
    setLoading(true);
    try {
      const point = await getCurrentPoint();
      if (!point) {
        setError(t('partner:field.creation.errors.locationDenied'));
        return;
      }
      router.push(`/partner/hunts/new?lat=${point.latitude}&lng=${point.longitude}`);
    } catch {
      setError(t('partner:field.creation.errors.gpsUnavailable'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.creation}>
      <Pressable style={styles.primaryButton} onPress={() => router.push('/partner/hunts')}>
        <Text style={styles.primaryButtonText}>{t('partner:field.creation.myHunts')}</Text>
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={() => void startHere()} disabled={loading}>
        {loading ? (
          <ActivityIndicator color={colors.teal} size="small" />
        ) : (
          <Text style={styles.secondaryButtonText}>{t('partner:field.creation.newHuntHere')}</Text>
        )}
      </Pressable>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function LiveOpsSection() {
  const { t } = useTranslation(['hunts', 'common']);
  const { user } = useAuth();
  const { setStepPaused, setStepRedirect, clearStepRedirect, getStepOverride, syncFromServer } =
    useLiveOps();
  const { subscribeHuntEvents } = useLiveEventsContext();
  const [chases, setChases] = useState<Chase[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedChaseId, setExpandedChaseId] = useState<string | null>(null);
  const [redirectingStepId, setRedirectingStepId] = useState<string | null>(null);
  const [redirectError, setRedirectError] = useState<string | null>(null);
  const [pausingChaseId, setPausingChaseId] = useState<string | null>(null);
  const [pauseError, setPauseError] = useState<string | null>(null);

  const loadChases = () => {
    if (!user?.id) {
      return;
    }
    setLoading(true);
    chaseApi
      .getManagedChases(user.id)
      .then(async (loaded) => {
        setChases(loaded);
        await Promise.all(loaded.map((chase) => syncFromServer(chase.id)));
      })
      .catch(() => setChases([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadChases();
  }, [user?.id]);

  useEffect(() => subscribeHuntEvents(() => loadChases()), [subscribeHuntEvents]);

  const handleToggleHuntPause = async (chase: Chase) => {
    setPauseError(null);
    setPausingChaseId(chase.id);
    try {
      const updated =
        chase.status === 'paused'
          ? await chaseApi.resumeChase(chase.id)
          : await chaseApi.pauseChase(chase.id);
      setChases((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setPauseError(err instanceof Error ? err.message : t('partner:field.liveops.errors.modifyFailed'));
    } finally {
      setPausingChaseId(null);
    }
  };

  const handleRedirect = async (huntId: string, stepId: string) => {
    setRedirectError(null);
    setRedirectingStepId(stepId);
    try {
      const point = await getCurrentPoint();
      if (!point) {
        setRedirectError(t('partner:field.liveops.errors.locationDenied'));
        return;
      }
      await setStepRedirect(huntId, stepId, point);
    } catch {
      setRedirectError(t('partner:field.liveops.errors.gpsUnavailable'));
    } finally {
      setRedirectingStepId(null);
    }
  };

  return (
    <View>
      {loading ? <ActivityIndicator color={colors.teal} style={{ marginTop: 24 }} /> : null}
      {!loading && chases.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>{t('partner:field.liveops.empty')}</Text>
        </View>
      ) : null}

      {pauseError ? <Text style={styles.errorText}>{pauseError}</Text> : null}

      {chases.map((chase) => {
        const paused = chase.status === 'paused';
        const expanded = expandedChaseId === chase.id;
        const isPausing = pausingChaseId === chase.id;
        return (
          <View key={chase.id} style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {chase.title}
              </Text>
              {paused ? (
                <View style={[styles.badge, styles.badgePaused]}>
                  <Text style={[styles.badgeText, styles.badgeTextPaused]}>{t('partner:field.liveops.huntPause.badge')}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.cardMeta}>
              {t('partner:field.liveops.meta', {
                stepCount: chase.steps.length,
                suffix: chase.steps.length > 1 ? 's' : '',
                participants: chase.participants,
              })}
            </Text>

            <Pressable
              style={[styles.pauseHuntButton, paused && styles.pauseHuntButtonActive]}
              disabled={isPausing}
              onPress={() => void handleToggleHuntPause(chase)}
            >
              {isPausing ? (
                <ActivityIndicator color={paused ? colors.teal : colors.danger} size="small" />
              ) : (
                <Text style={[styles.pauseHuntText, paused && styles.pauseHuntTextActive]}>
                  {paused ? t('partner:field.liveops.huntPause.resume') : t('partner:field.liveops.huntPause.suspend')}
                </Text>
              )}
            </Pressable>

            <Pressable onPress={() => setExpandedChaseId(expanded ? null : chase.id)}>
              <Text style={styles.expandSteps}>
                {expanded ? t('partner:field.liveops.expandSteps.hide') : t('partner:field.liveops.expandSteps.show')}
              </Text>
            </Pressable>

            {expanded
              ? chase.steps.map((step) => {
                  const override = getStepOverride(chase.id, step.id);
                  const stepPaused = Boolean(override?.paused);
                  const redirected = Boolean(override?.redirect);
                  return (
                    <View key={step.id} style={styles.liveStepCard}>
                      <View style={styles.stepHeaderRow}>
                        <Text style={styles.stepIndex}>{step.order}</Text>
                        <View style={styles.stepTitleWrap}>
                          <Text style={styles.liveStepTitle} numberOfLines={1}>
                            {step.title}
                          </Text>
                          {redirected ? (
                            <Text style={styles.redirectedLabel}>
                              → {override?.redirect?.location.latitude.toFixed(5)},{' '}
                              {override?.redirect?.location.longitude.toFixed(5)}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      <View style={styles.liveStepActions}>
                        <Pressable
                          style={[styles.smallAction, stepPaused && styles.smallActionPausedActive]}
                          onPress={() => void setStepPaused(chase.id, step.id, !stepPaused)}
                        >
                          <Text style={[styles.smallActionText, stepPaused && styles.smallActionTextPaused]}>
                            {stepPaused
                              ? t('partner:field.liveops.stepActions.resume')
                              : t('partner:field.liveops.stepActions.suspend')}
                          </Text>
                        </Pressable>
                        {redirected ? (
                          <Pressable
                            style={styles.smallAction}
                            onPress={() => void clearStepRedirect(chase.id, step.id)}
                          >
                            <Text style={styles.smallActionTextTeal}>{t('partner:field.liveops.stepActions.cancelRedirect')}</Text>
                          </Pressable>
                        ) : (
                          <Pressable
                            style={styles.smallAction}
                            onPress={() => void handleRedirect(chase.id, step.id)}
                            disabled={redirectingStepId === step.id}
                          >
                            {redirectingStepId === step.id ? (
                              <ActivityIndicator size="small" color={colors.teal} />
                            ) : (
                              <Text style={styles.smallActionTextTeal}>{t('partner:field.liveops.stepActions.redirectHere')}</Text>
                            )}
                          </Pressable>
                        )}
                      </View>
                    </View>
                  );
                })
              : null}
            {expanded && redirectError ? <Text style={styles.errorText}>{redirectError}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

function HeatmapSection() {
  const { t } = useTranslation(['hunts', 'common']);
  const [cells, setCells] = useState<HeatCell[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    setLoading(true);
    getHeatCells()
      .then(setCells)
      .catch(() => setCells([]))
      .finally(() => setLoading(false));
  };

  useEffect(reload, []);

  const handleClear = async () => {
    await clearHeatmap();
    setCells([]);
  };

  const center = cells[0] ?? HEATMAP_FALLBACK_CENTER;
  const totalPoints = cells.reduce((sum, cell) => sum + cell.weight, 0);

  return (
    <View>
      <View style={styles.mapCard}>
        <MapView
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          customMapStyle={darkMapStyle}
          initialRegion={{
            latitude: center.latitude,
            longitude: center.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }}
        >
          {cells.map((cell, index) => (
            <Circle
              key={`${cell.latitude}-${cell.longitude}-${index}`}
              center={{ latitude: cell.latitude, longitude: cell.longitude }}
              radius={Math.min(30 + cell.weight * 10, 80)}
              fillColor={`rgba(212, 175, 55, ${Math.min(0.12 + cell.weight * 0.06, 0.5)})`}
              strokeColor="transparent"
            />
          ))}
        </MapView>
      </View>

      <View style={styles.heatStatsRow}>
        <View style={styles.heatStat}>
          <Text style={styles.heatStatValue}>{cells.length}</Text>
          <Text style={styles.heatStatLabel}>{t('partner:field.heatmap.stats.cells')}</Text>
        </View>
        <View style={styles.heatStat}>
          <Text style={[styles.heatStatValue, { color: colors.gold }]}>{totalPoints}</Text>
          <Text style={styles.heatStatLabel}>{t('partner:field.heatmap.stats.points')}</Text>
        </View>
      </View>

      {loading ? <ActivityIndicator color={colors.teal} style={{ marginTop: 12 }} /> : null}
      {!loading && cells.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>{t('partner:field.heatmap.empty')}</Text>
        </View>
      ) : null}

      <Pressable style={styles.clearButton} onPress={() => void handleClear()}>
        <Text style={styles.clearButtonText}>{t('partner:field.heatmap.clear')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { fontSize: 28, fontWeight: '900', color: colors.foreground, marginBottom: 16 },
  blockedContainer: { paddingHorizontal: 16, justifyContent: 'center' },
  blockedCard: { ...glassStrongCard, padding: 28, alignItems: 'center' },
  blockedTitle: { color: colors.foreground, fontSize: 16, fontWeight: '800' },
  segments: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  segment: {
    flex: 1,
    borderColor: colors.glassBorder,
    borderWidth: 1,
    borderRadius: radii.pill,
    backgroundColor: colors.glass,
    paddingVertical: 9,
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: colors.goldSoft, borderColor: colors.gold },
  segmentText: { color: colors.textMuted, fontWeight: '800', fontSize: 13 },
  segmentTextActive: { color: colors.gold },
  creation: { gap: 12 },
  primaryButton: {
    backgroundColor: colors.gold,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: { color: colors.background, fontWeight: '900', fontSize: 14 },
  secondaryButton: {
    borderColor: colors.teal,
    borderWidth: 1,
    borderRadius: radii.md,
    backgroundColor: colors.tealSoft,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: { color: colors.teal, fontWeight: '800', fontSize: 14 },
  emptyCard: { ...glassCard, padding: 20, marginTop: 4, marginBottom: 12 },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  errorText: { color: colors.danger, fontSize: 12, marginTop: 8 },
  card: { ...glassCard, padding: 16, marginBottom: 12 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { color: colors.foreground, fontSize: 16, fontWeight: '900', flexShrink: 1 },
  cardMeta: { color: colors.textMuted, fontSize: 12, marginTop: 5 },
  badge: { borderRadius: radii.pill, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 3 },
  badgePaused: { backgroundColor: 'rgba(248,113,113,0.12)', borderColor: colors.danger },
  badgeText: { fontSize: 10, fontWeight: '800' },
  badgeTextPaused: { color: colors.danger },
  pauseHuntButton: {
    marginTop: 12,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radii.md,
    backgroundColor: 'rgba(248,113,113,0.08)',
    paddingVertical: 11,
    alignItems: 'center',
  },
  pauseHuntButtonActive: { backgroundColor: colors.tealSoft, borderColor: colors.teal },
  pauseHuntText: { color: colors.danger, fontWeight: '800', fontSize: 13 },
  pauseHuntTextActive: { color: colors.teal },
  expandSteps: { color: colors.teal, fontWeight: '800', fontSize: 12, marginTop: 12 },
  liveStepCard: { ...glassStrongCard, padding: 12, marginTop: 10 },
  stepHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepIndex: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.goldSoft,
    borderColor: colors.gold,
    borderWidth: 1,
    color: colors.gold,
    fontWeight: '900',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 24,
  },
  stepTitleWrap: { flex: 1 },
  liveStepTitle: { color: colors.foreground, fontSize: 13, fontWeight: '800' },
  redirectedLabel: { color: colors.gold, fontSize: 11, fontWeight: '700', marginTop: 3 },
  liveStepActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  smallAction: {
    borderColor: colors.glassBorderStrong,
    borderWidth: 1,
    borderRadius: radii.pill,
    backgroundColor: colors.glass,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  smallActionPausedActive: { backgroundColor: 'rgba(248,113,113,0.12)', borderColor: colors.danger },
  smallActionText: { color: colors.textMuted, fontWeight: '800', fontSize: 11 },
  smallActionTextPaused: { color: colors.danger },
  smallActionTextTeal: { color: colors.teal, fontWeight: '800', fontSize: 11 },
  mapCard: { ...glassCard, overflow: 'hidden', marginBottom: 12 },
  map: { height: 320, width: '100%' },
  heatStatsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  heatStat: { ...glassCard, flex: 1, paddingVertical: 14, alignItems: 'center' },
  heatStatValue: { color: colors.foreground, fontSize: 22, fontWeight: '900' },
  heatStatLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginTop: 4 },
  clearButton: {
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radii.md,
    backgroundColor: 'rgba(248,113,113,0.08)',
    paddingVertical: 12,
    alignItems: 'center',
  },
  clearButtonText: { color: colors.danger, fontWeight: '800', fontSize: 13 },
});
