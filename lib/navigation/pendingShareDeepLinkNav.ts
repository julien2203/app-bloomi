import type { Href } from 'expo-router';
import { authDebug } from '../authDebugLog';
import { parseDressingSellerIdFromUrl } from '../closetShare';

type ShareRouter = {
  replace: (href: Href) => void;
};

let pendingDressingSellerId: string | null = null;

export function hasPendingSharedDressing(): boolean {
  return pendingDressingSellerId != null;
}

export function queueSharedDressing(sellerId: string): boolean {
  const id = String(sellerId ?? '').trim();
  if (!id) return false;
  pendingDressingSellerId = id;
  authDebug('shareDeepLink:dressing:queued', { sellerId: id });
  return true;
}

export function queueSharedDressingFromUrl(url: string): boolean {
  const sellerId = parseDressingSellerIdFromUrl(url);
  if (!sellerId) return false;
  return queueSharedDressing(sellerId);
}

/** Consomme la file sans naviguer (ex. écran /dressing/[userId] qui redirige lui-même). */
export function consumePendingSharedDressing(): string | null {
  const id = pendingDressingSellerId;
  pendingDressingSellerId = null;
  return id;
}

/**
 * Navigue vers le dressing public une fois AuthGate / routeur prêts.
 * Même idée que flushPendingNotificationNav (évite le splash bloqué au cold start).
 */
export function flushPendingSharedDressing(router: ShareRouter): boolean {
  const id = pendingDressingSellerId;
  if (!id) return false;
  pendingDressingSellerId = null;
  authDebug('shareDeepLink:dressing:flush', { sellerId: id });
  router.replace({
    pathname: '/tabs/public-profile',
    params: { user_id: id }
  });
  return true;
}
