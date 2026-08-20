import { supabase } from '../supabase';
import { translateCategoryLabel } from '../categoryI18n';
import {
  buildSearchSuggestions,
  SEARCH_ACTIVE_SUGGESTIONS,
  type SearchSuggestion
} from './activeSuggestions';
import type { TFunction } from 'i18next';

const MIN_QUERY_LEN = 2;
const MAX_BRANDS = 5;
const MAX_COMBOS = 4;
const MAX_TITLES = 3;
const MAX_TOTAL = 10;

function escapeIlike(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function normalizeKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function cleanTitleSuggestion(title: string): string | null {
  let t = String(title ?? '')
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
    .replace(/\s*[–—|-].*$/, '')
    .replace(/\s*Taille\s+\S+/i, '')
    .replace(/\s*T\.\s*\d+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length < 2) return null;
  if (t.length > 48) t = `${t.slice(0, 45).trim()}…`;
  return t;
}

function dedupePush(
  out: SearchSuggestion[],
  seen: Set<string>,
  item: SearchSuggestion
) {
  const key = normalizeKey(item.queryText ?? item.id);
  if (!key || seen.has(key)) return;
  seen.add(key);
  out.push(item);
}

/**
 * Suggestions « profondes » à partir de la saisie :
 * 1) marques (za → Zara)
 * 2) combos catégorie + marque (Zara → Jeans Zara)
 * 3) titres d’annonces proches
 * + toujours la ligne « Rechercher “…” » et les raccourcis catégories qui matchent.
 */
export async function fetchDeepSearchSuggestions(
  query: string,
  translate: TFunction
): Promise<SearchSuggestion[]> {
  const q = query.trim();
  const base = buildSearchSuggestions(SEARCH_ACTIVE_SUGGESTIONS, q, translate);
  if (q.length < MIN_QUERY_LEN) return base;

  const qNorm = normalizeKey(q);
  const pattern = escapeIlike(q);
  const seen = new Set<string>();
  const deep: SearchSuggestion[] = [];

  // Garde la ligne « Rechercher … » en tête
  const queryRow = base.find((s) => s.kind === 'query');
  if (queryRow) dedupePush(deep, seen, queryRow);

  try {
    const [brandsRes, listingsRes] = await Promise.all([
      supabase
        .from('brands')
        .select('name')
        .ilike('name', `${pattern}%`)
        .limit(40),
      supabase
        .from('v_feed_listings')
        .select('title, brand, category')
        .or(
          `title.ilike.%${pattern}%,brand.ilike.%${pattern}%,category.ilike.%${pattern}%`
        )
        .limit(40)
    ]);

    // Marques uniques (préfixe d’abord)
    const brandNames: string[] = [];
    const brandSeen = new Set<string>();
    for (const row of (brandsRes.data ?? []) as { name?: string | null }[]) {
      const name = String(row.name ?? '').trim();
      const key = normalizeKey(name);
      if (!name || !key || brandSeen.has(key)) continue;
      brandSeen.add(key);
      brandNames.push(name);
      if (brandNames.length >= MAX_BRANDS) break;
    }

    // Si peu de préfixes, compléter par contains via les listings
    if (brandNames.length < MAX_BRANDS) {
      for (const row of (listingsRes.data ?? []) as {
        brand?: string | null;
      }[]) {
        const name = String(row.brand ?? '').trim();
        const key = normalizeKey(name);
        if (!name || !key || brandSeen.has(key)) continue;
        if (!key.includes(qNorm)) continue;
        brandSeen.add(key);
        brandNames.push(name);
        if (brandNames.length >= MAX_BRANDS) break;
      }
    }

    for (const name of brandNames) {
      dedupePush(deep, seen, {
        id: `brand:${normalizeKey(name)}`,
        kind: 'brand',
        queryText: name
      });
    }

    // Marque « forte » : exacte ou préfixe quasi-complet → combos catégorie + marque
    const strongBrand =
      brandNames.find((n) => normalizeKey(n) === qNorm) ??
      (qNorm.length >= 3
        ? brandNames.find((n) => normalizeKey(n).startsWith(qNorm))
        : undefined);

    if (strongBrand) {
      const { data: brandListings } = await supabase
        .from('v_feed_listings')
        .select('title, brand, category')
        .ilike('brand', strongBrand)
        .limit(50);

      const catCounts = new Map<string, number>();
      for (const row of (brandListings ?? []) as {
        category?: string | null;
      }[]) {
        const cat = String(row.category ?? '').trim();
        if (!cat) continue;
        catCounts.set(cat, (catCounts.get(cat) ?? 0) + 1);
      }
      const topCats = [...catCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_COMBOS)
        .map(([cat]) => cat);

      for (const cat of topCats) {
        const catLabel = translateCategoryLabel(cat, translate);
        const combo = `${catLabel} ${strongBrand}`;
        dedupePush(deep, seen, {
          id: `combo:${normalizeKey(combo)}`,
          kind: 'listing',
          queryText: combo
        });
      }
    }

    // Titres d’annonces utiles (hors marque seule)
    let titleCount = 0;
    for (const row of (listingsRes.data ?? []) as {
      title?: string | null;
      brand?: string | null;
    }[]) {
      if (titleCount >= MAX_TITLES) break;
      const cleaned = cleanTitleSuggestion(String(row.title ?? ''));
      if (!cleaned) continue;
      const key = normalizeKey(cleaned);
      if (key === qNorm) continue;
      if (brandNames.some((b) => normalizeKey(b) === key)) continue;
      dedupePush(deep, seen, {
        id: `title:${key}`,
        kind: 'listing',
        queryText: cleaned
      });
      titleCount += 1;
    }
  } catch {
    // Fallback : suggestions locales uniquement
  }

  // Raccourcis catégories (Femmes, Sacs…) qui matchent encore
  for (const s of base) {
    if (s.kind === 'query') continue;
    if (deep.length >= MAX_TOTAL) break;
    if (s.kind === 'gender' || s.kind === 'product' || s.kind === 'luxury') {
      const label = s.labelKey ? translate(s.labelKey) : '';
      const key = normalizeKey(label || s.id);
      if (seen.has(key)) continue;
      seen.add(key);
      deep.push(s);
    }
  }

  return deep.slice(0, MAX_TOTAL);
}
