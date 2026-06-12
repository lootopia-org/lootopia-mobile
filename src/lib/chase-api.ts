import * as SecureStore from 'expo-secure-store';
import { chases as mockChases } from '@/src/data/mock';

// Même API que l'auth (contrat /hunt, /profile, /auth sur le même serveur).
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';
const TOKEN_KEY = 'lootopia-mobile-token';

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
  // Optionnel : les étapes "checkpoint" sont géolocalisées, les étapes
  // "riddle" (réponse à une énigme) n'ont pas de position.
  location?: {
    latitude: number;
    longitude: number;
  };
  arContent?: ARContent;
  reward?: number;
  completed: boolean;
  // Champs propres au mobile : rayon de proximité GPS + indice affiché en AR.
  radiusMeters?: number;
  arHint?: string;
  // Contenu d'un QR code physique qui valide l'étape (alternative au GPS,
  // utile en intérieur). Format conseillé : "lootopia:<step-id>".
  qrPayload?: string;
  // Indice photo capturé sur site par le partenaire — révélé au joueur
  // uniquement à moins de 15 m du point ("photo secrecy").
  photoClueUri?: string;
  // Indice audio (10 s max) enregistré sur site par le partenaire.
  audioHintUri?: string;
};

export type Chase = {
  id: string;
  title: string;
  description: string;
  image?: string;
  partner: Partner;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedDuration: number;
  location: {
    latitude: number;
    longitude: number;
  };
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'draft' | 'archived';
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

type ApiError = {
  message?: string;
};

const fallbackProgressStore = new Map<string, UserProgress>();

// Les données mock partagent désormais la même forme `Chase` que l'API (voir
// src/data/mock.ts, alignées sur le frontend web) : plus besoin de normaliser.
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const parseJson = async <T,>(response: Response): Promise<T> => {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }

  return {} as T;
};

const getToken = async () => SecureStore.getItemAsync(TOKEN_KEY);

const request = async <T,>(path: string, init: RequestInit = {}) => {
  const token = await getToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await parseJson<ApiError>(response);
    throw new Error(body.message || 'Request failed');
  }

  return parseJson<T>(response);
};

// Le vrai backend ne renvoie pas forcément tous les champs que le mock
// garantissait : `GET /hunt` (liste) ne contient PAS les étapes (elles sont
// inline uniquement sur `GET /hunt/{id}`), et rating/participants/location
// peuvent manquer. On normalise pour que l'UI puisse compter sur la forme.
const normalizeChase = (raw: Partial<Chase> & { id: string }): Chase => ({
  id: raw.id,
  title: raw.title ?? 'Chasse sans titre',
  description: raw.description ?? '',
  image: raw.image,
  difficulty: raw.difficulty ?? 'easy',
  estimatedDuration: raw.estimatedDuration ?? 0,
  createdAt: raw.createdAt ?? new Date(0).toISOString(),
  updatedAt: raw.updatedAt ?? new Date(0).toISOString(),
  status: raw.status ?? 'active',
  participants: raw.participants ?? 0,
  rating: raw.rating ?? 0,
  partner: raw.partner ?? { id: 'unknown', name: 'Lootopia', email: '', chases: [] },
  location: raw.location ?? { latitude: 0, longitude: 0 },
  steps: Array.isArray(raw.steps) ? raw.steps : [],
});

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
    .filter((item): item is Partial<Chase> & { id: string } =>
      Boolean(item && typeof item === 'object' && 'id' in item)
    )
    .map(normalizeChase);
};

const ensureFallbackProgress = (chase: Chase) => {
  const existing = fallbackProgressStore.get(chase.id);
  if (existing) {
    return existing;
  }

  return null;
};

export const chaseApi = {
  // GET /hunt — chasses actives (contrat Hunts).
  getChases: async (): Promise<Chase[]> => {
    try {
      const response = await request<unknown>('/hunt');
      return normalizeChasesResponse(response);
    } catch {
      return clone(mockChases);
    }
  },

  // GET /hunt/{id} — la chasse et ses étapes (inline).
  getChase: async (chaseId: string): Promise<Chase> => {
    try {
      const chase = await request<Partial<Chase> & { id: string }>(`/hunt/${chaseId}`);
      return normalizeChase(chase);
    } catch {
      const chase = mockChases.find((item) => item.id === chaseId);
      if (!chase) {
        throw new Error('Chase not found');
      }

      return clone(chase);
    }
  },

  getProgress: async (chaseId: string): Promise<UserProgress | null> => {
    try {
      return await request<UserProgress>(`/chases/${chaseId}/progress`);
    } catch {
      const chase = mockChases.find((item) => item.id === chaseId);
      if (!chase) {
        return null;
      }

      const progress = ensureFallbackProgress(chase);
      return progress ?? null;
    }
  },

  // POST /hunt/join {huntId} — rejoindre une chasse active.
  joinHunt: async (huntId: string): Promise<void> => {
    await request<void>('/hunt/join', {
      method: 'POST',
      body: JSON.stringify({ huntId }),
    });
  },

  // POST /hunt/leave {huntId} — quitter une chasse rejointe.
  leaveHunt: async (huntId: string): Promise<void> => {
    await request<void>('/hunt/leave', {
      method: 'POST',
      body: JSON.stringify({ huntId }),
    });
  },

  // GET /hunt/joined — chasses rejointes non terminées.
  getJoinedHunts: async (): Promise<Chase[]> => {
    try {
      const response = await request<unknown>('/hunt/joined');
      return normalizeChasesResponse(response);
    } catch {
      return [];
    }
  },

  // Démarrage côté joueur : rejoint la chasse via le contrat (/hunt/join) puis
  // construit la progression locale (le suivi par étape reste local au mobile).
  startChase: async (chaseId: string): Promise<UserProgress> => {
    try {
      await chaseApi.joinHunt(chaseId);
      const chase = await chaseApi.getChase(chaseId);
      const progress: UserProgress = {
        userId: 'mobile-user',
        chaseId,
        currentStep: 1,
        totalSteps: chase.steps.length,
        pointsEarned: 0,
        startedAt: new Date().toISOString(),
        stepProgress: chase.steps.map((step) => ({ stepId: step.id, completed: false })),
      };
      fallbackProgressStore.set(chaseId, progress);
      return progress;
    } catch {
      const chase = await chaseApi.getChase(chaseId);
      const progress: UserProgress = {
        userId: 'mobile-user',
        chaseId,
        currentStep: 1,
        totalSteps: chase.steps.length,
        pointsEarned: 0,
        startedAt: new Date().toISOString(),
        stepProgress: chase.steps.map((step) => ({ stepId: step.id, completed: false })),
      };

      fallbackProgressStore.set(chaseId, progress);
      return progress;
    }
  },

  completeStep: async (chaseId: string, stepId: string): Promise<ChaseStep> => {
    try {
      return await request<ChaseStep>(`/chases/${chaseId}/steps/${stepId}/complete`, {
        method: 'POST',
      });
    } catch {
      const chase = await chaseApi.getChase(chaseId);
      const step = chase.steps.find((item) => item.id === stepId);

      if (!step) {
        throw new Error('Step not found');
      }

      const nextProgress = fallbackProgressStore.get(chaseId) ?? (await chaseApi.startChase(chaseId));
      const updatedProgress: UserProgress = {
        ...nextProgress,
        stepProgress: nextProgress.stepProgress.map((progressStep) =>
          progressStep.stepId === stepId
            ? { ...progressStep, completed: true, completedAt: new Date().toISOString() }
            : progressStep
        ),
      };

      updatedProgress.currentStep = Math.min(
        updatedProgress.stepProgress.filter((progressStep) => progressStep.completed).length + 1,
        updatedProgress.totalSteps
      );
      updatedProgress.pointsEarned += step.reward ?? 10;

      fallbackProgressStore.set(chaseId, updatedProgress);
      return { ...step, completed: true };
    }
  },

  interactAR: async (chaseId: string, stepId: string): Promise<{ success: boolean; progress: UserProgress | null }> => {
    try {
      return await request<{ success: boolean; progress: UserProgress | null }>(
        `/chases/${chaseId}/steps/${stepId}/ar-interact`,
        { method: 'POST' }
      );
    } catch {
      const progress = fallbackProgressStore.get(chaseId);
      if (!progress) {
        return { success: true, progress: null };
      }

      const nextProgress: UserProgress = {
        ...progress,
        stepProgress: progress.stepProgress.map((progressStep) =>
          progressStep.stepId === stepId ? { ...progressStep, arInteraction: true } : progressStep
        ),
      };

      fallbackProgressStore.set(chaseId, nextProgress);
      return { success: true, progress: nextProgress };
    }
  },

  completeChase: async (chaseId: string): Promise<{ pointsEarned: number }> => {
    try {
      return await request<{ pointsEarned: number }>(`/chases/${chaseId}/complete`, {
        method: 'POST',
      });
    } catch {
      const progress = fallbackProgressStore.get(chaseId);
      return { pointsEarned: progress?.pointsEarned ?? 0 };
    }
  },
  // POST /hunt — contrat : {title, description, image, partnerId, difficulty,
  // estimatedDuration, status?, steps[]} (admin/partner). On mappe l'objet
  // `partner` local vers `partnerId` attendu par l'API.
  createChase: async (payload: Partial<Chase>): Promise<Chase> => {
    try {
      const { partner, ...rest } = payload;
      return await request<Chase>('/hunt', {
        method: 'POST',
        body: JSON.stringify({ ...rest, partnerId: partner?.id }),
      });
    } catch {
      // Fallback: create a local draft chase
      const id = `local-${Math.random().toString(36).slice(2, 9)}`;
      const now = new Date().toISOString();
      const chase: Chase = {
        id,
        title: payload.title ?? 'Nouvelle chasse',
        description: payload.description ?? '',
        image: payload.image,
        partner: payload.partner ?? {
          id: `partner-${id}`,
          name: 'Mobile Partner',
          email: 'partner@local',
          description: '',
          logo: '',
          chases: [],
        },
        difficulty: (payload.difficulty as Chase['difficulty']) ?? 'easy',
        estimatedDuration: payload.estimatedDuration ?? 30,
        location: payload.location ?? { latitude: 43.2965, longitude: 5.3698 },
        createdAt: now,
        updatedAt: now,
        status: 'draft',
        participants: 0,
        rating: 0,
        steps: payload.steps ?? [],
      };

      return chase;
    }
  },

  // PATCH /hunt/{id} — mise à jour partielle (admin ou propriétaire).
  updateChase: async (chaseId: string, payload: Partial<Chase>): Promise<Chase> => {
    try {
      return await request<Chase>(`/hunt/${chaseId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    } catch {
      // Fallback: attempt to fetch chase and merge changes locally
      const existing = await (async () => {
        try {
          return await chaseApi.getChase(chaseId);
        } catch {
          return null;
        }
      })();

      if (!existing) {
        throw new Error('Chase not found');
      }

      const updated: Chase = {
        ...existing,
        ...payload,
        updatedAt: new Date().toISOString(),
      } as Chase;

      return updated;
    }
  },

  // DELETE /hunt/{id} — suppression (admin ou propriétaire). Pas de fallback
  // mock : une suppression "simulée" serait trompeuse.
  deleteChase: async (chaseId: string): Promise<void> => {
    await request<void>(`/hunt/${chaseId}`, { method: 'DELETE' });
  },
};