export type Step = {
  id: string;
  title: string;
  clue: string;
  location: {
    latitude: number;
    longitude: number;
  };
  radiusMeters: number;
  arHint: string;
};

export type Chase = {
  id: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  duration: number;
  points: number;
  image: string;
  steps: Step[];
};

export const chases: Chase[] = [
  {
    id: '1',
    title: 'Le Trésor du Vieux Port',
    description: 'Une chasse urbaine simple pour démarrer sur mobile.',
    difficulty: 'easy',
    duration: 30,
    points: 150,
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    steps: [
      {
        id: 's1',
        title: 'Départ',
        clue: 'Regarde près du point de départ.',
        location: { latitude: 43.2968, longitude: 5.3696 },
        radiusMeters: 120,
        arHint: 'Reste près du point de départ pour valider cette étape.',
      },
      {
        id: 's2',
        title: 'Indice 2',
        clue: 'Le prochain indice est lié à l’eau.',
        location: { latitude: 43.2978, longitude: 5.3715 },
        radiusMeters: 120,
        arHint: 'Approche-toi du bord de l’eau pour débloquer l’indice.',
      },
      {
        id: 's3',
        title: 'Arrivée',
        clue: 'Trouve la zone finale et valide la chasse.',
        location: { latitude: 43.2992, longitude: 5.3731 },
        radiusMeters: 120,
        arHint: 'Dernière validation à proximité du point final.',
      },
    ],
  },
  {
    id: '2',
    title: 'Mission Panorama',
    description: 'Carte, étapes et récompenses dans une chasse un peu plus longue.',
    difficulty: 'medium',
    duration: 45,
    points: 240,
    image: 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1200&q=80',
    steps: [
      {
        id: 's4',
        title: 'Point A',
        clue: 'Va vers le lieu le plus visible.',
        location: { latitude: 43.2959, longitude: 5.3682 },
        radiusMeters: 100,
        arHint: 'Valide quand tu es au bon endroit, près du point le plus visible.',
      },
      {
        id: 's5',
        title: 'Point B',
        clue: 'Cherche un endroit calme.',
        location: { latitude: 43.2948, longitude: 5.3706 },
        radiusMeters: 100,
        arHint: 'Valide au calme, au bon endroit.',
      },
      {
        id: 's6',
        title: 'Point C',
        clue: 'Dernière étape avant le gain final.',
        location: { latitude: 43.2939, longitude: 5.3721 },
        radiusMeters: 100,
        arHint: 'Dernière validation à proximité du point final.',
      },
    ],
  },
];

export const progressByUser: Record<string, { currentStep: number; totalSteps: number; points: number }> = {
  'player-1': { currentStep: 2, totalSteps: 3, points: 120 },
};