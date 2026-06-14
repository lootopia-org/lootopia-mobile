import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  connectLiveEvents,
  isHuntEvent,
  isHuntPausedNotification,
  type HuntPausedNotification,
  type LiveEvent,
} from '@/src/lib/ws/live-events';
import { useLiveLocationSync } from '@/src/hooks/use-live-location-sync';
import { useAuth } from '@/src/state/AuthContext';

type HuntEventListener = (event: LiveEvent) => void;
type LiveEventListener = (event: LiveEvent) => void;

type LiveEventsContextValue = {
  lastHuntEvent: LiveEvent | null;
  lastHuntPausedNotification: HuntPausedNotification | null;
  subscribeHuntEvents: (listener: HuntEventListener) => () => void;
  subscribeLiveEvents: (listener: LiveEventListener) => () => void;
  clearHuntPausedNotification: () => void;
  requestLocationSend: () => void;
};

const LiveEventsContext = createContext<LiveEventsContextValue | null>(null);

export function LiveEventsProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation('hunts');
  const { token, isAuthenticated } = useAuth();
  const [lastHuntEvent, setLastHuntEvent] = useState<LiveEvent | null>(null);
  const [lastHuntPausedNotification, setLastHuntPausedNotification] =
    useState<HuntPausedNotification | null>(null);
  const listenersRef = useRef<Set<HuntEventListener>>(new Set());
  const allListenersRef = useRef<Set<LiveEventListener>>(new Set());
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionRef = useRef<{ close: () => void; updateLocation: (latitude: number, longitude: number) => void } | null>(null);
  const sendLocationRef = useRef<((latitude: number, longitude: number) => void) | null>(null);
  const forceSendRef = useRef<(() => void) | null>(null);

  useLiveLocationSync(sendLocationRef, isAuthenticated && !!token, forceSendRef);

  const requestLocationSend = useCallback(() => {
    forceSendRef.current?.();
  }, []);

  const subscribeHuntEvents = useCallback((listener: HuntEventListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const subscribeLiveEvents = useCallback((listener: LiveEventListener) => {
    allListenersRef.current.add(listener);
    return () => {
      allListenersRef.current.delete(listener);
    };
  }, []);

  const clearHuntPausedNotification = useCallback(() => {
    setLastHuntPausedNotification(null);
  }, []);

  const handleEvent = useCallback(
    (event: LiveEvent) => {
      allListenersRef.current.forEach((listener) => listener(event));

      const isRelevant =
        isHuntEvent(event) || event.eventType === 'hunt_steps.live_ops_updated';

      if (isRelevant) {
        if (isHuntEvent(event)) {
          setLastHuntEvent(event);
        }
        listenersRef.current.forEach((listener) => listener(event));
      }

      if (isHuntPausedNotification(event)) {
        setLastHuntPausedNotification(event.payload);
        Alert.alert(t('liveEvents.huntSuspendedTitle'), event.payload.message);
      }
    },
    [t]
  );

  useEffect(() => {
    if (!isAuthenticated || !token) {
      connectionRef.current?.close();
      connectionRef.current = null;
      sendLocationRef.current = null;
      return;
    }

    let cancelled = false;

    const connect = () => {
      if (cancelled) {
        return;
      }
      connectionRef.current?.close();
      connectionRef.current = connectLiveEvents(
        token,
        handleEvent,
        () => {
          connectionRef.current = null;
          sendLocationRef.current = null;
          if (!cancelled) {
            reconnectTimerRef.current = setTimeout(connect, 5000);
          }
        },
        () => {
          if (connectionRef.current) {
            sendLocationRef.current = connectionRef.current.updateLocation;
          }
          forceSendRef.current?.();
        }
      );
      sendLocationRef.current = connectionRef.current.updateLocation;
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      connectionRef.current?.close();
      connectionRef.current = null;
      sendLocationRef.current = null;
    };
  }, [isAuthenticated, token, handleEvent]);

  const value = useMemo<LiveEventsContextValue>(
    () => ({
      lastHuntEvent,
      lastHuntPausedNotification,
      subscribeHuntEvents,
      subscribeLiveEvents,
      clearHuntPausedNotification,
      requestLocationSend,
    }),
    [lastHuntEvent, lastHuntPausedNotification, subscribeHuntEvents, subscribeLiveEvents, clearHuntPausedNotification, requestLocationSend]
  );

  return <LiveEventsContext.Provider value={value}>{children}</LiveEventsContext.Provider>;
}

export function useLiveEventsContext() {
  const context = useContext(LiveEventsContext);
  if (!context) {
    throw new Error('useLiveEventsContext must be used within LiveEventsProvider');
  }
  return context;
}
