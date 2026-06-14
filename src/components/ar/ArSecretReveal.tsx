import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { StoredImage } from '@/src/components/StoredImage';
import { isLikelyImageReference } from '@/src/lib/qr-utils';
import { colors, radii } from '@/src/theme';

type ArSecretRevealProps = {
  secret: string;
  onContinue: () => void;
};

export function ArSecretReveal({ secret, onContinue }: ArSecretRevealProps) {
  const { t } = useTranslation('hunts');
  const backdrop = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.4)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const [typedText, setTypedText] = useState('');
  const showImage = isLikelyImageReference(secret);

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.spring(cardScale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      Animated.timing(textOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(shimmer, { toValue: 1, duration: 2200, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, [backdrop, cardOpacity, cardScale, glow, shimmer, textOpacity]);

  useEffect(() => {
    if (showImage) {
      setTypedText('');
      return;
    }

    setTypedText('');
    let index = 0;
    const interval = setInterval(() => {
      index += 1;
      setTypedText(secret.slice(0, index));
      if (index >= secret.length) {
        clearInterval(interval);
      }
    }, 22);

    return () => clearInterval(interval);
  }, [secret, showImage]);

  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.85] });
  const shimmerTranslate = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-120, 120] });

  return (
    <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
      <Animated.View style={[styles.glowRing, { opacity: glowOpacity, transform: [{ scale: cardScale }] }]} />
      <Animated.View style={[styles.cardWrap, { opacity: cardOpacity, transform: [{ scale: cardScale }] }]}>
        <LinearGradient colors={['#1a2236', '#0b0f1a']} style={styles.card}>
          <Animated.View style={[styles.shimmer, { transform: [{ translateX: shimmerTranslate }] }]} />
          <Text style={styles.kicker}>{t('ar.qrReveal.kicker')}</Text>
          <Text style={styles.title}>{t('ar.qrReveal.title')}</Text>

          {showImage ? (
            <Animated.View style={[styles.imageWrap, { opacity: textOpacity }]}>
              <StoredImage storedUrl={secret} style={styles.secretImage} resizeMode="cover" />
            </Animated.View>
          ) : (
            <Animated.Text style={[styles.secret, { opacity: textOpacity }]}>
              {typedText}
              {typedText.length < secret.length ? '|' : ''}
            </Animated.Text>
          )}

          <Pressable style={styles.button} onPress={onContinue}>
            <Text style={styles.buttonText}>{t('ar.qrReveal.continue')}</Text>
          </Pressable>
        </LinearGradient>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11,15,26,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 20,
  },
  glowRing: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: radii.xl,
    backgroundColor: colors.goldSoft,
    borderColor: colors.gold,
    borderWidth: 2,
  },
  cardWrap: { width: '100%', maxWidth: 340 },
  card: {
    borderRadius: radii.xl,
    borderColor: colors.gold,
    borderWidth: 1,
    padding: 24,
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 60,
    backgroundColor: 'rgba(212,175,55,0.12)',
    transform: [{ skewX: '-18deg' }],
  },
  kicker: { color: colors.gold, fontWeight: '900', fontSize: 11, letterSpacing: 1.4 },
  title: { color: colors.foreground, fontWeight: '900', fontSize: 22, marginTop: 8 },
  secret: {
    color: colors.teal,
    fontWeight: '800',
    fontSize: 18,
    lineHeight: 28,
    marginTop: 16,
    textAlign: 'center',
    minHeight: 56,
  },
  imageWrap: {
    marginTop: 16,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderColor: colors.teal,
    borderWidth: 1,
    minHeight: 160,
  },
  secretImage: { width: '100%', height: 200 },
  button: {
    marginTop: 22,
    backgroundColor: colors.gold,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: colors.background, fontWeight: '900', fontSize: 14 },
});
