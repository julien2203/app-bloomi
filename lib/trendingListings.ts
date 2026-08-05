import { supabase } from './supabase';
import type { FeedListing } from './api';
import type { FeedFilters } from './store/feedFilters';
import { expandConditionFilterValues } from './conditionI18n';

export const TRENDING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const TRENDING_CANDIDATE_LIMIT = 80;

export function trendingScore(views: number, likes: number): number {
  return views + likes * 2;
}

export async function fetchTrendingListings(options?: { limit?: number }): Promise<FeedListing[]> {
  const from = new Date(Date.now() - TRENDING_WINDOW_MS).toISOString();

  const { data: recentListings, error: recentErr } = await supabase
    .from('listings')
    .select('id, views_count')
    .eq('status', 'published')
    .gte('created_at', from)
    .order('created_at', { ascending: false })
    .limit(TRENDING_CANDIDATE_LIMIT);
  if (recentErr) throw recentErr;

  const ids = (recentListings || []).map((r) => String(r.id)).filter(Boolean);
  if (ids.length === 0) return [];

  const viewsById: Record<string, number> = {};
  for (const r of recentListings ?? []) {
    const id = String(r.id);
    const v = typeof r.views_count === 'number' ? r.views_count : Number(r.views_count ?? 0);
    viewsById[id] = Number.isFinite(v) ? v : 0;
  }

  const { data: cards, error: cardsErr } = await supabase
    .from('v_feed_listings')
    .select('*')
    .in('id', ids);
  if (cardsErr) throw cardsErr;

  const rows = (cards || []) as FeedListing[];
  let scored = rows
    .map((r) => {
      const views = viewsById[r.id] ?? 0;
      const likes = typeof r.likes_count === 'number' ? r.likes_count : 0;
      return { r, score: trendingScore(views, likes) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.r);

  if (options?.limit != null) {
    scored = scored.slice(0, options.limit);
  }

  return scored;
}

export function filterTrendingListings(
  listings: FeedListing[],
  opts: {
    filters: FeedFilters;
    brandNames: string[];
    sizeLabels: string[];
    colorNames: string[];
    query?: string;
  }
): FeedListing[] {
  const { filters, brandNames, sizeLabels, colorNames, query = '' } = opts;
  const trimmed = query.trim().toLowerCase();

  return listings.filter((row) => {
    if (filters.categoryIds && filters.categoryIds.length > 0) {
      const allowed = new Set(filters.categoryIds.map((id) => Number(id)));
      if (!allowed.has(Number(row.category_id))) return false;
    }

    if (filters.conditionIds && filters.conditionIds.length > 0) {
      const conditions = expandConditionFilterValues(filters.conditionIds);
      if (conditions.length > 0 && (!row.condition || !conditions.includes(row.condition))) {
        return false;
      }
    }

    if (filters.priceMin != null && row.price < filters.priceMin) return false;
    if (filters.priceMax != null && row.price > filters.priceMax) return false;

    if (brandNames.length > 0) {
      const brand = row.brand != null ? String(row.brand).trim() : '';
      if (!brand || !brandNames.includes(brand)) return false;
    }

    const size = (row as FeedListing & { size?: string | null }).size;
    if (sizeLabels.length > 0) {
      const sizeVal = size != null ? String(size).trim() : '';
      if (!sizeVal || !sizeLabels.includes(sizeVal)) return false;
    }

    const color = (row as FeedListing & { color?: string | null }).color;
    if (colorNames.length > 0) {
      const colorVal = color != null ? String(color).toLowerCase() : '';
      if (!colorVal || !colorNames.some((c) => colorVal.includes(c.toLowerCase()))) return false;
    }

    if (trimmed) {
      const haystack = [row.title, row.description, row.brand]
        .map((x) => (x != null ? String(x).toLowerCase() : ''))
        .join(' ');
      if (!haystack.includes(trimmed)) return false;
    }

    return true;
  });
}
