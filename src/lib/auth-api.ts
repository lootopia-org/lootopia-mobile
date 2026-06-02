const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

export type AuthMethod = 'totp' | 'webauthn';

export type LoginResponse = {
  token: string;
  mfaRequired: boolean;
  mfaMethods: AuthMethod[];
};

export type User = {
  id: string;
  username: string;
  email: string;
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

type ApiError = {
  message?: string;
  code?: string;
};

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
    const errorBody = await parseJson<ApiError>(response);
    const error = new Error(errorBody.message || 'Request failed') as Error & { code?: string };
    error.code = errorBody.code;
    throw error;
  }

  return parseJson<T>(response);
};

export const authApi = {
  register: (email: string, password: string) =>
    request<void>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
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
    request<User>('/me', {
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