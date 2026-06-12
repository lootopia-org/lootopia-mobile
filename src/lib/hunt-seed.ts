import type { Chase, ChaseStep } from '@/src/lib/chase-api';
import type { GeoPoint } from '@/src/lib/geo';

/**
 * Génération automatique d'une chasse de départ côté backend (POST /hunt)
 * quand le catalogue est vide : 3 étapes checkpoint disposées autour de la
 * position du joueur (~250-450 m), pour que la carte ne soit jamais déserte.
 *
 * Volontairement déclenché UNIQUEMENT sur catalogue vide (pas à chaque visite :
 * cela créerait une chasse par page vue). Nécessite un rôle admin/partner —
 * pour un joueur, le POST renvoie 403 et l'appelant ignore l'échec.
 */

// ~0.003° ≈ 330 m en latitude ; ajusté grossièrement pour la longitude.
const offsets = [
  { dLat: 0.0025, dLng: 0.001 },
  { dLat: -0.001, dLng: 0.0032 },
  { dLat: -0.0028, dLng: -0.0018 },
];

const STEP_BLUEPRINTS = [
  {
    title: 'Le point de départ',
    description: 'Rejoins le premier repère de la chasse découverte.',
    clue: 'Tout commence près de toi — suis la boussole.',
    reward: 50,
  },
  {
    title: 'La piste se précise',
    description: 'Deuxième repère : ouvre l’œil sur les détails du lieu.',
    clue: 'Cherche ce que les passants ne regardent jamais.',
    reward: 75,
  },
  {
    title: 'Le trésor découverte',
    description: 'Dernier repère : le coffre de bienvenue t’attend.',
    clue: 'Au bout de l’effort, l’or de Lootopia.',
    reward: 125,
  },
];

export function buildSeedHunt(center: GeoPoint): Partial<Chase> {
  const steps: ChaseStep[] = STEP_BLUEPRINTS.map((blueprint, index) => ({
    id: `seed-step-${index + 1}`,
    order: index + 1,
    title: blueprint.title,
    description: blueprint.description,
    clue: blueprint.clue,
    location: {
      latitude: center.latitude + offsets[index].dLat,
      longitude: center.longitude + offsets[index].dLng,
    },
    reward: blueprint.reward,
    completed: false,
    radiusMeters: 30,
    qrPayload: `lootopia:seed-step-${index + 1}`,
  }));

  return {
    title: 'Chasse découverte',
    description: 'Une première chasse générée automatiquement autour de toi pour découvrir Lootopia.',
    image: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?auto=format&fit=crop&w=1200&q=80',
    difficulty: 'easy',
    estimatedDuration: 30,
    status: 'active',
    location: center,
    steps,
  };
}
