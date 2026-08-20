import { Keyboard } from 'react-native';
import type { Router } from 'expo-router';
import {
  resolveSearchSuggestionCategoryIds,
  type SearchSuggestion
} from './activeSuggestions';
import type { SearchCollection } from './collections';
import { useSearchFiltersStore } from '../store/searchFilters';
import { useFeedFiltersStore } from '../store/feedFilters';
import { navigateToBrandFilter } from '../navigation/brandFilterNav';
import { FILTERS_PATH_SEARCH_STACK, filtersScreenPath } from '../navigation/filterRoutes';
import { rememberSearchQuery } from './searchHistory';

export type DiscoveryNavTranslate = (key: string) => string;

/** Navigue vers Search avec une query texte (marque / listing / query libre). */
export function navigateSearchWithQuery(router: Router, query: string) {
  const q = query.trim();
  useSearchFiltersStore.getState().setFilter('categoryIds', []);
  Keyboard.dismiss();
  if (!q) return;
  rememberSearchQuery(q);
  router.push({
    pathname: '/tabs/search' as any,
    params: { query: q }
  });
}

/** Suggestion catégorie → search store + commit sans query. */
export async function navigateSearchFromCategorySuggestion(
  router: Router,
  suggestion: SearchSuggestion,
  t: DiscoveryNavTranslate
) {
  Keyboard.dismiss();
  try {
    const ids = await resolveSearchSuggestionCategoryIds(suggestion);
    useSearchFiltersStore.getState().setFilter('categoryIds', ids);
    router.push({
      pathname: '/tabs/search' as any,
      params: { commit: '1' }
    });
  } catch {
    const fallback = suggestion.labelKey ? t(suggestion.labelKey) : '';
    if (fallback.trim()) {
      navigateSearchWithQuery(router, fallback);
    }
  }
}

/** Depuis le Feed (ou tout écran hors Search) : commit = navigation. */
export async function handleDiscoverySuggestionNavigate(
  router: Router,
  suggestion: SearchSuggestion,
  currentQuery: string,
  t: DiscoveryNavTranslate
) {
  if (
    suggestion.kind === 'query' ||
    suggestion.kind === 'brand' ||
    suggestion.kind === 'listing'
  ) {
    const text = (suggestion.queryText ?? currentQuery).trim();
    navigateSearchWithQuery(router, text);
    return;
  }
  // Suggestions de genre : ouvrir l'écran sélection catégorie avant les résultats.
  if (suggestion.kind === 'gender' && suggestion.gender) {
    Keyboard.dismiss();
    router.push({
      pathname: filtersScreenPath(FILTERS_PATH_SEARCH_STACK, 'category-gender') as any,
      params: {
        gender: suggestion.gender,
        returnTo: 'search'
      }
    });
    return;
  }
  await navigateSearchFromCategorySuggestion(router, suggestion, t);
}

/** Collections éditoriales (Search discovery / Feed overlay). */
export function handleDiscoveryCollectionPress(
  router: Router,
  collection: SearchCollection,
  t: DiscoveryNavTranslate
) {
  Keyboard.dismiss();
  const action = collection.action;
  if (action.type === 'brand_filter') {
    void navigateToBrandFilter(
      router,
      FILTERS_PATH_SEARCH_STACK,
      [],
      { returnTo: 'search' },
      t('filters.brand')
    );
    return;
  }
  if (action.type === 'deals') {
    const feed = useFeedFiltersStore.getState();
    feed.resetFilters();
    feed.setFilters({ priceMax: action.priceMax });
    router.push({
      pathname: '/tabs/results' as any,
      params: {
        section: 'all',
        title: t(collection.titleKey)
      }
    });
    return;
  }
  router.push({
    pathname: '/tabs/results' as any,
    params: {
      section: action.section,
      title: t(collection.titleKey)
    }
  });
}
