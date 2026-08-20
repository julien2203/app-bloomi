import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'bloomi_search_history_v1';
export const SEARCH_HISTORY_MAX = 8;

function normalizeQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

function persist(items: string[]) {
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

type SearchHistoryState = {
  items: string[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  add: (query: string) => void;
  remove: (query: string) => void;
  clear: () => void;
};

export const useSearchHistoryStore = create<SearchHistoryState>((set, get) => ({
  items: [],
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      const items = Array.isArray(parsed)
        ? parsed
            .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
            .map(normalizeQuery)
            .filter(Boolean)
            .slice(0, SEARCH_HISTORY_MAX)
        : [];
      set({ items, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  add: (query) => {
    const q = normalizeQuery(query);
    if (!q) return;
    const next = [q, ...get().items.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(
      0,
      SEARCH_HISTORY_MAX
    );
    set({ items: next });
    persist(next);
  },

  remove: (query) => {
    const needle = normalizeQuery(query).toLowerCase();
    const next = get().items.filter((x) => x.toLowerCase() !== needle);
    set({ items: next });
    persist(next);
  },

  clear: () => {
    set({ items: [] });
    void AsyncStorage.removeItem(STORAGE_KEY);
  }
}));

export function rememberSearchQuery(query: string) {
  useSearchHistoryStore.getState().add(query);
}
