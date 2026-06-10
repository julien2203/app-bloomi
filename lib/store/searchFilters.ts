import { create } from 'zustand';
import type { FeedFilters } from './feedFilters';

/** Même forme que `FeedFilters`, instance de store séparée (onglet Search uniquement). */
export type SearchFilters = FeedFilters;

interface SearchFiltersState {
  filters: FeedFilters;
  setFilter: <K extends keyof FeedFilters>(key: K, value: FeedFilters[K]) => void;
  setFilters: (
    update: Partial<FeedFilters> | ((prev: FeedFilters) => Partial<FeedFilters>)
  ) => void;
  resetFilters: () => void;
}

const defaultFilters: FeedFilters = {
  categoryIds: [],
  brandIds: [],
  sizeIds: [],
  colorIds: [],
  conditionIds: [],
  priceMin: null,
  priceMax: null,
  nearbyKm: null,
  sortBy: 'recent'
};

function cloneDefaultFilters(): FeedFilters {
  return {
    ...defaultFilters,
    categoryIds: [],
    brandIds: [],
    sizeIds: [],
    colorIds: [],
    conditionIds: []
  };
}

export const useSearchFiltersStore = create<SearchFiltersState>((set) => ({
  filters: cloneDefaultFilters(),
  setFilter: (key, value) =>
    set((state) => ({
      filters: {
        ...state.filters,
        [key]: value
      }
    })),
  setFilters: (update) =>
    set((state) => {
      const partial = typeof update === 'function' ? update(state.filters) : update;
      return { filters: { ...state.filters, ...partial } };
    }),
  resetFilters: () => set({ filters: cloneDefaultFilters() })
}));
