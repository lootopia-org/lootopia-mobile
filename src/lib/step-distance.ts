import * as Location from 'expo-location';
import {
  haversineDistanceMeters,
  isReliableDeviceLocation,
  isValidGeoPoint,
  type GeoPoint,
} from '@/src/lib/geo';

export type StepDistanceCheck =
  | { ok: true; distanceMeters: number }
  | {
      ok: false;
      reason: 'invalid_location' | 'location_denied' | 'location_unavailable' | 'too_far';
      distanceMeters?: number;
    };

export async function checkDistanceToStep(
  stepLocation: GeoPoint,
  radiusMeters: number
): Promise<StepDistanceCheck> {
  if (!isValidGeoPoint(stepLocation)) {
    return { ok: false, reason: 'invalid_location' };
  }

  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    return { ok: false, reason: 'location_denied' };
  }

  try {
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    if (!isReliableDeviceLocation(position.coords)) {
      return { ok: false, reason: 'location_unavailable' };
    }

    const distanceMeters = haversineDistanceMeters(
      { latitude: position.coords.latitude, longitude: position.coords.longitude },
      stepLocation
    );

    if (distanceMeters > radiusMeters) {
      return { ok: false, reason: 'too_far', distanceMeters };
    }

    return { ok: true, distanceMeters };
  } catch {
    return { ok: false, reason: 'location_unavailable' };
  }
}
