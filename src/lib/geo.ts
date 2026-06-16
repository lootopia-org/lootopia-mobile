// Utilitaires géo partagés (extraits d'ARExperience pour réutilisation carte/listes).

export type GeoPoint = { latitude: number; longitude: number };

export function parseCoord(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const text = String(value).trim().replace(',', '.');
  if (!text) {
    return null;
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Parse latitude/longitude from API hunt or step payloads (flat or nested). */
export function geoPointFromApiFields(
  source: Record<string, unknown> | null | undefined
): GeoPoint | undefined {
  if (!source) {
    return undefined;
  }

  const nested =
    source.location && typeof source.location === 'object' && !Array.isArray(source.location)
      ? (source.location as Record<string, unknown>)
      : undefined;

  let lat = parseCoord(source.latitude ?? source.lat ?? nested?.latitude ?? nested?.lat);
  let lng = parseCoord(
    source.longitude ?? source.lng ?? source.lon ?? nested?.longitude ?? nested?.lng ?? nested?.lon
  );

  if (lat === null || lng === null) {
    return undefined;
  }

  if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
    [lat, lng] = [lng, lat];
  }

  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return undefined;
  }
  if (lat === 0 && lng === 0) {
    return undefined;
  }

  return { latitude: lat, longitude: lng };
}

export function isValidGeoPoint(point: GeoPoint | null | undefined): point is GeoPoint {
  if (!point) {
    return false;
  }
  if (Math.abs(point.latitude) < 0.0001 && Math.abs(point.longitude) < 0.0001) {
    return false;
  }
  if (point.latitude === 0 && point.longitude === 0) {
    return false;
  }
  return Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180;
}

export function isReliableDeviceLocation(point: {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
}): boolean {
  if (!isValidGeoPoint(point)) {
    return false;
  }
  if (point.accuracy != null && point.accuracy > 80_000) {
    return false;
  }
  return true;
}

export const haversineDistanceMeters = (a: GeoPoint, b: GeoPoint) => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const aValue = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  const c = 2 * Math.atan2(Math.sqrt(aValue), Math.sqrt(1 - aValue));

  return earthRadius * c;
};

export const formatDistance = (meters: number) =>
  meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;

// Lissage passe-bas du GPS : absorbe le jitter (3-15 m en ville) sans retarder
// visiblement le personnage. alpha proche de 1 = très réactif, proche de 0 = très lisse.
export const smoothPosition = (previous: GeoPoint | null, next: GeoPoint, alpha = 0.35): GeoPoint => {
  if (!previous) {
    return next;
  }
  return {
    latitude: previous.latitude + alpha * (next.latitude - previous.latitude),
    longitude: previous.longitude + alpha * (next.longitude - previous.longitude),
  };
};

// Cap (en degrés) entre deux positions — utilisé pour orienter le personnage.
export const bearingDegrees = (from: GeoPoint, to: GeoPoint) => {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const toDeg = (v: number) => (v * 180) / Math.PI;
  const dLng = toRad(to.longitude - from.longitude);
  const y = Math.sin(dLng) * Math.cos(toRad(to.latitude));
  const x =
    Math.cos(toRad(from.latitude)) * Math.sin(toRad(to.latitude)) -
    Math.sin(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
};
