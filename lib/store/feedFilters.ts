import { create } from 'zustand';

export type FeedSort = 'relevance' | 'price_desc' | 'price_asc' | 'newest';

export type FeedFilters = {
  /**
   * Valeur legacy simple pour le genre / catégorie principale
   * (utilisée aujourd'hui par l'API du feed).
   */
  category?: string;
  /**
   * Nouveau format structuré pour les catégories du feed :
   * - gender: femme / homme / enfant / bebe...
   * - categoryIds: IDs des sous-catégories sélectionnées.
   */
  categoryFilter?: {
    gender?: string;
    categoryIds: number[];
  };
  /**
   * Legacy: filtres basés sur les labels.
   * Gardés pour compatibilité, mais les nouveaux écrans
   * stockent aussi les IDs correspondants.
   */
  brands?: string[];
  sizes?: string[];
  colors?: string[];
  /**
   * Nouveaux filtres orientés IDs (Supabase).
   */
  brandIds?: number[];
  sizeIds?: number[];
  colorIds?: number[];
  conditions?: string[];
  /**
   * Legacy: borne min/max à plat.
   */
  priceMin?: number;
  priceMax?: number;
  /**
   * Nouveau format structuré pour le range de prix.
   */
  priceRange?: {
    min?: number;
    max?: number;
  };
  sort?: FeedSort;
};

interface FeedFiltersState {
  filters: FeedFilters;
  setFilters: (
    update: Partial<FeedFilters> | ((prev: FeedFilters) => Partial<FeedFilters>)
  ) => void;
  resetFilters: () => void;
}

const defaultFilters: FeedFilters = {};

export const useFeedFiltersStore = create<FeedFiltersState>((set) => ({
  filters: defaultFilters,
  setFilters: (update) =>
    set((state) => {
      const partial = typeof update === 'function' ? update(state.filters) : update;
      return { filters: { ...state.filters, ...partial } };
    }),
  resetFilters: () => set({ filters: defaultFilters })
}));

