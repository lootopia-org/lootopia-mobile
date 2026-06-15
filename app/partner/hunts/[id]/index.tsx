import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HuntHeatmap } from '@/src/components/hunts/HuntHeatmap';
import { useAuth } from '@/src/state/AuthContext';
import {
  chaseApi,
  type Chase,
  type HuntAnalytics,
  type HuntParticipant,
} from '@/src/lib/chase-api';
import { useCatalogHuntEvents } from '@/src/hooks/use-catalog-hunt-events';
import { colors, glassCard, glassStrongCard, radii } from '@/src/theme';

export default function PartnerHuntDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation(['hunts', 'partner', 'common']);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [chase, setChase] = useState<Chase | null>(null);
  const [analytics, setAnalytics] = useState<HuntAnalytics | null>(null);
  const [participants, setParticipants] = useState<HuntParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allowed = user?.role === 'partner' || user?.role === 'admin';

  const load = useCallback(() => {
    if (!id || !allowed) {
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([
      chaseApi.getChase(id),
      chaseApi.getHuntAnalytics(id).catch((): HuntAnalytics | null => null),
      chaseApi.getHuntParticipants(id).catch((): HuntParticipant[] => []),
    ])
      .then(([nextChase, nextAnalytics, nextParticipants]) => {
        setChase(nextChase);
        setAnalytics(nextAnalytics);
        setParticipants(nextParticipants);
      })
      .catch(() => setError(t('partner:hunts.editLoadError')))
      .finally(() => setLoading(false));
  }, [allowed, id, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useCatalogHuntEvents(load);

  const handleDelete = () => {
    if (!id) {
      return;
    }
    Alert.alert(t('partner:editor.deleteConfirmTitle'), t('partner:editor.deleteConfirmMessage'), [
      { text: t('common:cancel'), style: 'cancel' },
      {
        text: t('common:delete'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setDeleting(true);
            try {
              await chaseApi.deleteChase(id);
              router.replace('/(tabs)/field');
            } catch (err) {
              setError(err instanceof Error ? err.message : t('common:errors.deleteFailed'));
            } finally {
              setDeleting(false);
            }
          })();
        },
      },
    ]);
  };

  if (!allowed) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.blocked}>{t('partner:hunts.accessDenied')}</Text>
      </View>
    );
  }

  if (loading && !chase) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  if (error || !chase) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>{error ?? t('partner:hunts.editLoadError')}</Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>{t('common:back')}</Text>
        </Pressable>
      </View>
    );
  }

  const sortedParticipants = [...participants].sort((a, b) => (b.pointsAwarded ?? 0) - (a.pointsAwarded ?? 0));
  const totalPoints = chase.steps.reduce((sum, step) => sum + (step.points ?? step.reward ?? 0), 0);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 32, paddingHorizontal: 16 }}
    >
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>{t('common:back')}</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {chase.title || t('partner:hunts.untitled')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.badges}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{t(`partner:hunts.status.${chase.status}`)}</Text>
        </View>
        <View style={[styles.badge, styles.badgeTeal]}>
          <Text style={[styles.badgeText, styles.badgeTextTeal]}>
            {t(`hunts:shared.difficultyLabels.${chase.difficulty}`)}
          </Text>
        </View>
      </View>

      {chase.description ? <Text style={styles.description}>{chase.description}</Text> : null}

      <Text style={styles.meta}>
        {t('hunts:detail.duration', { minutes: chase.estimatedDuration })}
        {' · '}
        {t('hunts:detail.sidebar.stepMeta', { stepCount: chase.steps.length, totalPoints })}
      </Text>

      <Text style={styles.sectionTitle}>{t('hunts:detail.heatmap.title')}</Text>
      {analytics ? <HuntHeatmap analytics={analytics} /> : <ActivityIndicator color={colors.teal} style={{ marginVertical: 16 }} />}

      <Text style={styles.sectionTitle}>{t('hunts:detail.steps.title', { count: chase.steps.length })}</Text>
      {chase.steps.map((step) => (
        <View key={step.id} style={styles.stepCard}>
          <Text style={styles.stepIndex}>{step.order}</Text>
          <View style={styles.stepBody}>
            <Text style={styles.stepTitle}>{step.title}</Text>
            {step.description ? (
              <Text style={styles.stepDescription} numberOfLines={2}>
                {step.description}
              </Text>
            ) : null}
          </View>
        </View>
      ))}

      <Text style={styles.sectionTitle}>{t('hunts:participants.title', { count: participants.length })}</Text>
      {sortedParticipants.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>{t('hunts:participants.empty')}</Text>
        </View>
      ) : (
        sortedParticipants.map((participant) => (
          <View key={participant.userId} style={styles.participantCard}>
            <View style={styles.participantMain}>
              <Text style={styles.participantEmail}>{participant.email}</Text>
              <Text style={styles.participantJoined}>
                {t('hunts:participants.joined', {
                  date: participant.joinedAt
                    ? new Date(participant.joinedAt).toLocaleDateString()
                    : '—',
                })}
              </Text>
            </View>
            <View style={styles.participantBadges}>
              <Text style={[styles.participantStatus, participant.completedAt && styles.participantStatusDone]}>
                {participant.completedAt
                  ? t('hunts:participants.status.completed')
                  : t('hunts:participants.status.inProgress')}
              </Text>
              <Text style={styles.participantPoints}>
                {t('hunts:participants.points', { points: participant.pointsAwarded ?? 0 })}
              </Text>
            </View>
          </View>
        ))
      )}

      <View style={styles.actions}>
        <Pressable
          style={styles.editButton}
          onPress={() => router.push(`/partner/hunts/${chase.id}/edit`)}
        >
          <Text style={styles.editButtonText}>{t('partner:hunts.detail.edit')}</Text>
        </Pressable>
        <Pressable style={styles.deleteButton} onPress={handleDelete} disabled={deleting}>
          {deleting ? (
            <ActivityIndicator color={colors.danger} size="small" />
          ) : (
            <Text style={styles.deleteButtonText}>{t('partner:hunts.detail.delete')}</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { alignItems: 'center', justifyContent: 'center' },
  blocked: { color: colors.textMuted, fontWeight: '700' },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  back: { color: colors.teal, fontWeight: '700', fontSize: 14, width: 70 },
  headerTitle: { flex: 1, textAlign: 'center', color: colors.foreground, fontWeight: '900', fontSize: 18 },
  headerSpacer: { width: 70 },
  backLink: { marginTop: 16 },
  backLinkText: { color: colors.teal, fontWeight: '700' },
  badges: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  badge: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.goldSoft,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgeTeal: { borderColor: colors.teal, backgroundColor: colors.tealSoft },
  badgeText: { color: colors.gold, fontWeight: '800', fontSize: 11 },
  badgeTextTeal: { color: colors.teal },
  description: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 8 },
  meta: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 16 },
  sectionTitle: { color: colors.foreground, fontWeight: '900', fontSize: 16, marginTop: 18, marginBottom: 10 },
  stepCard: { ...glassCard, flexDirection: 'row', gap: 12, padding: 12, marginBottom: 8 },
  stepIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.goldSoft,
    borderColor: colors.gold,
    borderWidth: 1,
    color: colors.gold,
    fontWeight: '900',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 26,
  },
  stepBody: { flex: 1 },
  stepTitle: { color: colors.foreground, fontWeight: '800', fontSize: 14 },
  stepDescription: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  emptyCard: { ...glassCard, padding: 20, marginBottom: 8 },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  participantCard: {
    ...glassCard,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  participantMain: { flex: 1 },
  participantEmail: { color: colors.foreground, fontWeight: '800', fontSize: 13 },
  participantJoined: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
  participantBadges: { alignItems: 'flex-end', gap: 4 },
  participantStatus: { color: colors.textMuted, fontWeight: '800', fontSize: 10 },
  participantStatusDone: { color: colors.teal },
  participantPoints: { color: colors.gold, fontWeight: '800', fontSize: 11 },
  actions: { gap: 10, marginTop: 24 },
  editButton: {
    backgroundColor: colors.gold,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  editButtonText: { color: colors.background, fontWeight: '900', fontSize: 14 },
  deleteButton: {
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radii.md,
    backgroundColor: 'rgba(248,113,113,0.08)',
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteButtonText: { color: colors.danger, fontWeight: '800', fontSize: 14 },
  errorText: { color: colors.textMuted, fontWeight: '700' },
});
