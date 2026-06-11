// Utilitaires géo partagés (extraits d'ARExperience pour réutilisation carte/listes).

export type GeoPoint = { latitude: number; longitude: number };

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
