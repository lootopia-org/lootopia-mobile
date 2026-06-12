import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, type MapType } from 'react-native-maps';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { PlayerCharacter } from '@/src/components/PlayerCharacter';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chaseApi, type Chase } from '@/src/lib/chase-api';
import { useHunts } from '@/src/state/HuntsContext';
import { PlayerCharacter3D } from '@/src/components/PlayerCharacter3D';
import { colors, darkMapStyle, glassStrongCard, radii } from '@/src/theme';
import { bearingDegrees, formatDistance, haversineDistanceMeters, smoothPosition, type GeoPoint } from '@/src/lib/geo';
import { getFps } from '@/src/lib/perf';
import { recordBreadcrumb } from '@/src/lib/heatmap';
import { usePlayerProfile } from '@/src/hooks/usePlayerProfile';

// Région initiale de la carte tant que le GPS n'a pas fourni de position.
const FALLBACK_POSITION: GeoPoint = { latitude: 37.8044, longitude: -122.2712 };
const WALK_THRESHOLD_METERS = 1.5;

// Profils GPS adaptatifs : précision maximale uniquement à proximité d'une
// chasse ; sinon profil économe (précision Balanced, intervalles espacés).
// Hystérésis near<400 m / far>600 m pour éviter les bascules en boucle.
const GPS_PROFILES = {
  near: { accuracy: Location.Accuracy.High, distanceInterval: 2, timeInterval: 1500 },
  far: { accuracy: Location.Accuracy.Balanced, distanceInterval: 10, timeInterval: 5000 },
} as const;
type GpsProfile = keyof typeof GPS_PROFILES;
const NEAR_ENTER_METERS = 400;
const NEAR_EXIT_METERS = 600;

// Styles de carte personnalisables par le joueur (persistés).
const MAP_STYLES = [
  { id: 'dark', label: 'Sombre' },
  { id: 'light', label: 'Clair' },
  { id: 'satellite', label: 'Satellite' },
] as const;
type MapStyleId = (typeof MAP_STYLES)[number]['id'];
const MAP_STYLE_KEY = 'lootopia-mobile-map-style';

export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { avatarModel, acceptHunt, isAccepted } = useHunts();
  // Niveau/points réels du joueur (GET /profile).
  const { level, points } = usePlayerProfile();

  const mapRef = useRef<MapView>(null);
  const [hunts, setHunts] = useState<Chase[]>([]);
  const [position, setPosition] = useState<GeoPoint | null>(null);
  const [walking, setWalking] = useState(false);
  const [heading, setHeading] = useState<number | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [selectedHunt, setSelectedHunt] = useState<Chase | null>(null);
  const [proximityAlert, setProximityAlert] = useState<string | null>(null);
  const [fps, setFps] = useState(0);

  // Mode suivi : caméra verrouillée sur le joueur (personnage 3D centré).
  // Dès que l'utilisateur fait glisser la carte, on passe en exploration libre
  // (le personnage devient un marqueur à sa position GPS réelle).
  const [following, setFollowing] = useState(true);
  const followingRef = useRef(true);
  useEffect(() => {
    followingRef.current = following;
  }, [following]);

  // Style de carte choisi par le joueur (persisté).
  const [mapStyle, setMapStyle] = useState<MapStyleId>('dark');
  const [stylePickerOpen, setStylePickerOpen] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(MAP_STYLE_KEY).then((stored) => {
      if (stored === 'dark' || stored === 'light' || stored === 'satellite') {
        setMapStyle(stored);
      }
    });
  }, []);
  const selectMapStyle = (style: MapStyleId) => {
    setMapStyle(style);
    setStylePickerOpen(false);
    void AsyncStorage.setItem(MAP_STYLE_KEY, style);
  };
  const mapType: MapType = mapStyle === 'satellite' ? 'satellite' : 'standard';

  // Moniteur FPS visible uniquement en build de dev (télémétrie de dev).
  useEffect(() => {
    if (!__DEV__) {
      return;
    }
    const interval = setInterval(() => setFps(getFps('character')), 1000);
    return () => clearInterval(interval);
  }, []);
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const lastPosition = useRef<GeoPoint | null>(null);
  const walkingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notifiedHuntIds = useRef<Set<string>>(new Set());
  const proximityTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chargement des chasses (API ; liste vide en cas d'erreur réseau).
  const huntsRef = useRef<Chase[]>([]);
  useEffect(() => {
    chaseApi.getChases().then(setHunts).catch(() => setHunts([]));
  }, []);
  useEffect(() => {
    huntsRef.current = hunts;
  }, [hunts]);

  const gpsProfileRef = useRef<GpsProfile>('near');
  const gpsSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

  const handlePositionUpdate = useCallback((update: Location.LocationObject) => {
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
    // La caméra ne suit le joueur qu'en mode suivi — en exploration libre,
    // l'utilisateur garde la main sur la carte.
    if (followingRef.current) {
      mapRef.current?.animateCamera({ center: smoothed }, { duration: 800 });
    }
    // Alimente la heatmap joueur (échantillonnage géré par la lib).
    void recordBreadcrumb(smoothed);

    // Adaptation du profil GPS à la distance de la chasse la plus proche.
    const distances = huntsRef.current.map((hunt) => haversineDistanceMeters(smoothed, hunt.location));
    const nearest = distances.length > 0 ? Math.min(...distances) : Infinity;
    const current = gpsProfileRef.current;
    const next: GpsProfile =
      current === 'near' ? (nearest > NEAR_EXIT_METERS ? 'far' : 'near') : nearest < NEAR_ENTER_METERS ? 'near' : 'far';
    if (next !== current) {
      void subscribeGps(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subscribeGps = useCallback(
    async (profile: GpsProfile) => {
      gpsSubscriptionRef.current?.remove();
      gpsProfileRef.current = profile;
      gpsSubscriptionRef.current = await Location.watchPositionAsync(GPS_PROFILES[profile], handlePositionUpdate);
    },
    [handlePositionUpdate]
  );

  // Suivi GPS actif uniquement quand l'écran carte a le focus (les autres
  // onglets n'en ont pas besoin : économie batterie). La caméra suit le
  // joueur : le personnage reste au centre, la carte défile (pattern Pokémon GO).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      (async () => {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (cancelled) {
          return;
        }
        if (!permission.granted) {
          setPermissionDenied(true);
          return;
        }
        await subscribeGps(gpsProfileRef.current);
      })();

      return () => {
        cancelled = true;
        gpsSubscriptionRef.current?.remove();
        gpsSubscriptionRef.current = null;
        if (walkingTimeout.current) {
          clearTimeout(walkingTimeout.current);
        }
      };
    }, [subscribeGps])
  );

  const huntsWithDistance = useMemo(
    () =>
      hunts
        // Garde : le backend peut renvoyer des chasses sans coordonnées
        // (normalisées à 0,0) — on ne les affiche pas sur la carte.
        .filter((hunt) => hunt.location.latitude !== 0 || hunt.location.longitude !== 0)
        .map((hunt) => ({
          hunt,
          distance: position ? haversineDistanceMeters(position, hunt.location) : null,
        })),
    [hunts, position]
  );

  // Alerte de proximité in-app : prévenir (une seule fois par chasse) quand une
  // chasse non acceptée entre dans le rayon de découverte. Remplacera une vraie
  // notification locale (expo-notifications) en phase suivante.
  useEffect(() => {
    if (!position) {
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
  }, [huntsWithDistance, position]);

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
    selectedHunt && position
      ? haversineDistanceMeters(position, selectedHunt.location)
      : null;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFill}
        customMapStyle={mapStyle === 'dark' ? darkMapStyle : []}
        mapType={mapType}
        initialRegion={{
          ...(position ?? FALLBACK_POSITION),
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        }}
        showsUserLocation={false}
        rotateEnabled={false}
        pitchEnabled={false}
        onPress={closeSheet}
        onPanDrag={() => {
          if (followingRef.current) {
            setFollowing(false);
          }
        }}
      >
        {/* Exploration libre : le personnage est un marqueur à sa position GPS
            réelle (sprite — un canvas GL dans un Marker natif n'est pas fiable). */}
        {!following && position && (
          <Marker coordinate={position} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false}>
            <PlayerCharacter model={avatarModel} walking={walking} headingDegrees={heading} />
          </Marker>
        )}

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

      {/* Mode suivi : personnage 3D fixe au centre, la carte défile sous lui. */}
      {following && position && (
        <View pointerEvents="none" style={styles.characterAnchor}>
          <PlayerCharacter3D model={avatarModel} walking={walking} headingDegrees={heading} />
        </View>
      )}

      {/* Contrôles carte : recentrer + style */}
      <View style={[styles.mapControls, { bottom: insets.bottom + 18 }]}>
        {stylePickerOpen && (
          <View style={styles.stylePicker}>
            {MAP_STYLES.map((style) => (
              <Pressable
                key={style.id}
                style={[styles.styleChip, mapStyle === style.id && styles.styleChipActive]}
                onPress={() => selectMapStyle(style.id)}
              >
                <Text style={[styles.styleChipText, mapStyle === style.id && styles.styleChipTextActive]}>
                  {style.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
        <Pressable style={styles.mapControlButton} onPress={() => setStylePickerOpen((open) => !open)}>
          <Ionicons name="layers-outline" size={20} color={colors.foreground} />
        </Pressable>
        <Pressable
          style={[styles.mapControlButton, following && styles.mapControlButtonActive]}
          onPress={() => {
            setFollowing(true);
            if (position) {
              mapRef.current?.animateCamera({ center: position }, { duration: 500 });
            }
          }}
        >
          <Ionicons name="locate" size={20} color={following ? colors.background : colors.gold} />
        </Pressable>
      </View>

      {/* HUD niveau / points */}
      <View style={[styles.hud, { top: insets.top + 10 }]}>
        <View style={styles.hudPill}>
          <Text style={styles.hudGold}>⭐ Niv. {level}</Text>
        </View>
        <View style={styles.hudPill}>
          <Text style={styles.hudTeal}>{points} pts</Text>
        </View>
        {__DEV__ && (
          <View style={styles.hudPill}>
            <Text style={[styles.hudTeal, fps > 0 && fps < 24 && { color: colors.danger }]}>{fps} fps</Text>
          </View>
        )}
      </View>

      {permissionDenied && (
        <View style={[styles.banner, { top: insets.top + 56 }]}>
          <Text style={styles.bannerText}>
            Localisation refusée — active-la dans les réglages pour voir ta position.
          </Text>
        </View>
      )}

      {proximityAlert && (
        <View style={[styles.proximityBanner, { top: insets.top + 56 }]}>
          <Text style={styles.proximityTitle}>🧰 Chasse à proximité !</Text>
          <Text style={styles.proximityText}>« {proximityAlert} » est à moins de 250 m.</Text>
        </View>
      )}

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
  mapControls: { position: 'absolute', right: 14, alignItems: 'flex-end', gap: 10 },
  mapControlButton: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(11,15,26,0.88)', borderColor: colors.glassBorderStrong, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  mapControlButtonActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  stylePicker: { flexDirection: 'row', gap: 6, backgroundColor: 'rgba(11,15,26,0.92)', borderColor: colors.glassBorderStrong, borderWidth: 1, borderRadius: radii.pill, padding: 5 },
  styleChip: { borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 7 },
  styleChipActive: { backgroundColor: colors.goldSoft, borderColor: colors.gold, borderWidth: 1 },
  styleChipText: { color: colors.textMuted, fontSize: 11, fontWeight: '800' },
  styleChipTextActive: { color: colors.gold },
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
