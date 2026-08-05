import AsyncStorage from '@react-native-async-storage/async-storage';
import { InteractionManager } from 'react-native';
import { router, type Href, type Router } from 'expo-router';
import { authDebug } from '../authDebugLog';

export const STRIPE_CONNECT_RETURN_PENDING_KEY = 'stripe_connect_return_pending';

const MAIN_TAB_ROOTS = new Set([
  '/tabs/feed',
  '/tabs/search',
  '/tabs/sell',
  '/tabs/messages',
  '/tabs/profile'
]);

function hrefPath(href: Href): string {
  if (typeof href === 'string') return href.split('?')[0];
  return String(href.pathname ?? '');
}

/**
 * Bascule entre onglets racine (navbar) sans replace ni dismissAll — instantané, état conservé.
 */
export function switchMainTab(href: Href) {
  const hrefStr = typeof href === 'string' ? href : JSON.stringify(href);
  authDebug('nav:switchMainTab', { href: hrefStr });
  router.navigate(href);
}

/**
 * Navigation vers une route dans l’onglet tabs en réinitialisant modales / piles (filtres, auth, etc.).
 * Ne pas utiliser pour un simple tap navbar entre onglets racine — préférer switchMainTab.
 */
export function navigateInTabs(href: Href) {
  const hrefStr = typeof href === 'string' ? href : JSON.stringify(href);
  const path = hrefPath(href);
  if (MAIN_TAB_ROOTS.has(path)) {
    switchMainTab(href);
    return;
  }
  const canDismiss = typeof router.canDismiss === 'function' && router.canDismiss();
  authDebug('nav:navigateInTabs', { href: hrefStr, canDismiss });
  if (canDismiss) {
    authDebug('nav:dismissAll');
    router.dismissAll();
  }
  authDebug('nav:replace', { href: hrefStr });
  router.replace(href);
  authDebug('nav:replace:done', { href: hrefStr });
}

/**
 * Ouvre un fil de messages depuis un autre onglet (ex. offre sur feed/make-offer).
 * Ferme d’abord les modales / piles (make-offer, etc.) puis bascule vers l’inbox.
 */
export function navigateToThread(
  routerInstance: Router,
  threadId: string,
  extraParams?: Record<string, string>
) {
  const href: Href = {
    pathname: '/tabs/messages/[id]',
    params: {
      id: threadId,
      from_inbox: '1',
      ...extraParams
    }
  };
  const hrefStr = JSON.stringify(href);
  const canDismiss =
    typeof routerInstance.canDismiss === 'function' && routerInstance.canDismiss();
  authDebug('nav:navigateToThread', { href: hrefStr, canDismiss });
  if (canDismiss) {
    routerInstance.dismissAll();
  }
  InteractionManager.runAfterInteractions(() => {
    authDebug('nav:navigateToThread:replace', { href: hrefStr });
    routerInstance.replace(href);
  });
}

/** Deep link / retour Stripe Connect → écran d’activation vendeur dans les tabs. */
export function isStripeConnectReturnUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.startsWith('bloomi://profile') ||
    lower.includes('onboarding-return') ||
    lower.includes('activate-seller-account')
  );
}

export function navigateAfterStripeConnectReturn() {
  navigateInTabs('/tabs/profile/activate-seller-account');
}

const STRIPE_RETURN_MAX_AGE_MS = 30 * 60 * 1000;

export async function markStripeConnectReturnPending() {
  await AsyncStorage.setItem(STRIPE_CONNECT_RETURN_PENDING_KEY, String(Date.now()));
}

export async function consumeStripeConnectReturnPending(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(STRIPE_CONNECT_RETURN_PENDING_KEY);
  if (!raw) return false;
  await AsyncStorage.removeItem(STRIPE_CONNECT_RETURN_PENDING_KEY);
  const ts = Number(raw);
  if (!Number.isFinite(ts) || Date.now() - ts > STRIPE_RETURN_MAX_AGE_MS) {
    return false;
  }
  return true;
}
