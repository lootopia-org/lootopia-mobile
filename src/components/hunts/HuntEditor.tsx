import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { chaseApi } from '@/src/lib/chase-api';
import {
  createDefaultStep,
  type HuntDifficulty,
  type HuntForm,
  type HuntStatus,
  type HuntStepForm,
  type HuntStepType,
} from '@/src/lib/hunt-types';
import { PhotoStepReference } from '@/src/components/hunts/PhotoStepReference';
import { StepTypePicker } from '@/src/components/hunts/StepTypePicker';
import { colors, glassCard, glassStrongCard, radii } from '@/src/theme';

type Props = {
  mode: 'create' | 'edit';
  huntId?: string;
  initial: HuntForm;
  partnerId?: string;
  onSaved: (huntId: string) => void;
  onCancel: () => void;
};

const DIFFICULTIES: HuntDifficulty[] = ['easy', 'medium', 'hard'];
const STATUSES: HuntStatus[] = ['draft', 'active'];

function validateForm(form: HuntForm, t: (key: string, options?: Record<string, unknown>) => string): string | null {
  if (form.title.trim().length < 3) {
    return t('validation:huntTitleMin');
  }
  if (form.description.trim().length < 10) {
    return t('validation:huntDescriptionMin');
  }
  if (form.steps.length === 0) {
    return t('validation:huntStepsRequired');
  }
  for (let i = 0; i < form.steps.length; i++) {
    const step = form.steps[i];
    if (!step.title.trim()) {
      return t('validation:stepTitleRequired', { index: i + 1 });
    }
    if (!step.description.trim()) {
      return t('validation:stepDescriptionRequired', { index: i + 1 });
    }
    if (!step.latitude.trim() || !step.longitude.trim()) {
      return t('validation:stepCoordinatesRequired', { index: i + 1 });
    }
    if (step.type === 'photo' && !step.answer?.trim()) {
      return t('validation:stepPhotoReferenceRequired', { index: i + 1 });
    }
  }
  return null;
}

export function HuntEditor({ mode, huntId, initial, partnerId, onSaved, onCancel }: Props) {
  const { t } = useTranslation(['partner', 'common', 'validation']);
  const [form, setForm] = useState<HuntForm>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateForm = (patch: Partial<HuntForm>) => setForm((current) => ({ ...current, ...patch }));

  const updateStep = (index: number, patch: Partial<HuntStepForm>) => {
    setForm((current) => ({
      ...current,
      steps: current.steps.map((step, i) => (i === index ? { ...step, ...patch } : step)),
    }));
  };

  const changeStepType = (index: number, type: HuntStepType) => {
    setForm((current) => ({
      ...current,
      steps: current.steps.map((step, i) =>
        i === index ? { ...step, type, answer: type === 'photo' ? step.answer : undefined } : step
      ),
    }));
  };

  const addStep = async () => {
    let lat: number | undefined;
    let lng: number | undefined;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.granted) {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = position.coords.latitude;
        lng = position.coords.longitude;
      }
    } catch {
      // coords stay empty
    }
    setForm((current) => ({
      ...current,
      steps: [...current.steps, createDefaultStep(current.steps.length + 1, lat, lng)],
    }));
  };

  const removeStep = (index: number) => {
    setForm((current) => ({
      ...current,
      steps: current.steps.filter((_, i) => i !== index).map((step, i) => ({ ...step, order: i + 1 })),
    }));
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= form.steps.length) {
      return;
    }
    setForm((current) => {
      const steps = [...current.steps];
      [steps[index], steps[target]] = [steps[target], steps[index]];
      return { ...current, steps: steps.map((step, i) => ({ ...step, order: i + 1 })) };
    });
  };

  const useCurrentLocation = async (index: number) => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setError(t('common:permissions.locationDenied'));
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      updateStep(index, {
        latitude: String(position.coords.latitude),
        longitude: String(position.coords.longitude),
      });
    } catch {
      setError(t('common:permissions.gpsUnavailable'));
    }
  };

  const handleSave = async () => {
    const validationError = validateForm(form, t);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (mode === 'create') {
        const created = await chaseApi.createChase(form, partnerId);
        onSaved(created.id);
      } else if (huntId) {
        await chaseApi.saveHuntEdit(huntId, form);
        onSaved(huntId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common:errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!huntId) {
      return;
    }
    Alert.alert(t('partner:editor.deleteConfirmTitle'), t('partner:editor.deleteConfirmMessage'), [
      { text: t('common:cancel'), style: 'cancel' },
      {
        text: t('common:delete'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setSaving(true);
            try {
              await chaseApi.deleteChase(huntId);
              onCancel();
            } catch (err) {
              setError(err instanceof Error ? err.message : t('common:errors.deleteFailed'));
            } finally {
              setSaving(false);
            }
          })();
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Pressable onPress={onCancel}>
          <Text style={styles.back}>{t('common:back')}</Text>
        </Pressable>
        <Text style={styles.title}>{mode === 'create' ? t('partner:editor.newHunt') : t('partner:editor.editHunt')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('partner:editor.huntSection')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('common:placeholders.title')}
          placeholderTextColor={colors.textFaint}
          value={form.title}
          onChangeText={(title) => updateForm({ title })}
        />
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder={t('common:placeholders.description')}
          placeholderTextColor={colors.textFaint}
          value={form.description}
          onChangeText={(description) => updateForm({ description })}
          multiline
        />
        <View style={styles.row}>
          <Text style={styles.label}>{t('partner:editor.difficulty')}</Text>
          <View style={styles.chips}>
            {DIFFICULTIES.map((d) => (
              <Pressable
                key={d}
                style={[styles.chip, form.difficulty === d && styles.chipActive]}
                onPress={() => updateForm({ difficulty: d })}
              >
                <Text style={[styles.chipText, form.difficulty === d && styles.chipTextActive]}>
                  {t(`common:difficulty.${d}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{t('partner:editor.durationMinutes')}</Text>
          <TextInput
            style={[styles.input, styles.numberInput]}
            keyboardType="number-pad"
            value={String(form.estimatedDuration)}
            onChangeText={(text) => updateForm({ estimatedDuration: Number(text) || 60 })}
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{t('partner:editor.status')}</Text>
          <View style={styles.chips}>
            {STATUSES.map((s) => (
              <Pressable
                key={s}
                style={[styles.chip, form.status === s && styles.chipActive]}
                onPress={() => updateForm({ status: s })}
              >
                <Text style={[styles.chipText, form.status === s && styles.chipTextActive]}>
                  {t(`common:status.${s}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('partner:editor.stepsSection', { count: form.steps.length })}</Text>
          <Pressable style={styles.addButton} onPress={() => void addStep()}>
            <Text style={styles.addButtonText}>{t('partner:editor.addStep')}</Text>
          </Pressable>
        </View>

        {form.steps.map((step, index) => (
          <View key={step.id ?? `step-${index}`} style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepIndex}>{index + 1}</Text>
              <View style={styles.stepActions}>
                <Pressable onPress={() => moveStep(index, -1)} disabled={index === 0}>
                  <Text style={[styles.stepAction, index === 0 && styles.stepActionDisabled]}>↑</Text>
                </Pressable>
                <Pressable onPress={() => moveStep(index, 1)} disabled={index === form.steps.length - 1}>
                  <Text
                    style={[
                      styles.stepAction,
                      index === form.steps.length - 1 && styles.stepActionDisabled,
                    ]}
                  >
                    ↓
                  </Text>
                </Pressable>
                <Pressable onPress={() => removeStep(index)}>
                  <Text style={styles.stepDelete}>✕</Text>
                </Pressable>
              </View>
            </View>

            <StepTypePicker value={step.type} onChange={(type) => changeStepType(index, type)} />

            <TextInput
              style={styles.input}
              placeholder={t('common:placeholders.title')}
              placeholderTextColor={colors.textFaint}
              value={step.title}
              onChangeText={(title) => updateStep(index, { title })}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t('common:placeholders.description')}
              placeholderTextColor={colors.textFaint}
              value={step.description}
              onChangeText={(description) => updateStep(index, { description })}
              multiline
            />

            <View style={styles.coordRow}>
              <TextInput
                style={[styles.input, styles.coordInput]}
                placeholder={t('common:placeholders.latitude')}
                placeholderTextColor={colors.textFaint}
                value={step.latitude}
                onChangeText={(latitude) => updateStep(index, { latitude })}
                keyboardType="decimal-pad"
              />
              <TextInput
                style={[styles.input, styles.coordInput]}
                placeholder={t('common:placeholders.longitude')}
                placeholderTextColor={colors.textFaint}
                value={step.longitude}
                onChangeText={(longitude) => updateStep(index, { longitude })}
                keyboardType="decimal-pad"
              />
            </View>
            <Pressable style={styles.gpsButton} onPress={() => void useCurrentLocation(index)}>
              <Text style={styles.gpsButtonText}>{t('partner:editor.currentLocation')}</Text>
            </Pressable>

            <View style={styles.row}>
              <Text style={styles.label}>{t('partner:editor.points')}</Text>
              <TextInput
                style={[styles.input, styles.numberInput]}
                keyboardType="number-pad"
                value={String(step.points)}
                onChangeText={(text) => updateStep(index, { points: Number(text) || 10 })}
              />
            </View>

            {(step.type === 'riddle' || step.type === 'qr_code' || step.type === 'clue') && (
              <TextInput
                style={styles.input}
                placeholder={
                  step.type === 'riddle'
                    ? t('common:placeholders.answer')
                    : step.type === 'qr_code'
                      ? t('common:placeholders.qrContent')
                      : t('common:placeholders.hintCode')
                }
                placeholderTextColor={colors.textFaint}
                value={step.answer ?? ''}
                onChangeText={(answer) => updateStep(index, { answer })}
              />
            )}

            {step.type === 'photo' && (
              <PhotoStepReference
                answer={step.answer}
                onAnswerChange={(answer) => updateStep(index, { answer })}
              />
            )}
          </View>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.saveButton} onPress={() => void handleSave()} disabled={saving}>
        {saving ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={styles.saveButtonText}>{mode === 'create' ? t('common:create') : t('common:save')}</Text>
        )}
      </Pressable>

      {mode === 'edit' && huntId ? (
        <Pressable style={styles.deleteButton} onPress={handleDelete} disabled={saving}>
          <Text style={styles.deleteButtonText}>{t('partner:editor.deleteHunt')}</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: 8 },
  back: { color: colors.teal, fontWeight: '700', fontSize: 14 },
  title: { flex: 1, textAlign: 'center', color: colors.foreground, fontWeight: '900', fontSize: 18 },
  headerSpacer: { width: 60 },
  section: { ...glassCard, padding: 16, marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { color: colors.foreground, fontWeight: '800', fontSize: 16, marginBottom: 12 },
  input: {
    ...glassStrongCard,
    color: colors.foreground,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 10,
  },
  textArea: { minHeight: 72, textAlignVertical: 'top' },
  numberInput: { width: 80, marginBottom: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  label: { color: colors.textMuted, fontWeight: '700', fontSize: 13, minWidth: 80 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, flex: 1 },
  chip: {
    borderColor: colors.glassBorder,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.glass,
  },
  chipActive: { backgroundColor: colors.goldSoft, borderColor: colors.gold },
  chipText: { color: colors.textMuted, fontWeight: '700', fontSize: 12 },
  chipTextActive: { color: colors.gold },
  addButton: {
    backgroundColor: colors.tealSoft,
    borderColor: colors.teal,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addButtonText: { color: colors.teal, fontWeight: '800', fontSize: 12 },
  stepCard: { ...glassStrongCard, padding: 12, marginBottom: 12 },
  stepHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  stepIndex: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.goldSoft,
    borderColor: colors.gold,
    borderWidth: 1,
    color: colors.gold,
    fontWeight: '900',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 24,
  },
  stepActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  stepAction: { color: colors.teal, fontWeight: '900', fontSize: 16 },
  stepActionDisabled: { opacity: 0.3 },
  stepDelete: { color: colors.danger, fontWeight: '900', fontSize: 16 },
  coordRow: { flexDirection: 'row', gap: 8 },
  coordInput: { flex: 1 },
  gpsButton: {
    borderColor: colors.teal,
    borderWidth: 1,
    borderRadius: radii.md,
    backgroundColor: colors.tealSoft,
    paddingVertical: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  gpsButtonText: { color: colors.teal, fontWeight: '800', fontSize: 12 },
  error: { color: colors.danger, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  saveButton: {
    backgroundColor: colors.gold,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  saveButtonText: { color: colors.background, fontWeight: '900', fontSize: 15 },
  deleteButton: { alignItems: 'center', paddingVertical: 12 },
  deleteButtonText: { color: colors.danger, fontWeight: '700', fontSize: 13, textDecorationLine: 'underline' },
});
