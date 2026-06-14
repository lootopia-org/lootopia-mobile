import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { fetchOrCreateProfile, type Profile } from '@/src/lib/profile-api';
import { isProfileUpdatedEvent, type LiveEvent } from '@/src/lib/ws/live-events';
import { useAuth } from '@/src/state/AuthContext';
import { useLiveEventsContext } from '@/src/state/LiveEventsContext';

export type PlayerProfileSnapshot = {
  points: number;
  level: number;
  completedHunts: number;
};

type PlayerProfileContextValue = {
  profile: PlayerProfileSnapshot | null;
  isLive: boolean;
  points: number;
  level: number;
  completedHunts: number;
  refreshProfile: () => Promise<PlayerProfileSnapshot | null>;
  applyProfilePayload: (payload: unknown) => void;
};

const PlayerProfileContext = createContext<PlayerProfileContextValue | null>(null);

function snapshotFromProfile(profile: Profile): PlayerProfileSnapshot {
  return {
    points: profile.points ?? 0,
    level: profile.level ?? 1,
    completedHunts: profile.completedHunts ?? 0,
  };
}

function snapshotFromPayload(payload: unknown): PlayerProfileSnapshot | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const data = payload as {
    points?: number;
    level?: number;
    completedHunts?: number;
  };
  if (typeof data.points !== 'number') {
    return null;
  }
  return {
    points: data.points,
    level: typeof data.level === 'number' ? data.level : 1,
    completedHunts: typeof data.completedHunts === 'number' ? data.completedHunts : 0,
  };
}

export function PlayerProfileProvider({ children }: { children: React.ReactNode }) {
  const { token, isAuthenticated } = useAuth();
  const { subscribeLiveEvents } = useLiveEventsContext();
  const [profile, setProfile] = useState<PlayerProfileSnapshot | null>(null);

  const applyProfilePayload = useCallback((payload: unknown) => {
    const next = snapshotFromPayload(payload);
    if (next) {
      setProfile(next);
    }
  }, []);

  const refreshProfile = useCallback(async (): Promise<PlayerProfileSnapshot | null> => {
    if (!token) {
      setProfile(null);
      return null;
    }
    try {
      const next = snapshotFromProfile(await fetchOrCreateProfile(token));
      setProfile(next);
      return next;
    } catch {
      setProfile(null);
      return null;
    }
  }, [token]);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setProfile(null);
      return;
    }
    void refreshProfile();
  }, [isAuthenticated, token, refreshProfile]);

  useEffect(() => {
    if (!token) {
      return;
    }
    return subscribeLiveEvents((event: LiveEvent) => {
      if (isProfileUpdatedEvent(event)) {
        applyProfilePayload(event.payload);
      }
    });
  }, [token, subscribeLiveEvents, applyProfilePayload]);

  const value = useMemo<PlayerProfileContextValue>(
    () => ({
      profile,
      isLive: profile !== null,
      points: profile?.points ?? 0,
      level: profile?.level ?? 1,
      completedHunts: profile?.completedHunts ?? 0,
      refreshProfile,
      applyProfilePayload,
    }),
    [profile, refreshProfile, applyProfilePayload]
  );

  return <PlayerProfileContext.Provider value={value}>{children}</PlayerProfileContext.Provider>;
}

export function usePlayerProfileContext() {
  const context = useContext(PlayerProfileContext);
  if (!context) {
    throw new Error('usePlayerProfileContext must be used within PlayerProfileProvider');
  }
  return context;
}
