import React, { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ARExperience } from '@/src/components/ARExperience';
import { chaseApi, type Chase } from '@/src/lib/chase-api';
import { colors, radii } from '@/src/theme';

export default function ARScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, clue, stepId } = useLocalSearchParams<{ id: string; clue?: string; stepId?: string }>();
  const [chase, setChase] = useState<Chase | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      return;
    }

    (async () => {
      try {
        setIsLoading(true);
        setChase(await chaseApi.getChase(id));
      } finally {
        setIsLoading(false);
      }
    })();
  }, [id]);

  const step = chase?.steps.find((item) => item.id === stepId) ?? chase?.steps[0];

  const handleComplete = async () => {
    if (!chase || !step) {
      return;
    }
    // On valide côté API mais on reste sur l'écran : le joueur voit le coffre
    // s'ouvrir, puis revient avec le bouton retour.
    await chaseApi.completeStep(chase.id, step.id);
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  if (!chase) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFoundText}>Chasse introuvable.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* L'expérience AR occupe tout l'écran. */}
      <ARExperience
        clue={step?.clue ?? clue ?? 'Indice indisponible'}
        targetLocation={step?.location ?? { latitude: 43.2965, longitude: 5.3698 }}
        radiusMeters={step?.radiusMeters ?? 100}
        qrPayload={step?.qrPayload}
        fullScreen
        onComplete={handleComplete}
      />

      {/* En-tête superposé : retour + contexte de l'étape. */}
      <View style={[styles.topBar, { top: insets.top + 10 }]} pointerEvents="box-none">
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={colors.foreground} />
        </Pressable>
        <View style={styles.titlePill}>
          <Text style={styles.titleText} numberOfLines={1}>
            {chase.title}
          </Text>
          {step && (
            <Text style={styles.stepText} numberOfLines={1}>
              {step.title}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: { position: 'absolute', left: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(11,15,26,0.85)',
    borderColor: colors.glassBorderStrong,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titlePill: {
    flex: 1,
    backgroundColor: 'rgba(11,15,26,0.85)',
    borderColor: colors.glassBorderStrong,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  titleText: { color: colors.foreground, fontWeight: '900', fontSize: 13 },
  stepText: { color: colors.gold, fontWeight: '700', fontSize: 11, marginTop: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  notFoundText: { color: colors.textMuted, fontWeight: '700' },
});
