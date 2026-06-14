import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { usePlayerProfileContext } from '@/src/state/PlayerProfileContext';

/**
 * Player profile (points, level, completed hunts) backed by shared context.
 * Refreshes from GET /profile when the calling screen gains focus.
 */
export function usePlayerProfile() {
  const { profile, isLive, points, level, completedHunts, refreshProfile } = usePlayerProfileContext();

  useFocusEffect(
    useCallback(() => {
      void refreshProfile();
    }, [refreshProfile])
  );

  return {
    profile,
    isLive,
    points,
    level,
    completedHunts,
    refreshProfile,
  };
}
