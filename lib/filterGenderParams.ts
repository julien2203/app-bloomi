export type FilterGenderKey = 'Woman' | 'Men' | 'Kids' | 'Baby';

export const UI_TO_DB_GENDER: Record<FilterGenderKey, string> = {
  Woman: 'femme',
  Men: 'homme',
  Kids: 'enfant',
  Baby: 'bebe'
};

const DB_TO_UI_GENDER: Record<string, FilterGenderKey> = {
  femme: 'Woman',
  homme: 'Men',
  enfant: 'Kids',
  bebe: 'Baby'
};

const CATALOG_GENDERS = new Set(['femme', 'homme', 'enfant', 'bebe']);

/** Valeur `brands.gender` / `sizes.gender` : accepte clés UI (Woman…) ou DB (femme…). */
export function toCatalogGender(raw: string | null | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  const trimmed = raw.trim();
  if (trimmed in UI_TO_DB_GENDER) {
    return UI_TO_DB_GENDER[trimmed as FilterGenderKey];
  }
  const lower = trimmed.toLowerCase();
  if (CATALOG_GENDERS.has(lower)) return lower;
  return undefined;
}

/** Accepte Woman/Men/… ou valeurs DB (femme, homme, …). */
export function resolveFilterGenderParam(raw: string | undefined): FilterGenderKey {
  if (!raw || !raw.trim()) return 'Woman';
  const trimmed = raw.trim();
  if (trimmed in UI_TO_DB_GENDER) return trimmed as FilterGenderKey;
  const fromDb = DB_TO_UI_GENDER[trimmed.toLowerCase()];
  if (fromDb) return fromDb;
  return 'Woman';
}

export const FILTER_GENDER_OPTIONS: { labelKey: string; genderKey: FilterGenderKey }[] = [
  { labelKey: 'filters.woman', genderKey: 'Woman' },
  { labelKey: 'filters.men', genderKey: 'Men' },
  { labelKey: 'filters.kids', genderKey: 'Kids' },
  { labelKey: 'filters.baby', genderKey: 'Baby' }
];

/** Libellé i18n pour un genre catalogue (`femme`, `homme`, …). */
export function translateFilterGenderDb(
  gender: string | null | undefined,
  t: (key: string) => string
): string {
  switch ((gender ?? '').toLowerCase()) {
    case 'femme':
      return t('filters.woman');
    case 'homme':
      return t('filters.men');
    case 'enfant':
      return t('filters.kids');
    case 'bebe':
      return t('filters.baby');
    default:
      return gender ? String(gender) : '—';
  }
}
