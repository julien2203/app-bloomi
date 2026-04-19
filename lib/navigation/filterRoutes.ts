import { usePathname } from 'expo-router';

/** Filtres sous la pile Search (retour correct vers Search). */
export const FILTERS_PATH_SEARCH_STACK = '/tabs/search/filters' as const;
/** Filtres au niveau onglets (ex. depuis l’écran Results, pas le tab Search). */
export const FILTERS_PATH_TABS_ROOT = '/tabs/filters' as const;

export type FiltersStackBase =
  | typeof FILTERS_PATH_SEARCH_STACK
  | typeof FILTERS_PATH_TABS_ROOT;

/**
 * Préfixe de routage pour les sous-écrans filtres : reste sur la pile où l’utilisateur a ouvert les filtres.
 */
export function useFiltersStackBase(): FiltersStackBase {
  const pathname = usePathname();
  const normalized = pathname.replace(/\/+$/, '');
  if (
    normalized === FILTERS_PATH_SEARCH_STACK ||
    normalized.startsWith(`${FILTERS_PATH_SEARCH_STACK}/`)
  ) {
    return FILTERS_PATH_SEARCH_STACK;
  }
  return FILTERS_PATH_TABS_ROOT;
}

export function filtersScreenPath(base: FiltersStackBase, segment: string): string {
  const s = segment.replace(/^\/+/, '');
  return `${base}/${s}`;
}
