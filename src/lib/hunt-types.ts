import i18n from '@/src/i18n';

export const HUNT_STEP_TYPES = [
  'checkpoint',
  'riddle',
  'qr_code',
  'clue',
  'ar',
  'photo',
] as const;

export type HuntStepType = (typeof HUNT_STEP_TYPES)[number];

export const DEFAULT_STEP_POINTS = 10;

export function getHuntStepTypeOptions(): { value: HuntStepType; label: string }[] {
  return HUNT_STEP_TYPES.map((value) => ({
    value,
    label: i18n.t(`hunts:stepTypes.${value}`),
  }));
}

export type HuntStatus = 'active' | 'draft' | 'archived' | 'paused';
export type HuntDifficulty = 'easy' | 'medium' | 'hard';

export type HuntStepForm = {
  id?: string;
  order: number;
  title: string;
  description: string;
  type: HuntStepType;
  answer?: string;
  latitude: string;
  longitude: string;
  points: number;
};

export type HuntForm = {
  title: string;
  description: string;
  difficulty: HuntDifficulty;
  estimatedDuration: number;
  status: HuntStatus;
  steps: HuntStepForm[];
};

export function createDefaultStep(order: number, lat?: number, lng?: number): HuntStepForm {
  return {
    order,
    title: '',
    description: '',
    type: 'checkpoint',
    latitude: lat !== undefined ? String(lat) : '',
    longitude: lng !== undefined ? String(lng) : '',
    points: DEFAULT_STEP_POINTS,
  };
}

export function stepTypeLabel(type: HuntStepType): string {
  return i18n.t(`hunts:stepTypes.${type}`, { defaultValue: type });
}

export function stepActionLabel(type: HuntStepType): string {
  return i18n.t(`hunts:stepActions.${type}`, { defaultValue: i18n.t('hunts:stepActions.default') });
}
