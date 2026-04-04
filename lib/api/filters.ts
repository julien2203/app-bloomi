import { supabase } from '../supabase';

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

export async function getChildCategories(parentId: number) {
  const { data } = await supabase
    .from('categories')
    .select('*')
    .eq('parent_id', parentId)
    .order('name');
  return data ?? [];
}

/**
 * Marques avec compteur d'articles réels.
 * items_count est calculé à partir de la table listings (status = 'published').
 * On matche listings.brand (texte) avec brands.name.
 */
export async function getBrands(gender?: string, type?: string) {
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

  // 2. Récupérer toutes les annonces publiées avec une marque
  const { data: listings, error: listingsError } = await supabase
    .from('listings')
    .select('brand, status')
    .eq('status', 'published');

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
export async function getSizes(gender?: string, type?: string) {
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

  const { data: listings, error: listingsError } = await supabase
    .from('listings')
    .select('size, status')
    .eq('status', 'published');

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

