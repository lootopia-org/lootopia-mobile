import React, { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ARExperience } from '@/src/components/ARExperience';
import { StepAnswerInput } from '@/src/components/hunts/StepAnswerInput';
import { StepPhotoCapture } from '@/src/components/hunts/StepPhotoCapture';
import { chaseApi, type Chase } from '@/src/lib/chase-api';
import type { HuntStepType } from '@/src/lib/hunt-types';
import { profileApi } from '@/src/lib/profile-api';
import { useAuth } from '@/src/state/AuthContext';
import { useHunts } from '@/src/state/HuntsContext';
import { useLiveOps } from '@/src/state/LiveOpsContext';
import { useLiveEventsContext } from '@/src/state/LiveEventsContext';
import { colors, radii } from '@/src/theme';

export default function ARScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, stepId } = useLocalSearchParams<{ id: string; stepId?: string }>();
  const { getStepOverride, syncFromServer } = useLiveOps();
  const { subscribeHuntEvents } = useLiveEventsContext();
  const { token } = useAuth();
  const { acceptedHunts, completeStep: completeStepLocally } = useHunts();
  const [chase, setChase] = useState<Chase | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
        setError('Chasse introuvable');
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
  }, [id, subscribeHuntEvents, syncFromServer]);

  const step = chase?.steps.find((item) => item.id === stepId) ?? chase?.steps[0];
  const stepType: HuntStepType = step?.type ?? 'checkpoint';

  const finishStep = async (answer?: string) => {
    if (!chase || !step) {
      return;
    }
    await chaseApi.completeStep(chase.id, step.id, answer);
    await completeStepLocally(chase.id, step.id);

    const alreadyDone = acceptedHunts[chase.id]?.completedStepIds ?? [];
    const doneAfter = new Set([...alreadyDone, step.id]);
    const isHuntComplete = chase.steps.every((item) => doneAfter.has(item.id));
    if (isHuntComplete && token) {
      try {
        await profileApi.completeHunt(token, chase.id);
      } catch {
        // best-effort
      }
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
        <Text style={styles.notFoundText}>{error ?? 'Étape introuvable'}</Text>
      </View>
    );
  }

  if (!step.location) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFoundText}>Coordonnées manquantes</Text>
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
          placeholder={stepType === 'riddle' ? 'Réponse' : 'Indice / code'}
        />
      );
    }

    if (stepType === 'photo') {
      return <StepPhotoCapture description={step.description} onSubmit={(url) => finishStep(url)} />;
    }

    return (
      <ARExperience
        clue={step.description}
        targetLocation={stepLocation}
        radiusMeters={step.radiusMeters ?? 30}
        qrPayload={stepType === 'qr_code' ? step.answer : step.qrPayload}
        photoClueUri={step.photoClueUri}
        audioHintUri={step.audioHintUri}
        liveOverride={liveOverride}
        fullScreen
        combatEnabled={stepType === 'ar'}
        onComplete={(answer) => {
          void finishStep(answer);
        }}
      />
    );
  };

  return (
    <View style={styles.container}>
      {renderStepContent()}

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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  notFoundText: { color: colors.textMuted, fontWeight: '700' },
});
