import { supabase } from '../supabase';
import { toCatalogGender } from '../filterGenderParams';
import { isBlockedBrandName } from '../brandConstants';
import {
  inferProductTypeFromCategorySlugs as inferProductTypeFromSlugs,
  type BrandProductType
} from '../inferProductType';

/** Type produit attendu par les tables `brands` / `sizes` (colonnes `type`). */
export type ProductTypeSlug = BrandProductType;

export { inferProductTypeFromCategorySlugs } from '../inferProductType';

export type CategoryFilterContext = {
  gender: string | null;
  /** Aligné sur `brands.type` / `sizes.type` ; null si non déductible */
  type: string | null;
  slugs: string[];
};

type CategoryTreeRow = {
  id: string | number;
  gender?: string | null;
  slug?: string | null;
  parent_id?: string | number | null;
  name?: string | null;
  sort_order?: number | null;
};

const CATEGORIES_CACHE_TTL_MS = 5 * 60 * 1000;
let categoriesCache: { rows: CategoryTreeRow[]; fetchedAt: number } | null = null;

async function getAllCategoriesCached(): Promise<CategoryTreeRow[]> {
  if (
    categoriesCache &&
    Date.now() - categoriesCache.fetchedAt < CATEGORIES_CACHE_TTL_MS
  ) {
    return categoriesCache.rows;
  }

  const { data, error } = await supabase
    .from('categories')
    .select('id, gender, slug, parent_id, name, sort_order');

  const rows = !error && data ? (data as CategoryTreeRow[]) : [];
  categoriesCache = { rows, fetchedAt: Date.now() };
  return rows;
}

function categoryIdKey(id: string | number | null | undefined): string {
  return String(id ?? '').trim();
}

function buildCategoryById(rows: CategoryTreeRow[]): Map<string, CategoryTreeRow> {
  const map = new Map<string, CategoryTreeRow>();
  for (const row of rows) {
    const key = categoryIdKey(row.id);
    if (key) map.set(key, row);
  }
  return map;
}

function getCategoryFilterContextFromRows(
  categoryId: string,
  byId: Map<string, CategoryTreeRow>
): CategoryFilterContext | null {
  const slugs: string[] = [];
  let gender: string | null = null;
  let currentId: string | null = categoryId;

  for (let depth = 0; depth < 24 && currentId; depth++) {
    const row = byId.get(currentId);
    if (!row) return null;

    const slug = row.slug != null ? String(row.slug).trim() : '';
    if (slug) slugs.push(slug);

    const g = row.gender != null && String(row.gender).trim() ? String(row.gender).trim() : null;
    if (g) gender = g;

    const pid = row.parent_id;
    currentId =
      pid != null && String(pid).trim() !== '' ? String(pid).trim() : null;
  }

  return { gender, type: inferProductTypeFromSlugs(slugs), slugs };
}

/**
 * Genre + type pour filtres Brand / Size à partir du `categoryId` du store.
 */
export async function getCategoryFilterContext(
  categoryId: string | null | undefined
): Promise<CategoryFilterContext | null> {
  if (categoryId == null || String(categoryId).trim() === '') return null;

  const rows = await getAllCategoriesCached();
  const byId = buildCategoryById(rows);
  return getCategoryFilterContextFromRows(String(categoryId).trim(), byId);
}

/** Section label for “Popular for …” (English UI). */
export function genderDisplayLabel(gender: string | null): string {
  switch (gender) {
    case 'femme':
      return 'Women';
    case 'homme':
      return 'Men';
    case 'enfant':
      return 'Kids';
    case 'bebe':
      return 'Baby';
    default:
      return '—';
  }
}

/** @deprecated Use {@link genderDisplayLabel} */
export const genderDisplayLabelFr = genderDisplayLabel;

function normalizeCategoryIdsForCounts(
  opts?: { categoryIdForCounts?: string | null; categoryIdsForCounts?: string[] | null }
): string[] {
  const fromList = (opts?.categoryIdsForCounts ?? [])
    .map((id) => String(id).trim())
    .filter(Boolean);
  if (fromList.length > 0) return fromList;
  const single = opts?.categoryIdForCounts;
  if (single != null && String(single).trim() !== '') return [String(single).trim()];
  return [];
}

function categoryIdsToRpcParam(categoryIds: string[]): number[] | null {
  if (categoryIds.length === 0) return null;
  return categoryIds.map((id) => Number(id)).filter((id) => Number.isFinite(id));
}

function applyCategoryIdsToListingsQuery<T extends { eq: Function; in: Function }>(
  query: T,
  categoryIds: string[]
): T {
  if (categoryIds.length === 1) {
    return query.eq('category_id', categoryIds[0]) as T;
  }
  if (categoryIds.length > 1) {
    return query.in('category_id', categoryIds) as T;
  }
  return query;
}

async function fetchBrandCountsLegacy(categoryIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  let query = supabase.from('listings').select('brand').eq('status', 'published');
  query = applyCategoryIdsToListingsQuery(query, categoryIds);
  const { data, error } = await query;
  if (error || !data) return map;
  for (const row of data as { brand?: string | null }[]) {
    const name = row.brand?.trim();
    if (!name) continue;
    map.set(name, (map.get(name) ?? 0) + 1);
  }
  return map;
}

async function fetchBrandCountsByName(
  categoryIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const rpcIds = categoryIdsToRpcParam(categoryIds);
  const { data, error } = await supabase.rpc('get_listing_brand_counts', {
    p_category_ids: rpcIds
  });
  if (error) {
    return fetchBrandCountsLegacy(categoryIds);
  }
  if (!data) return map;

  for (const row of data as { brand?: string | null; listing_count?: number | null }[]) {
    const name = row.brand?.trim();
    if (!name) continue;
    map.set(name, Number(row.listing_count ?? 0));
  }
  return map;
}

export async function getEmptyBrandCountInCategories(
  categoryIds: string[]
): Promise<number> {
  const rpcIds = categoryIdsToRpcParam(categoryIds);
  const { data, error } = await supabase.rpc('get_listing_empty_brand_count', {
    p_category_ids: rpcIds
  });
  if (error) {
    let query = supabase.from('listings').select('brand').eq('status', 'published');
    query = applyCategoryIdsToListingsQuery(query, categoryIds);
    const { data } = await query;
    let empty = 0;
    for (const row of (data ?? []) as { brand?: string | null }[]) {
      if (!row.brand?.trim()) empty += 1;
    }
    return empty;
  }
  if (data == null) return 0;
  return Number(data) || 0;
}

async function fetchSizeCountsLegacy(categoryIds: string[]): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  let query = supabase.from('listings').select('size').eq('status', 'published');
  query = applyCategoryIdsToListingsQuery(query, categoryIds);
  const { data, error } = await query;
  if (error || !data) return counts;
  for (const row of data as { size?: string | null }[]) {
    const label = row.size?.trim();
    if (!label) continue;
    counts[label] = (counts[label] ?? 0) + 1;
  }
  return counts;
}

async function fetchSizeCountsByLabel(
  categoryIds: string[]
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const rpcIds = categoryIdsToRpcParam(categoryIds);
  const { data, error } = await supabase.rpc('get_listing_size_counts', {
    p_category_ids: rpcIds
  });
  if (error) {
    return fetchSizeCountsLegacy(categoryIds);
  }
  if (!data) return counts;

  for (const row of data as { size_label?: string | null; listing_count?: number | null }[]) {
    const label = row.size_label?.trim();
    if (!label) continue;
    counts[label] = Number(row.listing_count ?? 0);
  }
  return counts;
}

async function fetchColorCountsLegacy(categoryIds: string[]): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  let query = supabase.from('listings').select('color').eq('status', 'published');
  query = applyCategoryIdsToListingsQuery(query, categoryIds);
  const { data, error } = await query;
  if (error || !data) return counts;
  for (const row of data as { color?: string | null }[]) {
    const raw = row.color;
    if (!raw) continue;
    for (const part of raw.split(',').map((p) => p.trim()).filter(Boolean)) {
      counts[part] = (counts[part] ?? 0) + 1;
    }
  }
  return counts;
}

async function fetchColorCountsByName(
  categoryIds: string[]
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const rpcIds = categoryIdsToRpcParam(categoryIds);
  const { data, error } = await supabase.rpc('get_listing_color_counts', {
    p_category_ids: rpcIds
  });
  if (error) {
    return fetchColorCountsLegacy(categoryIds);
  }
  if (!data) return counts;

  for (const row of data as { color_name?: string | null; listing_count?: number | null }[]) {
    const name = row.color_name?.trim();
    if (!name) continue;
    counts[name] = Number(row.listing_count ?? 0);
  }
  return counts;
}

/**
 * Contexte filtre à partir d'une ou plusieurs catégories sélectionnées.
 * Plusieurs catégories (ex. « Tous les articles femme ») : genre commun, type null si mixte.
 */
export async function resolveCategoryFilterContext(
  categoryIds: string[] | null | undefined
): Promise<CategoryFilterContext | null> {
  const ids = (categoryIds ?? []).map((id) => String(id).trim()).filter(Boolean);
  if (ids.length === 0) return null;

  const rows = await getAllCategoriesCached();
  const byId = buildCategoryById(rows);

  if (ids.length === 1) {
    return getCategoryFilterContextFromRows(ids[0]!, byId);
  }

  const sample = ids.slice(0, 12);
  const contexts = sample
    .map((id) => getCategoryFilterContextFromRows(id, byId))
    .filter((c): c is CategoryFilterContext => c != null);

  if (contexts.length === 0) return null;

  const genders = new Set(contexts.map((c) => c.gender).filter(Boolean));
  const types = new Set(contexts.map((c) => c.type).filter(Boolean));

  return {
    gender: genders.size === 1 ? [...genders][0]! : contexts[0]?.gender ?? null,
    type: types.size === 1 ? [...types][0]! : null,
    slugs: []
  };
}

/** Comptes par nom de marque dans une ou plusieurs catégories (agrégat SQL). */
export async function getBrandNameCountsInCategory(
  categoryIdOrIds: string | string[]
): Promise<Map<string, number>> {
  const categoryIds = Array.isArray(categoryIdOrIds)
    ? categoryIdOrIds.map((id) => String(id).trim()).filter(Boolean)
    : [String(categoryIdOrIds).trim()].filter(Boolean);
  return fetchBrandCountsByName(categoryIds);
}

export async function getCategories(gender?: string) {
  let query = supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name');
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
    .order('sort_order', { ascending: true })
    .order('name');
  return data ?? [];
}

export async function getChildCategories(parentId: string | number) {
  const id = typeof parentId === 'number' ? parentId : String(parentId).trim();
  const { data } = await supabase
    .from('categories')
    .select('*')
    .eq('parent_id', id)
    .order('sort_order', { ascending: true })
    .order('name');
  return data ?? [];
}

export async function getDescendantCategoryIds(
  rootIds: Array<string | number>
): Promise<string[]> {
  const roots = rootIds.map((id) => String(id).trim()).filter(Boolean);
  if (roots.length === 0) return [];

  const rows = await getAllCategoriesCached();
  const childrenByParent = new Map<string, string[]>();
  for (const row of rows) {
    const parentKey = categoryIdKey(row.parent_id);
    const childKey = categoryIdKey(row.id);
    if (!parentKey || !childKey) continue;
    const list = childrenByParent.get(parentKey) ?? [];
    list.push(childKey);
    childrenByParent.set(parentKey, list);
  }

  const visited = new Set<string>();
  const queue = [...roots];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);
    for (const childId of childrenByParent.get(currentId) ?? []) {
      if (!visited.has(childId)) queue.push(childId);
    }
  }

  return Array.from(visited);
}

const BRANDS_PAGE_SIZE = 1000;

/** PostgREST limite à 1000 lignes par défaut — paginer pour tout charger. */
async function fetchAllBrandRows(): Promise<any[]> {
  const rows: any[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('brands')
      .select('*')
      .order('name')
      .range(offset, offset + BRANDS_PAGE_SIZE - 1);
    if (error) {
      throw error;
    }
    const page = (data ?? []) as any[];
    rows.push(...page);
    if (page.length < BRANDS_PAGE_SIZE) break;
    offset += BRANDS_PAGE_SIZE;
  }
  return rows;
}

/**
 * Marques avec compteur d'articles réels.
 * items_count est calculé à partir de la table listings (status = 'published').
 * On matche listings.brand (texte) avec brands.name.
 */
export async function getBrands(
  gender?: string,
  type?: string,
  opts?: { categoryIdForCounts?: string | null; categoryIdsForCounts?: string[] | null }
) {
  // 1. Récupérer la liste de base des marques
  // On applique les filtres en JS pour inclure les marques "globales"
  // (gender/type null ou gender='all') et éviter les listes incomplètes.
  let brands: any[] = [];
  try {
    brands = await fetchAllBrandRows();
  } catch {
    return [];
  }

  const normalizedGender = toCatalogGender(gender) ?? '';
  const normalizedType = String(type ?? '').trim().toLowerCase();
  const filteredBrands = brands.filter((b) => {
    if (isBlockedBrandName((b as any).name)) return false;

    const brandGender = String((b as any).gender ?? '')
      .trim()
      .toLowerCase();
    const brandType = String((b as any).type ?? '')
      .trim()
      .toLowerCase();

    const genderOk =
      normalizedGender.length === 0 ||
      brandGender.length === 0 ||
      brandGender === 'all' ||
      brandGender === normalizedGender;

    const typeOk =
      normalizedType.length === 0 ||
      brandType.length === 0 ||
      brandType === normalizedType;

    return genderOk && typeOk;
  });

  const categoryIds = normalizeCategoryIdsForCounts(opts);
  const brandCounts = await fetchBrandCountsByName(categoryIds);
  const countsByBrand: Record<string, number> = Object.fromEntries(brandCounts);

  // 3. Fusionner: ajouter items_count sur chaque marque
  return filteredBrands.map((b) => ({
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
  opts?: { categoryIdForCounts?: string | null; categoryIdsForCounts?: string[] | null }
) {
  let sizesQuery = supabase.from('sizes').select('*').order('sort_order');
  const catalogGender = toCatalogGender(gender);
  if (catalogGender) {
    // Toujours inclure les tailles globales (gender = 'all')
    sizesQuery = sizesQuery.in('gender', [catalogGender, 'all']);
  }
  if (type) {
    sizesQuery = sizesQuery.eq('type', type);
  }
  const { data: sizes, error: sizesError } = await sizesQuery;
  if (sizesError || !sizes) {
    return sizes ?? [];
  }

  const categoryIds = normalizeCategoryIdsForCounts(opts);
  const countsBySizeLabel = await fetchSizeCountsByLabel(categoryIds);

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
export async function getColors(
  opts?: { categoryIdForCounts?: string | null; categoryIdsForCounts?: string[] | null }
) {
  const { data: colors, error: colorsError } = await supabase
    .from('colors')
    .select('*')
    .order('name');
  if (colorsError || !colors) {
    return colors ?? [];
  }

  const categoryIds = normalizeCategoryIdsForCounts(opts);
  const countsByColorName = await fetchColorCountsByName(categoryIds);

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

