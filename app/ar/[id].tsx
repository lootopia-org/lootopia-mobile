import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ARExperience } from '@/src/components/ARExperience';
import { StepAnswerInput } from '@/src/components/hunts/StepAnswerInput';
import { StepPhotoCapture } from '@/src/components/hunts/StepPhotoCapture';
import { useFinishHuntStep } from '@/src/hooks/useFinishHuntStep';
import { chaseApi, type Chase } from '@/src/lib/chase-api';
import type { HuntStepType } from '@/src/lib/hunt-types';
import { useHunts } from '@/src/state/HuntsContext';
import { useLiveOps } from '@/src/state/LiveOpsContext';
import { useLiveEventsContext } from '@/src/state/LiveEventsContext';
import { colors, radii } from '@/src/theme';

export default function ARScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation(['hunts', 'common']);
  const { id, stepId } = useLocalSearchParams<{ id: string; stepId?: string }>();
  const { getStepOverride, syncFromServer } = useLiveOps();
  const { subscribeHuntEvents } = useLiveEventsContext();
  const finishHuntStep = useFinishHuntStep();
  const { acceptedHunts, refreshFromServer, canPlayHunts } = useHunts();
  const [chase, setChase] = useState<Chase | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      return;
    }

    const loadChase = async () => {
      try {
        setIsLoading(true);
        setChase(await chaseApi.getChase(id));
      } catch {
        setError(t('hunts:shared.errors.notFound'));
      } finally {
        setIsLoading(false);
      }
    };

    void loadChase();
    void syncFromServer(id);
    return subscribeHuntEvents((event) => {
      const payload = event.payload as { id?: string; huntId?: string } | undefined;
      if (payload?.id === id || payload?.huntId === id || event.resourceId === id) {
        void loadChase();
        void syncFromServer(id);
      }
    });
  }, [id, subscribeHuntEvents, syncFromServer, t]);

  const step = chase?.steps.find((item) => item.id === stepId) ?? chase?.steps[0];
  const stepType: HuntStepType = step?.type ?? 'checkpoint';
  const stepCompleted = Boolean(
    id && step && (acceptedHunts[id]?.completedStepIds ?? []).includes(step.id)
  );

  useFocusEffect(
    useCallback(() => {
      if (canPlayHunts) {
        void refreshFromServer();
      }
    }, [canPlayHunts, refreshFromServer])
  );

  const finishStep = async (answer?: string) => {
    if (!chase || !step || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { pointsEarned, huntCompleted } = await finishHuntStep(chase, step, answer);

      if (pointsEarned > 0) {
        Alert.alert(
          t('hunts:ar.messages.pointsEarned', { points: pointsEarned }),
          huntCompleted ? t('hunts:ar.messages.huntCompleted') : undefined
        );
      } else if (huntCompleted) {
        Alert.alert(t('hunts:ar.messages.huntCompleted'));
      }

      router.back();
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common:errors.saveFailed');
      setError(message);
      throw err instanceof Error ? err : new Error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  if (!chase || !step) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFoundText}>{error ?? t('hunts:shared.errors.stepNotFound')}</Text>
      </View>
    );
  }

  if (stepCompleted) {
    return (
      <View style={styles.center}>
        <Text style={styles.completedTitle}>{t('hunts:participants.status.completed')}</Text>
        <Text style={styles.completedSubtitle}>{step.title}</Text>
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>{t('common:back')}</Text>
        </Pressable>
      </View>
    );
  }

  if (!step.location) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFoundText}>{t('hunts:shared.errors.missingCoordinates')}</Text>
      </View>
    );
  }

  if (stepType === 'qr_code' && !step.scanInAr) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFoundText}>{t('hunts:qrScan.useStandardScanner')}</Text>
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>{t('common:back')}</Text>
        </Pressable>
      </View>
    );
  }

  const stepLocation = step.location;
  const liveOverride = {
    huntPaused: chase.status === 'paused',
    stepPaused: getStepOverride(chase.id, step.id)?.paused,
    redirect: getStepOverride(chase.id, step.id)?.redirect,
  };

  const renderStepContent = () => {
    if (stepType === 'riddle' || stepType === 'clue') {
      return (
        <StepAnswerInput
          description={step.description}
          onSubmit={(answer) => finishStep(answer)}
          placeholder={stepType === 'riddle' ? t('hunts:ar.answerInput.riddlePlaceholder') : t('hunts:ar.answerInput.cluePlaceholder')}
        />
      );
    }

    if (stepType === 'photo') {
      return (
        <StepPhotoCapture
          description={step.description}
          referencePhotoUrl={step.photoClueUri ?? step.answer}
          onSubmit={(url) => finishStep(url)}
        />
      );
    }

    const isQrStep = stepType === 'qr_code';
    const isChestStep = stepType === 'ar' || stepType === 'checkpoint';

    return (
      <ARExperience
        clue={step.description}
        targetLocation={stepLocation}
        radiusMeters={step.radiusMeters ?? 30}
        accessCode={isChestStep ? step.answer : undefined}
        qrPayload={isQrStep ? step.answer : step.qrPayload}
        qrRevealContent={isQrStep ? step.answer : undefined}
        requireQrScan={isQrStep}
        photoClueUri={step.photoClueUri}
        audioHintUri={step.audioHintUri}
        liveOverride={liveOverride}
        fullScreen
        onComplete={(answer) => finishStep(answer)}
      />
    );
  };

  return (
    <View style={styles.container}>
      {renderStepContent()}

      {isSubmitting && (
        <View style={styles.submittingOverlay}>
          <ActivityIndicator color={colors.gold} size="large" />
        </View>
      )}

      <View style={[styles.topBar, { top: insets.top + 10 }]} pointerEvents="box-none">
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={colors.foreground} />
        </Pressable>
        <View style={styles.titlePill}>
          <Text style={styles.titleText} numberOfLines={1}>
            {chase.title}
          </Text>
          <Text style={styles.stepText} numberOfLines={1}>
            {step.title}
          </Text>
          {(step.points ?? 0) > 0 && (
            <Text style={styles.pointsText}>
              {t('hunts:shared.points.short', { points: step.points ?? 0 })}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: { position: 'absolute', left: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(11,15,26,0.85)',
    borderColor: colors.glassBorderStrong,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titlePill: {
    flex: 1,
    backgroundColor: 'rgba(11,15,26,0.85)',
    borderColor: colors.glassBorderStrong,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  titleText: { color: colors.foreground, fontWeight: '900', fontSize: 13 },
  stepText: { color: colors.gold, fontWeight: '700', fontSize: 11, marginTop: 1 },
  pointsText: { color: colors.teal, fontWeight: '800', fontSize: 10, marginTop: 2 },
  submittingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11,15,26,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  notFoundText: { color: colors.textMuted, fontWeight: '700' },
  completedTitle: { color: colors.teal, fontWeight: '900', fontSize: 22 },
  completedSubtitle: { color: colors.foreground, fontWeight: '700', fontSize: 16, marginTop: 8, textAlign: 'center', paddingHorizontal: 24 },
  backLink: { marginTop: 20, paddingHorizontal: 16, paddingVertical: 10 },
  backLinkText: { color: colors.gold, fontWeight: '800', fontSize: 14 },
});
