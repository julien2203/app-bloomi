import { create } from 'zustand';

export type FeedSort = 'recent' | 'price_asc' | 'price_desc' | 'relevance';

export type FeedFilters = {
  categoryId: string | null;
  brandIds: string[];
  sizeIds: string[];
  colorIds: string[];
  conditionIds: string[];
  priceMin: number | null;
  priceMax: number | null;
  nearbyKm: number | null;
  sortBy: FeedSort;
};

interface FeedFiltersState {
  filters: FeedFilters;
  setFilter: <K extends keyof FeedFilters>(key: K, value: FeedFilters[K]) => void;
  setFilters: (
    update: Partial<FeedFilters> | ((prev: FeedFilters) => Partial<FeedFilters>)
  ) => void;
  resetFilters: () => void;
}

const defaultFilters: FeedFilters = {
  categoryId: null,
  brandIds: [],
  sizeIds: [],
  colorIds: [],
  conditionIds: [],
  priceMin: null,
  priceMax: null,
  nearbyKm: null,
  sortBy: 'recent'
};

export const useFeedFiltersStore = create<FeedFiltersState>((set) => ({
  filters: defaultFilters,
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
  resetFilters: () => set({ filters: { ...defaultFilters } })
}));

