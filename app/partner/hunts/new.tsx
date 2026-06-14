import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HuntEditor } from '@/src/components/hunts/HuntEditor';
import { createDefaultStep, type HuntForm } from '@/src/lib/hunt-types';
import { useAuth } from '@/src/state/AuthContext';
import { colors } from '@/src/theme';

export default function NewHuntScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { lat, lng } = useLocalSearchParams<{ lat?: string; lng?: string }>();

  const initial = useMemo<HuntForm>(() => {
    const parsedLat = lat ? Number(lat) : undefined;
    const parsedLng = lng ? Number(lng) : undefined;
    const hasCoords = parsedLat !== undefined && parsedLng !== undefined && Number.isFinite(parsedLat) && Number.isFinite(parsedLng);
    return {
      title: '',
      description: '',
      difficulty: 'medium',
      estimatedDuration: 60,
      status: 'draft',
      steps: hasCoords ? [createDefaultStep(1, parsedLat, parsedLng)] : [],
    };
  }, [lat, lng]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <HuntEditor
        mode="create"
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
});
