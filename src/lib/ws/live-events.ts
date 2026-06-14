const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

export type LiveEvent = {
  id: string;
  eventType: string;
  topic: string;
  resourceId?: string;
  payload: unknown;
  timestamp: string;
};

export type HuntPausedNotification = {
  userId: string;
  huntId: string;
  huntTitle: string;
  message: string;
};

export function getWsUrl(token: string): string {
  const wsBase = API_BASE_URL.replace(/^http/, 'ws');
  return `${wsBase}/ws?token=${encodeURIComponent(token)}`;
}

export function isLiveEvent(data: unknown): data is LiveEvent {
  return (
    typeof data === 'object' &&
    data !== null &&
    'topic' in data &&
    typeof (data as LiveEvent).topic === 'string' &&
    (data as LiveEvent).topic.length > 0 &&
    'eventType' in data
  );
}

export function isHuntPausedNotification(data: unknown): data is LiveEvent & {
  payload: HuntPausedNotification;
} {
  if (!isLiveEvent(data)) {
    return false;
  }
  const payload = data.payload as HuntPausedNotification | undefined;
  return (
    data.eventType === 'notifications.hunt_paused' &&
    typeof payload?.huntId === 'string' &&
    typeof payload?.message === 'string'
  );
}

export function isHuntEvent(data: LiveEvent): boolean {
  return data.topic === 'hunts' || data.eventType.startsWith('hunts.');
}

export function isProfileUpdatedEvent(data: LiveEvent): boolean {
  return data.topic === 'profiles' && data.eventType === 'profiles.updated';
}

export type LiveEventsConnection = {
  close: () => void;
  updateLocation: (latitude: number, longitude: number) => void;
};

export function connectLiveEvents(
  token: string,
  onEvent: (event: LiveEvent) => void,
  onClose?: () => void,
  onOpen?: () => void
): LiveEventsConnection {
  const ws = new WebSocket(getWsUrl(token));

  let closed = false;

  ws.onopen = () => {
    ws.send(
      JSON.stringify({
        action: 'subscribe',
        topics: ['hunts', 'profiles', 'hunt_steps', 'notifications'],
      })
    );
    onOpen?.();
  };

  const updateLocation = (latitude: number, longitude: number) => {
    if (ws.readyState !== WebSocket.OPEN) {
      return;
    }
    ws.send(
      JSON.stringify({
        action: 'updateLocation',
        latitude: latitude.toFixed(6),
        longitude: longitude.toFixed(6),
      })
    );
  };

  ws.onmessage = (message: MessageEvent) => {
    try {
      const data = JSON.parse(String(message.data)) as unknown;
      if (isLiveEvent(data)) {
        onEvent(data);
      }
    } catch {
      // ignore malformed messages
    }
  };

  ws.onclose = () => {
    clearInterval(pingInterval);
    if (!closed) {
      onClose?.();
    }
  };

  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: 'ping' }));
    }
  }, 30_000);

  return {
    close: () => {
      closed = true;
      clearInterval(pingInterval);
      ws.close();
    },
    updateLocation,
  };
}
