import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { fetchOrCreateProfile, type Profile } from '@/src/lib/profile-api';
import { useAuth } from '@/src/state/AuthContext';

/**
 * Profil joueur (GET /profile). Rechargé à chaque focus de l'écran appelant,
 * pour que les points crédités par PATCH /profile (fin de chasse) apparaissent
 * sans redémarrage.
 */
export function usePlayerProfile() {
  const { token } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);

  const realToken = token;

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
    points: profile?.points ?? 0,
    level: profile?.level ?? 1,
    completedHunts: profile?.completedHunts ?? 0,
  };
}
