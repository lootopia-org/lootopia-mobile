import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AvatarModel = 'male' | 'female';

type HuntProgress = {
  acceptedAt: string;
  completedStepIds: string[];
};

type HuntsContextValue = {
  ready: boolean;
  acceptedHunts: Record<string, HuntProgress>;
  avatarModel: AvatarModel;
  acceptHunt: (huntId: string) => Promise<void>;
  abandonHunt: (huntId: string) => Promise<void>;
  completeStep: (huntId: string, stepId: string) => Promise<void>;
  isAccepted: (huntId: string) => boolean;
  setAvatarModel: (model: AvatarModel) => Promise<void>;
};

const STORAGE_KEY = 'lootopia-mobile-hunts';
const AVATAR_KEY = 'lootopia-mobile-avatar';

const HuntsContext = createContext<HuntsContextValue | undefined>(undefined);

export function HuntsProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [acceptedHunts, setAcceptedHunts] = useState<Record<string, HuntProgress>>({});
  const [avatarModel, setAvatarModelState] = useState<AvatarModel>('male');

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
        // Stockage corrompu : on repart d'un état vide plutôt que de bloquer l'app.
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const persist = async (next: Record<string, HuntProgress>) => {
    setAcceptedHunts(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const acceptHunt = async (huntId: string) => {
    if (acceptedHunts[huntId]) {
      return;
    }
    await persist({
      ...acceptedHunts,
      [huntId]: { acceptedAt: new Date().toISOString(), completedStepIds: [] },
    });
  };

  const abandonHunt = async (huntId: string) => {
    const next = { ...acceptedHunts };
    delete next[huntId];
    await persist(next);
  };

  const completeStep = async (huntId: string, stepId: string) => {
    const progress = acceptedHunts[huntId];
    if (!progress || progress.completedStepIds.includes(stepId)) {
      return;
    }
    await persist({
      ...acceptedHunts,
      [huntId]: { ...progress, completedStepIds: [...progress.completedStepIds, stepId] },
    });
  };

  const setAvatarModel = async (model: AvatarModel) => {
    setAvatarModelState(model);
    await AsyncStorage.setItem(AVATAR_KEY, model);
  };

  const value = useMemo<HuntsContextValue>(
    () => ({
      ready,
      acceptedHunts,
      avatarModel,
      acceptHunt,
      abandonHunt,
      completeStep,
      isAccepted: (huntId: string) => Boolean(acceptedHunts[huntId]),
      setAvatarModel,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, acceptedHunts, avatarModel]
  );

  return <HuntsContext.Provider value={value}>{children}</HuntsContext.Provider>;
}

export function useHunts() {
  const context = useContext(HuntsContext);
  if (!context) {
    throw new Error('useHunts doit être utilisé dans un HuntsProvider');
  }
  return context;
}
