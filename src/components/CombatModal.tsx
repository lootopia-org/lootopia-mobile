import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radii } from '@/src/theme';

type CombatModalProps = {
  visible: boolean;
  onWin: () => void;
  onFlee: () => void;
};

const TRACK_WIDTH = 260;
const CURSOR_WIDTH = 14;
const ZONE_RATIO = 0.26;
const GUARDIAN_HP = 2;
const PLAYER_HP = 2;

export function CombatModal({ visible, onWin, onFlee }: CombatModalProps) {
  const { t } = useTranslation('hunts');
  const cursor = useRef(new Animated.Value(0)).current;
  const cursorValue = useRef(0);
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  const [guardianHp, setGuardianHp] = useState(GUARDIAN_HP);
  const [playerHp, setPlayerHp] = useState(PLAYER_HP);
  const [round, setRound] = useState(1);
  const [message, setMessage] = useState('');
  const [outcome, setOutcome] = useState<'fighting' | 'won' | 'lost'>('fighting');

  useEffect(() => {
    setMessage(t('combat.messages.intro'));
  }, [t]);

  useEffect(() => {
    const listener = cursor.addListener(({ value }) => {
      cursorValue.current = value;
    });
    return () => cursor.removeListener(listener);
  }, [cursor]);

  const startOscillation = (speedRound: number) => {
    animation.current?.stop();
    const duration = Math.max(900 - speedRound * 150, 420);
    animation.current = Animated.loop(
      Animated.sequence([
        Animated.timing(cursor, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(cursor, { toValue: 0, duration, easing: Easing.linear, useNativeDriver: true }),
      ])
    );
    animation.current.start();
  };

  useEffect(() => {
    if (visible) {
      setGuardianHp(GUARDIAN_HP);
      setPlayerHp(PLAYER_HP);
      setRound(1);
      setOutcome('fighting');
      setMessage(t('combat.messages.intro'));
      cursor.setValue(0);
      startOscillation(1);
    } else {
      animation.current?.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, t]);

  const handleStrike = () => {
    if (outcome !== 'fighting') {
      return;
    }
    const inZone = Math.abs(cursorValue.current - 0.5) <= ZONE_RATIO / 2;

    if (inZone) {
      const nextHp = guardianHp - 1;
      setGuardianHp(nextHp);
      if (nextHp <= 0) {
        setOutcome('won');
        setMessage(t('combat.messages.playerWins'));
        animation.current?.stop();
        return;
      }
      setMessage(t('combat.messages.hit'));
    } else {
      const nextHp = playerHp - 1;
      setPlayerHp(nextHp);
      if (nextHp <= 0) {
        setOutcome('lost');
        setMessage(t('combat.messages.guardianWins'));
        animation.current?.stop();
        return;
      }
      setMessage(t('combat.messages.miss'));
    }

    const nextRound = round + 1;
    setRound(nextRound);
    startOscillation(nextRound);
  };

  const handleRetry = () => {
    setGuardianHp(GUARDIAN_HP);
    setPlayerHp(PLAYER_HP);
    setRound(1);
    setOutcome('fighting');
    setMessage(t('combat.messages.retryIntro'));
    startOscillation(1);
  };

  if (!visible) {
    return null;
  }

  const zoneWidth = TRACK_WIDTH * ZONE_RATIO;

  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <Text style={styles.guardian}>{outcome === 'won' ? '💀' : '👹'}</Text>
        <Text style={styles.title}>{t('combat.title')}</Text>
        <Text style={styles.message}>{message}</Text>

        <View style={styles.hpRow}>
          <Text style={styles.hpLabel}>
            {t('combat.hp.guardian')} {'❤️'.repeat(Math.max(guardianHp, 0))}{'🖤'.repeat(GUARDIAN_HP - Math.max(guardianHp, 0))}
          </Text>
          <Text style={styles.hpLabel}>
            {t('combat.hp.you')} {'❤️'.repeat(Math.max(playerHp, 0))}{'🖤'.repeat(PLAYER_HP - Math.max(playerHp, 0))}
          </Text>
        </View>

        {outcome === 'fighting' && (
          <>
            <View style={styles.track}>
              <View style={[styles.zone, { width: zoneWidth, left: (TRACK_WIDTH - zoneWidth) / 2 }]} />
              <Animated.View
                style={[
                  styles.cursor,
                  {
                    transform: [
                      {
                        translateX: cursor.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, TRACK_WIDTH - CURSOR_WIDTH],
                        }),
                      },
                    ],
                  },
                ]}
              />
            </View>
            <Pressable style={styles.strikeButton} onPress={handleStrike}>
              <Text style={styles.strikeText}>{t('combat.buttons.strike')}</Text>
            </Pressable>
            <Pressable onPress={onFlee}>
              <Text style={styles.flee}>{t('combat.buttons.flee')}</Text>
            </Pressable>
          </>
        )}

        {outcome === 'won' && (
          <Pressable style={styles.strikeButton} onPress={onWin}>
            <Text style={styles.strikeText}>{t('combat.buttons.openChest')}</Text>
          </Pressable>
        )}

        {outcome === 'lost' && (
          <>
            <Pressable style={styles.strikeButton} onPress={handleRetry}>
              <Text style={styles.strikeText}>{t('combat.buttons.retry')}</Text>
            </Pressable>
            <Pressable onPress={onFlee}>
              <Text style={styles.flee}>{t('combat.buttons.giveUp')}</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11,15,26,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  card: {
    width: 320,
    backgroundColor: 'rgba(13,18,30,0.98)',
    borderColor: colors.gold,
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: 22,
    alignItems: 'center',
  },
  guardian: { fontSize: 54 },
  title: { color: colors.gold, fontWeight: '900', fontSize: 18, marginTop: 6 },
  message: { color: colors.foreground, fontSize: 13, textAlign: 'center', marginTop: 8, minHeight: 36 },
  hpRow: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch', marginTop: 10 },
  hpLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  track: {
    width: TRACK_WIDTH,
    height: 26,
    borderRadius: radii.pill,
    backgroundColor: colors.glass,
    borderColor: colors.glassBorderStrong,
    borderWidth: 1,
    marginTop: 18,
    overflow: 'hidden',
  },
  zone: { position: 'absolute', top: 0, bottom: 0, backgroundColor: colors.goldSoft, borderColor: colors.gold, borderWidth: 1 },
  cursor: { position: 'absolute', top: 2, bottom: 2, width: CURSOR_WIDTH, borderRadius: 7, backgroundColor: colors.teal },
  strikeButton: { backgroundColor: colors.gold, borderRadius: radii.md, paddingHorizontal: 26, paddingVertical: 13, marginTop: 18 },
  strikeText: { color: colors.background, fontWeight: '900', fontSize: 15 },
  flee: { color: colors.textFaint, fontSize: 12, marginTop: 14, textDecorationLine: 'underline' },
});
