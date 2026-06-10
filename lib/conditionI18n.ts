import type { TFunction } from 'i18next';

/** Valeurs canoniques `listings.condition` (flux vente / édition). */
export const CONDITION_VALUES = ['new', 'like_new', 'good', 'fair', 'poor'] as const;
export type ConditionValue = (typeof CONDITION_VALUES)[number];

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
