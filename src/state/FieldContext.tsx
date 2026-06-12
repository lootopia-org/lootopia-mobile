import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { chaseApi } from '@/src/lib/chase-api';
import type { GeoPoint } from '@/src/lib/geo';

/**
 * Mode Terrain (partner/admin) : brouillons de chasses construits sur site,
 * sauvegardés localement pour être modifiés plus tard ("save hunts to be
 * modified later") puis synchronisés vers l'éditeur web.
 */

export type FieldDraftStep = {
  id: string;
  title: string;
  location: GeoPoint;
  note?: string;
  // Médias capturés sur place (URIs locales expo-camera / expo-audio).
  photoClueUri?: string;
  audioHintUri?: string;
};

export type FieldDraft = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
  steps: FieldDraftStep[];
};

type FieldContextValue = {
  drafts: FieldDraft[];
  createDraft: (title: string) => Promise<FieldDraft>;
  renameDraft: (draftId: string, title: string) => Promise<void>;
  deleteDraft: (draftId: string) => Promise<void>;
  addStep: (draftId: string, step: Omit<FieldDraftStep, 'id'>) => Promise<void>;
  updateStep: (draftId: string, stepId: string, patch: Partial<FieldDraftStep>) => Promise<void>;
  removeStep: (draftId: string, stepId: string) => Promise<void>;
  syncDraft: (draftId: string) => Promise<boolean>;
};

const STORAGE_KEY = 'lootopia-mobile-field-drafts';

const FieldContext = createContext<FieldContextValue | undefined>(undefined);

const makeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function FieldProvider({ children }: { children: React.ReactNode }) {
  const [drafts, setDrafts] = useState<FieldDraft[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          setDrafts(JSON.parse(stored) as FieldDraft[]);
        }
      } catch {
        // état corrompu : on repart à vide
      }
    })();
  }, []);

  const persist = async (next: FieldDraft[]) => {
    setDrafts(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const patchDraft = async (draftId: string, patcher: (draft: FieldDraft) => FieldDraft) => {
    await persist(
      drafts.map((draft) =>
        draft.id === draftId ? { ...patcher(draft), updatedAt: new Date().toISOString(), synced: false } : draft
      )
    );
  };

  const value = useMemo<FieldContextValue>(
    () => ({
      drafts,
      createDraft: async (title) => {
        const now = new Date().toISOString();
        const draft: FieldDraft = { id: makeId(), title, createdAt: now, updatedAt: now, synced: false, steps: [] };
        await persist([draft, ...drafts]);
        return draft;
      },
      renameDraft: (draftId, title) => patchDraft(draftId, (draft) => ({ ...draft, title })),
      deleteDraft: async (draftId) => {
        await persist(drafts.filter((draft) => draft.id !== draftId));
      },
      addStep: (draftId, step) =>
        patchDraft(draftId, (draft) => ({ ...draft, steps: [...draft.steps, { ...step, id: makeId() }] })),
      updateStep: (draftId, stepId, patch) =>
        patchDraft(draftId, (draft) => ({
          ...draft,
          steps: draft.steps.map((step) => (step.id === stepId ? { ...step, ...patch } : step)),
        })),
      removeStep: (draftId, stepId) =>
        patchDraft(draftId, (draft) => ({ ...draft, steps: draft.steps.filter((step) => step.id !== stepId) })),
      // Synchronisation vers l'éditeur web via l'API (fallback mock : succès simulé).
      syncDraft: async (draftId) => {
        const draft = drafts.find((item) => item.id === draftId);
        if (!draft) {
          return false;
        }
        try {
          // Publication directe : la chasse part en "active" (un seul geste,
          // pas d'état brouillon intermédiaire côté serveur). Le brouillon
          // local n'est qu'un espace de travail avant publication.
          await chaseApi.createChase({
            title: draft.title,
            description: `Chasse créée sur le terrain (${draft.steps.length} étapes)`,
            status: 'active',
            steps: draft.steps.map((step, index) => ({
              id: step.id,
              order: index + 1,
              title: step.title,
              description: step.note ?? '',
              clue: step.note ?? '',
              location: step.location,
              completed: false,
              radiusMeters: 30,
              photoClueUri: step.photoClueUri,
              audioHintUri: step.audioHintUri,
            })),
          });
          await persist(drafts.map((item) => (item.id === draftId ? { ...item, synced: true } : item)));
          return true;
        } catch {
          return false;
        }
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drafts]
  );

  return <FieldContext.Provider value={value}>{children}</FieldContext.Provider>;
}

export function useField() {
  const context = useContext(FieldContext);
  if (!context) {
    throw new Error('useField doit être utilisé dans un FieldProvider');
  }
  return context;
}
