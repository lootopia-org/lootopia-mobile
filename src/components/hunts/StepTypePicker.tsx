import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HUNT_STEP_TYPE_OPTIONS, type HuntStepType } from '@/src/lib/hunt-types';
import { colors, glassCard, radii } from '@/src/theme';

type Props = {
  value: HuntStepType;
  onChange: (type: HuntStepType) => void;
};

export function StepTypePicker({ value, onChange }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {HUNT_STEP_TYPE_OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(option.value)}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 4 },
  chip: {
    ...glassCard,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  chipActive: { backgroundColor: colors.goldSoft, borderColor: colors.gold },
  chipText: { color: colors.textMuted, fontWeight: '700', fontSize: 12 },
  chipTextActive: { color: colors.gold },
});
