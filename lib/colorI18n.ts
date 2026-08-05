import type { TFunction } from 'i18next';

/** Slugs reconnus → clé i18n `catalog.colors.{slug}` */
const COLOR_SLUGS = new Set([
  'black',
  'white',
  'grey',
  'beige',
  'brown',
  'blue',
  'red',
  'green',
  'yellow',
  'orange',
  'pink',
  'purple',
  'multicolor',
  'gold',
  'silver',
  'cream',
  'khaki',
  'khaki_green',
  'navy',
  'navy_blue',
  'burgundy',
  'turquoise',
  'coral',
  'mustard',
  'olive',
  'tan',
  'ivory',
  'nude',
  'copper',
  'bronze',
  'lavender',
  'lilac',
  'mint',
  'charcoal',
  'dark_blue',
  'light_blue',
  'dark_green',
  'light_green',
  'dark_grey',
  'light_grey',
  'dark_pink',
  'light_pink',
  'dark_brown',
  'light_brown',
  'dark_red',
  'leopard',
  'floral',
  'striped',
  'polka_dot',
  'animal_print',
  'clear',
  'other'
]);

/** Alias (nom normalisé ou variante) → slug canonique */
const ALIASES: Record<string, string> = {
  gray: 'grey',
  gris: 'grey',
  noir: 'black',
  blanc: 'white',
  marron: 'brown',
  bleu: 'blue',
  rouge: 'red',
  vert: 'green',
  jaune: 'yellow',
  rose: 'pink',
  violet: 'purple',
  multicolore: 'multicolor',
  multicolour: 'multicolor',
  multi: 'multicolor',
  dore: 'gold',
  argent: 'silver',
  creme: 'cream',
  kaki: 'khaki',
  khaki_green: 'khaki_green',
  vert_kaki: 'khaki_green',
  marine: 'navy',
  navy_blue: 'navy_blue',
  bleu_marine: 'navy_blue',
  bordeaux: 'burgundy',
  corail: 'coral',
  moutarde: 'mustard',
  ivoire: 'ivory',
  anthracite: 'charcoal',
  camel: 'tan',
  leopard_print: 'leopard',
  fleuri: 'floral',
  raye: 'striped',
  rayures: 'striped',
  a_pois: 'polka_dot',
  pois: 'polka_dot',
  animalier: 'animal_print',
  transparent: 'clear',
  autre: 'other',
  autres: 'other'
};

export function isOtherColorName(name: string): boolean {
  return resolveColorSlug(name) === 'other';
}

/** Place « Other » en fin de liste (vente / filtres). */
export function sortColorsOtherLast<T extends { name: string }>(colors: T[]): T[] {
  const other: T[] = [];
  const rest: T[] = [];
  for (const c of colors) {
    if (isOtherColorName(c.name)) other.push(c);
    else rest.push(c);
  }
  return [...rest, ...other];
}

export function normalizeColorKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function resolveColorSlug(name: string): string | null {
  const norm = normalizeColorKey(name);
  if (!norm) return null;
  if (COLOR_SLUGS.has(norm)) return norm;
  const alias = ALIASES[norm];
  if (alias && COLOR_SLUGS.has(alias)) return alias;
  return null;
}

/** Libellé affiché pour un nom de couleur catalogue (DB `colors.name`). */
export function translateColorName(name: string, t: TFunction): string {
  const trimmed = name?.trim();
  if (!trimmed) return '';
  const slug = resolveColorSlug(trimmed);
  if (!slug) return trimmed;
  const key = `catalog.colors.${slug}`;
  const translated = t(key);
  return translated !== key ? String(translated) : trimmed;
}

/** Chaîne `listings.color` (ex. « Black, White »). */
export function translateColorList(raw: string | null | undefined, t: TFunction): string {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  return text
    .split(',')
    .map((part) => translateColorName(part.trim(), t))
    .filter(Boolean)
    .join(', ');
}
