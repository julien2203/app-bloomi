import {
  getDescendantCategoryIds,
  getLuxuryCategoryTreeIds,
  getRootCategoriesByGender
} from '../api/filters';
import { UI_TO_DB_GENDER, type FilterGenderKey } from '../filterGenderParams';
import { supabase } from '../supabase';

export type SearchSuggestionKind =
  | 'gender'
  | 'product'
  | 'luxury'
  | 'query'
  | 'brand'
  | 'listing';

export type SearchSuggestion = {
  id: string;
  kind: SearchSuggestionKind;
  /** Clé i18n `filters.searchSuggestions.*` (sauf `query`). */
  labelKey?: string;
  /** Libellé libre pour une recherche texte (`kind: 'query'`). */
  queryText?: string;
  gender?: FilterGenderKey;
  /** Match racines catalogue : slug contient cette clé (ex. `sacs`, `chaussures`). */
  slugIncludes?: string;
};

/** Suggestions statiques (maquette Search active). */
export const SEARCH_ACTIVE_SUGGESTIONS: SearchSuggestion[] = [
  { id: 'women', labelKey: 'filters.searchSuggestions.women', kind: 'gender', gender: 'Woman' },
  { id: 'men', labelKey: 'filters.searchSuggestions.men', kind: 'gender', gender: 'Men' },
  { id: 'kids', labelKey: 'filters.searchSuggestions.kids', kind: 'gender', gender: 'Kids' },
  {
    id: 'bags',
    labelKey: 'filters.searchSuggestions.bags',
    kind: 'product',
    slugIncludes: 'sacs'
  },
  {
    id: 'shoes',
    labelKey: 'filters.searchSuggestions.shoes',
    kind: 'product',
    slugIncludes: 'chaussures'
  },
  {
    id: 'luxury',
    labelKey: 'filters.searchSuggestions.luxury',
    kind: 'luxury'
  }
];

/**
 * Suggestions affichées :
 * - champ vide → catégories statiques
 * - texte saisi → ligne « Rechercher “…” » + catégories dont le libellé matche
 */
export function buildSearchSuggestions(
  suggestions: SearchSuggestion[],
  query: string,
  translate: (key: string) => string
): SearchSuggestion[] {
  const q = query.trim();
  const categoryMatches = !q
    ? suggestions
    : suggestions.filter((s) => {
        const label = translate(s.labelKey ?? '').toLowerCase();
        return label.includes(q.toLowerCase()) || s.id.includes(q.toLowerCase());
      });

  if (!q) return categoryMatches;

  const querySuggestion: SearchSuggestion = {
    id: `query:${q.toLowerCase()}`,
    kind: 'query',
    queryText: q
  };
  return [querySuggestion, ...categoryMatches];
}

/** Résout les `categoryIds` pour une suggestion (arbre + descendants). */
export async function resolveSearchSuggestionCategoryIds(
  suggestion: SearchSuggestion
): Promise<string[]> {
  if (suggestion.kind === 'query' || suggestion.kind === 'brand' || suggestion.kind === 'listing') {
    return [];
  }
  if (suggestion.kind === 'luxury') {
    return getLuxuryCategoryTreeIds();
  }

  if (suggestion.kind === 'gender' && suggestion.gender) {
    const roots = await getRootCategoriesByGender(UI_TO_DB_GENDER[suggestion.gender]);
    return getDescendantCategoryIds((roots as { id: string | number }[]).map((r) => r.id));
  }

  if (suggestion.kind === 'product' && suggestion.slugIncludes) {
    const needle = suggestion.slugIncludes.toLowerCase();
    const { data } = await supabase
      .from('categories')
      .select('id, slug, parent_id')
      .is('parent_id', null);
    const roots = ((data ?? []) as { id: string | number; slug?: string | null }[]).filter((row) =>
      String(row.slug ?? '')
        .toLowerCase()
        .includes(needle)
    );
    if (roots.length === 0) return [];
    return getDescendantCategoryIds(roots.map((r) => r.id));
  }

  return [];
}
