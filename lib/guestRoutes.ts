/**
 * Routes accessibles sans compte lorsque l'utilisateur a choisi le mode invité.
 */
export function isGuestBrowseRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const p = pathname.replace(/\/+$/, '') || '/';
  return (
    p.startsWith('/tabs/feed') ||
    p.startsWith('/tabs/public-profile') ||
    p.startsWith('/tabs/search') ||
    p.startsWith('/tabs/results') ||
    p.startsWith('/tabs/filters')
  );
}
