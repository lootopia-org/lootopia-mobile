import { apiRequest } from '@/src/lib/api-client';
import type { GeoPoint } from '@/src/lib/geo';

export type StepLiveOpsOverride = {
  paused?: boolean;
  redirect?: GeoPoint & { note?: string };
};

export type HuntLiveOps = {
  huntId: string;
  steps: Record<string, StepLiveOpsOverride>;
};

export const liveOpsApi = {
  getForHunt: (huntId: string) => apiRequest<HuntLiveOps>(`/hunt/${huntId}/live-ops`),

  updateStep: (
    huntId: string,
    stepId: string,
    patch: {
      paused?: boolean;
      redirect?: GeoPoint & { note?: string };
      clearRedirect?: boolean;
    }
  ) =>
    apiRequest<HuntLiveOps>(`/hunt/${huntId}/live-ops/${stepId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        paused: patch.paused,
        redirect: patch.redirect
          ? {
              latitude: patch.redirect.latitude,
              longitude: patch.redirect.longitude,
              note: patch.redirect.note,
            }
          : undefined,
        clearRedirect: patch.clearRedirect,
      }),
    }),

  clearStep: (huntId: string, stepId: string) =>
    apiRequest<void>(`/hunt/${huntId}/live-ops/${stepId}`, { method: 'DELETE' }),
};
