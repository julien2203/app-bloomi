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
