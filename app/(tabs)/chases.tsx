import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View, ImageBackground, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { chaseApi, type Chase } from '@/src/lib/chase-api';

export default function ChasesScreen() {
  const router = useRouter();
  const [chases, setChases] = useState<Chase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        setError(null);
        setChases(await chaseApi.getChases());
      } catch {
        setError('Impossible de charger les chasses.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ff6b35" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Chasses disponibles</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={chases}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/chases/${item.id}`)} style={styles.cardWrap}>
            <ImageBackground
              source={{ uri: item.image || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80' }}
              style={styles.cardImage}
              imageStyle={styles.cardImageStyle}
            >
              <View style={styles.overlay}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardSubtitle}>{item.description}</Text>
                <Text style={styles.meta}>{item.steps.length} étapes · {item.estimatedDuration} min · {item.difficulty}</Text>
              </View>
            </ImageBackground>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Aucune chasse disponible.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff9f5', paddingTop: 64, paddingHorizontal: 16 },
  header: { fontSize: 28, fontWeight: '800', color: '#1f2937', marginBottom: 16 },
  cardWrap: { marginBottom: 14 },
  cardImage: { height: 180, justifyContent: 'flex-end' },
  cardImageStyle: { borderRadius: 24 },
  overlay: { backgroundColor: 'rgba(17,24,39,0.42)', borderRadius: 24, padding: 16 },
  cardTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  cardSubtitle: { color: '#f3f4f6', marginTop: 6 },
  meta: { color: '#fde68a', marginTop: 8, fontWeight: '700' },
  error: { color: '#b91c1c', marginBottom: 12, fontWeight: '700' },
  empty: { textAlign: 'center', marginTop: 24, color: '#6b7280' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});