const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api';

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
};