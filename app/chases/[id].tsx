import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Modal, ScrollView, Text, View, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { StoredImageBackground } from '@/src/components/StoredImage';
import { QrScanScreen } from '@/src/components/QrScanScreen';
import { huntJoinErrorMessage } from '@/src/lib/hunt-join-errors';
import { useFinishHuntStep } from '@/src/hooks/useFinishHuntStep';
import { useHunts } from '@/src/state/HuntsContext';
import { ChaseMap } from '@/src/components/ChaseMap';
import { chaseApi, type Chase, type ChaseStep, type UserProgress } from '@/src/lib/chase-api';
import { getStepPlayMode, shouldOpenArRoute } from '@/src/lib/step-navigation';
import { stepActionLabel, stepTypeLabel, type HuntStepType } from '@/src/lib/hunt-types';
import { colors, glassCard, radii } from '@/src/theme';

export default function ChaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation(['hunts', 'common']);
  const { isAccepted, isCompleted, acceptHunt, abandonHunt, canPlayHunts, refreshFromServer, acceptedHunts } =
    useHunts();
  const [chase, setChase] = useState<Chase | null>(null);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrScanStep, setQrScanStep] = useState<ChaseStep | null>(null);
  const [isSubmittingQr, setIsSubmittingQr] = useState(false);
  const finishHuntStep = useFinishHuntStep();

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
        setError(t('hunts:shared.errors.notFound'));
      } finally {
        setIsLoading(false);
      }
    })();
  }, [id, t]);

  useEffect(() => {
    if (canPlayHunts) {
      void refreshFromServer();
    }
  }, [canPlayHunts, id, refreshFromServer]);

  useFocusEffect(
    useCallback(() => {
      if (canPlayHunts) {
        void refreshFromServer();
      }
    }, [canPlayHunts, refreshFromServer])
  );

  const openStep = (step: ChaseStep) => {
    if (getStepPlayMode(step) === 'qr_scan') {
      setQrScanStep(step);
      return;
    }
    if (shouldOpenArRoute(step)) {
      router.push(`/ar/${chase!.id}?stepId=${step.id}`);
    }
  };

  const handleContinue = async () => {
    if (!chase || !isAccepted(chase.id)) {
      return;
    }

    try {
      setError(null);
      const nextProgress = progress ?? (await chaseApi.startChase(chase.id, true));
      if (!progress) {
        setProgress(nextProgress);
      }

      const completedIds =
        acceptedHunts[chase.id]?.completedStepIds ??
        (await chaseApi.getCompletedStepIds(chase.id).catch((): string[] => []));
      const currentStep =
        chase.steps.find((step) => !completedIds.includes(step.id)) ?? chase.steps[0];

      if (currentStep) {
        openStep(currentStep);
      }
    } catch (err) {
      setError(huntJoinErrorMessage(err, t));
    }
  };

  const handleQrComplete = async (payload: string) => {
    if (!chase || !qrScanStep || isSubmittingQr) {
      return;
    }

    setIsSubmittingQr(true);
    try {
      const { pointsEarned, huntCompleted } = await finishHuntStep(chase, qrScanStep, payload);
      setQrScanStep(null);
      await refreshFromServer();

      if (pointsEarned > 0) {
        Alert.alert(
          t('hunts:ar.messages.pointsEarned', { points: pointsEarned }),
          huntCompleted ? t('hunts:ar.messages.huntCompleted') : undefined
        );
      } else if (huntCompleted) {
        Alert.alert(t('hunts:ar.messages.huntCompleted'));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common:errors.saveFailed');
      Alert.alert(t('common:errors.operationFailed'), message);
    } finally {
      setIsSubmittingQr(false);
    }
  };

  const handleJoinLeave = async () => {
    if (!chase || !canPlayHunts) {
      return;
    }

    const joined = isAccepted(chase.id);
    setActionLoading(true);
    setError(null);

    try {
      if (joined) {
        await abandonHunt(chase.id);
        setProgress(null);
      } else {
        await acceptHunt(chase.id);
      }
    } catch (err) {
      Alert.alert(
        joined ? t('hunts:shared.errors.leaveFailed') : t('hunts:shared.errors.joinFailed'),
        huntJoinErrorMessage(err, t)
      );
    } finally {
      setActionLoading(false);
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
    return (
      <View style={styles.center}>
        <Text style={styles.notFoundText}>{t('hunts:shared.errors.notFound')}</Text>
      </View>
    );
  }

  const accepted = isAccepted(chase.id);
  const completed = isCompleted(chase.id);
  const completedCount = completed
    ? chase.steps.length
    : (acceptedHunts[chase.id]?.completedStepIds.length ?? 0);
  const difficultyLabel = t(`hunts:shared.difficultyLabels.${chase.difficulty}`);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
      {chase.image ? (
        <StoredImageBackground storedUrl={chase.image} style={styles.hero} imageStyle={styles.heroImage}>
          <View style={styles.heroOverlay}>
            <Text style={styles.title}>{chase.title}</Text>
            <Text style={styles.description}>{chase.description}</Text>
          </View>
        </StoredImageBackground>
      ) : (
        <View style={styles.heroPlain}>
          <Text style={styles.title}>{chase.title}</Text>
          <Text style={styles.description}>{chase.description}</Text>
        </View>
      )}

      {completed && (
        <View style={[styles.acceptedBanner, styles.completedBanner]}>
          <Text style={[styles.acceptedBannerText, styles.completedBannerText]}>
            {t('hunts:detail.bannerCompleted')}
          </Text>
        </View>
      )}

      {accepted && !completed && (
        <View style={styles.acceptedBanner}>
          <Text style={styles.acceptedBannerText}>{t('hunts:detail.bannerInProgress')}</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('hunts:shared.sections.detail')}</Text>
        <Text style={styles.meta}>{t('hunts:shared.meta.detailDifficulty', { difficulty: difficultyLabel })}</Text>
        <Text style={styles.meta}>{t('hunts:shared.meta.detailDuration', { minutes: chase.estimatedDuration })}</Text>
        <Text style={styles.meta}>{t('hunts:shared.meta.detailOrganizer', { name: chase.partner.name })}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('hunts:shared.sections.map')}</Text>
        <ChaseMap
          center={chase.location}
          markers={chase.steps
            .filter((step) => step.location)
            .map((step) => ({
              latitude: step.location!.latitude,
              longitude: step.location!.longitude,
              title: step.title,
              description: step.description,
            }))}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('hunts:shared.sections.steps')}</Text>
        <Text style={styles.meta}>
          {t('hunts:shared.meta.progressCounter', {
            current: completedCount,
            total: chase.steps.length,
          })}
        </Text>
        {chase.steps.map((step, index) => {
          const type = (step.type ?? 'checkpoint') as HuntStepType;
          const stepCompleted =
            completed || (acceptedHunts[chase.id]?.completedStepIds ?? []).includes(step.id);
          return (
            <View key={step.id} style={[styles.step, stepCompleted && styles.stepCompleted]}>
              <View style={styles.stepHeader}>
                <Text style={[styles.stepTitle, stepCompleted && styles.stepTitleCompleted]}>
                  {index + 1}. {step.title}
                </Text>
                <View style={styles.stepBadges}>
                  {stepCompleted && (
                    <View style={styles.completedBadge}>
                      <Text style={styles.completedBadgeText}>{t('hunts:participants.status.completed')}</Text>
                    </View>
                  )}
                  <View style={[styles.typeBadge, stepCompleted && styles.typeBadgeCompleted]}>
                    <Text style={[styles.typeBadgeText, stepCompleted && styles.typeBadgeTextCompleted]}>
                      {stepTypeLabel(type)}
                    </Text>
                  </View>
                </View>
              </View>
              <Text style={[styles.stepText, stepCompleted && styles.stepTextCompleted]}>{step.description}</Text>
              {accepted && !completed && !stepCompleted && (
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => openStep(step)}
                >
                  <Text style={styles.secondaryButtonText}>{stepActionLabel(type)}</Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      {canPlayHunts && !completed && (
        <View style={styles.actions}>
          {accepted && (
            <Pressable
              style={styles.actionButton}
              disabled={actionLoading}
              onPress={() => void handleContinue()}
            >
              <Text style={styles.actionText}>{t('hunts:detail.primaryAction.continue')}</Text>
            </Pressable>
          )}
          <Pressable
            style={[styles.actionButton, accepted && styles.leaveButton]}
            disabled={actionLoading}
            onPress={() => void handleJoinLeave()}
          >
            <Text style={[styles.actionText, accepted && styles.leaveText]}>
              {actionLoading
                ? '…'
                : accepted
                  ? t('hunts:shared.abandon')
                  : t('common:buttons.accept')}
            </Text>
          </Pressable>
        </View>
      )}
      <Modal visible={!!qrScanStep} animationType="slide" onRequestClose={() => setQrScanStep(null)}>
        {qrScanStep ? (
          <QrScanScreen
            title={qrScanStep.title}
            description={qrScanStep.description}
            expectedPayload={qrScanStep.answer ?? ''}
            onClose={() => setQrScanStep(null)}
            onComplete={(payload) => {
              void handleQrComplete(payload);
            }}
          />
        ) : null}
      </Modal>
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
  heroPlain: { marginTop: 56, marginHorizontal: 16, padding: 16, ...glassCard },
  title: { color: colors.foreground, fontSize: 24, fontWeight: '900' },
  description: { color: colors.textMuted, marginTop: 6 },
  acceptedBanner: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: colors.tealSoft,
    borderColor: colors.teal,
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  acceptedBannerText: { color: colors.teal, fontWeight: '900', fontSize: 15 },
  completedBanner: { backgroundColor: colors.glass, borderColor: colors.textMuted },
  completedBannerText: { color: colors.textMuted },
  card: { ...glassCard, padding: 18, margin: 16, marginBottom: 0 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.foreground, marginBottom: 8 },
  meta: { color: colors.textMuted, marginTop: 6 },
  step: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.glassBorder },
  stepCompleted: {
    opacity: 0.55,
    backgroundColor: colors.glass,
    borderRadius: radii.md,
    paddingHorizontal: 10,
    paddingBottom: 10,
    marginHorizontal: -4,
  },
  stepHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  stepTitle: { fontWeight: '700', color: colors.foreground, flex: 1 },
  stepTitleCompleted: { color: colors.textFaint, textDecorationLine: 'line-through' },
  stepBadges: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  completedBadge: {
    backgroundColor: colors.glass,
    borderColor: colors.textMuted,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  completedBadgeText: { color: colors.textMuted, fontWeight: '800', fontSize: 10 },
  typeBadge: {
    backgroundColor: colors.goldSoft,
    borderColor: colors.gold,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typeBadgeText: { color: colors.gold, fontWeight: '800', fontSize: 10 },
  typeBadgeCompleted: { backgroundColor: colors.glass, borderColor: colors.glassBorderStrong },
  typeBadgeTextCompleted: { color: colors.textFaint },
  stepText: { color: colors.textMuted, marginTop: 4 },
  stepTextCompleted: { color: colors.textFaint },
  secondaryButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.teal,
    backgroundColor: colors.tealSoft,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  secondaryButtonText: { color: colors.teal, fontWeight: '800', fontSize: 12 },
  actions: { marginHorizontal: 16, marginTop: 16, marginBottom: 24, gap: 10 },
  actionButton: {
    backgroundColor: colors.gold,
    paddingVertical: 16,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  leaveButton: {
    backgroundColor: 'transparent',
    borderColor: colors.danger,
    borderWidth: 1,
  },
  actionText: { color: colors.background, fontWeight: '900' },
  leaveText: { color: colors.danger },
  error: { marginHorizontal: 16, marginTop: 16, color: colors.danger, fontWeight: '700' },
});
