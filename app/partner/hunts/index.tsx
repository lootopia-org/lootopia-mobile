import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/state/AuthContext';
import { chaseApi, type Chase } from '@/src/lib/chase-api';
import { colors, glassCard, radii } from '@/src/theme';

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  draft: 'Brouillon',
  paused: 'En pause',
};

export default function PartnerHuntsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [hunts, setHunts] = useState<Chase[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!user?.id) {
      return;
    }
    setLoading(true);
    chaseApi
      .getManagedChases(user.id)
      .then(setHunts)
      .catch(() => setHunts([]))
      .finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(load, [load]);

  const allowed = user?.role === 'partner' || user?.role === 'admin';

  if (!allowed) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.blocked}>Accès réservé aux organisateurs</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Retour</Text>
        </Pressable>
        <Text style={styles.title}>Mes chasses</Text>
        <Pressable onPress={() => router.push('/partner/hunts/new')}>
          <Text style={styles.add}>+</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={hunts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Aucune chasse</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/partner/hunts/${item.id}/edit`)}
            >
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.title || 'Sans titre'}
              </Text>
              <Text style={styles.cardMeta}>
                {item.steps.length} étape{item.steps.length > 1 ? 's' : ''} ·{' '}
                {STATUS_LABELS[item.status] ?? item.status}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { justifyContent: 'center', alignItems: 'center' },
  blocked: { color: colors.textMuted, fontWeight: '700' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  back: { color: colors.teal, fontWeight: '700', fontSize: 14, width: 70 },
  title: { flex: 1, textAlign: 'center', color: colors.foreground, fontWeight: '900', fontSize: 18 },
  add: { color: colors.gold, fontWeight: '900', fontSize: 28, width: 70, textAlign: 'right' },
  list: { padding: 16, paddingBottom: 32 },
  empty: { ...glassCard, padding: 24, alignItems: 'center' },
  emptyText: { color: colors.textMuted, fontSize: 14 },
  card: { ...glassCard, padding: 16, marginBottom: 10 },
  cardTitle: { color: colors.foreground, fontWeight: '800', fontSize: 16 },
  cardMeta: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
});
