import type { TFunction } from 'i18next';

export function normalizeSizeKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[–—−]/g, '-')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/** Libellés canoniques BDD `sizes.label` (normalisés → slug). */
const CANONICAL_LABELS = [
  'XXS (32)',
  'XS (34)',
  'S (36)',
  'M (38–40)',
  'L (42–44)',
  'XL (46)',
  'XXL (48)',
  '3XL (50)',
  '4XL (52)',
  '5XL et plus',
  'TU',
  'EU 35',
  'EU 36',
  'EU 37',
  'EU 38',
  'EU 39',
  'EU 40',
  'EU 41',
  'EU 42',
  'EU 43',
  'EU 44',
  'EU 45',
  'EU 46',
  'EU 47',
  'EU 48',
  'EU 49',
  'EU 50',
  'EU 16',
  'EU 17',
  'EU 18',
  'EU 19',
  'EU 20',
  'EU 21',
  'EU 22',
  'EU 23',
  'EU 24',
  'EU 25',
  'EU 26',
  'EU 27',
  'EU 28',
  'EU 29',
  'EU 30',
  'EU 31',
  'EU 32',
  'EU 33',
  'EU 34',
  '50 (newborn)',
  '56 (0–1 month)',
  '62 (0–3 months)',
  '68 (3–6 months)',
  '74 (6–9 months)',
  '80 (9–12 months)',
  '86 (12–18 months)',
  '92 (2 ans)',
  '98 (3 ans)',
  '104 (4 ans)',
  '110 (5 ans)',
  '116 (6 ans)',
  '122 (7 ans)',
  '128 (8 ans)',
  '134 (9 ans)',
  '140 (10 ans)',
  '146 (11 ans)',
  '152 (12 ans)',
  '158 (13 ans)',
  '164 (14 ans)',
  'One size',
  'Not specified / See label',
  'XS (44)',
  'S (46)',
  'M (48)',
  'L (50)',
  'XL (52)',
  'XXL (54)',
  '3XL (56)',
  '4XL (58)',
  'W28 (XS / 38)',
  'W29 (S / 40)',
  'W30 (S / 40-42)',
  'W31 (M / 42)',
  'W32 (M / 42-44)',
  'W33 (L / 44)',
  'W34 (L / 44-46)',
  'W36 (XL / 46)',
  'W38 (XXL / 48)',
  'W40 (3XL / 50)',
  'W42 (4XL / 52)',
  '37 (S)',
  '38 (S/M)',
  '39 (M)',
  '40 (M/L)',
  '41 (L)',
  '42 (L/XL)',
  '43 (XL)',
  '44 (XXL)'
] as const;

const SIZE_SLUGS = new Set(CANONICAL_LABELS.map((label) => normalizeSizeKey(label)));

/** Variantes (anciennes annonces, tirets ASCII, libellés FR). */
const ALIASES: Record<string, string> = {
  'm_38-40': 'm_38_40',
  'l_42-44': 'l_42_44',
  '56_0-1_month': '56_0_1_month',
  '62_0-3_months': '62_0_3_months',
  '68_3-6_months': '68_3_6_months',
  '74_6-9_months': '74_6_9_months',
  '80_9-12_months': '80_9_12_months',
  '86_12-18_months': '86_12_18_months',
  taille_unique: 'one_size',
  '5xl_and_up': '5xl_et_plus'
};

function resolveSizeSlug(label: string): string | null {
  const norm = normalizeSizeKey(label);
  if (!norm) return null;
  if (SIZE_SLUGS.has(norm)) return norm;
  const alias = ALIASES[norm];
  if (alias && SIZE_SLUGS.has(alias)) return alias;
  return null;
}

/** Libellé affiché pour une taille catalogue (DB `sizes.label` ou `listings.size`). */
export function translateSizeLabel(label: string, t: TFunction): string {
  const trimmed = label?.trim();
  if (!trimmed) return '';
  const slug = resolveSizeSlug(trimmed);
  if (!slug) return trimmed;
  const key = `catalog.sizes.${slug}`;
  const translated = t(key);
  return translated !== key ? String(translated) : trimmed;
}
