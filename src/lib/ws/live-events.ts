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

export function getWsUrl(): string {
  const wsBase = API_BASE_URL.replace(/^http/, 'ws');
  return `${wsBase}/ws`;
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

export type LiveEventsConnection = {
  close: () => void;
  updateLocation: (latitude: number, longitude: number) => void;
};

type WebSocketWithHeaders = new (
  url: string,
  protocols?: string | string[],
  options?: { headers?: Record<string, string> }
) => WebSocket;

export function connectLiveEvents(
  token: string,
  onEvent: (event: LiveEvent) => void,
  onClose?: () => void
): LiveEventsConnection {
  const ws = new (WebSocket as unknown as WebSocketWithHeaders)(getWsUrl(), undefined, {
    headers: { Cookie: `session=${token}` },
  });

  let closed = false;

  ws.onopen = () => {
    ws.send(
      JSON.stringify({
        action: 'subscribe',
        topics: ['hunts', 'profiles', 'hunt_steps', 'notifications'],
      })
    );
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

  ws.onmessage = (message) => {
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
