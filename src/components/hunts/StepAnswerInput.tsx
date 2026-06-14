import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, glassCard, radii } from '@/src/theme';

type Props = {
  description: string;
  onSubmit: (answer: string) => Promise<void>;
  placeholder?: string;
};

export function StepAnswerInput({ description, onSubmit, placeholder }: Props) {
  const { t } = useTranslation(['hunts', 'common']);
  const resolvedPlaceholder = placeholder ?? t('hunts:stepAnswer.defaultPlaceholder');
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    const trimmed = answer.trim();
    if (!trimmed || submitting || done) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(trimmed);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('hunts:stepAnswer.errorIncorrect'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.description}>{description}</Text>
      <TextInput
        style={styles.input}
        placeholder={resolvedPlaceholder}
        placeholderTextColor={colors.textFaint}
        value={answer}
        onChangeText={setAnswer}
        editable={!done}
        returnKeyType="done"
        onSubmitEditing={() => void handleSubmit()}
      />
      <Pressable
        style={[styles.button, (done || !answer.trim()) && styles.buttonDisabled]}
        onPress={() => void handleSubmit()}
        disabled={submitting || done || !answer.trim()}
      >
        {submitting ? (
          <ActivityIndicator color={colors.background} size="small" />
        ) : (
          <Text style={styles.buttonText}>{done ? t('hunts:stepAnswer.validated') : t('common:submit')}</Text>
        )}
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  description: { color: colors.foreground, fontSize: 16, lineHeight: 24, marginBottom: 20 },
  input: {
    ...glassCard,
    color: colors.foreground,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 14,
  },
  button: {
    backgroundColor: colors.gold,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.background, fontWeight: '900', fontSize: 14 },
  error: { color: colors.danger, marginTop: 12, fontWeight: '700', textAlign: 'center' },
});
