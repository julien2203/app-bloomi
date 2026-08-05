import type { Router } from 'expo-router';
import { resolveCategoryFilterContext } from '../api/filters';
import { filtersScreenPath, type FiltersStackBase } from './filterRoutes';

export type BrandFilterNavParams = {
  returnTo?: string;
  resultsSection?: string;
  resultsQuery?: string;
  resultsTitle?: string;
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
 * Ouvre le filtre marque en tenant compte de la catégorie sélectionnée :
 * sans catégorie → choix du genre ; avec catégorie → liste marques contextualisée.
 */
export async function navigateToBrandFilter(
  router: Router,
  stackBase: FiltersStackBase,
  categoryIds: string[],
  navParams: BrandFilterNavParams,
  brandTitle: string
): Promise<void> {
  const selectedCategoryIds = categoryIds
    .map((id) => String(id).trim())
    .filter(Boolean);
  const baseParams = buildNavParams(navParams);

  if (selectedCategoryIds.length === 0) {
    router.push({
      pathname: filtersScreenPath(stackBase, 'brand-gender') as any,
      params: baseParams
    });
    return;
  }

  const ctx = await resolveCategoryFilterContext(selectedCategoryIds);
  router.push({
    pathname: filtersScreenPath(stackBase, 'brand') as any,
    params: {
      title: brandTitle,
      ...(ctx?.gender ? { gender: ctx.gender } : {}),
      ...(ctx?.type ? { type: ctx.type } : {}),
      ...baseParams
    }
  });
}
