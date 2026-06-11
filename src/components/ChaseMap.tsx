import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View, StyleSheet, Text } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, LatLng, Region } from 'react-native-maps';
import * as Location from 'expo-location';

type ChaseMapProps = {
  center: LatLng;
  markers: Array<LatLng & { title: string; description: string }>;
};

export function ChaseMap({ center, markers }: ChaseMapProps) {
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [permissionRequested, setPermissionRequested] = useState(false);

  useEffect(() => {
    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      setPermissionRequested(true);

      if (!permission.granted) {
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setUserLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    })();
  }, []);

  const region: Region = useMemo(() => {
    const focus = userLocation ?? center;

    return {
      latitude: focus.latitude,
      longitude: focus.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };
  }, [center, userLocation]);

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        region={region}
        showsUserLocation={permissionRequested}
        followsUserLocation={permissionRequested}
      >
        <Marker coordinate={center} title="Zone de chasse" description="Point de départ ou zone de référence" pinColor="#d4af37" />
        {markers.map((marker, index) => (
          <Marker key={`${marker.title}-${index}`} coordinate={marker} title={marker.title} description={marker.description} />
        ))}
      </MapView>
      <View style={styles.floatingLabel}>
        <Text style={styles.floatingTitle}>Carte de chasse</Text>
        <Text style={styles.floatingText}>
          {userLocation ? 'Ta position réelle est affichée sur la carte.' : 'Activation de la géolocalisation en cours.'}
        </Text>
      </View>
      {!permissionRequested && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color="#d4af37" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 280, borderRadius: 24, overflow: 'hidden' },
  floatingLabel: { position: 'absolute', left: 12, right: 12, top: 12, backgroundColor: 'rgba(17,24,39,0.8)', borderRadius: 18, padding: 12 },
  floatingTitle: { color: '#fff', fontWeight: '800', fontSize: 14 },
  floatingText: { color: '#e5e7eb', marginTop: 3, fontSize: 12 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.3)' },
});