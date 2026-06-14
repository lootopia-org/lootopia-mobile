import { API_BASE_URL } from '@/src/lib/api-client';

function isHttpStoredImageUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://');
}

export function storedImageViewUrl(storedUrl: string): string {
  return `${API_BASE_URL}/upload/image/view?url=${encodeURIComponent(storedUrl)}`;
}

export function resolveStoredImageUri(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('file://') || trimmed.startsWith('data:')) {
    return trimmed;
  }
  if (isHttpStoredImageUrl(trimmed)) {
    return storedImageViewUrl(trimmed);
  }
  return trimmed;
}
