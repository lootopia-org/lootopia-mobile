import { useEffect, useRef, type MutableRefObject } from 'react';
import * as Location from 'expo-location';
import { haversineDistanceMeters, type GeoPoint } from '@/src/lib/geo';

type LocationSender = (latitude: number, longitude: number) => void;

const MIN_SEND_INTERVAL_MS = 4_000;
const MIN_MOVE_METERS = 5;

/**
 * Streams GPS updates to the live WebSocket while the user is authenticated.
 * Matches the backend `updateLocation` control message on `/ws`.
 */
export function useLiveLocationSync(
  sendLocationRef: MutableRefObject<LocationSender | null>,
  enabled: boolean
) {
  const lastSentAt = useRef(0);
  const lastSentPosition = useRef<GeoPoint | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    const maybeSend = (point: GeoPoint, force = false) => {
      const send = sendLocationRef.current;
      if (!send) {
        return;
      }

      const now = Date.now();
      const moved =
        lastSentPosition.current == null
          ? Infinity
          : haversineDistanceMeters(lastSentPosition.current, point);

      if (!force && now - lastSentAt.current < MIN_SEND_INTERVAL_MS && moved < MIN_MOVE_METERS) {
        return;
      }

      send(point.latitude, point.longitude);
      lastSentAt.current = now;
      lastSentPosition.current = point;
    };

    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (cancelled || !permission.granted) {
        return;
      }

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 5,
          timeInterval: 4_000,
        },
        (update) => {
          maybeSend({
            latitude: update.coords.latitude,
            longitude: update.coords.longitude,
          });
        }
      );

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }).catch(() => null);

      if (!cancelled && current) {
        maybeSend(
          {
            latitude: current.coords.latitude,
            longitude: current.coords.longitude,
          },
          true
        );
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
      subscription = null;
      lastSentAt.current = 0;
      lastSentPosition.current = null;
    };
  }, [enabled, sendLocationRef]);
}
