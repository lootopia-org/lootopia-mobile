import { useCallback } from 'react';
import { chaseApi, type Chase, type ChaseStep } from '@/src/lib/chase-api';
import { profileApi } from '@/src/lib/profile-api';
import { useAuth } from '@/src/state/AuthContext';
import { useHunts } from '@/src/state/HuntsContext';
import { usePlayerProfileContext } from '@/src/state/PlayerProfileContext';

export type FinishHuntStepResult = {
  pointsEarned: number;
  huntCompleted: boolean;
};

function stepPoints(step: ChaseStep): number {
  return Math.max(0, step.points ?? step.reward ?? 0);
}

export function useFinishHuntStep() {
  const { token } = useAuth();
  const { acceptedHunts, completeStep: completeStepLocally, markHuntCompleted, refreshFromServer } = useHunts();
  const { profile, refreshProfile } = usePlayerProfileContext();

  return useCallback(
    async (chase: Chase, step: ChaseStep, answer?: string): Promise<FinishHuntStepResult> => {
      const pointsBefore = profile?.points ?? 0;

      await chaseApi.completeStep(chase.id, step.id, answer);
      await completeStepLocally(chase.id, step.id);

      const updatedProfile = (await refreshProfile()) ?? profile;
      const pointsEarned = Math.max(
        0,
        updatedProfile ? updatedProfile.points - pointsBefore : stepPoints(step)
      );

      const completedIds = new Set([
        ...(acceptedHunts[chase.id]?.completedStepIds ?? []),
        step.id,
      ]);
      const huntCompleted = chase.steps.length > 0 && chase.steps.every((item) => completedIds.has(item.id));

      if (huntCompleted && token) {
        try {
          await profileApi.completeHunt(token, chase.id);
          await refreshProfile();
        } catch {
          // Hunt may already be marked complete by the backend when the last step was submitted.
        }
      }

      if (huntCompleted) {
        markHuntCompleted(chase.id);
      }

      await refreshFromServer();

      return { pointsEarned, huntCompleted };
    },
    [acceptedHunts, completeStepLocally, markHuntCompleted, profile, refreshFromServer, refreshProfile, token]
  );
}
