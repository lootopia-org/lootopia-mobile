import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { chaseApi } from '@/src/lib/chase-api';
import { isPlayerUser } from '@/src/lib/player-access';
import { useAuth } from '@/src/state/AuthContext';
import { useLiveEventsContext } from '@/src/state/LiveEventsContext';

export type AvatarModel = 'male' | 'female';

export type HuntJoinErrorCode = 'NOT_AUTHENTICATED' | 'PLAYER_ONLY' | 'JOIN_FAILED' | 'LEAVE_FAILED';

export class HuntJoinError extends Error {
  code: HuntJoinErrorCode;

  constructor(code: HuntJoinErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

type HuntProgress = {
  acceptedAt: string;
  completedStepIds: string[];
  paused?: boolean;
};

type HuntsContextValue = {
  ready: boolean;
  canPlayHunts: boolean;
  joinedHuntIds: string[];
  completedHuntIds: string[];
  acceptedHunts: Record<string, HuntProgress>;
  avatarModel: AvatarModel;
  acceptHunt: (huntId: string) => Promise<void>;
  abandonHunt: (huntId: string) => Promise<void>;
  completeStep: (huntId: string, stepId: string) => Promise<void>;
  markHuntCompleted: (huntId: string) => void;
  setHuntPaused: (huntId: string, paused: boolean) => Promise<void>;
  isAccepted: (huntId: string) => boolean;
  isCompleted: (huntId: string) => boolean;
  setAvatarModel: (model: AvatarModel) => Promise<void>;
  refreshFromServer: () => Promise<void>;
};

const STORAGE_KEY = 'lootopia-mobile-hunts';
const AVATAR_KEY = 'lootopia-mobile-avatar';
const RECENT_MUTATION_MS = 12_000;

const HuntsContext = createContext<HuntsContextValue | undefined>(undefined);

function isOfflineError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return /network|fetch|offline|internet|timed out/i.test(error.message);
}

function isRecentMutation(at: number | undefined): boolean {
  return at !== undefined && Date.now() - at < RECENT_MUTATION_MS;
}

export function HuntsProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isReady: authReady } = useAuth();
  const { requestLocationSend, subscribeLiveEvents } = useLiveEventsContext();
  const canPlayHunts = isPlayerUser(user);
  const [ready, setReady] = useState(false);
  const [joinedHuntIds, setJoinedHuntIds] = useState<string[]>([]);
  const [completedHuntIds, setCompletedHuntIds] = useState<string[]>([]);
  const [acceptedHunts, setAcceptedHunts] = useState<Record<string, HuntProgress>>({});
  const [avatarModel, setAvatarModelState] = useState<AvatarModel>('male');
  const recentJoinRef = useRef<{ huntId: string; at: number } | null>(null);
  const recentLeaveRef = useRef<{ huntId: string; at: number } | null>(null);
  const mutationLockRef = useRef<string | null>(null);

  const persistAcceptedHunts = useCallback(async (next: Record<string, HuntProgress>) => {
    setAcceptedHunts(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const refreshFromServer = useCallback(async () => {
    if (!isAuthenticated || !canPlayHunts) {
      setJoinedHuntIds([]);
      setCompletedHuntIds([]);
      return;
    }

    if (mutationLockRef.current) {
      return;
    }

    try {
      const [joinedHunts, completedHunts] = await Promise.all([
        chaseApi.getJoinedHunts(),
        chaseApi.getCompletedHunts(),
      ]);
      let ids = joinedHunts.map((hunt) => hunt.id);
      const completedIds = completedHunts.map((hunt) => hunt.id);

      const recentLeave = recentLeaveRef.current;
      if (recentLeave && isRecentMutation(recentLeave.at)) {
        ids = ids.filter((id) => id !== recentLeave.huntId);
      }

      const recentJoin = recentJoinRef.current;
      if (recentJoin && isRecentMutation(recentJoin.at) && !ids.includes(recentJoin.huntId)) {
        ids = [...ids, recentJoin.huntId];
      }

      setJoinedHuntIds(ids);
      setCompletedHuntIds(completedIds);

      const serverProgress = await Promise.all(
        ids.map(async (huntId) => {
          const hunt = joinedHunts.find((item) => item.id === huntId);
          const completedStepIds = await chaseApi.getCompletedStepIds(huntId);
          return { huntId, completedStepIds, hunt };
        })
      );

      setAcceptedHunts((current) => {
        const next: Record<string, HuntProgress> = {};
        for (const entry of serverProgress) {
          const existing = current[entry.huntId];
          const serverIds = entry.completedStepIds ?? [];
          const localIds = existing?.completedStepIds ?? [];
          next[entry.huntId] = {
            acceptedAt: existing?.acceptedAt ?? new Date().toISOString(),
            completedStepIds: Array.from(new Set([...localIds, ...serverIds])),
            paused: existing?.paused,
          };
        }
        void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    } catch {
      // Keep local state when offline or API unavailable.
    }
  }, [canPlayHunts, isAuthenticated]);

  useEffect(() => {
    (async () => {
      try {
        const [storedHunts, storedAvatar] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(AVATAR_KEY),
        ]);
        if (storedHunts) {
          setAcceptedHunts(JSON.parse(storedHunts) as Record<string, HuntProgress>);
        }
        if (storedAvatar === 'male' || storedAvatar === 'female') {
          setAvatarModelState(storedAvatar);
        }
      } catch {
        // Corrupt storage: start fresh rather than blocking the app.
      } finally {
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!authReady || !ready) {
      return;
    }
    if (!isAuthenticated || !canPlayHunts) {
      setJoinedHuntIds([]);
      setCompletedHuntIds([]);
      return;
    }
    void refreshFromServer();
  }, [authReady, ready, isAuthenticated, canPlayHunts, refreshFromServer]);

  useEffect(() => {
    if (!canPlayHunts) {
      return;
    }
    return subscribeLiveEvents((event) => {
      if (event.eventType === 'hunt_steps.complete') {
        void refreshFromServer();
      }
    });
  }, [canPlayHunts, subscribeLiveEvents, refreshFromServer]);

  const acceptHunt = async (huntId: string) => {
    if (!isAuthenticated) {
      throw new HuntJoinError('NOT_AUTHENTICATED');
    }
    if (!canPlayHunts) {
      throw new HuntJoinError('PLAYER_ONLY');
    }
    if (joinedHuntIds.includes(huntId) || mutationLockRef.current === huntId) {
      return;
    }
    if (completedHuntIds.includes(huntId)) {
      return;
    }

    mutationLockRef.current = huntId;
    if (recentLeaveRef.current?.huntId === huntId) {
      recentLeaveRef.current = null;
    }
    recentJoinRef.current = { huntId, at: Date.now() };

    setJoinedHuntIds((current) => (current.includes(huntId) ? current : [...current, huntId]));
    setAcceptedHunts((current) => {
      const next = {
        ...current,
        [huntId]: { acceptedAt: new Date().toISOString(), completedStepIds: [] },
      };
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });

    try {
      await chaseApi.joinHunt(huntId);
      requestLocationSend();
      await refreshFromServer();
    } catch (error) {
      if (!isOfflineError(error)) {
        recentJoinRef.current = null;
        setJoinedHuntIds((current) => current.filter((id) => id !== huntId));
        setAcceptedHunts((current) => {
          const next = { ...current };
          delete next[huntId];
          void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          return next;
        });
        throw new HuntJoinError(
          'JOIN_FAILED',
          error instanceof Error ? error.message : undefined
        );
      }
    } finally {
      mutationLockRef.current = null;
    }
  };

  const abandonHunt = async (huntId: string) => {
    if (!isAuthenticated) {
      throw new HuntJoinError('NOT_AUTHENTICATED');
    }
    if (!canPlayHunts) {
      throw new HuntJoinError('PLAYER_ONLY');
    }
    if (mutationLockRef.current === huntId) {
      return;
    }

    mutationLockRef.current = huntId;
    if (recentJoinRef.current?.huntId === huntId) {
      recentJoinRef.current = null;
    }
    recentLeaveRef.current = { huntId, at: Date.now() };

    setJoinedHuntIds((current) => current.filter((id) => id !== huntId));
    setAcceptedHunts((current) => {
      const next = { ...current };
      delete next[huntId];
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });

    try {
      await chaseApi.leaveHunt(huntId);
      await refreshFromServer();
    } catch (error) {
      if (!isOfflineError(error)) {
        recentLeaveRef.current = null;
        throw new HuntJoinError(
          'LEAVE_FAILED',
          error instanceof Error ? error.message : undefined
        );
      }
    } finally {
      mutationLockRef.current = null;
    }
  };

  const markHuntCompleted = useCallback((huntId: string) => {
    setCompletedHuntIds((current) => (current.includes(huntId) ? current : [...current, huntId]));
    setJoinedHuntIds((current) => current.filter((id) => id !== huntId));
    setAcceptedHunts((current) => {
      if (!(huntId in current)) {
        return current;
      }
      const next = { ...current };
      delete next[huntId];
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const completeStep = async (huntId: string, stepId: string) => {
    setAcceptedHunts((current) => {
      const progress = current[huntId];
      if (!progress || progress.completedStepIds.includes(stepId)) {
        return current;
      }
      const next = {
        ...current,
        [huntId]: { ...progress, completedStepIds: [...progress.completedStepIds, stepId] },
      };
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const setHuntPaused = async (huntId: string, paused: boolean) => {
    const progress = acceptedHunts[huntId];
    if (!progress) {
      return;
    }
    await persistAcceptedHunts({ ...acceptedHunts, [huntId]: { ...progress, paused } });
  };

  const setAvatarModel = async (model: AvatarModel) => {
    setAvatarModelState(model);
    await AsyncStorage.setItem(AVATAR_KEY, model);
  };

  const value = useMemo<HuntsContextValue>(
    () => ({
      ready,
      canPlayHunts,
      joinedHuntIds,
      completedHuntIds,
      acceptedHunts,
      avatarModel,
      acceptHunt,
      abandonHunt,
      completeStep,
      markHuntCompleted,
      setHuntPaused,
      isAccepted: (huntId: string) => joinedHuntIds.includes(huntId),
      isCompleted: (huntId: string) => completedHuntIds.includes(huntId),
      setAvatarModel,
      refreshFromServer,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, canPlayHunts, joinedHuntIds, completedHuntIds, acceptedHunts, avatarModel]
  );

  return <HuntsContext.Provider value={value}>{children}</HuntsContext.Provider>;
}

export function useHunts() {
  const context = useContext(HuntsContext);
  if (!context) {
    throw new Error('useHunts must be used within HuntsProvider');
  }
  return context;
}
