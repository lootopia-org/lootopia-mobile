// Thème Lootopia mobile — repris du frontend web (lootopia-frontend/src/app/globals.css).
// Dark glassmorphism : fond nuit, or, teal, surfaces "verre" translucides.

export const colors = {
  background: '#0b0f1a',
  foreground: '#f8fafc',
  gold: '#d4af37',
  goldSoft: 'rgba(212, 175, 55, 0.15)',
  teal: '#2dd4bf',
  tealSoft: 'rgba(45, 212, 191, 0.12)',
  glass: 'rgba(255, 255, 255, 0.06)',
  glassStrong: 'rgba(255, 255, 255, 0.10)',
  glassBorder: 'rgba(255, 255, 255, 0.10)',
  glassBorderStrong: 'rgba(255, 255, 255, 0.15)',
  textMuted: 'rgba(248, 250, 252, 0.55)',
  textFaint: 'rgba(248, 250, 252, 0.40)',
  danger: '#f87171',
  success: '#34d399',
} as const;

export const radii = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;

// Style "verre" réutilisable pour les cartes/panneaux.
export const glassCard = {
  backgroundColor: colors.glass,
  borderColor: colors.glassBorder,
  borderWidth: 1,
  borderRadius: radii.lg,
} as const;

export const glassStrongCard = {
  backgroundColor: colors.glassStrong,
  borderColor: colors.glassBorderStrong,
  borderWidth: 1,
  borderRadius: radii.lg,
} as const;

// Style sombre de la carte (appliqué par Google Maps via customMapStyle ;
// ignoré par Apple Maps qui garde son rendu natif).
export const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#0b0f1a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a93a6' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0b0f1a' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1c2333' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#6b7487' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#101725' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];
