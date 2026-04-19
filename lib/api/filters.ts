import { supabase } from '../supabase';

/** Type produit attendu par les tables `brands` / `sizes` (colonnes `type`). */
export type ProductTypeSlug =
  | 'vetements'
  | 'chaussures'
  | 'pantalons'
  | 'chemises'
  | 'sacs'
  | 'accessoires';

export type CategoryFilterContext = {
  gender: string | null;
  /** Aligné sur `brands.type` / `sizes.type` ; null si non déductible */
  type: string | null;
  slugs: string[];
};

/**
 * Déduit vetements / chaussures / … depuis les slug(s) catégorie (+ parent).
 * Ordre des règles : du plus spécifique au générique.
 */
export function inferProductTypeFromCategorySlugs(slugs: string[]): string | null {
  const blob = slugs
    .filter(Boolean)
    .map((s) => String(s).toLowerCase())
    .join(' ');
  if (!blob.trim()) return null;

  const rules: [RegExp, ProductTypeSlug][] = [
    [/chaussure|shoe|sneaker|basket|heel|trainer|boot|sandale/i, 'chaussures'],
    [/pant|jean|trouser|cargo|short(?!age)/i, 'pantalons'],
    [/chemise|shirt|chemisier|blouse|polo/i, 'chemises'],
    [/sac|bag|handbag|backpack|cartable/i, 'sacs'],
    [/accessoire|accessory|belt|ceinture|jewel|bijou|hat|bonnet|scarf|foulard/i, 'accessoires'],
    [/sport|running|fitness|yoga/i, 'vetements'],
    [/robe|dress|jupe|skirt|top|pull|knit|coat|manteau|jacket|gilet|swim|maillot/i, 'vetements'],
    [/vetement|clothing|vetements|apparel|lingerie/i, 'vetements']
  ];

  for (const [re, t] of rules) {
    if (re.test(blob)) return t;
  }
  return null;
}

/**
 * Genre + type pour filtres Brand / Size à partir du `categoryId` du store.
 * Charge la catégorie et éventuellement son parent (gender + slug).
 */
export async function getCategoryFilterContext(
  categoryId: string | null | undefined
): Promise<CategoryFilterContext | null> {
  if (categoryId == null || String(categoryId).trim() === '') return null;

  const slugs: string[] = [];
  /** Parcourt feuille → racine : le dernier genre non vide trouvé correspond en général à Men/Women/Kids en racine */
  let gender: string | null = null;
  let currentId: string | null = String(categoryId).trim();

  for (let depth = 0; depth < 24 && currentId; depth++) {
    const { data: cat, error } = await supabase
      .from('categories')
      .select('id, gender, slug, parent_id')
      .eq('id', currentId)
      .maybeSingle();

    if (error || !cat) return null;

    const row = cat as {
      gender?: string | null;
      slug?: string | null;
      parent_id?: string | null;
    };

    const slug = row.slug != null ? String(row.slug).trim() : '';
    if (slug) slugs.push(slug);

    const g = row.gender != null && String(row.gender).trim() ? String(row.gender).trim() : null;
    if (g) gender = g;

    const pid = row.parent_id;
    currentId =
      pid != null && String(pid).trim() !== '' ? String(pid).trim() : null;
  }

  const type = inferProductTypeFromCategorySlugs(slugs);

  return { gender, type, slugs };
}

/** Libellé FR pour section « Popular for … » */
export function genderDisplayLabelFr(gender: string | null): string {
  switch (gender) {
    case 'femme':
      return 'Femme';
    case 'homme':
      return 'Homme';
    case 'enfant':
      return 'Enfant';
    case 'bebe':
      return 'Bébé';
    default:
      return '—';
  }
}

/**
 * Compte des annonces par nom de marque dans une catégorie donnée.
 */
export async function getBrandNameCountsInCategory(categoryId: string): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const { data, error } = await supabase
    .from('listings')
    .select('brand')
    .eq('status', 'published')
    .eq('category_id', categoryId);

  if (error || !data) return map;

  for (const row of data as { brand?: string | null }[]) {
    const name = row.brand?.trim();
    if (!name) continue;
    map.set(name, (map.get(name) ?? 0) + 1);
  }
  return map;
}

export async function getCategories(gender?: string) {
  let query = supabase.from('categories').select('*').order('name');
  if (gender) {
    query = query.eq('gender', gender);
  }
  const { data } = await query;
  return data ?? [];
}

export async function getRootCategoriesByGender(gender: string) {
  const { data } = await supabase
    .from('categories')
    .select('*')
    .eq('gender', gender)
    .is('parent_id', null)
    .order('name');
  return data ?? [];
}

export async function getChildCategories(parentId: string | number) {
  const id = typeof parentId === 'number' ? parentId : String(parentId).trim();
  const { data } = await supabase
    .from('categories')
    .select('*')
    .eq('parent_id', id)
    .order('name');
  return data ?? [];
}

/**
 * Marques avec compteur d'articles réels.
 * items_count est calculé à partir de la table listings (status = 'published').
 * On matche listings.brand (texte) avec brands.name.
 */
export async function getBrands(
  gender?: string,
  type?: string,
  opts?: { categoryIdForCounts?: string | null }
) {
  // 1. Récupérer la liste de base des marques
  let brandsQuery = supabase.from('brands').select('*').order('name');
  if (gender) {
    brandsQuery = brandsQuery.eq('gender', gender);
  }
  if (type) {
    brandsQuery = brandsQuery.eq('type', type);
  }
  const { data: brands, error: brandsError } = await brandsQuery;
  if (brandsError || !brands) {
    return brands ?? [];
  }

  // 2. Annonces publiées avec une marque (optionnellement limitées à la catégorie pour les compteurs)
  let listingsQuery = supabase.from('listings').select('brand, status').eq('status', 'published');
  const cid = opts?.categoryIdForCounts;
  if (cid != null && String(cid).trim() !== '') {
    listingsQuery = listingsQuery.eq('category_id', cid);
  }
  const { data: listings, error: listingsError } = await listingsQuery;

  const countsByBrand: Record<string, number> = {};
  if (!listingsError && listings) {
    for (const row of listings as any[]) {
      const name = (row.brand as string | null)?.trim();
      if (!name) continue;
      countsByBrand[name] = (countsByBrand[name] ?? 0) + 1;
    }
  }

  // 3. Fusionner: ajouter items_count sur chaque marque
  return (brands as any[]).map((b) => ({
    ...b,
    items_count: countsByBrand[(b.name as string) ?? ''] ?? 0
  }));
}

/**
 * Tailles avec compteur d'articles (via listings.size texte = sizes.label).
 */
export async function getSizes(
  gender?: string,
  type?: string,
  opts?: { categoryIdForCounts?: string | null }
) {
  let sizesQuery = supabase.from('sizes').select('*').order('sort_order');
  if (gender) {
    // Toujours inclure les tailles globales (gender = 'all')
    sizesQuery = sizesQuery.in('gender', [gender, 'all']);
  }
  if (type) {
    sizesQuery = sizesQuery.eq('type', type);
  }
  const { data: sizes, error: sizesError } = await sizesQuery;
  if (sizesError || !sizes) {
    return sizes ?? [];
  }

  let listingsQuery = supabase.from('listings').select('size, status').eq('status', 'published');
  const cid = opts?.categoryIdForCounts;
  if (cid != null && String(cid).trim() !== '') {
    listingsQuery = listingsQuery.eq('category_id', cid);
  }

  const { data: listings, error: listingsError } = await listingsQuery;

  const countsBySizeLabel: Record<string, number> = {};
  if (!listingsError && listings) {
    for (const row of listings as any[]) {
      const size = (row.size as string | null)?.trim();
      if (!size) continue;
      countsBySizeLabel[size] = (countsBySizeLabel[size] ?? 0) + 1;
    }
  }

  return (sizes as any[]).map((s) => ({
    ...s,
    items_count: countsBySizeLabel[(s.label as string) ?? ''] ?? 0
  }));
}

/**
 * Couleurs avec compteur d'articles.
 * listings.color peut contenir une liste séparée par des virgules (ex: "Blanc, Noir").
 * On assigne un count à chaque couleur dont le nom apparaît dans la chaîne.
 */
export async function getColors() {
  const { data: colors, error: colorsError } = await supabase
    .from('colors')
    .select('*')
    .order('name');
  if (colorsError || !colors) {
    return colors ?? [];
  }

  const { data: listings, error: listingsError } = await supabase
    .from('listings')
    .select('color, status')
    .eq('status', 'published');

  const countsByColorName: Record<string, number> = {};
  if (!listingsError && listings) {
    for (const row of listings as any[]) {
      const raw = row.color as string | null;
      if (!raw) continue;
      const parts = raw
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      for (const part of parts) {
        countsByColorName[part] = (countsByColorName[part] ?? 0) + 1;
      }
    }
  }

  return (colors as any[]).map((c) => ({
    ...c,
    items_count: countsByColorName[(c.name as string) ?? ''] ?? 0
  }));
}

/**
 * Conditions avec compteur d'articles (listings.condition).
 */
export async function getConditions() {
  const { data: conditions, error: condError } = await supabase
    .from('conditions')
    .select('*')
    .order('sort_order');

  if (condError || !conditions) {
    return conditions ?? [];
  }

  const { data: listings, error: listingsError } = await supabase
    .from('listings')
    .select('condition, status')
    .eq('status', 'published');

  const countsByCond: Record<string, number> = {};
  if (!listingsError && listings) {
    for (const row of listings as any[]) {
      const cond = (row.condition as string | null)?.trim();
      if (!cond) continue;
      countsByCond[cond] = (countsByCond[cond] ?? 0) + 1;
    }
  }

  return (conditions as any[]).map((c) => ({
    ...c,
    items_count: countsByCond[(c.value as string) ?? ''] ?? 0
  }));
}

