import { create } from 'zustand';

interface DraftMap {
  [storeId: string]: {
    counts: Record<string, number>;
    fieldName: string; // last-used field-name for AddPhotos rows
    generalComments: string;
  };
}

interface DraftState {
  drafts: DraftMap;
  setCount: (storeId: string, name: string, value: number) => void;
  setFieldName: (storeId: string, fieldName: string) => void;
  setGeneralComments: (storeId: string, text: string) => void;
  reset: (storeId: string) => void;
  get: (storeId: string) => DraftMap[string];
}

const empty = (): DraftMap[string] => ({ counts: {}, fieldName: '', generalComments: '' });

export const useDraftStore = create<DraftState>((set, getState) => ({
  drafts: {},
  setCount: (storeId, name, value) =>
    set((s) => ({
      drafts: {
        ...s.drafts,
        [storeId]: {
          ...(s.drafts[storeId] ?? empty()),
          counts: { ...(s.drafts[storeId]?.counts ?? {}), [name]: value },
        },
      },
    })),
  setFieldName: (storeId, fieldName) =>
    set((s) => ({
      drafts: {
        ...s.drafts,
        [storeId]: { ...(s.drafts[storeId] ?? empty()), fieldName },
      },
    })),
  setGeneralComments: (storeId, generalComments) =>
    set((s) => ({
      drafts: {
        ...s.drafts,
        [storeId]: { ...(s.drafts[storeId] ?? empty()), generalComments },
      },
    })),
  reset: (storeId) =>
    set((s) => {
      const next = { ...s.drafts };
      delete next[storeId];
      return { drafts: next };
    }),
  get: (storeId) => getState().drafts[storeId] ?? empty(),
}));
