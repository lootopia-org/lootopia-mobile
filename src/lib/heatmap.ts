import AsyncStorage from '@react-native-async-storage/async-storage';
import { haversineDistanceMeters, type GeoPoint } from '@/src/lib/geo';

/**
 * Heatmap joueur : le client enregistre des "miettes" de position pendant le
 * jeu (échantillonnées : min 20 m OU 30 s entre deux points, plafond FIFO),
 * et le mode Terrain les agrège en cellules pondérées pour affichage.
 * Prototype local ; en production, agrégat anonymisé côté backend.
 */

const STORAGE_KEY = 'lootopia-mobile-heatmap';
const MIN_DISTANCE_METERS = 20;
const MIN_INTERVAL_MS = 30000;
const MAX_POINTS = 600;
// ~55 m de côté à ces latitudes : assez fin pour un parcours urbain.
const GRID_PRECISION = 2000;

type Breadcrumb = GeoPoint & { t: number };

let cache: Breadcrumb[] | null = null;
let lastRecorded: Breadcrumb | null = null;

async function load(): Promise<Breadcrumb[]> {
  if (cache) {
    return cache;
  }
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    cache = stored ? (JSON.parse(stored) as Breadcrumb[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

export async function recordBreadcrumb(point: GeoPoint): Promise<void> {
  const now = Date.now();
  if (lastRecorded) {
    const tooClose = haversineDistanceMeters(lastRecorded, point) < MIN_DISTANCE_METERS;
    const tooSoon = now - lastRecorded.t < MIN_INTERVAL_MS;
    if (tooClose && tooSoon) {
      return;
    }
  }
  const crumbs = await load();
  crumbs.push({ ...point, t: now });
  if (crumbs.length > MAX_POINTS) {
    crumbs.splice(0, crumbs.length - MAX_POINTS);
  }
  lastRecorded = { ...point, t: now };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(crumbs));
}

export type HeatCell = GeoPoint & { weight: number };

export async function getHeatCells(): Promise<HeatCell[]> {
  const crumbs = await load();
  const buckets = new Map<string, HeatCell>();
  for (const crumb of crumbs) {
    const latKey = Math.round(crumb.latitude * GRID_PRECISION);
    const lngKey = Math.round(crumb.longitude * GRID_PRECISION);
    const key = `${latKey}:${lngKey}`;
    const cell = buckets.get(key);
    if (cell) {
      cell.weight += 1;
    } else {
      buckets.set(key, {
        latitude: latKey / GRID_PRECISION,
        longitude: lngKey / GRID_PRECISION,
        weight: 1,
      });
    }
  }
  return [...buckets.values()];
}

export async function clearHeatmap(): Promise<void> {
  cache = [];
  lastRecorded = null;
  await AsyncStorage.removeItem(STORAGE_KEY);
}
