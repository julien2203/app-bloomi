/** ID interne UI pour la marque « Autre » / saisie libre (non persisté en base comme id). */
export const BRAND_OTHER_ID = -1;

/** Libellé canonique stocké en base pour « Autre » sans nom personnalisé. */
export const BRAND_OTHER_CANONICAL_NAME = 'Autre';

/** Longueur min/max pour une marque saisie libre. */
export const CUSTOM_BRAND_MIN_LENGTH = 2;
export const CUSTOM_BRAND_MAX_LENGTH = 60;

/**
 * Marques / marketplaces ultra low-cost interdites (clé normalisée).
 * Étendre cette liste pour bloquer d’autres noms.
 */
export const BLOCKED_BRAND_KEYS = [
  'temu',
  'shein',
  'shein.com',
  'romwe',
  'aliexpress',
  'ali express',
  'ali-express',
  'wish',
  'zaful',
  'lightinthebox',
  'light in the box',
  'banggood',
  'dhgate',
  'joom'
] as const;

const BLOCKED_BRAND_KEY_SET = new Set<string>(BLOCKED_BRAND_KEYS);

export function normalizeBrandKey(name: string | null | undefined): string {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** True si la marque est explicitement interdite (Temu, Shein, etc.). */
export function isBlockedBrandName(name: string | null | undefined): boolean {
  const key = normalizeBrandKey(name);
  if (!key) return false;
  if (BLOCKED_BRAND_KEY_SET.has(key)) return true;

  for (const blocked of BLOCKED_BRAND_KEY_SET) {
    if (key === blocked) return true;
    if (
      key.startsWith(`${blocked} `) ||
      key.startsWith(`${blocked}-`) ||
      key.startsWith(`${blocked}.`)
    ) {
      return true;
    }
  }
  return false;
}

export function isCanonicalOtherBrandName(name: string | null | undefined): boolean {
  const key = normalizeBrandKey(name);
  return key === 'autre' || key === 'other';
}

export function isBrandOtherSelection(brand: { id?: number; name?: string } | null | undefined): boolean {
  if (!brand) return false;
  if (brand.id === BRAND_OTHER_ID) return true;
  return isCanonicalOtherBrandName(brand.name);
}

/** Marque libre (hors catalogue), distincte du simple libellé « Autre ». */
export function isCustomBrandSelection(brand: { id?: number; name?: string } | null | undefined): boolean {
  if (!brand?.name?.trim()) return false;
  if (isCanonicalOtherBrandName(brand.name)) return false;
  if (brand.id === BRAND_OTHER_ID) return true;
  if (typeof brand.id === 'number' && brand.id > 0) return false;
  return true;
}

export function makeCustomBrandSelection(name: string): { id: number; name: string } {
  return {
    id: BRAND_OTHER_ID,
    name: name.trim().replace(/\s+/g, ' ')
  };
}

export function isValidCustomBrandName(name: string | null | undefined): boolean {
  const trimmed = String(name ?? '').trim();
  if (trimmed.length < CUSTOM_BRAND_MIN_LENGTH) return false;
  if (trimmed.length > CUSTOM_BRAND_MAX_LENGTH) return false;
  if (isCanonicalOtherBrandName(trimmed)) return false;
  if (isBlockedBrandName(trimmed)) return false;
  return true;
}

/** Valeur texte à persister sur `listings.brand`. */
export function brandSelectionToStorageName(
  brand: { id?: number; name?: string } | null | undefined
): string | null {
  if (!brand) return null;
  const name = String(brand.name ?? '').trim().replace(/\s+/g, ' ');
  if (!name) return null;
  if (isBlockedBrandName(name)) return null;
  if (brand.id === BRAND_OTHER_ID && isCanonicalOtherBrandName(name)) {
    return BRAND_OTHER_CANONICAL_NAME;
  }
  return name;
}

/** Libellé UI pour la ligne résumé (sell / edit). */
export function formatBrandDisplayLabel(
  brand: { id?: number; name?: string } | null | undefined,
  otherLabel: string
): string | null {
  if (!brand?.name?.trim()) return null;
  if (isCanonicalOtherBrandName(brand.name) && !isCustomBrandSelection(brand)) {
    return otherLabel;
  }
  return brand.name.trim();
}
