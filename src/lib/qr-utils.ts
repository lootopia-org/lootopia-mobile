/** Normalize QR payload strings for reliable scan matching. */
export function normalizeQrPayload(value: string): string {
  return value
    .trim()
    .replace(/\r\n/g, '\n')
    .replace(/\uFEFF/g, '');
}

export function qrPayloadsMatch(scanned: string, expected: string): boolean {
  const a = normalizeQrPayload(scanned);
  const b = normalizeQrPayload(expected);
  if (!a || !b) {
    return false;
  }
  if (a === b) {
    return true;
  }
  if (a.toLowerCase() === b.toLowerCase()) {
    return true;
  }
  return false;
}

export function isLikelyImageReference(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:image/') ||
    /^[A-Za-z0-9+/=]{80,}$/.test(trimmed)
  );
}
