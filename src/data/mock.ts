import type { Chase } from '@/src/lib/chase-api';

// Données mock alignées sur le frontend web (lootopia-frontend/src/lib/mock-chases.ts) :
// mêmes chasses, mêmes étapes, mêmes stats / classement. `radiusMeters` et `arHint`
// sont des champs propres au mobile (proximité GPS + indice AR) ajoutés par-dessus la
// forme partagée `Chase`.

const createDate = (daysAgo: number) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
};

const goldenGate = {
  id: 'partner-1',
  name: 'Golden Gate Adventures',
  email: 'hello@goldengateadventures.local',
  description: 'Mock partner for demo treasure hunts.',
  logo: '',
  chases: [],
};

const baseSteps = [
  {
    id: 'step-1',
    order: 1,
    title: 'Old Harbor Puzzle',
    description: 'Find the marker near the harbor entrance.',
    clue: 'Look for the bronze compass facing the water.',
    location: { latitude: 37.808, longitude: -122.417 },
    reward: 50,
    completed: false,
    radiusMeters: 120,
    qrPayload: 'lootopia:step-1',
    arHint: 'Reste près de l’entrée du port pour valider cette étape.',
  },
  {
    id: 'step-2',
    order: 2,
    title: 'Market Square Cipher',
    description: 'Decode the mural in the center of the square.',
    clue: 'The answer is hidden where the colors meet.',
    location: { latitude: 37.803, longitude: -122.414 },
    arContent: {
      id: 'ar-1',
      type: 'model' as const,
      data: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
      scale: 1,
    },
    reward: 75,
    completed: false,
    radiusMeters: 120,
    qrPayload: 'lootopia:step-2',
    arHint: 'Approche-toi de la fresque au centre de la place pour révéler l’indice.',
  },
  {
    id: 'step-3',
    order: 3,
    title: 'Hidden Vault Finale',
    description: 'Unlock the vault with the final code.',
    clue: 'Combine the harbor and mural clues to reveal the code.',
    location: { latitude: 37.797, longitude: -122.409 },
    reward: 125,
    completed: false,
    radiusMeters: 120,
    qrPayload: 'lootopia:step-3',
    arHint: 'Dernière validation à proximité du coffre final.',
  },
];

export const chases: Chase[] = [
  {
    id: 'mock-chase-golden-bay',
    title: 'Golden Bay Treasure Run',
    description: 'A beginner-friendly urban treasure hunt through San Francisco landmarks.',
    image: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?auto=format&fit=crop&w=1200&q=80',
    difficulty: 'easy',
    estimatedDuration: 45,
    location: { latitude: 37.8044, longitude: -122.2712 },
    createdAt: createDate(12),
    updatedAt: createDate(2),
    status: 'active',
    participants: 128,
    rating: 4.8,
    partner: goldenGate,
    steps: JSON.parse(JSON.stringify(baseSteps)),
  },
  {
    id: 'mock-chase-midnight-museum',
    title: 'Midnight Museum Mystery',
    description: 'A harder chase inside the city museum district with augmented reality clues.',
    image: 'https://images.unsplash.com/photo-1554907984-15263bfd63bd?auto=format&fit=crop&w=1200&q=80',
    difficulty: 'hard',
    estimatedDuration: 90,
    location: { latitude: 37.7858, longitude: -122.401 },
    createdAt: createDate(20),
    updatedAt: createDate(4),
    status: 'active',
    participants: 76,
    rating: 4.9,
    partner: {
      id: 'partner-2',
      name: 'Museum Quest Co.',
      email: 'contact@museumquest.local',
      description: '',
      logo: '',
      chases: [],
    },
    steps: JSON.parse(JSON.stringify(baseSteps)).map((step: Chase['steps'][number], index: number) => ({
      ...step,
      id: `museum-step-${index + 1}`,
      title: `${step.title} ${index + 1}`,
      completed: false,
    })),
  },
];

// Statistiques de gamification (mock), identiques au frontend (mock-player).
export const playerStats = {
  points: 1240,
  level: 8,
  completedChases: 14,
  progressPercentage: 37,
};

export type LeaderboardEntry = {
  rank: number;
  name: string;
  points: number;
  chasesCompleted: number;
};

// Classement global, identique au frontend (mock-gamification leaderboard).
export const leaderboard: LeaderboardEntry[] = [
  { rank: 1, name: 'Lootopia Admin', points: 9800, chasesCompleted: 128 },
  { rank: 2, name: 'Treasure Player', points: 1240, chasesCompleted: 14 },
  { rank: 3, name: 'Urban Explorer', points: 980, chasesCompleted: 11 },
  { rank: 4, name: 'Quest Runner', points: 860, chasesCompleted: 9 },
];
