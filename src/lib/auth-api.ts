import { API_BASE_URL, apiRequest } from '@/src/lib/api-client';

export type AuthMethod = 'totp' | 'webauthn';

export type LoginResponse = {
  token: string;
  mfaRequired: boolean;
  mfaMethods: AuthMethod[];
};

export type UserRole = 'admin' | 'partner' | 'player';

export type User = {
  id: string;
  username: string;
  email: string;
  role?: UserRole;
};

export type TotpEnrollBeginResponse = {
  secret: string;
  otpauthUri: string;
};

export type WebauthnBeginResponse = {
  handle: string;
  publicKey: any;
};

export type WebauthnCompleteResponse = {
  token: string;
};

export type WebauthnCredential = {
  id: string;
  name?: string;
  createdAt: string;
  lastUsedAt?: string;
};

// Erreur enrichie comme côté web : l'API renvoie ses erreurs en TEXTE BRUT
// (ex. "invalid email or password", "missing session token"), parfois en JSON
// ({"message": ...}). On expose donc le `status` HTTP (fiable) + le corps brut,
// et un `message` best-effort. La détection (ex. email non vérifié = 403) se fait
// sur le statut, pas sur un `code` JSON qui n'existe pas.
export type AuthApiError = Error & { status?: number; body?: string };

const parseJson = async <T,>(response: Response): Promise<T> => {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }

  return {} as T;
};

const request = async <T,>(path: string, init: RequestInit = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    let message = body;
    try {
      const parsed = JSON.parse(body);
      message = parsed.message || parsed.code || body;
    } catch {
      // corps en texte brut : on le garde tel quel
    }

    const error = new Error(message || 'Request failed') as AuthApiError;
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return parseJson<T>(response);
};

export type RegisterPayload = {
  username: string;
  email: string;
  password: string;
  bio?: string;
  avatar?: string;
};

export const authApi = {
  register: (payload: RegisterPayload) =>
    request<void>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  forgotPassword: (email: string) =>
    // L'API renvoie toujours un message générique (pas d'énumération de comptes).
    request<{ message?: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, newPassword: string) =>
    // Contrat API : champ `new_password` (snake_case). Lien à usage unique,
    // expirant, et qui révoque les sessions existantes.
    request<void>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, new_password: newPassword }),
    }),

  verifyEmail: (token: string) =>
    request<void>(`/auth/verify-email?token=${encodeURIComponent(token)}`, {
      method: 'GET',
    }),

  resendVerification: (email: string) =>
    request<void>('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  login: (email: string, password: string) =>
    request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  verifyTotp: (token: string, code: string) =>
    apiRequest<LoginResponse>(
      '/auth/mfa/totp',
      { method: 'POST', body: JSON.stringify({ code }) },
      token
    ),

  // WebAuthn login
  beginWebauthnLogin: (email: string) =>
    request<WebauthnBeginResponse>('/auth/webauthn/login/begin', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  completeWebauthnLogin: (handle: string, credential: unknown) =>
    request<WebauthnCompleteResponse>('/auth/webauthn/login/complete', {
      method: 'POST',
      body: JSON.stringify({ handle, credential }),
    }),

  me: (token: string) => apiRequest<User>('/auth/me', { method: 'GET' }, token),

  logout: (token: string) => apiRequest<void>('/auth/logout', { method: 'POST' }, token),

  // TOTP enrollment
  beginTotpEnroll: (token: string) =>
    apiRequest<TotpEnrollBeginResponse>('/auth/totp/enroll/begin', { method: 'POST' }, token),

  verifyTotpEnroll: (token: string, code: string) =>
    apiRequest<void>(
      '/auth/totp/enroll/verify',
      { method: 'POST', body: JSON.stringify({ code }) },
      token
    ),

  disableTotp: (token: string, code: string) =>
    apiRequest<void>(
      '/auth/totp/disable',
      { method: 'POST', body: JSON.stringify({ code }) },
      token
    ),

  // WebAuthn registration
  beginWebauthnRegister: (token: string) =>
    apiRequest<WebauthnBeginResponse>('/auth/webauthn/register/begin', { method: 'POST' }, token),

  completeWebauthnRegister: (token: string, handle: string, credential: unknown) =>
    apiRequest<void>(
      '/auth/webauthn/register/complete',
      { method: 'POST', body: JSON.stringify({ handle, credential }) },
      token
    ),

  listWebauthnCredentials: (token: string) =>
    apiRequest<WebauthnCredential[]>('/auth/webauthn/credentials', { method: 'GET' }, token),
};