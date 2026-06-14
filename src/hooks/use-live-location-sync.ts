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
  enabled: boolean,
  forceSendRef?: MutableRefObject<(() => void) | null>
) {
  const lastSentAt = useRef(0);
  const lastSentPosition = useRef<GeoPoint | null>(null);
  const lastKnownPosition = useRef<GeoPoint | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    const maybeSend = (point: GeoPoint, force = false) => {
      lastKnownPosition.current = point;

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

    const forceSend = () => {
      if (lastKnownPosition.current) {
        maybeSend(lastKnownPosition.current, true);
        return;
      }

      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        .then((update) => {
          if (cancelled) {
            return;
          }
          maybeSend(
            {
              latitude: update.coords.latitude,
              longitude: update.coords.longitude,
            },
            true
          );
        })
        .catch(() => undefined);
    };

    if (forceSendRef) {
      forceSendRef.current = forceSend;
    }

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
      if (forceSendRef) {
        forceSendRef.current = null;
      }
    };
  }, [enabled, sendLocationRef, forceSendRef]);

  // When the WebSocket sender becomes available, push the last known position.
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const pushLastKnown = () => {
      const point = lastKnownPosition.current;
      const send = sendLocationRef.current;
      if (!point || !send) {
        return;
      }
      send(point.latitude, point.longitude);
      lastSentAt.current = Date.now();
      lastSentPosition.current = point;
    };

    const interval = setInterval(() => {
      if (sendLocationRef.current && lastKnownPosition.current) {
        pushLastKnown();
      }
    }, 500);

    return () => clearInterval(interval);
  }, [enabled, sendLocationRef]);
}
