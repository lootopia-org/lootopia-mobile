# Lootopia Mobile

Expo React Native app focused only on the player flow:

- Chasses
- Détail d'une chasse
- Progression / étapes
- Compte joueur
- Auth / déconnexion
- Accueil joueur mobile
- Carte de chasse
- AR mobile via caméra

## Start

```bash
cd mobile
npm install
npm run start
```

The app uses `react-native-maps`, `expo-camera`, `expo-location`, and `expo-linear-gradient`.
After installing dependencies, run the Expo dev server and open it in Android or iOS.

## Routes

- `/(auth)/login`
- `/(auth)/register`
- `/(tabs)/chases`
- `/(tabs)/index`
- `/(tabs)/progress`
- `/(tabs)/account`
- `/chases/[id]`
- `/ar/[id]`