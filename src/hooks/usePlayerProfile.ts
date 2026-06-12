import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { fetchOrCreateProfile, type Profile } from '@/src/lib/profile-api';
import { useAuth } from '@/src/state/AuthContext';
import { playerStats } from '@/src/data/mock';

/**
 * Profil joueur (GET /profile) avec repli sur les stats mock en mode démo ou
 * hors-ligne. Rechargé à chaque focus de l'écran appelant, pour que les points
 * crédités par PATCH /profile (fin de chasse) apparaissent sans redémarrage.
 */
export function usePlayerProfile() {
  const { token, isDemoSession } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);

  const realToken = token && !isDemoSession ? token : null;

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      if (!realToken) {
        setProfile(null);
        return;
      }
      fetchOrCreateProfile(realToken)
        .then((result) => {
          if (!cancelled) {
            setProfile(result);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setProfile(null);
          }
        });
      return () => {
        cancelled = true;
      };
    }, [realToken])
  );

  return {
    profile,
    isLive: profile !== null,
    points: profile?.points ?? playerStats.points,
    level: profile?.level ?? playerStats.level,
    completedHunts: profile?.completedHunts ?? playerStats.completedChases,
  };
}
