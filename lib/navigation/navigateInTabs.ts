import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, type Href } from 'expo-router';

export const STRIPE_CONNECT_RETURN_PENDING_KEY = 'stripe_connect_return_pending';

/**
 * Navigation vers une route dans l’onglet tabs en réinitialisant la pile (barre d’onglets visible sur les racines).
 */
export function navigateInTabs(href: Href) {
  if (typeof router.canDismiss === 'function' && router.canDismiss()) {
    router.dismissAll();
  }
  router.replace(href);
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
