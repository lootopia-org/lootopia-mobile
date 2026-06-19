import { apiRequest } from '@/src/lib/api-client';
import { isValidGeoPoint } from '@/src/lib/geo';
import {
  fromApiHunt,
  normalizeHuntDetailResponse,
  toCreateHuntPayload,
  toUpdateHuntPayload,
  toApiStep,
  type ApiHuntRaw,
} from '@/src/lib/hunt-mappers';
import type { HuntForm, HuntStepForm } from '@/src/lib/hunt-types';

export type Partner = {
  id: string;
  name: string;
  email: string;
  description?: string;
  logo?: string;
  chases: Chase[];
};

export type ARContent = {
  id: string;
  type: 'model' | 'image' | 'marker';
  data: string;
  scale?: number;
  rotation?: [number, number, number];
};

export type ChaseStep = {
  id: string;
  order: number;
  title: string;
  description: string;
  clue: string;
  type?: import('@/src/lib/hunt-types').HuntStepType;
  answer?: string;
  points?: number;
  location?: {
    latitude: number;
    longitude: number;
  };
  arContent?: ARContent;
  reward?: number;
  completed: boolean;
  radiusMeters?: number;
  arHint?: string;
  qrPayload?: string;
  scanInAr?: boolean;
  photoClueUri?: string;
  audioHintUri?: string;
};

export type Chase = {
  id: string;
  title: string;
  description: string;
  image?: string;
  partnerId: string;
  partner: Partner;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedDuration: number;
  location: {
    latitude: number;
    longitude: number;
  };
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'draft' | 'archived' | 'paused';
  participants: number;
  rating: number;
  steps: ChaseStep[];
};

export type StepProgress = {
  stepId: string;
  completed: boolean;
  completedAt?: string;
  arInteraction?: boolean;
};

export type UserProgress = {
  userId: string;
  chaseId: string;
  currentStep: number;
  totalSteps: number;
  pointsEarned: number;
  startedAt: string;
  completedAt?: string;
  stepProgress: StepProgress[];
};

export type HuntStepAnalytics = {
  stepId: string;
  order: number;
  title: string;
  latitude?: string;
  longitude?: string;
  completionCount: number;
};

export type HuntAnalytics = {
  huntId: string;
  participantCount: number;
  completedHuntCount: number;
  steps: HuntStepAnalytics[];
  userLocations: Array<{ latitude: string; longitude: string }>;
};

export type HuntParticipant = {
  userId: string;
  email: string;
  points?: number;
  level?: number;
  completedHunts?: number;
  pointsAwarded: number;
  joinedAt?: string;
  completedAt?: string;
};

type ApiStepAnalyticsRaw = {
  stepId: string;
  stepOrder?: number;
  order?: number;
  title: string;
  latitude?: string;
  longitude?: string;
  completionCount: number;
};

type ApiHuntAnalyticsRaw = {
  huntId: string;
  participantCount: number;
  completedHuntCount: number;
  steps: ApiStepAnalyticsRaw[];
  userLocations: Array<{ latitude: string; longitude: string }>;
};

const normalizeAnalytics = (raw: ApiHuntAnalyticsRaw): HuntAnalytics => ({
  huntId: raw.huntId,
  participantCount: raw.participantCount,
  completedHuntCount: raw.completedHuntCount,
  userLocations: raw.userLocations ?? [],
  steps: (raw.steps ?? []).map((step) => ({
    stepId: step.stepId,
    order: step.order ?? step.stepOrder ?? 0,
    title: step.title,
    latitude: step.latitude,
    longitude: step.longitude,
    completionCount: step.completionCount,
  })),
});

const localProgressStore = new Map<string, UserProgress>();

const normalizeChase = (raw: ApiHuntRaw): Chase => fromApiHunt(raw);

/** Hunt search payloads omit steps and coordinates — load detail when needed. */
const needsChaseDetail = (chase: Chase) =>
  !isValidGeoPoint(chase.location) || chase.steps.length === 0;

const enrichChaseSummaries = async (chases: Chase[]): Promise<Chase[]> => {
  const stale = chases.filter(needsChaseDetail);
  if (stale.length === 0) {
    return chases;
  }

  const details = await Promise.all(
    stale.map(async (chase) => {
      try {
        const response = await apiRequest<unknown>(`/hunt/${chase.id}`);
        return normalizeChase(normalizeHuntDetailResponse(response));
      } catch {
        return chase;
      }
    })
  );

  const byId = new Map(details.map((chase) => [chase.id, chase]));
  return chases.map((chase) => {
    const detailed = byId.get(chase.id);
    if (!detailed) {
      return chase;
    }
    return {
      ...chase,
      location: isValidGeoPoint(detailed.location) ? detailed.location : chase.location,
      steps: detailed.steps.length > 0 ? detailed.steps : chase.steps,
    };
  });
};

export type HuntSearchParams = {
  q?: string;
  status?: Chase['status'];
  difficulty?: Chase['difficulty'];
  partnerId?: string;
  limit?: number;
  offset?: number;
};

const HUNT_SEARCH_LIMIT = 100;

function buildHuntSearchPath(params: HuntSearchParams = {}): string {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.status) search.set('status', params.status);
  if (params.difficulty) search.set('difficulty', params.difficulty);
  if (params.partnerId) search.set('partnerId', params.partnerId);
  if (params.limit != null) search.set('limit', String(params.limit));
  if (params.offset != null) search.set('offset', String(params.offset));
  const qs = search.toString();
  return qs ? `/hunt/search?${qs}` : '/hunt/search';
}

const normalizeChasesResponse = (response: unknown): Chase[] => {
  let list: unknown[] = [];
  if (Array.isArray(response)) {
    list = response;
  } else if (
    response &&
    typeof response === 'object' &&
    'data' in response &&
    Array.isArray((response as { data: unknown[] }).data)
  ) {
    list = (response as { data: unknown[] }).data;
  }

  return list
    .filter((item): item is ApiHuntRaw => Boolean(item && typeof item === 'object' && 'id' in item))
    .map((item) => normalizeChase(normalizeHuntDetailResponse(item)));
};

const buildLocalProgress = (chase: Chase): UserProgress => ({
  userId: 'me',
  chaseId: chase.id,
  currentStep: 1,
  totalSteps: chase.steps.length,
  pointsEarned: 0,
  startedAt: new Date().toISOString(),
  stepProgress: chase.steps.map((step) => ({ stepId: step.id, completed: false })),
});

export const chaseApi = {
  searchChases: async (params: HuntSearchParams = {}): Promise<Chase[]> => {
    const response = await apiRequest<unknown>(buildHuntSearchPath(params));
    return enrichChaseSummaries(normalizeChasesResponse(response));
  },

  getChases: async (): Promise<Chase[]> => {
    const response = await apiRequest<unknown>(
      buildHuntSearchPath({ limit: HUNT_SEARCH_LIMIT })
    );
    const hunts = normalizeChasesResponse(response).filter(
      (chase) => chase.status !== 'paused'
    );
    return enrichChaseSummaries(hunts);
  },

  getManagedChases: async (partnerId?: string): Promise<Chase[]> => {
    const response = await apiRequest<unknown>(
      buildHuntSearchPath({
        partnerId,
        limit: HUNT_SEARCH_LIMIT,
      })
    );
    const hunts = await enrichChaseSummaries(normalizeChasesResponse(response));
    const owned = partnerId ? hunts.filter((chase) => chase.partnerId === partnerId) : hunts;
    return owned.filter((chase) => chase.status !== 'archived');
  },

  pauseChase: async (chaseId: string): Promise<Chase> => {
    return chaseApi.updateChase(chaseId, { status: 'paused' });
  },

  resumeChase: async (chaseId: string): Promise<Chase> => {
    return chaseApi.updateChase(chaseId, { status: 'active' });
  },

  getChase: async (chaseId: string): Promise<Chase> => {
    const response = await apiRequest<unknown>(`/hunt/${chaseId}`);
    return normalizeChase(normalizeHuntDetailResponse(response));
  },

  joinHunt: async (huntId: string): Promise<void> => {
    try {
      await apiRequest<void>('/hunt/join', {
        method: 'POST',
        body: JSON.stringify({ huntId }),
      });
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 409) {
        return;
      }
      throw error;
    }
  },

  leaveHunt: async (huntId: string): Promise<void> => {
    try {
      await apiRequest<void>('/hunt/leave', {
        method: 'POST',
        body: JSON.stringify({ huntId }),
      });
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 409) {
        return;
      }
      throw error;
    }
  },

  getJoinedHuntIds: async (): Promise<string[]> => {
    const hunts = await chaseApi.getJoinedHunts();
    return hunts.map((hunt) => hunt.id);
  },

  getJoinedHunts: async (): Promise<Chase[]> => {
    const response = await apiRequest<unknown>('/hunt/joined');
    return enrichChaseSummaries(normalizeChasesResponse(response));
  },

  getCompletedHunts: async (): Promise<Chase[]> => {
    const response = await apiRequest<unknown>('/hunt/completed');
    return enrichChaseSummaries(normalizeChasesResponse(response));
  },

  getCompletedStepIds: async (huntId: string): Promise<string[]> => {
    const response = await apiRequest<unknown>(`/hunt/step/completed/${huntId}`);
    if (!Array.isArray(response)) {
      return [];
    }
    return response
      .map((step) => {
        if (!step || typeof step !== 'object') {
          return undefined;
        }
        const id = (step as { id?: string }).id;
        return typeof id === 'string' && id.length > 0 ? id : undefined;
      })
      .filter((id): id is string => Boolean(id));
  },

  getProgress: async (chaseId: string): Promise<UserProgress | null> =>
    localProgressStore.get(chaseId) ?? null,

  startChase: async (chaseId: string, alreadyJoined = false): Promise<UserProgress> => {
    if (!alreadyJoined) {
      await chaseApi.joinHunt(chaseId);
    }
    const chase = await chaseApi.getChase(chaseId);
    const progress = buildLocalProgress(chase);
    localProgressStore.set(chaseId, progress);
    return progress;
  },

  completeStep: async (chaseId: string, stepId: string, answer?: string): Promise<ChaseStep> => {
    await apiRequest(`/hunt/step/complete/${stepId}`, {
      method: 'POST',
      body: JSON.stringify({ answer: answer?.trim() || null }),
    });

    const chase = await chaseApi.getChase(chaseId);
    const step = chase.steps.find((item) => item.id === stepId);
    if (!step) {
      throw new Error('Étape introuvable');
    }

    const progress = localProgressStore.get(chaseId) ?? buildLocalProgress(chase);
    const updated: UserProgress = {
      ...progress,
      stepProgress: progress.stepProgress.map((item) =>
        item.stepId === stepId ? { ...item, completed: true, completedAt: new Date().toISOString() } : item
      ),
    };
    updated.currentStep = Math.min(
      updated.stepProgress.filter((item) => item.completed).length + 1,
      updated.totalSteps
    );
    updated.pointsEarned += step.points ?? step.reward ?? 10;
    localProgressStore.set(chaseId, updated);

    return { ...step, completed: true };
  },

  interactAR: async (chaseId: string, stepId: string): Promise<{ success: boolean; progress: UserProgress | null }> => {
    const progress = localProgressStore.get(chaseId);
    if (!progress) {
      return { success: true, progress: null };
    }
    const updated: UserProgress = {
      ...progress,
      stepProgress: progress.stepProgress.map((item) =>
        item.stepId === stepId ? { ...item, arInteraction: true } : item
      ),
    };
    localProgressStore.set(chaseId, updated);
    return { success: true, progress: updated };
  },

  completeChase: async (chaseId: string): Promise<{ pointsEarned: number }> => {
    const progress = localProgressStore.get(chaseId);
    return { pointsEarned: progress?.pointsEarned ?? 0 };
  },

  createChase: async (form: HuntForm, partnerId?: string): Promise<Chase> => {
    const chase = await apiRequest<ApiHuntRaw>('/hunt', {
      method: 'POST',
      body: JSON.stringify(toCreateHuntPayload(form, partnerId)),
    });
    return normalizeChase(chase);
  },

  updateChase: async (chaseId: string, payload: Partial<Chase>): Promise<Chase> => {
    const chase = await apiRequest<ApiHuntRaw>(`/hunt/${chaseId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return normalizeChase(chase);
  },

  syncHuntSteps: async (huntId: string, steps: HuntStepForm[]): Promise<Chase> => {
    await apiRequest(`/hunt/${huntId}/steps/sync`, {
      method: 'PUT',
      body: JSON.stringify({ steps: steps.map(toApiStep) }),
    });
    return chaseApi.getChase(huntId);
  },

  saveHuntEdit: async (huntId: string, form: HuntForm): Promise<Chase> => {
    await chaseApi.updateChase(huntId, toUpdateHuntPayload(form));
    return chaseApi.syncHuntSteps(huntId, form.steps);
  },

  deleteChase: async (chaseId: string): Promise<void> => {
    await apiRequest<void>(`/hunt/${chaseId}`, { method: 'DELETE' });
  },

  getHuntAnalytics: async (huntId: string): Promise<HuntAnalytics> => {
    const raw = await apiRequest<ApiHuntAnalyticsRaw>(`/hunt/${huntId}/analytics`);
    return normalizeAnalytics(raw);
  },

  getHuntParticipants: async (huntId: string): Promise<HuntParticipant[]> => {
    const response = await apiRequest<HuntParticipant[]>(`/hunt/${huntId}/participants`);
    return Array.isArray(response) ? response : [];
  },
};
