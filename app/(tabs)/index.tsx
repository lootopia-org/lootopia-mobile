import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chaseApi, type Chase } from '@/src/lib/chase-api';
import { useHunts } from '@/src/state/HuntsContext';
import { useDemo } from '@/src/state/DemoContext';
import { PlayerCharacter3D } from '@/src/components/PlayerCharacter3D';
import { colors, darkMapStyle, glassStrongCard, radii } from '@/src/theme';
import { bearingDegrees, formatDistance, haversineDistanceMeters, smoothPosition, type GeoPoint } from '@/src/lib/geo';
import { playerStats } from '@/src/data/mock';

// Position de repli (zone des chasses mock à San Francisco) quand le GPS est
// indisponible — notamment en mode démo sur simulateur.
const FALLBACK_POSITION: GeoPoint = { latitude: 37.8044, longitude: -122.2712 };
const WALK_THRESHOLD_METERS = 1.5;

export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { demoMode } = useDemo();
  const { avatarModel, acceptedHunts, acceptHunt, isAccepted } = useHunts();

  const mapRef = useRef<MapView>(null);
  const [hunts, setHunts] = useState<Chase[]>([]);
  const [position, setPosition] = useState<GeoPoint | null>(null);
  const [walking, setWalking] = useState(false);
  const [heading, setHeading] = useState<number | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [selectedHunt, setSelectedHunt] = useState<Chase | null>(null);
  const [proximityAlert, setProximityAlert] = useState<string | null>(null);
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const lastPosition = useRef<GeoPoint | null>(null);
  const walkingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notifiedHuntIds = useRef<Set<string>>(new Set());
  const proximityTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chargement des chasses (API → fallback mock géré par chase-api).
  useEffect(() => {
    chaseApi.getChases().then(setHunts).catch(() => setHunts([]));
  }, []);

  // Suivi GPS continu avec lissage. La caméra suit le joueur : le personnage
  // reste au centre de l'écran et la carte défile sous lui (pattern Pokémon GO).
  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setPermissionDenied(true);
        if (demoMode) {
          setPosition(FALLBACK_POSITION);
        }
        return;
      }

      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 2, timeInterval: 1500 },
        (update) => {
          const raw: GeoPoint = {
            latitude: update.coords.latitude,
            longitude: update.coords.longitude,
          };
          const smoothed = smoothPosition(lastPosition.current, raw);

          if (lastPosition.current) {
            const moved = haversineDistanceMeters(lastPosition.current, smoothed);
            if (moved > WALK_THRESHOLD_METERS) {
              setWalking(true);
              setHeading(
                update.coords.heading != null && update.coords.heading >= 0
                  ? update.coords.heading
                  : bearingDegrees(lastPosition.current, smoothed)
              );
              if (walkingTimeout.current) {
                clearTimeout(walkingTimeout.current);
              }
              // Repasse en idle si plus aucun mouvement pendant 3 s.
              walkingTimeout.current = setTimeout(() => setWalking(false), 3000);
            }
          }

          lastPosition.current = smoothed;
          setPosition(smoothed);
          mapRef.current?.animateCamera({ center: smoothed }, { duration: 800 });
        }
      );
    })();

    return () => {
      subscription?.remove();
      if (walkingTimeout.current) {
        clearTimeout(walkingTimeout.current);
      }
    };
  }, [demoMode]);

  const effectivePosition = position ?? (demoMode ? FALLBACK_POSITION : null);

  const huntsWithDistance = useMemo(
    () =>
      hunts.map((hunt) => ({
        hunt,
        distance: effectivePosition ? haversineDistanceMeters(effectivePosition, hunt.location) : null,
      })),
    [hunts, effectivePosition]
  );

  const inProgressCount = Object.keys(acceptedHunts).length;

  // Alerte de proximité in-app : prévenir (une seule fois par chasse) quand une
  // chasse non acceptée entre dans le rayon de découverte. Remplacera une vraie
  // notification locale (expo-notifications) en phase suivante.
  useEffect(() => {
    if (!effectivePosition) {
      return;
    }
    const nearby = huntsWithDistance.find(
      ({ hunt, distance }) =>
        distance !== null &&
        distance <= 250 &&
        !isAccepted(hunt.id) &&
        !notifiedHuntIds.current.has(hunt.id)
    );
    if (nearby) {
      notifiedHuntIds.current.add(nearby.hunt.id);
      setProximityAlert(nearby.hunt.title);
      if (proximityTimeout.current) {
        clearTimeout(proximityTimeout.current);
      }
      proximityTimeout.current = setTimeout(() => setProximityAlert(null), 6000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [huntsWithDistance, effectivePosition]);

  useEffect(
    () => () => {
      if (proximityTimeout.current) {
        clearTimeout(proximityTimeout.current);
      }
    },
    []
  );

  const openSheet = (hunt: Chase) => {
    setSelectedHunt(hunt);
    Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 6 }).start();
  };

  const closeSheet = () => {
    Animated.timing(sheetAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() =>
      setSelectedHunt(null)
    );
  };

  const handleAccept = async () => {
    if (!selectedHunt) {
      return;
    }
    await acceptHunt(selectedHunt.id);
  };

  const selectedDistance =
    selectedHunt && effectivePosition
      ? haversineDistanceMeters(effectivePosition, selectedHunt.location)
      : null;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFill}
        customMapStyle={darkMapStyle}
        initialRegion={{
          ...(effectivePosition ?? FALLBACK_POSITION),
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        }}
        showsUserLocation={false}
        rotateEnabled={false}
        pitchEnabled={false}
        onPress={closeSheet}
      >
        {huntsWithDistance.map(({ hunt, distance }) => (
          <Marker
            key={hunt.id}
            coordinate={hunt.location}
            onPress={() => openSheet(hunt)}
            tracksViewChanges={false}
          >
            <View style={styles.huntMarker}>
              <Text style={styles.huntMarkerIcon}>{isAccepted(hunt.id) ? '🎯' : '🧰'}</Text>
              {distance !== null && (
                <View style={styles.huntMarkerBadge}>
                  <Text style={styles.huntMarkerBadgeText}>{formatDistance(distance)}</Text>
                </View>
              )}
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Personnage 3D : fixe au centre de l'écran, la carte défile sous lui. */}
      {effectivePosition && (
        <View pointerEvents="none" style={styles.characterAnchor}>
          <PlayerCharacter3D model={avatarModel} walking={walking} headingDegrees={heading} />
        </View>
      )}

      {/* HUD niveau / points */}
      <View style={[styles.hud, { top: insets.top + 10 }]}>
        <View style={styles.hudPill}>
          <Text style={styles.hudGold}>⭐ Niv. {playerStats.level}</Text>
        </View>
        <View style={styles.hudPill}>
          <Text style={styles.hudTeal}>{playerStats.points} pts</Text>
        </View>
      </View>

      {permissionDenied && !demoMode && (
        <View style={[styles.banner, { top: insets.top + 56 }]}>
          <Text style={styles.bannerText}>
            Localisation refusée — active-la dans les réglages, ou utilise le mode démo.
          </Text>
        </View>
      )}

      {proximityAlert && (
        <View style={[styles.proximityBanner, { top: insets.top + 56 }]}>
          <Text style={styles.proximityTitle}>🧰 Chasse à proximité !</Text>
          <Text style={styles.proximityText}>« {proximityAlert} » est à moins de 250 m.</Text>
        </View>
      )}

      {/* Boutons flottants */}
      <View style={[styles.fabRow, { bottom: insets.bottom + 14 }]}>
        <Fab icon="person-circle-outline" label="Profil" onPress={() => router.push('/(tabs)/account')} />
        <Fab
          icon="flag-outline"
          label="En cours"
          count={inProgressCount}
          onPress={() => router.push('/(tabs)/in-progress')}
        />
        <Fab icon="map-outline" label="Disponibles" onPress={() => router.push('/(tabs)/chases')} />
      </View>

      {/* Bottom sheet de détail */}
      {selectedHunt && (
        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + 16 },
            {
              transform: [
                {
                  translateY: sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [320, 0] }),
                },
              ],
            },
          ]}
        >
          <View style={styles.sheetGrab} />
          <Text style={styles.sheetTitle}>{selectedHunt.title}</Text>
          <View style={styles.sheetMeta}>
            <Chip label={selectedHunt.difficulty === 'easy' ? 'Facile' : selectedHunt.difficulty === 'hard' ? 'Difficile' : 'Moyenne'} />
            <Chip label={`🏆 ${selectedHunt.steps.reduce((sum, step) => sum + (step.reward ?? 0), 0)} pts`} gold />
            {selectedDistance !== null && <Chip label={`📍 ${formatDistance(selectedDistance)}`} teal />}
          </View>
          <Text style={styles.sheetDescription} numberOfLines={3}>
            {selectedHunt.description}
          </Text>
          {isAccepted(selectedHunt.id) ? (
            <Pressable
              style={[styles.cta, styles.ctaAccepted]}
              onPress={() => router.push(`/chases/${selectedHunt.id}`)}
            >
              <Text style={styles.ctaAcceptedText}>En cours ✓ — voir le détail</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.cta} onPress={handleAccept}>
              <Text style={styles.ctaText}>Accepter la chasse</Text>
            </Pressable>
          )}
        </Animated.View>
      )}
    </View>
  );
}

function Fab({
  icon,
  label,
  count,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  count?: number;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.fab} onPress={onPress}>
      <Ionicons name={icon} size={20} color={colors.foreground} />
      <Text style={styles.fabLabel}>{label}</Text>
      {count != null && count > 0 && (
        <View style={styles.fabBadge}>
          <Text style={styles.fabBadgeText}>{count}</Text>
        </View>
      )}
    </Pressable>
  );
}

function Chip({ label, gold, teal }: { label: string; gold?: boolean; teal?: boolean }) {
  return (
    <View
      style={[
        styles.chip,
        gold && { borderColor: colors.gold, backgroundColor: colors.goldSoft },
        teal && { borderColor: colors.teal, backgroundColor: colors.tealSoft },
      ]}
    >
      <Text style={[styles.chipText, gold && { color: colors.gold }, teal && { color: colors.teal }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  characterAnchor: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    // Décale légèrement vers le haut : les pieds du personnage "touchent" la position GPS.
    paddingBottom: 64,
  },
  hud: { position: 'absolute', left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between' },
  hudPill: { ...glassStrongCard, borderRadius: radii.pill, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: 'rgba(11,15,26,0.82)' },
  hudGold: { color: colors.gold, fontWeight: '800', fontSize: 13 },
  hudTeal: { color: colors.teal, fontWeight: '800', fontSize: 13 },
  banner: { position: 'absolute', left: 14, right: 14, backgroundColor: 'rgba(11,15,26,0.92)', borderColor: colors.danger, borderWidth: 1, borderRadius: radii.md, padding: 10 },
  bannerText: { color: colors.foreground, fontSize: 12, lineHeight: 17 },
  proximityBanner: { position: 'absolute', left: 14, right: 14, backgroundColor: 'rgba(11,15,26,0.94)', borderColor: colors.gold, borderWidth: 1, borderRadius: radii.md, padding: 12 },
  proximityTitle: { color: colors.gold, fontWeight: '900', fontSize: 13 },
  proximityText: { color: colors.foreground, fontSize: 12, marginTop: 3 },
  huntMarker: { alignItems: 'center' },
  huntMarkerIcon: { fontSize: 30, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  huntMarkerBadge: { backgroundColor: 'rgba(11,15,26,0.9)', borderColor: colors.glassBorderStrong, borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: 7, paddingVertical: 2, marginTop: 2 },
  huntMarkerBadgeText: { color: colors.foreground, fontSize: 9, fontWeight: '800' },
  fabRow: { position: 'absolute', left: 14, right: 14, flexDirection: 'row', gap: 10 },
  fab: { flex: 1, ...glassStrongCard, backgroundColor: 'rgba(11,15,26,0.88)', borderRadius: radii.lg, alignItems: 'center', paddingVertical: 10 },
  fabLabel: { color: colors.foreground, fontSize: 10, fontWeight: '800', marginTop: 3 },
  fabBadge: { position: 'absolute', top: 6, right: 14, backgroundColor: colors.gold, borderRadius: radii.pill, minWidth: 18, paddingHorizontal: 4, paddingVertical: 1, alignItems: 'center' },
  fabBadgeText: { color: colors.background, fontSize: 10, fontWeight: '900' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(13,18,30,0.97)', borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, borderColor: colors.glassBorderStrong, borderWidth: 1, padding: 18 },
  sheetGrab: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.glassBorderStrong, alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { color: colors.foreground, fontSize: 19, fontWeight: '900' },
  sheetMeta: { flexDirection: 'row', gap: 8, marginVertical: 10 },
  chip: { borderColor: colors.glassBorderStrong, borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: colors.glass },
  chipText: { color: colors.foreground, fontSize: 11, fontWeight: '700' },
  sheetDescription: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 14 },
  cta: { backgroundColor: colors.gold, borderRadius: radii.md, alignItems: 'center', paddingVertical: 13 },
  ctaText: { color: colors.background, fontWeight: '900', fontSize: 15 },
  ctaAccepted: { backgroundColor: colors.tealSoft, borderColor: colors.teal, borderWidth: 1 },
  ctaAcceptedText: { color: colors.teal, fontWeight: '900', fontSize: 15 },
});
