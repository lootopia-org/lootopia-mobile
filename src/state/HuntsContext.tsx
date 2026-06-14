import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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
  acceptedHunts: Record<string, HuntProgress>;
  avatarModel: AvatarModel;
  acceptHunt: (huntId: string) => Promise<void>;
  abandonHunt: (huntId: string) => Promise<void>;
  completeStep: (huntId: string, stepId: string) => Promise<void>;
  setHuntPaused: (huntId: string, paused: boolean) => Promise<void>;
  isAccepted: (huntId: string) => boolean;
  setAvatarModel: (model: AvatarModel) => Promise<void>;
  refreshFromServer: () => Promise<void>;
};

const STORAGE_KEY = 'lootopia-mobile-hunts';
const AVATAR_KEY = 'lootopia-mobile-avatar';

const HuntsContext = createContext<HuntsContextValue | undefined>(undefined);

function isOfflineError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return /network|fetch|offline|internet|timed out/i.test(error.message);
}

export function HuntsProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isReady: authReady } = useAuth();
  const { requestLocationSend, subscribeLiveEvents } = useLiveEventsContext();
  const canPlayHunts = isPlayerUser(user);
  const [ready, setReady] = useState(false);
  const [joinedHuntIds, setJoinedHuntIds] = useState<string[]>([]);
  const [acceptedHunts, setAcceptedHunts] = useState<Record<string, HuntProgress>>({});
  const [avatarModel, setAvatarModelState] = useState<AvatarModel>('male');

  const persistAcceptedHunts = useCallback(async (next: Record<string, HuntProgress>) => {
    setAcceptedHunts(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const refreshFromServer = useCallback(async () => {
    if (!isAuthenticated || !canPlayHunts) {
      setJoinedHuntIds([]);
      return;
    }

    try {
      const joinedHunts = await chaseApi.getJoinedHunts();
      const ids = joinedHunts.map((hunt) => hunt.id);
      setJoinedHuntIds(ids);

      const serverProgress = await Promise.all(
        joinedHunts.map(async (hunt) => {
          const completedStepIds = await chaseApi.getCompletedStepIds(hunt.id).catch(() => []);
          return { huntId: hunt.id, completedStepIds };
        })
      );

      setAcceptedHunts((current) => {
        const next: Record<string, HuntProgress> = {};
        for (const hunt of joinedHunts) {
          const serverEntry = serverProgress.find((entry) => entry.huntId === hunt.id);
          const existing = current[hunt.id];
          next[hunt.id] = {
            acceptedAt: existing?.acceptedAt ?? new Date().toISOString(),
            completedStepIds: serverEntry?.completedStepIds ?? existing?.completedStepIds ?? [],
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
    if (joinedHuntIds.includes(huntId)) {
      return;
    }

    try {
      await chaseApi.joinHunt(huntId);
    } catch (error) {
      if (!isOfflineError(error)) {
        throw new HuntJoinError(
          'JOIN_FAILED',
          error instanceof Error ? error.message : undefined
        );
      }
    }

    setJoinedHuntIds((current) => (current.includes(huntId) ? current : [...current, huntId]));
    setAcceptedHunts((current) => {
      const next = {
        ...current,
        [huntId]: { acceptedAt: new Date().toISOString(), completedStepIds: [] },
      };
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    requestLocationSend();
    await refreshFromServer();
  };

  const abandonHunt = async (huntId: string) => {
    if (!isAuthenticated) {
      throw new HuntJoinError('NOT_AUTHENTICATED');
    }
    if (!canPlayHunts) {
      throw new HuntJoinError('PLAYER_ONLY');
    }

    try {
      await chaseApi.leaveHunt(huntId);
    } catch (error) {
      if (!isOfflineError(error)) {
        throw new HuntJoinError(
          'LEAVE_FAILED',
          error instanceof Error ? error.message : undefined
        );
      }
    }

    setJoinedHuntIds((current) => current.filter((id) => id !== huntId));
    setAcceptedHunts((current) => {
      const next = { ...current };
      delete next[huntId];
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    await refreshFromServer();
  };

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
      acceptedHunts,
      avatarModel,
      acceptHunt,
      abandonHunt,
      completeStep,
      setHuntPaused,
      isAccepted: (huntId: string) => joinedHuntIds.includes(huntId),
      setAvatarModel,
      refreshFromServer,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, canPlayHunts, joinedHuntIds, acceptedHunts, avatarModel]
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
