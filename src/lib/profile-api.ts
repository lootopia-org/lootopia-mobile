import { apiRequest } from '@/src/lib/api-client';
import type { AuthApiError } from '@/src/lib/auth-api';

/**
 * Contrat Profiles (authentifié, session MFA complète) :
 *   GET    /profile        → profil de l'utilisateur courant
 *   POST   /profile        → création (409 si déjà existant)
 *   PATCH  /profile {huntId} → marks a joined hunt as finished (no points; use step completion)
 *   DELETE /profile        → suppression du profil
 *   GET    /profile/list   → tous les profils (admin uniquement)
 */
export type Profile = {
  id: string;
  userId: string;
  username: string;
  bio?: string;
  avatar?: string;
  points: number;
  level: number;
  completedHunts?: number;
  createdAt?: string;
  updatedAt?: string;
};

const request = async <T,>(token: string, path: string, init: RequestInit = {}) =>
  apiRequest<T>(path, init, token);

export const profileApi = {
  get: (token: string) => request<Profile>(token, '/profile', { method: 'GET' }),

  create: (token: string) => request<Profile>(token, '/profile', { method: 'POST' }),

  completeHunt: (token: string, huntId: string) =>
    request<Profile>(token, '/profile', {
      method: 'PATCH',
      body: JSON.stringify({ huntId }),
    }),

  delete: (token: string) => request<void>(token, '/profile', { method: 'DELETE' }),

  list: (token: string) => request<Profile[]>(token, '/profile/list', { method: 'GET' }),
};

export async function fetchOrCreateProfile(token: string): Promise<Profile> {
  try {
    return await profileApi.get(token);
  } catch (error: unknown) {
    const status = (error as AuthApiError)?.status;
    if (status !== 404) {
      throw error;
    }
  }
  try {
    return await profileApi.create(token);
  } catch (error: unknown) {
    const status = (error as AuthApiError)?.status;
    if (status === 409) {
      return profileApi.get(token);
    }
    throw error;
  }
}
