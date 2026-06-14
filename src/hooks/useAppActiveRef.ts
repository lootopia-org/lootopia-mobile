import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/**
 * Ref booléenne indiquant si l'app est au premier plan.
 * Lue dans les boucles de rendu GL (sans re-render React) pour suspendre
 * tout travail GPU quand l'app passe en arrière-plan — gros poste batterie.
 */
export function useAppActiveRef() {
  const activeRef = useRef(AppState.currentState === 'active');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      activeRef.current = state === 'active';
    });
    return () => subscription.remove();
  }, []);

  return activeRef;
}

/**
 * Limiteur de cadence pour boucle requestAnimationFrame : renvoie true si la
 * frame doit être rendue. 30 fps suffisent pour un personnage sur carte et
 * divisent par deux le travail GPU sur les Android d'entrée de gamme.
 */
export function createFrameLimiter(targetFps = 30) {
  const minInterval = 1000 / targetFps;
  let lastRender = 0;
  return () => {
    const now = Date.now();
    if (now - lastRender < minInterval) {
      return false;
    }
    lastRender = now;
    return true;
  };
}
