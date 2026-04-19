import type { Router } from 'expo-router';

/**
 * Après mise à jour du store filtres : retour vers l’écran source.
 * Depuis Search (`returnTo === 'search'`) : on remonte toute la pile filtres jusqu’à Search
 * (un seul `router.back()` ne suffit pas quand plusieurs sous-écrans sont empilés).
 */
export function navigateAfterFilterCommit(router: Router, returnTo?: string) {
  if (returnTo === 'search') {
    router.dismissTo('/tabs/search');
    return;
  }
  if (returnTo === 'results') {
    router.dismissTo('/tabs/results');
    return;
  }
  router.back();
}
