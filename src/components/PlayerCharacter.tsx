import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/src/theme';
import type { AvatarModel } from '@/src/state/HuntsContext';

type PlayerCharacterProps = {
  model: AvatarModel;
  walking: boolean;
  headingDegrees?: number | null;
};

/**
 * Personnage joueur affiché au centre de la carte (la caméra suit le joueur,
 * donc le personnage reste fixe à l'écran et la carte défile sous lui).
 *
 * MVP : sprite animé (idle = flottement lent, walk = rebond rapide + inclinaison
 * selon le cap). Ce composant a vocation à être remplacé par un canvas
 * expo-gl + three.js rendant un GLB animé (voir conception-prototype-AR-lootopia.md)
 * sans changer son interface (model / walking / headingDegrees).
 */
export function PlayerCharacter({ model, walking, headingDegrees }: PlayerCharacterProps) {
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    bob.setValue(0);
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: 1,
          duration: walking ? 220 : 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: walking ? 220 : 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [walking, bob]);

  const translateY = bob.interpolate({
    inputRange: [0, 1],
    outputRange: [0, walking ? -7 : -3],
  });

  // Légère inclinaison gauche/droite selon le cap pour suggérer la direction.
  const heading = headingDegrees ?? 0;
  const leaning = walking ? (heading > 180 ? '-8deg' : '8deg') : '0deg';

  return (
    <View pointerEvents="none" style={styles.wrapper}>
      <Animated.View style={{ transform: [{ translateY }, { rotate: leaning }] }}>
        <Text style={styles.sprite}>{model === 'male' ? '🧍‍♂️' : '🧍‍♀️'}</Text>
      </Animated.View>
      <View style={styles.shadow} />
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{walking ? 'En marche' : 'Toi'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center' },
  sprite: { fontSize: 44, textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 6 },
  shadow: { width: 30, height: 9, borderRadius: 9, backgroundColor: 'rgba(0,0,0,0.35)', marginTop: -6 },
  badge: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(11,15,26,0.85)',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  badgeText: { color: colors.gold, fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
});
