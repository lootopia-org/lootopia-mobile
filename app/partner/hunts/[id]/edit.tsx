import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HuntEditor } from '@/src/components/hunts/HuntEditor';
import { chaseApi } from '@/src/lib/chase-api';
import { chaseToHuntForm } from '@/src/lib/hunt-mappers';
import type { HuntForm } from '@/src/lib/hunt-types';
import { useAuth } from '@/src/state/AuthContext';
import { colors } from '@/src/theme';

export default function EditHuntScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('hunts');
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [initial, setInitial] = useState<HuntForm | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      return;
    }
    chaseApi
      .getChase(id)
      .then((chase) => setInitial(chaseToHuntForm(chase)))
      .catch(() => setError(t('partner:hunts.editLoadError')));
  }, [id]);

  if (error) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (!initial || !id) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <HuntEditor
        mode="edit"
        huntId={id}
        initial={initial}
        partnerId={user?.id}
        onSaved={() => router.replace('/partner/hunts')}
        onCancel={() => router.back()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  error: { color: colors.textMuted, fontWeight: '700' },
});
