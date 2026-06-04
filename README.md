# Lootopia Mobile

Application Expo React Native centrée sur le parcours joueur :

- Chasses
- Détail d'une chasse
- Progression / étapes
- Compte joueur
- Auth / déconnexion
- Accueil joueur mobile
- Carte de chasse
- AR mobile via caméra

## Stack

- **Expo SDK 54** · React Native 0.81.x · React 19.1.0
- **expo-router** (routing par fichiers)
- Libs natives : `react-native-maps`, `expo-camera`, `expo-location`, `expo-secure-store`, `expo-linear-gradient`

> Toutes ces libs natives sont incluses dans **Expo Go** pour le SDK 54 — aucun build custom n'est nécessaire pour tester.

## Installation

```bash
cd lootopia-mobile
npm install
```

> Les versions des paquets sont alignées sur celles attendues par Expo SDK 54.
> Pour vérifier ou corriger un éventuel décalage : `npx expo install --check` (puis `--fix`).

## Lancer le serveur de dev

```bash
npm run start        # = expo start
```

Scripts disponibles :

| Script | Action |
| --- | --- |
| `npm run start` | Démarre Metro (mode LAN) |
| `npm run android` | Démarre + ouvre l'émulateur Android |
| `npm run ios` | Démarre + ouvre le simulateur iOS (macOS) |
| `npm run web` | Démarre la version web |

## Tester sur un téléphone physique

1. Installe **Expo Go** (App Store / Play Store).
2. Lance `npm run start`.
3. Scanne le QR code :
   - **iOS** : app Caméra → ouvre la notification
   - **Android** : depuis Expo Go → "Scan QR code"

⚠️ Le téléphone et l'ordinateur doivent être sur le **même réseau Wi-Fi**.

### Si le LAN ne fonctionne pas (Wi-Fi d'entreprise, VPN, appareils isolés)

Option A — partage de connexion : connecte ton Mac au partage de connexion du téléphone, puis `npm run start`.

Option B — tunnel (passe par ngrok, contourne le réseau local) :

```bash
npx expo start --tunnel
```

Le tunnel requiert `@expo/ngrok`. L'install **globale** échoue sur les machines où `/usr/local` est verrouillé (EACCES) — il est donc installé **en dépendance de dev locale** du projet (`@expo/ngrok` dans `devDependencies`), ce qui évite tout `sudo`. Si le tunnel expire (`ngrok tunnel took too long to connect`), c'est généralement un pare-feu qui bloque ngrok : privilégie le mode LAN ou le partage de connexion.

## Tests

```bash
npm test             # jest (jest-expo + @testing-library/react-native v13)
npm run test:watch
```

## Routes

- `/(auth)/login`
- `/(auth)/register`
- `/(tabs)/chases`
- `/(tabs)/index`
- `/(tabs)/progress`
- `/(tabs)/account`
- `/chases/[id]`
- `/ar/[id]`
