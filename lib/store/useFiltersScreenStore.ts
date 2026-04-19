import { usePathname } from 'expo-router';
import { useFeedFiltersStore } from './feedFilters';
import { useSearchFiltersStore } from './searchFilters';

/**
 * Écrans sous `app/filters` : même UI pour Search (`/tabs/search/…`) et pour Results (`/tabs/filters/…`).
 * Les deux hooks Zustand sont toujours appelés (règles React), seule la sortie change.
 */
export function useFiltersScreenStore() {
  const pathname = usePathname().replace(/\/+$/, '');
  const isSearchArea =
    pathname === '/tabs/search' || pathname.startsWith('/tabs/search/');
  const feed = useFeedFiltersStore();
  const search = useSearchFiltersStore();
  return isSearchArea ? search : feed;
}
