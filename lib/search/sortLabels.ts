import type { FeedSort } from '../store/feedFilters';

type Translate = (key: string, options?: Record<string, unknown>) => string;

export function getSortShortLabel(sortBy: FeedSort | undefined, t: Translate): string {
  switch (sortBy) {
    case 'price_asc':
      return t('filters.sortPillPriceAsc');
    case 'price_desc':
      return t('filters.sortPillPriceDesc');
    case 'relevance':
      return t('filters.sortRelevance');
    case 'recent':
    default:
      return t('filters.sheetSortRecent');
  }
}

export function getSortPillText(sortBy: FeedSort | undefined, t: Translate): string {
  return t('filters.sortPill', { value: getSortShortLabel(sortBy, t) });
}
