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

export const HUNT_STEP_TYPE_OPTIONS: {
  value: HuntStepType;
  label: string;
}[] = [
  { value: 'checkpoint', label: 'Checkpoint GPS' },
  { value: 'riddle', label: 'Énigme' },
  { value: 'qr_code', label: 'QR code' },
  { value: 'clue', label: 'Indice' },
  { value: 'ar', label: 'Trésor AR' },
  { value: 'photo', label: 'Photo' },
];

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
  return HUNT_STEP_TYPE_OPTIONS.find((opt) => opt.value === type)?.label ?? type;
}

export function stepActionLabel(type: HuntStepType): string {
  switch (type) {
    case 'checkpoint':
      return 'Y aller';
    case 'riddle':
      return 'Répondre';
    case 'qr_code':
      return 'Scanner';
    case 'clue':
      return 'Découvrir';
    case 'ar':
      return 'Ouvrir AR';
    case 'photo':
      return 'Photographier';
    default:
      return 'Commencer';
  }
}
