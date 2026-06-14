import { API_BASE_URL } from '@/src/lib/api-client';

function isHttpStoredImageUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://');
}

function isLikelyBase64Image(value: string): boolean {
  if (!value || value.startsWith('http') || value.startsWith('/') || value.startsWith('data:')) {
    return false;
  }
  return /^[A-Za-z0-9+/=]+$/.test(value.slice(0, 64));
}

/** Extract S3 object key from a stored image URL when possible. */
export function extractStoredImageKey(storedUrl: string): string | undefined {
  const trimmed = storedUrl.trim();
  if (!isHttpStoredImageUrl(trimmed)) {
    return trimmed.includes('/') ? trimmed : undefined;
  }

  try {
    const pathname = new URL(trimmed).pathname.replace(/^\/+/, '');
    const lootopiaIdx = pathname.indexOf('lootopia/');
    if (lootopiaIdx >= 0) {
      return pathname.slice(lootopiaIdx);
    }
    return pathname || undefined;
  } catch {
    return undefined;
  }
}

export { isHttpStoredImageUrl, extractStoredImageKey };

/** True when the reference must be fetched via the authenticated view endpoint. */
export function needsAuthenticatedImageFetch(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('file://')) {
    return false;
  }
  return isHttpStoredImageUrl(trimmed) || Boolean(extractStoredImageKey(trimmed));
}

export function storedImageViewUrl(storedUrl: string): string {
  const params = new URLSearchParams();
  params.set('url', storedUrl);
  const key = extractStoredImageKey(storedUrl);
  if (key) {
    params.set('key', key);
  }
  return `${API_BASE_URL}/upload/image/view?${params.toString()}`;
}

export function resolveStoredImageUri(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('file://') || trimmed.startsWith('data:')) {
    return trimmed;
  }
  if (isHttpStoredImageUrl(trimmed) || trimmed.includes('/')) {
    return storedImageViewUrl(trimmed);
  }
  if (isLikelyBase64Image(trimmed)) {
    return `data:image/jpeg;base64,${trimmed}`;
  }
  return trimmed;
}
