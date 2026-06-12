import * as SecureStore from 'expo-secure-store';

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

// Suivi LOCAL de la progression par étape : le contrat backend ne gère pas les
// étapes individuellement (la complétion d'une chasse passe par
// PATCH /profile {huntId}) — ce n'est pas un mock, c'est l'état de jeu client.
const localProgressStore = new Map<string, UserProgress>();

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
    throw new Error(body.message || `Requête échouée (${response.status})`);
  }

  return parseJson<T>(response);
};

// Le backend ne renvoie pas forcément tous les champs : `GET /hunt` (liste) ne
// contient PAS les étapes (inline uniquement sur `GET /hunt/{id}`), et
// rating/participants/location peuvent manquer. On normalise la forme.
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
  // GET /hunt — chasses actives (contrat Hunts).
  getChases: async (): Promise<Chase[]> => {
    const response = await request<unknown>('/hunt');
    return normalizeChasesResponse(response);
  },

  // GET /hunt/{id} — la chasse et ses étapes (inline).
  getChase: async (chaseId: string): Promise<Chase> => {
    const chase = await request<Partial<Chase> & { id: string }>(`/hunt/${chaseId}`);
    return normalizeChase(chase);
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
    const response = await request<unknown>('/hunt/joined');
    return normalizeChasesResponse(response);
  },

  // Progression locale (le backend ne suit pas les étapes individuelles).
  getProgress: async (chaseId: string): Promise<UserProgress | null> =>
    localProgressStore.get(chaseId) ?? null,

  // Démarrage : rejoint la chasse via le contrat puis initialise la
  // progression locale par étape.
  startChase: async (chaseId: string): Promise<UserProgress> => {
    await chaseApi.joinHunt(chaseId);
    const chase = await chaseApi.getChase(chaseId);
    const progress = buildLocalProgress(chase);
    localProgressStore.set(chaseId, progress);
    return progress;
  },

  completeStep: async (chaseId: string, stepId: string): Promise<ChaseStep> => {
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
    updated.pointsEarned += step.reward ?? 10;
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

  // POST /hunt — contrat : {title, description, image, partnerId, difficulty,
  // estimatedDuration, status?, steps[]} (admin/partner). On mappe l'objet
  // `partner` local vers `partnerId` attendu par l'API.
  createChase: async (payload: Partial<Chase>): Promise<Chase> => {
    const { partner, ...rest } = payload;
    const chase = await request<Partial<Chase> & { id: string }>('/hunt', {
      method: 'POST',
      body: JSON.stringify({ ...rest, partnerId: partner?.id }),
    });
    return normalizeChase(chase);
  },

  // PATCH /hunt/{id} — mise à jour partielle (admin ou propriétaire).
  updateChase: async (chaseId: string, payload: Partial<Chase>): Promise<Chase> => {
    const chase = await request<Partial<Chase> & { id: string }>(`/hunt/${chaseId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return normalizeChase(chase);
  },

  // DELETE /hunt/{id} — suppression (admin ou propriétaire).
  deleteChase: async (chaseId: string): Promise<void> => {
    await request<void>(`/hunt/${chaseId}`, { method: 'DELETE' });
  },
};
