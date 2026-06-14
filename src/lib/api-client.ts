import * as SecureStore from 'expo-secure-store';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';
export const TOKEN_KEY = 'lootopia-mobile-token';

export type ApiRequestError = Error & { status?: number; body?: string };

export async function getSessionToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export function sessionCookieHeader(token: string): Record<string, string> {
  return { Cookie: `session=${token.trim()}` };
}

/**
 * Authenticated fetch for the Lootopia API.
 * The backend reads `session` from the Cookie header.
 *
 * On React Native, set `credentials: 'omit'` when sending Cookie manually —
 * otherwise the native cookie jar can override or conflict with the header.
 */
export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  tokenOverride?: string | null
): Promise<T> {
  const token = tokenOverride ?? (await getSessionToken());
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };

  const hasBody = init.body !== undefined && init.body !== null;
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (hasBody && !isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    Object.assign(headers, sessionCookieHeader(token));
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: token ? 'omit' : 'include',
  });

  if (!response.ok) {
    const body = await response.text();
    let message = body;
    try {
      const parsed = JSON.parse(body) as { message?: string };
      message = parsed.message || body;
    } catch {
      // keep raw body
    }
    const error = new Error(message || `Request failed (${response.status})`) as ApiRequestError;
    error.status = response.status;
    error.body = body;
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }

  return {} as T;
}
