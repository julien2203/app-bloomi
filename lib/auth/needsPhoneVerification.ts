/**
 * La vérification SMS n'est plus obligatoire à l'inscription ni à la connexion.
 * Les écrans verify-phone* restent dans le code (accès manuel possible)
 * mais ne sont plus injectés dans le parcours auth.
 */
export function needsAuthPhoneVerification(
  _user?: { phone_confirmed_at?: string | null } | null
): boolean {
  return false;
}

export function postAuthDestination(
  _user?: { phone_confirmed_at?: string | null } | null
): '/tabs/feed' {
  return '/tabs/feed';
}
