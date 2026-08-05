import type { TFunction } from 'i18next';

/** Valeurs canoniques `listings.condition` (flux vente / édition). */
export const CONDITION_VALUES = ['new', 'like_new', 'good', 'fair', 'poor'] as const;
export type ConditionValue = (typeof CONDITION_VALUES)[number];

/** Options affichées dans les filtres (alignées sur l'écran Vendre). */
export const FILTER_CONDITION_VALUES = ['new', 'like_new', 'good', 'fair'] as const;
export type FilterConditionValue = (typeof FILTER_CONDITION_VALUES)[number];

/** Alias legacy en base → valeur canonique filtre. */
const ALIAS_TO_CANONICAL: Record<string, FilterConditionValue | 'poor'> = {
  new: 'new',
  new_with_tags: 'new',
  like_new: 'like_new',
  new_without_tags: 'like_new',
  good: 'good',
  very_good: 'good',
  fair: 'fair',
  poor: 'poor',
  satisfactory: 'poor'
};

/** Valeurs `listings.condition` à inclure pour chaque option filtre. */
const CANONICAL_TO_DB_VALUES: Record<FilterConditionValue, readonly string[]> = {
  new: ['new', 'new_with_tags'],
  like_new: ['like_new', 'new_without_tags'],
  good: ['good', 'very_good'],
  fair: ['fair']
};

const LABEL_KEYS: Record<string, string> = {
  new: 'feed.listingDetail.conditionNew',
  new_with_tags: 'feed.listingDetail.conditionNew',
  like_new: 'feed.listingDetail.conditionLikeNew',
  new_without_tags: 'feed.listingDetail.conditionLikeNew',
  good: 'feed.listingDetail.conditionGood',
  very_good: 'feed.listingDetail.conditionGood',
  fair: 'feed.listingDetail.conditionFair',
  poor: 'feed.listingDetail.conditionPoor',
  satisfactory: 'feed.listingDetail.conditionPoor'
};

const DESC_KEYS: Record<string, string> = {
  new: 'sell.conditionDescNew',
  new_with_tags: 'sell.conditionDescNew',
  like_new: 'sell.conditionDescLikeNew',
  new_without_tags: 'sell.conditionDescLikeNew',
  good: 'sell.conditionDescGood',
  very_good: 'sell.conditionDescGood',
  fair: 'sell.conditionDescFair',
  poor: 'sell.conditionDescPoor',
  satisfactory: 'sell.conditionDescPoor'
};

/** Normalise la valeur catalogue / filtre (underscores, minuscules). */
export function normalizeConditionValue(raw: string): string {
  return raw.trim().toLowerCase().replace(/-/g, '_');
}

export function toCanonicalFilterConditionValue(
  raw: string
): FilterConditionValue | null {
  const v = normalizeConditionValue(raw);
  const canon = ALIAS_TO_CANONICAL[v];
  if (canon && (FILTER_CONDITION_VALUES as readonly string[]).includes(canon)) {
    return canon;
  }
  return null;
}

/** Déduplique une sélection (ex. `good` + `very_good` → `good`). */
export function normalizeConditionFilterSelection(values: string[]): FilterConditionValue[] {
  const selected = new Set<FilterConditionValue>();
  for (const raw of values) {
    const canon = toCanonicalFilterConditionValue(raw);
    if (canon) selected.add(canon);
  }
  return FILTER_CONDITION_VALUES.filter((v) => selected.has(v));
}

/** Étend les valeurs filtre vers tous les alias stockés en base. */
export function expandConditionFilterValues(values: string[]): string[] {
  const out = new Set<string>();
  for (const raw of values) {
    const canon = toCanonicalFilterConditionValue(raw);
    if (canon) {
      for (const dbVal of CANONICAL_TO_DB_VALUES[canon]) {
        out.add(dbVal);
      }
      continue;
    }
    const v = normalizeConditionValue(raw);
    if (v) out.add(v);
  }
  return [...out];
}

export function translateConditionLabel(value: string, t: TFunction): string {
  const v = normalizeConditionValue(value);
  if (!v) return '';
  const key = LABEL_KEYS[v];
  return key ? String(t(key)) : value.trim();
}

export function translateConditionDescription(value: string, t: TFunction): string {
  const v = normalizeConditionValue(value);
  if (!v) return '';
  const key = DESC_KEYS[v];
  return key ? String(t(key)) : '';
}
