import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import MapView, { Circle, PROVIDER_DEFAULT } from 'react-native-maps';
import { useAuth } from '@/src/state/AuthContext';
import { useField, type FieldDraft, type FieldDraftStep } from '@/src/state/FieldContext';
import { useLiveOps } from '@/src/state/LiveOpsContext';
import { chaseApi, type Chase } from '@/src/lib/chase-api';
import { clearHeatmap, getHeatCells, type HeatCell } from '@/src/lib/heatmap';
import type { GeoPoint } from '@/src/lib/geo';
import { colors, darkMapStyle, glassCard, glassStrongCard, radii } from '@/src/theme';
import { PhotoClueCapture } from '@/src/components/field/PhotoClueCapture';
import { AudioHintRecorder } from '@/src/components/field/AudioHintRecorder';

/**
 * Mode Terrain (partner/admin) :
 * 1. Brouillons — construire une chasse sur site (étapes GPS + photo secrète + indice audio),
 *    sauvegardée localement puis synchronisée vers l'éditeur web.
 * 2. Live ops — pause d'urgence / redirection d'étape sur les chasses actives.
 * 3. Heatmap — densité des passages joueurs enregistrés sur cet appareil.
 */

type Section = 'drafts' | 'liveops' | 'heatmap';

const SECTIONS: Array<{ key: Section; label: string }> = [
  { key: 'drafts', label: 'Brouillons' },
  { key: 'liveops', label: 'Live ops' },
  { key: 'heatmap', label: 'Heatmap' },
];

const HEATMAP_FALLBACK_CENTER: GeoPoint = { latitude: 37.8044, longitude: -122.2712 };

const getCurrentPoint = async (): Promise<GeoPoint | null> => {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    return null;
  }
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { latitude: position.coords.latitude, longitude: position.coords.longitude };
};

const formatUpdatedAt = (iso: string) => {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export default function FieldScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [section, setSection] = useState<Section>('drafts');

  const allowed = user?.role === 'partner' || user?.role === 'admin';

  if (!allowed) {
    return (
      <View style={[styles.container, styles.blockedContainer, { paddingTop: insets.top + 16 }]}>
        <View style={styles.blockedCard}>
          <Text style={styles.blockedIcon}>🔒</Text>
          <Text style={styles.blockedTitle}>Réservé aux partenaires</Text>
          <Text style={styles.blockedText}>
            Le mode Terrain est réservé aux comptes partenaire et administrateur. Connecte-toi avec un
            compte organisateur pour y accéder.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32, paddingHorizontal: 16 }}
    >
      <Text style={styles.header}>🧭 Terrain</Text>
      <Text style={styles.subheader}>Outils organisateur sur site</Text>

      {/* Segmented control */}
      <View style={styles.segments}>
        {SECTIONS.map(({ key, label }) => {
          const active = section === key;
          return (
            <Pressable
              key={key}
              style={[styles.segment, active && styles.segmentActive]}
              onPress={() => setSection(key)}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {section === 'drafts' ? <DraftsSection /> : null}
      {section === 'liveops' ? <LiveOpsSection /> : null}
      {section === 'heatmap' ? <HeatmapSection /> : null}
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */
/* 1. Brouillons                                                       */
/* ------------------------------------------------------------------ */

function DraftsSection() {
  const { drafts, createDraft, renameDraft, deleteDraft, addStep, updateStep, removeStep, syncDraft } =
    useField();
  const [newTitle, setNewTitle] = useState('');
  const [expandedDraftId, setExpandedDraftId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<Record<string, 'pending' | 'success' | 'error'>>({});
  const [droppingDraftId, setDroppingDraftId] = useState<string | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);

  const handleCreate = async () => {
    const title = newTitle.trim();
    if (!title) {
      return;
    }
    const draft = await createDraft(title);
    setNewTitle('');
    setExpandedDraftId(draft.id);
  };

  const handleSync = async (draftId: string) => {
    setSyncStatus((status) => ({ ...status, [draftId]: 'pending' }));
    const ok = await syncDraft(draftId);
    setSyncStatus((status) => ({ ...status, [draftId]: ok ? 'success' : 'error' }));
  };

  const handleDropStep = async (draft: FieldDraft) => {
    setDropError(null);
    setDroppingDraftId(draft.id);
    try {
      const point = await getCurrentPoint();
      if (!point) {
        setDropError('Permission localisation refusée.');
        return;
      }
      await addStep(draft.id, { title: `Étape ${draft.steps.length + 1}`, location: point });
    } catch {
      setDropError('Position GPS indisponible — réessaie en extérieur.');
    } finally {
      setDroppingDraftId(null);
    }
  };

  return (
    <View>
      <Text style={styles.sectionHint}>
        Construis une chasse sur place, sauvegarde-la pour la retravailler plus tard, puis envoie-la vers
        l'éditeur web.
      </Text>

      {/* Création */}
      <View style={styles.createRow}>
        <TextInput
          style={styles.createInput}
          placeholder="Titre du nouveau brouillon…"
          placeholderTextColor={colors.textFaint}
          value={newTitle}
          onChangeText={setNewTitle}
          onSubmitEditing={() => void handleCreate()}
          returnKeyType="done"
        />
        <Pressable
          style={[styles.ctaButton, !newTitle.trim() && styles.ctaButtonDisabled]}
          onPress={() => void handleCreate()}
          disabled={!newTitle.trim()}
        >
          <Text style={styles.ctaText}>Créer</Text>
        </Pressable>
      </View>

      {drafts.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            Aucun brouillon pour le moment. Crée-en un, puis dépose des étapes là où tu te trouves.
          </Text>
        </View>
      ) : null}

      {drafts.map((draft) => {
        const expanded = expandedDraftId === draft.id;
        const status = syncStatus[draft.id];
        return (
          <View key={draft.id} style={styles.card}>
            <Pressable onPress={() => setExpandedDraftId(expanded ? null : draft.id)}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {draft.title}
                </Text>
                <View style={[styles.badge, draft.synced ? styles.badgeSynced : styles.badgeLocal]}>
                  <Text style={[styles.badgeText, draft.synced ? styles.badgeTextSynced : styles.badgeTextLocal]}>
                    {draft.synced ? 'Synchronisé' : 'Local'}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardMeta}>
                {draft.steps.length} étape{draft.steps.length > 1 ? 's' : ''} · MAJ {formatUpdatedAt(draft.updatedAt)}
                {' · '}
                <Text style={styles.cardMetaAccent}>{expanded ? 'replier ▲' : 'déplier ▼'}</Text>
              </Text>
            </Pressable>

            {expanded ? (
              <View style={styles.draftBody}>
                {/* Renommage */}
                <InlineTitleInput
                  key={`title-${draft.id}`}
                  value={draft.title}
                  placeholder="Titre du brouillon"
                  onCommit={(title) => void renameDraft(draft.id, title)}
                />

                {/* Étapes */}
                {draft.steps.map((step, index) => (
                  <DraftStepCard
                    key={step.id}
                    step={step}
                    index={index}
                    onRename={(title) => void updateStep(draft.id, step.id, { title })}
                    onRemove={() => void removeStep(draft.id, step.id)}
                    onPhotoCaptured={(uri) => void updateStep(draft.id, step.id, { photoClueUri: uri })}
                    onAudioRecorded={(uri) => void updateStep(draft.id, step.id, { audioHintUri: uri })}
                  />
                ))}

                {/* Déposer une étape ici */}
                <Pressable
                  style={styles.dropButton}
                  onPress={() => void handleDropStep(draft)}
                  disabled={droppingDraftId === draft.id}
                >
                  {droppingDraftId === draft.id ? (
                    <ActivityIndicator size="small" color={colors.background} />
                  ) : (
                    <Text style={styles.dropButtonText}>📍 Déposer une étape ici</Text>
                  )}
                </Pressable>
                {dropError && droppingDraftId === null ? <Text style={styles.errorText}>{dropError}</Text> : null}

                {/* Sync + suppression */}
                <Pressable
                  style={styles.syncButton}
                  onPress={() => void handleSync(draft.id)}
                  disabled={status === 'pending'}
                >
                  {status === 'pending' ? (
                    <ActivityIndicator size="small" color={colors.teal} />
                  ) : (
                    <Text style={styles.syncButtonText}>⤴ Synchroniser vers l'éditeur web</Text>
                  )}
                </Pressable>
                {status === 'success' ? (
                  <Text style={styles.syncSuccess}>✓ Brouillon envoyé vers l'éditeur web</Text>
                ) : null}
                {status === 'error' ? (
                  <Text style={styles.errorText}>Échec de la synchronisation — réessaie plus tard.</Text>
                ) : null}

                <Pressable onPress={() => void deleteDraft(draft.id)}>
                  <Text style={styles.deleteDraft}>Supprimer ce brouillon</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function DraftStepCard({
  step,
  index,
  onRename,
  onRemove,
  onPhotoCaptured,
  onAudioRecorded,
}: {
  step: FieldDraftStep;
  index: number;
  onRename: (title: string) => void;
  onRemove: () => void;
  onPhotoCaptured: (uri: string) => void;
  onAudioRecorded: (uri: string) => void;
}) {
  return (
    <View style={styles.stepCard}>
      <View style={styles.stepHeaderRow}>
        <Text style={styles.stepIndex}>{index + 1}</Text>
        <View style={styles.stepTitleWrap}>
          <InlineTitleInput value={step.title} placeholder={`Étape ${index + 1}`} onCommit={onRename} compact />
          <Text style={styles.stepCoords}>
            {step.location.latitude.toFixed(5)}, {step.location.longitude.toFixed(5)}
          </Text>
        </View>
        <Pressable onPress={onRemove} hitSlop={8}>
          <Text style={styles.stepDelete}>✕</Text>
        </Pressable>
      </View>
      <PhotoClueCapture
        stepLocation={step.location}
        photoClueUri={step.photoClueUri}
        onCaptured={onPhotoCaptured}
      />
      <AudioHintRecorder audioHintUri={step.audioHintUri} onRecorded={onAudioRecorded} />
    </View>
  );
}

function InlineTitleInput({
  value,
  placeholder,
  onCommit,
  compact,
}: {
  value: string;
  placeholder: string;
  onCommit: (title: string) => void;
  compact?: boolean;
}) {
  const [text, setText] = useState(value);
  return (
    <TextInput
      style={[styles.inlineInput, compact && styles.inlineInputCompact]}
      value={text}
      placeholder={placeholder}
      placeholderTextColor={colors.textFaint}
      onChangeText={setText}
      onEndEditing={() => {
        const trimmed = text.trim();
        if (trimmed && trimmed !== value) {
          onCommit(trimmed);
        } else {
          setText(value);
        }
      }}
      returnKeyType="done"
    />
  );
}

/* ------------------------------------------------------------------ */
/* 2. Live ops                                                         */
/* ------------------------------------------------------------------ */

function LiveOpsSection() {
  const { setHuntLivePaused, setStepPaused, setStepRedirect, clearStepRedirect, getStepOverride, isHuntLivePaused } =
    useLiveOps();
  const [chases, setChases] = useState<Chase[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedChaseId, setExpandedChaseId] = useState<string | null>(null);
  const [redirectingStepId, setRedirectingStepId] = useState<string | null>(null);
  const [redirectError, setRedirectError] = useState<string | null>(null);

  useEffect(() => {
    chaseApi
      .getChases()
      .then((all) => setChases(all.filter((chase) => chase.status === 'active')))
      .catch(() => setChases([]))
      .finally(() => setLoading(false));
  }, []);

  const handleRedirect = async (huntId: string, stepId: string) => {
    setRedirectError(null);
    setRedirectingStepId(stepId);
    try {
      const point = await getCurrentPoint();
      if (!point) {
        setRedirectError('Permission localisation refusée.');
        return;
      }
      await setStepRedirect(huntId, stepId, point, "Point déplacé par l'organisateur");
    } catch {
      setRedirectError('Position GPS indisponible.');
    } finally {
      setRedirectingStepId(null);
    }
  };

  return (
    <View>
      <Text style={styles.sectionHint}>
        Pause d'urgence et redirection d'étape sur les chasses actives (travaux, danger, événement…).
      </Text>

      {loading ? <ActivityIndicator color={colors.teal} style={{ marginTop: 24 }} /> : null}
      {!loading && chases.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Aucune chasse active pour le moment.</Text>
        </View>
      ) : null}

      {chases.map((chase) => {
        const paused = isHuntLivePaused(chase.id);
        const expanded = expandedChaseId === chase.id;
        return (
          <View key={chase.id} style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {chase.title}
              </Text>
              {paused ? (
                <View style={[styles.badge, styles.badgePaused]}>
                  <Text style={[styles.badgeText, styles.badgeTextPaused]}>En pause</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.cardMeta}>
              {chase.steps.length} étape{chase.steps.length > 1 ? 's' : ''} · {chase.participants} participants
            </Text>

            <Pressable
              style={[styles.pauseHuntButton, paused && styles.pauseHuntButtonActive]}
              onPress={() => void setHuntLivePaused(chase.id, !paused)}
            >
              <Text style={[styles.pauseHuntText, paused && styles.pauseHuntTextActive]}>
                {paused ? '▶ Reprendre la chasse' : '⏸ Suspendre la chasse'}
              </Text>
            </Pressable>

            <Pressable onPress={() => setExpandedChaseId(expanded ? null : chase.id)}>
              <Text style={styles.expandSteps}>{expanded ? 'Masquer les étapes ▲' : 'Gérer les étapes ▼'}</Text>
            </Pressable>

            {expanded
              ? chase.steps.map((step) => {
                  const override = getStepOverride(chase.id, step.id);
                  const stepPaused = Boolean(override?.paused);
                  const redirected = Boolean(override?.redirect);
                  return (
                    <View key={step.id} style={styles.liveStepCard}>
                      <View style={styles.stepHeaderRow}>
                        <Text style={styles.stepIndex}>{step.order}</Text>
                        <View style={styles.stepTitleWrap}>
                          <Text style={styles.liveStepTitle} numberOfLines={1}>
                            {step.title}
                          </Text>
                          {redirected ? (
                            <Text style={styles.redirectedLabel}>
                              → redirigée ({override?.redirect?.location.latitude.toFixed(5)},{' '}
                              {override?.redirect?.location.longitude.toFixed(5)})
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      <View style={styles.liveStepActions}>
                        <Pressable
                          style={[styles.smallAction, stepPaused && styles.smallActionPausedActive]}
                          onPress={() => void setStepPaused(chase.id, step.id, !stepPaused)}
                        >
                          <Text style={[styles.smallActionText, stepPaused && styles.smallActionTextPaused]}>
                            {stepPaused ? "▶ Reprendre l'étape" : "⏸ Suspendre l'étape"}
                          </Text>
                        </Pressable>
                        {redirected ? (
                          <Pressable
                            style={styles.smallAction}
                            onPress={() => void clearStepRedirect(chase.id, step.id)}
                          >
                            <Text style={styles.smallActionTextTeal}>Annuler la redirection</Text>
                          </Pressable>
                        ) : (
                          <Pressable
                            style={styles.smallAction}
                            onPress={() => void handleRedirect(chase.id, step.id)}
                            disabled={redirectingStepId === step.id}
                          >
                            {redirectingStepId === step.id ? (
                              <ActivityIndicator size="small" color={colors.teal} />
                            ) : (
                              <Text style={styles.smallActionTextTeal}>📍 Rediriger ici</Text>
                            )}
                          </Pressable>
                        )}
                      </View>
                    </View>
                  );
                })
              : null}
            {expanded && redirectError ? <Text style={styles.errorText}>{redirectError}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Heatmap joueurs                                                  */
/* ------------------------------------------------------------------ */

function HeatmapSection() {
  const [cells, setCells] = useState<HeatCell[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    setLoading(true);
    getHeatCells()
      .then(setCells)
      .catch(() => setCells([]))
      .finally(() => setLoading(false));
  };

  useEffect(reload, []);

  const handleClear = async () => {
    await clearHeatmap();
    setCells([]);
  };

  const center = cells[0] ?? HEATMAP_FALLBACK_CENTER;
  const totalPoints = cells.reduce((sum, cell) => sum + cell.weight, 0);

  return (
    <View>
      <Text style={styles.sectionHint}>
        Densité des passages des joueurs pendant le jeu — utile pour repérer les zones où ils se perdent.
      </Text>

      <View style={styles.mapCard}>
        <MapView
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          customMapStyle={darkMapStyle}
          initialRegion={{
            latitude: center.latitude,
            longitude: center.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }}
        >
          {cells.map((cell, index) => (
            <Circle
              key={`${cell.latitude}-${cell.longitude}-${index}`}
              center={{ latitude: cell.latitude, longitude: cell.longitude }}
              radius={Math.min(30 + cell.weight * 10, 80)}
              fillColor={`rgba(212, 175, 55, ${Math.min(0.12 + cell.weight * 0.06, 0.5)})`}
              strokeColor="transparent"
            />
          ))}
        </MapView>
      </View>

      <View style={styles.heatStatsRow}>
        <View style={styles.heatStat}>
          <Text style={styles.heatStatValue}>{cells.length}</Text>
          <Text style={styles.heatStatLabel}>Cellules</Text>
        </View>
        <View style={styles.heatStat}>
          <Text style={[styles.heatStatValue, { color: colors.gold }]}>{totalPoints}</Text>
          <Text style={styles.heatStatLabel}>Points enregistrés</Text>
        </View>
      </View>

      {loading ? <ActivityIndicator color={colors.teal} style={{ marginTop: 12 }} /> : null}
      {!loading && cells.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            Aucune donnée pour l'instant — les positions sont collectées pendant les sessions de jeu.
          </Text>
        </View>
      ) : null}

      <Pressable style={styles.clearButton} onPress={() => void handleClear()}>
        <Text style={styles.clearButtonText}>Effacer les données</Text>
      </Pressable>
      <Text style={styles.heatNote}>Données locales de cet appareil (prototype).</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { fontSize: 28, fontWeight: '900', color: colors.foreground },
  subheader: { color: colors.textMuted, fontSize: 13, marginTop: 4, marginBottom: 16 },

  blockedContainer: { paddingHorizontal: 16, justifyContent: 'center' },
  blockedCard: { ...glassStrongCard, padding: 28, alignItems: 'center' },
  blockedIcon: { fontSize: 40 },
  blockedTitle: { color: colors.foreground, fontSize: 18, fontWeight: '900', marginTop: 12 },
  blockedText: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 19 },

  segments: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  segment: {
    flex: 1,
    borderColor: colors.glassBorder,
    borderWidth: 1,
    borderRadius: radii.pill,
    backgroundColor: colors.glass,
    paddingVertical: 9,
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: colors.goldSoft, borderColor: colors.gold },
  segmentText: { color: colors.textMuted, fontWeight: '800', fontSize: 13 },
  segmentTextActive: { color: colors.gold },

  sectionHint: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 14 },
  emptyCard: { ...glassCard, padding: 20, marginTop: 4, marginBottom: 12 },
  emptyText: { color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  errorText: { color: colors.danger, fontSize: 12, marginTop: 8 },

  /* Brouillons */
  createRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  createInput: {
    ...glassCard,
    flex: 1,
    color: colors.foreground,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  ctaButton: {
    backgroundColor: colors.gold,
    borderRadius: radii.lg,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  ctaButtonDisabled: { opacity: 0.4 },
  ctaText: { color: colors.background, fontWeight: '900', fontSize: 13 },

  card: { ...glassCard, padding: 16, marginBottom: 12 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { color: colors.foreground, fontSize: 16, fontWeight: '900', flexShrink: 1 },
  cardMeta: { color: colors.textMuted, fontSize: 12, marginTop: 5 },
  cardMetaAccent: { color: colors.teal, fontWeight: '700' },

  badge: { borderRadius: radii.pill, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 3 },
  badgeSynced: { backgroundColor: colors.tealSoft, borderColor: colors.teal },
  badgeLocal: { backgroundColor: colors.goldSoft, borderColor: colors.gold },
  badgePaused: { backgroundColor: 'rgba(248,113,113,0.12)', borderColor: colors.danger },
  badgeText: { fontSize: 10, fontWeight: '800' },
  badgeTextSynced: { color: colors.teal },
  badgeTextLocal: { color: colors.gold },
  badgeTextPaused: { color: colors.danger },

  draftBody: { marginTop: 12, gap: 10 },
  inlineInput: {
    ...glassCard,
    color: colors.foreground,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    fontWeight: '700',
  },
  inlineInputCompact: { paddingVertical: 6, fontSize: 13, borderRadius: radii.sm },

  stepCard: { ...glassStrongCard, padding: 12 },
  stepHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
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
    overflow: 'hidden',
  },
  stepTitleWrap: { flex: 1 },
  stepCoords: { color: colors.textFaint, fontSize: 10, marginTop: 3 },
  stepDelete: { color: colors.danger, fontSize: 16, fontWeight: '900', paddingHorizontal: 4 },

  dropButton: {
    backgroundColor: colors.gold,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dropButtonText: { color: colors.background, fontWeight: '900', fontSize: 13 },
  syncButton: {
    borderColor: colors.teal,
    borderWidth: 1,
    borderRadius: radii.md,
    backgroundColor: colors.tealSoft,
    paddingVertical: 11,
    alignItems: 'center',
  },
  syncButtonText: { color: colors.teal, fontWeight: '800', fontSize: 13 },
  syncSuccess: { color: colors.success, fontSize: 12, fontWeight: '700' },
  deleteDraft: { color: colors.textFaint, fontSize: 11, textDecorationLine: 'underline', marginTop: 2 },

  /* Live ops */
  pauseHuntButton: {
    marginTop: 12,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radii.md,
    backgroundColor: 'rgba(248,113,113,0.08)',
    paddingVertical: 11,
    alignItems: 'center',
  },
  pauseHuntButtonActive: { backgroundColor: colors.tealSoft, borderColor: colors.teal },
  pauseHuntText: { color: colors.danger, fontWeight: '800', fontSize: 13 },
  pauseHuntTextActive: { color: colors.teal },
  expandSteps: { color: colors.teal, fontWeight: '800', fontSize: 12, marginTop: 12 },

  liveStepCard: { ...glassStrongCard, padding: 12, marginTop: 10 },
  liveStepTitle: { color: colors.foreground, fontSize: 13, fontWeight: '800' },
  redirectedLabel: { color: colors.gold, fontSize: 11, fontWeight: '700', marginTop: 3 },
  liveStepActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  smallAction: {
    borderColor: colors.glassBorderStrong,
    borderWidth: 1,
    borderRadius: radii.pill,
    backgroundColor: colors.glass,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  smallActionPausedActive: { backgroundColor: 'rgba(248,113,113,0.12)', borderColor: colors.danger },
  smallActionText: { color: colors.textMuted, fontWeight: '800', fontSize: 11 },
  smallActionTextPaused: { color: colors.danger },
  smallActionTextTeal: { color: colors.teal, fontWeight: '800', fontSize: 11 },

  /* Heatmap */
  mapCard: { ...glassCard, overflow: 'hidden', marginBottom: 12 },
  map: { height: 320, width: '100%' },
  heatStatsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  heatStat: { ...glassCard, flex: 1, paddingVertical: 14, alignItems: 'center' },
  heatStatValue: { color: colors.foreground, fontSize: 22, fontWeight: '900' },
  heatStatLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginTop: 4 },
  clearButton: {
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radii.md,
    backgroundColor: 'rgba(248,113,113,0.08)',
    paddingVertical: 12,
    alignItems: 'center',
  },
  clearButtonText: { color: colors.danger, fontWeight: '800', fontSize: 13 },
  heatNote: { color: colors.textFaint, fontSize: 11, textAlign: 'center', marginTop: 10 },
});
