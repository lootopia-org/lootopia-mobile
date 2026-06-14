import type { Chase, ChaseStep } from '@/src/lib/chase-api';
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
  latitude?: string | null;
  longitude?: string | null;
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

function parseCoord(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function fromApiStep(step: ApiHuntStep): ChaseStep {
  const lat = parseCoord(step.latitude);
  const lng = parseCoord(step.longitude);
  const type = (step.type ?? 'checkpoint') as HuntStepType;
  const answer = step.awnser ?? undefined;
  const description = step.description ?? '';

  return {
    id: step.id ?? '',
    order: step.stepOrder ?? step.order ?? 0,
    title: step.title,
    description,
    clue: description,
    type,
    answer,
    points: Math.round(step.points ?? DEFAULT_STEP_POINTS),
    location: lat !== null && lng !== null ? { latitude: lat, longitude: lng } : undefined,
    qrPayload: type === 'qr_code' ? answer : undefined,
    photoClueUri: type === 'photo' ? answer : undefined,
    completed: false,
    radiusMeters: 30,
    reward: Math.round(step.points ?? DEFAULT_STEP_POINTS),
  };
}

export function fromApiHunt(raw: ApiHuntRaw): Chase {
  const partnerId = raw.partnerId ?? raw.partner?.id ?? 'unknown';
  const steps = (raw.steps ?? []).map(fromApiStep).sort((a, b) => a.order - b.order);
  const firstLocated = steps.find((step) => step.location);

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
    location: raw.location ?? firstLocated?.location ?? { latitude: 0, longitude: 0 },
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
            latitude: step.location ? String(step.location.latitude) : '',
            longitude: step.location ? String(step.location.longitude) : '',
            points: step.points ?? DEFAULT_STEP_POINTS,
          }))
        : [],
  };
}
