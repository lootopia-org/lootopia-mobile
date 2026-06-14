import { apiRequest } from '@/src/lib/api-client';

export type StepPhotoSession = {
  sessionId: string;
  stepKey: string;
  huntId?: string;
  photoUrl?: string;
  status: 'pending' | 'completed';
};

export const stepPhotoApi = {
  submitPhoto: (sessionId: string, photoUrl: string) =>
    apiRequest<StepPhotoSession>(`/hunt/step-photo-sessions/${sessionId}/photo`, {
      method: 'POST',
      body: JSON.stringify({ photoUrl }),
    }),
};
