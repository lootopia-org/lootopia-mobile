import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { GeoPoint } from '@/src/lib/geo';
import { liveOpsApi } from '@/src/lib/live-ops-api';
import { useLiveEventsContext } from '@/src/state/LiveEventsContext';

/**
 * Opérations live de l'organisateur (pause d'étape / redirection GPS),
 * synchronisées via le backend et diffusées en temps réel (WebSocket).
 */

export type StepOverride = {
  paused?: boolean;
  redirect?: { location: GeoPoint; note?: string };
};

type HuntOps = {
  steps: Record<string, StepOverride>;
};

type LiveOpsContextValue = {
  ops: Record<string, HuntOps>;
  syncFromServer: (huntId: string) => Promise<void>;
  setStepPaused: (huntId: string, stepId: string, paused: boolean) => Promise<void>;
  setStepRedirect: (huntId: string, stepId: string, location: GeoPoint, note?: string) => Promise<void>;
  clearStepRedirect: (huntId: string, stepId: string) => Promise<void>;
  getStepOverride: (huntId: string, stepId: string) => StepOverride | undefined;
  isHuntLivePaused: (huntId: string) => boolean;
};

const LiveOpsContext = createContext<LiveOpsContextValue | undefined>(undefined);

const mapServerSteps = (steps: Record<string, { paused?: boolean; redirect?: GeoPoint & { note?: string } }>) => {
  const mapped: Record<string, StepOverride> = {};
  for (const [stepId, override] of Object.entries(steps)) {
    mapped[stepId] = {
      paused: override.paused,
      redirect: override.redirect
        ? {
            location: {
              latitude: override.redirect.latitude,
              longitude: override.redirect.longitude,
            },
            note: override.redirect.note,
          }
        : undefined,
    };
  }
  return mapped;
};

export function LiveOpsProvider({ children }: { children: React.ReactNode }) {
  const [ops, setOps] = useState<Record<string, HuntOps>>({});
  const { subscribeHuntEvents } = useLiveEventsContext();

  const applyHuntOps = useCallback((huntId: string, steps: Record<string, StepOverride>) => {
    setOps((current) => ({ ...current, [huntId]: { steps } }));
  }, []);

  const syncFromServer = useCallback(
    async (huntId: string) => {
      try {
        const remote = await liveOpsApi.getForHunt(huntId);
        applyHuntOps(huntId, mapServerSteps(remote.steps));
      } catch {
        // best-effort : on garde le cache local
      }
    },
    [applyHuntOps]
  );

  useEffect(
    () =>
      subscribeHuntEvents((event) => {
        if (event.eventType !== 'hunt_steps.live_ops_updated') {
          return;
        }
        const payload = event.payload as { huntId?: string } | undefined;
        if (payload?.huntId) {
          void syncFromServer(payload.huntId);
        }
      }),
    [subscribeHuntEvents, syncFromServer]
  );

  const setStepPaused = useCallback(
    async (huntId: string, stepId: string, paused: boolean) => {
      const remote = await liveOpsApi.updateStep(huntId, stepId, { paused });
      applyHuntOps(huntId, mapServerSteps(remote.steps));
    },
    [applyHuntOps]
  );

  const setStepRedirect = useCallback(
    async (huntId: string, stepId: string, location: GeoPoint, note?: string) => {
      const remote = await liveOpsApi.updateStep(huntId, stepId, {
        redirect: { ...location, note },
      });
      applyHuntOps(huntId, mapServerSteps(remote.steps));
    },
    [applyHuntOps]
  );

  const clearStepRedirect = useCallback(
    async (huntId: string, stepId: string) => {
      const remote = await liveOpsApi.updateStep(huntId, stepId, { clearRedirect: true });
      applyHuntOps(huntId, mapServerSteps(remote.steps));
    },
    [applyHuntOps]
  );

  const value = useMemo<LiveOpsContextValue>(
    () => ({
      ops,
      syncFromServer,
      setStepPaused,
      setStepRedirect,
      clearStepRedirect,
      getStepOverride: (huntId, stepId) => ops[huntId]?.steps[stepId],
      isHuntLivePaused: () => false,
    }),
    [ops, syncFromServer, setStepPaused, setStepRedirect, clearStepRedirect]
  );

  return <LiveOpsContext.Provider value={value}>{children}</LiveOpsContext.Provider>;
}

export function useLiveOps() {
  const context = useContext(LiveOpsContext);
  if (!context) {
    throw new Error('useLiveOps must be used within LiveOpsProvider');
  }
  return context;
}
