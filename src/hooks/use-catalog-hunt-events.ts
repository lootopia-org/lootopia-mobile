import { useEffect } from 'react';
import { isHuntEvent } from '@/src/lib/ws/live-events';
import { useLiveEventsContext } from '@/src/state/LiveEventsContext';

/** Refetch the available-hunts catalog when hunts are created, updated, or deleted. */
export function useCatalogHuntEvents(onRefresh: () => void) {
  const { subscribeLiveEvents } = useLiveEventsContext();

  useEffect(() => {
    return subscribeLiveEvents((event) => {
      if (isHuntEvent(event)) {
        onRefresh();
      }
    });
  }, [subscribeLiveEvents, onRefresh]);
}
