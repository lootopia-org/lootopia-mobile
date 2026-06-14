import { API_BASE_URL, getSessionToken, sessionCookieHeader } from '@/src/lib/api-client';

export async function uploadStepImage(localUri: string): Promise<string> {
  const token = await getSessionToken();
  const headers: Record<string, string> = {};
  if (token) {
    Object.assign(headers, sessionCookieHeader(token));
  }

  const response = await fetch(`${API_BASE_URL}/upload/image?kind=step`, {
    method: 'POST',
    headers,
    credentials: token ? 'omit' : 'include',
    body: (() => {
      const formData = new FormData();
      formData.append('file', {
        uri: localUri,
        name: 'step-photo.jpg',
        type: 'image/jpeg',
      } as unknown as Blob);
      return formData;
    })(),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Upload échoué (${response.status})`);
  }

  const data = (await response.json()) as { url: string };
  return data.url;
}
