import type { Router } from 'expo-router';

/**
 * Après mise à jour du store filtres : retour vers l’écran source.
 * Depuis Search (`returnTo === 'search'`) : remonte toute la pile filtres jusqu’à Search.
 */
export function navigateAfterFilterCommit(router: Router, returnTo?: string) {
  if (returnTo === 'search') {
    if (typeof router.dismissTo === 'function') {
      router.dismissTo('/tabs/search');
      return;
    }
    router.replace('/tabs/search' as any);
    return;
  }
  if (returnTo === 'results') {
    if (typeof router.dismissTo === 'function') {
      router.dismissTo('/tabs/results');
      return;
    }
    router.replace('/tabs/results' as any);
    return;
  }
  if (router.canGoBack?.()) {
    router.back();
    return;
  }
  router.replace('/tabs/search' as any);
}
