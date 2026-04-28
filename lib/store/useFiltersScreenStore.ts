import { useLocalSearchParams, usePathname } from 'expo-router';
import { useFeedFiltersStore } from './feedFilters';
import { useSearchFiltersStore } from './searchFilters';

/**
 * Écrans sous `app/filters` : même UI pour Search (`/tabs/search/…`) et pour Results (`/tabs/filters/…`).
 * Les deux hooks Zustand sont toujours appelés (règles React), seule la sortie change.
 */
export function useFiltersScreenStore() {
  const pathname = usePathname().replace(/\/+$/, '');
  const params = useLocalSearchParams<{ returnTo?: string; from?: string; scope?: string }>();
  const returnTo = typeof params.returnTo === 'string' ? params.returnTo : undefined;
  const scope = typeof params.scope === 'string' ? params.scope : undefined;
  const from = typeof params.from === 'string' ? params.from : undefined;
  const isSearchArea =
    pathname === '/tabs/search' ||
    pathname.startsWith('/tabs/search/') ||
    returnTo === 'search' ||
    scope === 'search' ||
    from === 'feed-search-filters';
  const feed = useFeedFiltersStore();
  const search = useSearchFiltersStore();
  return isSearchArea ? search : feed;
}
