import type { Chase, ChaseStep } from '@/src/lib/chase-api';
import { geoPointFromApiFields, isValidGeoPoint } from '@/src/lib/geo';
import type { HuntForm, HuntStepForm, HuntStepType } from '@/src/lib/hunt-types';
import { DEFAULT_STEP_POINTS } from '@/src/lib/hunt-types';

type ApiHuntStep = {
  id?: string;
  stepOrder?: number;
  order?: number;
  title: string;
  description?: string | null;
  type?: string | null;
  awnser?: string | null;
  scanInAr?: boolean;
  latitude?: string | number | null;
  longitude?: string | number | null;
  lat?: string | number | null;
  lng?: string | number | null;
  location?: { latitude?: unknown; longitude?: unknown; lat?: unknown; lng?: unknown } | null;
  radiusMeters?: number | null;
  radius?: number | null;
  points?: number | null;
};

export type ApiHuntRaw = {
  id: string;
  title?: string;
  description?: string | null;
  image?: string | null;
  partnerId?: string;
  partner?: Chase['partner'];
  difficulty?: Chase['difficulty'];
  estimatedDuration?: number;
  status?: Chase['status'];
  participants?: number;
  rating?: number | string | null;
  createdAt?: string;
  updatedAt?: string;
  location?: Chase['location'];
  steps?: ApiHuntStep[];
};

/** Unwrap hunt detail payloads from GET /hunt/{id} (flat or nested). */
export function normalizeHuntDetailResponse(response: unknown): ApiHuntRaw {
  if (!response || typeof response !== 'object') {
    throw new Error('Invalid hunt response');
  }

  const raw = response as Record<string, unknown>;
  if (raw.data && typeof raw.data === 'object') {
    return normalizeHuntDetailResponse(raw.data);
  }

  const nestedHunt = raw.hunt;
  if (nestedHunt && typeof nestedHunt === 'object') {
    const hunt = nestedHunt as ApiHuntRaw;
    return {
      ...hunt,
      id: hunt.id ?? String((nestedHunt as { id?: string }).id ?? raw.id ?? ''),
      steps: (raw.steps ?? hunt.steps) as ApiHuntStep[] | undefined,
    };
  }

  return raw as ApiHuntRaw;
}

export function fromApiStep(step: ApiHuntStep): ChaseStep {
  const type = (step.type ?? 'checkpoint') as HuntStepType;
  const answer = step.awnser ?? undefined;
  const description = step.description ?? '';
  const rawStep = step as ApiHuntStep & { step_order?: number };
  const location = geoPointFromApiFields(rawStep as Record<string, unknown>);

  return {
    id: step.id ?? '',
    order: step.stepOrder ?? rawStep.step_order ?? step.order ?? 0,
    title: step.title,
    description,
    clue: description,
    type,
    answer,
    points: Math.round(step.points ?? DEFAULT_STEP_POINTS),
    location,
    qrPayload: type === 'qr_code' ? answer : undefined,
    scanInAr: step.scanInAr ?? false,
    photoClueUri: type === 'photo' ? answer : undefined,
    completed: false,
    radiusMeters: step.radiusMeters ?? step.radius ?? 30,
    reward: Math.round(step.points ?? DEFAULT_STEP_POINTS),
  };
}

export function fromApiHunt(raw: ApiHuntRaw): Chase {
  const partnerId = raw.partnerId ?? raw.partner?.id ?? 'unknown';
  const steps = (raw.steps ?? []).map(fromApiStep).sort((a, b) => a.order - b.order);
  const firstLocated = steps.find((step) => isValidGeoPoint(step.location));
  const huntLocation =
    geoPointFromApiFields(raw as Record<string, unknown>) ?? firstLocated?.location;

  return {
    id: raw.id,
    title: raw.title ?? '',
    description: raw.description ?? '',
    image: raw.image ?? undefined,
    partnerId,
    partner: raw.partner ?? { id: partnerId, name: 'Lootopia', email: '', chases: [] },
    difficulty: raw.difficulty ?? 'easy',
    estimatedDuration: raw.estimatedDuration ?? 60,
    createdAt: raw.createdAt ?? new Date(0).toISOString(),
    updatedAt: raw.updatedAt ?? new Date(0).toISOString(),
    status: raw.status ?? 'active',
    participants: raw.participants ?? 0,
    rating: typeof raw.rating === 'string' ? Number(raw.rating) || 0 : (raw.rating ?? 0),
    location: huntLocation ?? { latitude: 0, longitude: 0 },
    steps,
  };
}

export function toApiStep(step: HuntStepForm, index: number) {
  return {
    ...(step.id ? { id: step.id } : {}),
    stepOrder: index + 1,
    title: step.title.trim(),
    description: step.description.trim(),
    type: step.type,
    latitude: step.latitude.trim(),
    longitude: step.longitude.trim(),
    points: Number(step.points),
    awnser: step.answer?.trim() || null,
    scanInAr: step.type === 'qr_code' ? Boolean(step.scanInAr) : false,
  };
}

export function toCreateHuntPayload(form: HuntForm, partnerId?: string) {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    difficulty: form.difficulty,
    estimatedDuration: form.estimatedDuration,
    status: form.status,
    ...(partnerId ? { partnerId } : {}),
    steps: form.steps.map(toApiStep),
  };
}

export function toUpdateHuntPayload(form: Pick<HuntForm, 'title' | 'description' | 'difficulty' | 'estimatedDuration' | 'status'>) {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    difficulty: form.difficulty,
    estimatedDuration: form.estimatedDuration,
    status: form.status,
  };
}

export function chaseToHuntForm(chase: Chase): HuntForm {
  return {
    title: chase.title,
    description: chase.description,
    difficulty: chase.difficulty,
    estimatedDuration: chase.estimatedDuration || 60,
    status: chase.status === 'paused' || chase.status === 'archived' ? chase.status : chase.status,
    steps:
      chase.steps.length > 0
        ? chase.steps.map((step) => ({
            id: step.id,
            order: step.order,
            title: step.title,
            description: step.description,
            type: step.type ?? 'checkpoint',
            answer: step.answer,
            scanInAr: step.scanInAr ?? false,
            latitude: step.location ? String(step.location.latitude) : '',
            longitude: step.location ? String(step.location.longitude) : '',
            points: step.points ?? DEFAULT_STEP_POINTS,
          }))
        : [],
  };
}
