import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GeoPoint } from '@/src/lib/geo';

/**
 * Opérations live de l'organisateur (Emergency Pause / Redirect) :
 * - pause d'une chasse entière ou d'une étape (travaux, danger…)
 * - redirection d'une étape vers un point alternatif
 * Le côté joueur lit cet état : validation bloquée sur étape en pause,
 * cible AR déplacée sur étape redirigée.
 *
 * Prototype : état partagé localement via AsyncStorage (un seul appareil).
 * En production, il transitera par le backend (WebSocket déjà prévu côté web).
 */

export type StepOverride = {
  paused?: boolean;
  redirect?: { location: GeoPoint; note?: string };
};

type HuntOps = {
  huntPaused?: boolean;
  steps: Record<string, StepOverride>;
};

type LiveOpsContextValue = {
  ops: Record<string, HuntOps>;
  setHuntLivePaused: (huntId: string, paused: boolean) => Promise<void>;
  setStepPaused: (huntId: string, stepId: string, paused: boolean) => Promise<void>;
  setStepRedirect: (huntId: string, stepId: string, location: GeoPoint, note?: string) => Promise<void>;
  clearStepRedirect: (huntId: string, stepId: string) => Promise<void>;
  getStepOverride: (huntId: string, stepId: string) => StepOverride | undefined;
  isHuntLivePaused: (huntId: string) => boolean;
};

const STORAGE_KEY = 'lootopia-mobile-liveops';

const LiveOpsContext = createContext<LiveOpsContextValue | undefined>(undefined);

export function LiveOpsProvider({ children }: { children: React.ReactNode }) {
  const [ops, setOps] = useState<Record<string, HuntOps>>({});

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          setOps(JSON.parse(stored) as Record<string, HuntOps>);
        }
      } catch {
        // état corrompu : on repart à vide
      }
    })();
  }, []);

  const persist = async (next: Record<string, HuntOps>) => {
    setOps(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const updateStep = async (huntId: string, stepId: string, patch: Partial<StepOverride>) => {
    const hunt = ops[huntId] ?? { steps: {} };
    const step = { ...(hunt.steps[stepId] ?? {}), ...patch };
    await persist({ ...ops, [huntId]: { ...hunt, steps: { ...hunt.steps, [stepId]: step } } });
  };

  const value = useMemo<LiveOpsContextValue>(
    () => ({
      ops,
      setHuntLivePaused: async (huntId, paused) => {
        const hunt = ops[huntId] ?? { steps: {} };
        await persist({ ...ops, [huntId]: { ...hunt, huntPaused: paused } });
      },
      setStepPaused: (huntId, stepId, paused) => updateStep(huntId, stepId, { paused }),
      setStepRedirect: (huntId, stepId, location, note) =>
        updateStep(huntId, stepId, { redirect: { location, note } }),
      clearStepRedirect: (huntId, stepId) => updateStep(huntId, stepId, { redirect: undefined }),
      getStepOverride: (huntId, stepId) => ops[huntId]?.steps[stepId],
      isHuntLivePaused: (huntId) => Boolean(ops[huntId]?.huntPaused),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ops]
  );

  return <LiveOpsContext.Provider value={value}>{children}</LiveOpsContext.Provider>;
}

export function useLiveOps() {
  const context = useContext(LiveOpsContext);
  if (!context) {
    throw new Error('useLiveOps doit être utilisé dans un LiveOpsProvider');
  }
  return context;
}
