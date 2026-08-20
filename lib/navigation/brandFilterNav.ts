import type { Router } from 'expo-router';
import { resolveCategoryFilterContext } from '../api/filters';
import { filtersScreenPath, type FiltersStackBase } from './filterRoutes';

export type BrandFilterNavParams = {
  returnTo?: string;
  resultsSection?: string;
  resultsQuery?: string;
  resultsTitle?: string;
};

export type BrandFilterNavOptions = {
  /** Genre déjà connu (ex. « tous les articles hommes ») — saute Femmes/Hommes/… */
  gender?: string | null;
};

function buildNavParams(navParams: BrandFilterNavParams) {
  return {
    ...(navParams.returnTo ? { returnTo: navParams.returnTo } : {}),
    ...(typeof navParams.resultsSection === 'string'
      ? { resultsSection: navParams.resultsSection }
      : {}),
    ...(typeof navParams.resultsQuery === 'string'
      ? { resultsQuery: navParams.resultsQuery }
      : {}),
    ...(typeof navParams.resultsTitle === 'string'
      ? { resultsTitle: navParams.resultsTitle }
      : {})
  };
}

/**
 * Ouvre le filtre marque en tenant compte de la catégorie / du genre déjà choisis :
 * genre connu (ex. tous les articles hommes) → liste marques, sans re-demander Homme/Femme.
 * type produit connu (chaussures, etc.) → marques de ce type.
 * sinon → choix du genre.
 */
export async function navigateToBrandFilter(
  router: Router,
  stackBase: FiltersStackBase,
  categoryIds: string[],
  navParams: BrandFilterNavParams,
  brandTitle: string,
  options?: BrandFilterNavOptions
): Promise<void> {
  const selectedCategoryIds = categoryIds
    .map((id) => String(id).trim())
    .filter(Boolean);
  const baseParams = buildNavParams(navParams);

  const ctx = selectedCategoryIds.length
    ? await resolveCategoryFilterContext(selectedCategoryIds)
    : null;
  const gender = ctx?.gender || options?.gender || null;
  const type = ctx?.type || null;

  if (gender || selectedCategoryIds.length > 0) {
    router.push({
      pathname: filtersScreenPath(stackBase, 'brand') as any,
      params: {
        title: brandTitle,
        ...(gender ? { gender } : {}),
        ...(type ? { type } : {}),
        ...baseParams
      }
    });
    return;
  }

  router.push({
    pathname: filtersScreenPath(stackBase, 'brand-gender') as any,
    params: baseParams
  });
}
