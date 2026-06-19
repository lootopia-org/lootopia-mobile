import { API_BASE_URL, apiRequest } from '@/src/lib/api-client';

export const encryptionApi = {
  putPublicKey: (token: string, publicKey: string) =>
    apiRequest<{ publicKey: string }>('/encryption/public-key', token, {
      method: 'PUT',
      body: JSON.stringify({ publicKey }),
    }),

  getPublicKey: (token: string, userId: string) =>
    apiRequest<{ publicKey: string; encryptionKeyVersion: number }>(
      `/encryption/public-key/${userId}`,
      token
    ),

  getHuntKey: (token: string, huntId: string) =>
    apiRequest<{ wrappedKey: string }>(`/hunt/${huntId}/key`, token),

  putKeyWrappers: (
    token: string,
    huntId: string,
    wrappers: Array<{ userId: string; wrappedKey: string }>
  ) =>
    apiRequest(`/hunt/${huntId}/key-wrappers`, token, {
      method: 'PUT',
      body: JSON.stringify({ wrappers }),
    }),
};
