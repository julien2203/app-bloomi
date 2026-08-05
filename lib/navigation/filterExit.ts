import type { Href, Router } from 'expo-router';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { FILTERS_PATH_SEARCH_STACK, type FiltersStackBase, useFiltersStackBase } from './filterRoutes';
import { navigateInTabs } from './navigateInTabs';

export type FilterResultsReturnParams = {
  section?: string;
  query?: string;
  title?: string;
};

function hrefForFilterReturn(
  returnTo: 'search' | 'results',
  resultsParams?: FilterResultsReturnParams
): Href {
  if (returnTo === 'search') {
    const query = resultsParams?.query?.trim();
    return query ? { pathname: '/tabs/search', params: { query } } : '/tabs/search';
  }

  const params: Record<string, string> = {};
  if (resultsParams?.section) params.section = resultsParams.section;
  if (resultsParams?.query) params.query = resultsParams.query;
  if (resultsParams?.title) params.title = resultsParams.title;
  return Object.keys(params).length > 0
    ? { pathname: '/tabs/results', params }
    : '/tabs/results';
}

type RouterWithDismissTo = Router & {
  dismissTo?: (href: Href) => void;
};

/** Filtres ouverts sur la pile Search : fermer la pile sans re-naviguer l’onglet. */
function exitSearchFiltersStack(router: Router, resultsParams?: FilterResultsReturnParams) {
  const href = hrefForFilterReturn('search', resultsParams);
  const dismissTo = (router as RouterWithDismissTo).dismissTo;
  if (typeof dismissTo === 'function') {
    dismissTo.call(router, href);
    return;
  }
  router.navigate(href);
}

/**
 * Après mise à jour du store filtres : retour vers l’écran source.
 * Pile `/tabs/search/filters` : dismiss / back (pas de `navigateInTabs`).
 * Onglet sibling `/tabs/filters` : `navigateInTabs` vers Search ou Results.
 */
export function navigateAfterFilterCommit(
  router: Router,
  returnTo?: string,
  resultsParams?: FilterResultsReturnParams,
  stackBase?: FiltersStackBase
) {
  if (returnTo === 'search' && stackBase === FILTERS_PATH_SEARCH_STACK) {
    exitSearchFiltersStack(router, resultsParams);
    return;
  }
  if (returnTo === 'search') {
    navigateInTabs(hrefForFilterReturn('search', resultsParams));
    return;
  }
  if (returnTo === 'results') {
    navigateInTabs(hrefForFilterReturn('results', resultsParams));
    return;
  }
  if (router.canGoBack?.()) {
    router.back();
    return;
  }
  navigateInTabs('/tabs/search');
}

/** Retour depuis l’index filtres. */
export function navigateBackFromFiltersIndex(
  router: Router,
  returnTo?: string,
  resultsParams?: FilterResultsReturnParams,
  stackBase?: FiltersStackBase
) {
  if (returnTo === 'search' && stackBase === FILTERS_PATH_SEARCH_STACK) {
    if (router.canGoBack?.()) {
      router.back();
      return;
    }
    exitSearchFiltersStack(router, resultsParams);
    return;
  }
  if (returnTo === 'search' || returnTo === 'results') {
    navigateAfterFilterCommit(router, returnTo, resultsParams, stackBase);
    return;
  }
  if (router.canGoBack?.()) {
    router.back();
    return;
  }
  navigateAfterFilterCommit(router, returnTo, resultsParams, stackBase);
}

/** Filtres partagés Search / Results : injecte automatiquement la pile courante. */
export function useFilterExit() {
  const router = useRouter();
  const stackBase = useFiltersStackBase();

  const navigateAfterFilterCommitBound = useCallback(
    (returnTo?: string, resultsParams?: FilterResultsReturnParams) => {
      navigateAfterFilterCommit(router, returnTo, resultsParams, stackBase);
    },
    [router, stackBase]
  );

  const navigateBackFromFiltersIndexBound = useCallback(
    (returnTo?: string, resultsParams?: FilterResultsReturnParams) => {
      navigateBackFromFiltersIndex(router, returnTo, resultsParams, stackBase);
    },
    [router, stackBase]
  );

  return {
    navigateAfterFilterCommit: navigateAfterFilterCommitBound,
    navigateBackFromFiltersIndex: navigateBackFromFiltersIndexBound
  };
}
