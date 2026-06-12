import type { AuthApiError } from '@/src/lib/auth-api';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

/**
 * Contrat Profiles (authentifié, session MFA complète) :
 *   GET    /profile        → profil de l'utilisateur courant
 *   POST   /profile        → création (409 si déjà existant)
 *   PATCH  /profile {huntId} → marque une chasse rejointe comme terminée,
 *                              crédite les points des étapes
 *   DELETE /profile        → suppression du profil
 *   GET    /profile/list   → tous les profils (admin uniquement)
 * Forme alignée sur le type `Profile` du frontend web (src/types/index.ts).
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

const request = async <T,>(token: string, path: string, init: RequestInit = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(body || 'Request failed') as AuthApiError;
    error.status = response.status;
    error.body = body;
    throw error;
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }
  return {} as T;
};

export const profileApi = {
  get: (token: string) => request<Profile>(token, '/profile', { method: 'GET' }),

  create: (token: string) => request<Profile>(token, '/profile', { method: 'POST' }),

  completeHunt: (token: string, huntId: string) =>
    request<Profile>(token, '/profile', {
      method: 'PATCH',
      body: JSON.stringify({ huntId }),
    }),

  delete: (token: string) => request<void>(token, '/profile', { method: 'DELETE' }),

  // Admin uniquement (403 pour les autres rôles).
  list: (token: string) => request<Profile[]>(token, '/profile/list', { method: 'GET' }),
};

/**
 * GET puis POST si le profil n'existe pas encore (404) — idempotent côté
 * appelant. Un 409 sur le POST (course avec une autre session) est rattrapé
 * par un nouveau GET.
 */
export async function fetchOrCreateProfile(token: string): Promise<Profile> {
  try {
    return await profileApi.get(token);
  } catch (error: any) {
    if (error?.status !== 404) {
      throw error;
    }
  }
  try {
    return await profileApi.create(token);
  } catch (error: any) {
    if (error?.status === 409) {
      return profileApi.get(token);
    }
    throw error;
  }
}
