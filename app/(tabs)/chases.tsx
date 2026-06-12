import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chaseApi, type Chase } from '@/src/lib/chase-api';
import { buildSeedHunt } from '@/src/lib/hunt-seed';
import { useHunts } from '@/src/state/HuntsContext';
import { colors, radii } from '@/src/theme';
import { formatDistance, haversineDistanceMeters, type GeoPoint } from '@/src/lib/geo';

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Facile',
  medium: 'Moyenne',
  hard: 'Difficile',
};

export default function ChasesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAccepted, acceptHunt } = useHunts();
  const [chases, setChases] = useState<Chase[]>([]);
  const [position, setPosition] = useState<GeoPoint | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        setError(null);
        let loaded = await chaseApi.getChases();
        // Catalogue serveur vide → génération automatique d'une chasse de
        // bienvenue autour du joueur (POST /hunt ; ignoré en 403 pour les
        // joueurs simples — seuls partner/admin peuvent créer).
        if (loaded.length === 0) {
          try {
            const permission = await Location.getForegroundPermissionsAsync();
            const center = permission.granted
              ? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then(
                  (current) => ({ latitude: current.coords.latitude, longitude: current.coords.longitude })
                )
              : { latitude: 37.8044, longitude: -122.2712 };
            await chaseApi.createChase(buildSeedHunt(center));
            loaded = await chaseApi.getChases();
          } catch {
            // 403 (rôle joueur) ou serveur indisponible : on laisse la liste vide.
          }
        }
        setChases(loaded);
      } catch {
        setError('Impossible de charger les chasses.');
      } finally {
        setIsLoading(false);
      }
    })();

    // Position one-shot pour trier/afficher les distances (le suivi continu
    // est réservé à l'écran carte pour économiser la batterie).
    (async () => {
      const permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted) {
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setPosition({ latitude: current.coords.latitude, longitude: current.coords.longitude });
    })();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  const sorted = position
    ? [...chases].sort(
        (a, b) =>
          haversineDistanceMeters(position, a.location) - haversineDistanceMeters(position, b.location)
      )
    : chases;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <Text style={styles.header}>🗺️ Chasses disponibles</Text>
      <Text style={styles.subheader}>
        {position ? 'Triées de la plus proche à la plus lointaine' : 'Autour de toi et dans la région'}
      </Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24, gap: 14 }}
        renderItem={({ item }) => {
          const accepted = isAccepted(item.id);
          const distance = position ? haversineDistanceMeters(position, item.location) : null;
          return (
            <Pressable onPress={() => router.push(`/chases/${item.id}`)} style={styles.cardWrap}>
              <ImageBackground
                source={{ uri: item.image || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80' }}
                style={styles.cardImage}
                imageStyle={styles.cardImageStyle}
              >
                <View style={styles.overlay}>
                  <View style={styles.badgeRow}>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{DIFFICULTY_LABELS[item.difficulty] ?? item.difficulty}</Text>
                    </View>
                    {distance !== null && (
                      <View style={[styles.badge, styles.badgeTeal]}>
                        <Text style={[styles.badgeText, { color: colors.teal }]}>📍 {formatDistance(distance)}</Text>
                      </View>
                    )}
                    {accepted && (
                      <View style={[styles.badge, styles.badgeGold]}>
                        <Text style={[styles.badgeText, { color: colors.gold }]}>En cours ✓</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardSubtitle} numberOfLines={2}>{item.description}</Text>
                  <View style={styles.bottomRow}>
                    <Text style={styles.meta}>
                      {item.steps.length} étapes · {item.estimatedDuration} min · ⭐ {item.rating}
                    </Text>
                    {!accepted && (
                      <Pressable
                        style={styles.acceptButton}
                        onPress={(event) => {
                          event.stopPropagation();
                          acceptHunt(item.id);
                        }}
                      >
                        <Text style={styles.acceptText}>Accepter</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </ImageBackground>
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>Aucune chasse disponible.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 16 },
  header: { fontSize: 26, fontWeight: '900', color: colors.foreground },
  subheader: { color: colors.textMuted, fontSize: 13, marginTop: 4, marginBottom: 16 },
  cardWrap: { borderRadius: radii.lg, overflow: 'hidden', borderColor: colors.glassBorder, borderWidth: 1 },
  cardImage: { height: 200, justifyContent: 'flex-end' },
  cardImageStyle: { borderRadius: radii.lg },
  overlay: { backgroundColor: 'rgba(11,15,26,0.55)', padding: 16 },
  badgeRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  badge: { backgroundColor: 'rgba(11,15,26,0.75)', borderColor: colors.glassBorderStrong, borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: 9, paddingVertical: 3 },
  badgeTeal: { borderColor: colors.teal },
  badgeGold: { borderColor: colors.gold },
  badgeText: { color: colors.foreground, fontSize: 10, fontWeight: '800' },
  cardTitle: { color: colors.foreground, fontSize: 19, fontWeight: '900' },
  cardSubtitle: { color: 'rgba(248,250,252,0.75)', marginTop: 4, fontSize: 12, lineHeight: 17 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  meta: { color: colors.gold, fontWeight: '700', fontSize: 11 },
  acceptButton: { backgroundColor: colors.gold, borderRadius: radii.pill, paddingHorizontal: 14, paddingVertical: 6 },
  acceptText: { color: colors.background, fontWeight: '900', fontSize: 12 },
  error: { color: colors.danger, marginBottom: 12, fontWeight: '700' },
  empty: { textAlign: 'center', marginTop: 24, color: colors.textMuted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
