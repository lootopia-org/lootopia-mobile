import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, Pressable, TextInput, Button, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { chaseApi, type Chase } from '@/src/lib/chase-api';
import { useAuth } from '@/src/state/AuthContext';

export default function PartnerStudioScreen() {
  const router = useRouter();
  const { user, isReady } = useAuth();
  const [chases, setChases] = useState<Chase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    (async () => {
      if (!isReady) return;
      setIsLoading(true);
      try {
        const all = await chaseApi.getChases();
        // Comme sur le frontend web, partenaires et admins pilotent toutes les chasses.
        if (user && (user.role === 'partner' || user.role === 'admin')) {
          setChases(all);
        } else {
          setChases([]);
        }
      } catch (e) {
        setChases([]);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [isReady, user]);

  const handleCreate = async () => {
    if (!user) {
      Alert.alert('Authentification requise', 'Veuillez vous connecter en tant que partenaire.');
      return;
    }

    if (!title.trim()) {
      Alert.alert('Titre requis', 'Donnez un titre à votre chasse.');
      return;
    }

    try {
      setIsLoading(true);
      const payload: Partial<Chase> = {
        title: title.trim(),
        description: description.trim(),
        partner: { id: user.id, name: user.username ?? user.email, email: user.email, description: '', logo: '', chases: [] },
        status: 'draft',
        steps: [],
      };

      const created = await chaseApi.createChase(payload);
      setChases((prev) => [created, ...prev]);
      setShowForm(false);
      setTitle('');
      setDescription('');
      // Navigate to edit/preview if desired
      router.push(`/chases/${created.id}`);
    } catch (err) {
      Alert.alert('Erreur', (err as Error).message || 'Impossible de créer la chasse');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isReady) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ff6b35" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Partner Studio</Text>
        <Text style={styles.notice}>Vous devez être connecté en tant que partenaire pour accéder à ce studio.</Text>
        <Button title="Se connecter" onPress={() => router.push('/auth/login')} />
      </View>
    );
  }

  // Accès réservé aux partenaires et admins (les joueurs sont bloqués même s'ils forcent l'URL).
  if (user.role !== 'partner' && user.role !== 'admin') {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Partner Studio</Text>
        <Text style={styles.notice}>
          Cet espace est réservé aux comptes partenaires et administrateurs. Ton profil joueur n’y a pas accès.
        </Text>
        <Button title="Retour aux chasses" onPress={() => router.replace('/(tabs)/chases')} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Partner Studio</Text>
      <Text style={styles.sub}>Connecté en tant que {user.email}</Text>

      <View style={{ marginVertical: 12 }}>
        <Button title={showForm ? 'Annuler' : 'Créer une chasse'} onPress={() => setShowForm((s) => !s)} />
      </View>

      {showForm && (
        <View style={styles.form}>
          <TextInput placeholder="Titre" value={title} onChangeText={setTitle} style={styles.input} />
          <TextInput placeholder="Description" value={description} onChangeText={setDescription} style={[styles.input, { height: 80 }]} multiline />
          <Button title="Publier (brouillon)" onPress={handleCreate} />
        </View>
      )}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#ff6b35" />
        </View>
      ) : (
        <FlatList
          data={chases}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/chases/${item.id}`)} style={styles.card}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardSubtitle}>{item.description}</Text>
              <Text style={styles.meta}>{item.status} · {item.steps.length} étapes</Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Vous n'avez pas encore de chasses.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff9f5', paddingTop: 64, paddingHorizontal: 16 },
  header: { fontSize: 28, fontWeight: '800', color: '#1f2937' },
  sub: { color: '#6b7280', marginTop: 6 },
  notice: { color: '#6b7280', marginVertical: 12 },
  form: { marginVertical: 12, backgroundColor: '#fff', padding: 12, borderRadius: 12, elevation: 2 },
  input: { borderColor: '#e5e7eb', borderWidth: 1, borderRadius: 8, padding: 8, marginBottom: 8, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { padding: 12, backgroundColor: '#fff', borderRadius: 12, marginVertical: 8, elevation: 1 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  cardSubtitle: { color: '#6b7280', marginTop: 6 },
  meta: { marginTop: 6, color: '#d97706', fontWeight: '700' },
  empty: { textAlign: 'center', marginTop: 24, color: '#6b7280' },
});
