// Télémétrie de performance légère (sans dépendance) : les boucles de rendu
// déclarent leurs frames, l'overlay dev lit les FPS calculés par fenêtre d'1 s.
// À remplacer par Sentry/Firebase Performance quand l'app aura un dev build.

type Counter = { frames: number; windowStart: number; fps: number };

const counters: Record<string, Counter> = {};

export function recordFrame(name: string) {
  const now = Date.now();
  const counter = (counters[name] ??= { frames: 0, windowStart: now, fps: 0 });
  counter.frames += 1;
  const elapsed = now - counter.windowStart;
  if (elapsed >= 1000) {
    counter.fps = Math.round((counter.frames * 1000) / elapsed);
    counter.frames = 0;
    counter.windowStart = now;
  }
}

export function getFps(name: string): number {
  return counters[name]?.fps ?? 0;
}
