import type { ChaseStep } from '@/src/lib/chase-api';
import type { HuntStepType } from '@/src/lib/hunt-types';

export type StepPlayMode = 'ar' | 'qr_scan' | 'answer' | 'photo';

export function getStepPlayMode(step: Pick<ChaseStep, 'type' | 'scanInAr'>): StepPlayMode {
  const type = (step.type ?? 'checkpoint') as HuntStepType;
  if (type === 'riddle' || type === 'clue') {
    return 'answer';
  }
  if (type === 'photo') {
    return 'photo';
  }
  if (type === 'qr_code') {
    return step.scanInAr ? 'ar' : 'qr_scan';
  }
  return 'ar';
}

export function shouldOpenArRoute(step: Pick<ChaseStep, 'type' | 'scanInAr'>): boolean {
  return getStepPlayMode(step) === 'ar' || getStepPlayMode(step) === 'answer' || getStepPlayMode(step) === 'photo';
}

export function stepRequiresProximity(step: Pick<ChaseStep, 'type' | 'scanInAr'>): boolean {
  const mode = getStepPlayMode(step);
  return mode === 'ar' || mode === 'photo' || mode === 'qr_scan';
}
