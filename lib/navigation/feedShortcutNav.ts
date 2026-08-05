import type { Href, Router } from 'expo-router';
import { switchMainTab } from './navigateInTabs';

export const FEED_SHORTCUT_FROM = 'from';

export type ProfileShortcutOrigin = 'feed' | 'profile';

type SearchParams = Record<string, string | string[] | undefined>;

function paramString(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) {
    return value[0].trim();
  }
  return undefined;
}

export function pickProfileShortcutOrigin(
  params: SearchParams
): ProfileShortcutOrigin | undefined {
  const from = paramString(params[FEED_SHORTCUT_FROM]);
  return from === 'feed' || from === 'profile' ? from : undefined;
}

/** Indique si l’écran raccourci est monté dans la pile feed (pas profil). */
export function isFeedStackShortcutPath(pathname: string): boolean {
  return (
    pathname.startsWith('/tabs/feed/favorites') ||
    pathname.startsWith('/tabs/feed/notifications') ||
    pathname.startsWith('/tabs/feed/orders')
  );
}

type FeedShortcutPath =
  | '/tabs/feed/favorites'
  | '/tabs/feed/orders'
  | '/tabs/feed/notifications';

type ProfileShortcutPath =
  | '/tabs/profile/favorites'
  | '/tabs/profile/orders'
  | '/tabs/profile/notifications';

/** Ouvre favoris / commandes / notifications depuis les icônes du feed (pile feed, pas profil). */
export function openProfileShortcutFromFeed(router: Router, pathname: ProfileShortcutPath) {
  const feedPath = pathname.replace('/tabs/profile/', '/tabs/feed/') as FeedShortcutPath;
  router.push({
    pathname: feedPath as Href['pathname'],
    params: { [FEED_SHORTCUT_FROM]: 'feed' }
  } as Href);
}

/** Ouvre depuis l’écran profil (retour attendu : index profil). */
export function openProfileShortcutFromProfile(router: Router, pathname: ProfileShortcutPath) {
  router.push({
    pathname: pathname as Href['pathname'],
    params: { [FEED_SHORTCUT_FROM]: 'profile' }
  } as Href);
}

/**
 * Retour depuis favoris / commandes / notifications.
 * Origine feed → toujours le feed (évite de tomber sur le profil après un replace cross-tab).
 * Origine profil → pop vers l’index profil.
 */
export function navigateBackFromProfileShortcut(
  router: Router,
  origin: ProfileShortcutOrigin | undefined
) {
  if (origin === 'feed') {
    if (router.canGoBack?.()) {
      router.back();
      return;
    }
    router.replace('/tabs/feed');
    return;
  }
  if (router.canGoBack?.()) {
    router.back();
    return;
  }
  router.replace('/tabs/profile');
}

/** Chemin favoris selon la pile courante (feed vs profil). */
export function favoritesShortcutHref(pathname: string): Href {
  return isFeedStackShortcutPath(pathname) || pathname.includes('/tabs/feed/')
    ? '/tabs/feed/favorites'
    : '/tabs/profile/favorites';
}

/** Chemin notifications selon origine feed / profil. */
export function notificationsShortcutHref(origin?: ProfileShortcutOrigin): Href {
  return origin === 'feed' ? '/tabs/feed/notifications' : '/tabs/profile/notifications';
}

/** Chemin commandes selon origine feed / profil ou pile courante. */
export function ordersShortcutHref(
  origin?: ProfileShortcutOrigin,
  pathname?: string
): Href {
  if (origin === 'feed' || (pathname && isFeedStackShortcutPath(pathname))) {
    return '/tabs/feed/orders';
  }
  return '/tabs/profile/orders';
}

/** Ouvre l’onglet profil à sa racine (index), sans sous-écran résiduel. */
export function navigateToProfileTabRoot() {
  switchMainTab('/tabs/profile');
}
