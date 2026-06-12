const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

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
  // Optionnel : la vraie API /me ne renvoie pas de rôle. Renseigné en mode démo
  // pour piloter l'accès au Studio (réservé partner/admin).
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
    request<LoginResponse>('/auth/mfa/totp', {
      method: 'POST',
      body: JSON.stringify({ token, code }),
    }),

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

  me: (token: string) =>
    request<User>('/auth/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }),

  logout: (token: string) =>
    request<void>('/auth/logout', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }),

  // TOTP enrollment
  beginTotpEnroll: (token: string) =>
    request<TotpEnrollBeginResponse>('/auth/totp/enroll/begin', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }),

  verifyTotpEnroll: (token: string, code: string) =>
    request<void>('/auth/totp/enroll/verify', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code }),
    }),

  disableTotp: (token: string, code: string) =>
    request<void>('/auth/totp/disable', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code }),
    }),

  // WebAuthn registration
  beginWebauthnRegister: (token: string) =>
    request<WebauthnBeginResponse>('/auth/webauthn/register/begin', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }),

  completeWebauthnRegister: (token: string, handle: string, credential: unknown) =>
    request<void>('/auth/webauthn/register/complete', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ handle, credential }),
    }),

  listWebauthnCredentials: (token: string) =>
    request<WebauthnCredential[]>('/auth/webauthn/credentials', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }),
};