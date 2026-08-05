import type { Href } from 'expo-router';
import { authDebug } from '../authDebugLog';

export type PendingNotificationNav = {
  threadId?: string;
  listingId?: string;
  orderId?: string;
};

type NotificationRouter = {
  push: (href: Href) => void;
};

let pending: PendingNotificationNav | null = null;
const handledResponseIds = new Set<string>();

export function hasPendingNotificationNav(): boolean {
  return pending != null;
}

function responseIdOf(response: any): string | null {
  const id = response?.notification?.request?.identifier;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

function parseNotificationData(response: any): PendingNotificationNav | null {
  const data = response?.notification?.request?.content?.data ?? {};
  const threadId = typeof data?.thread_id === 'string' ? data.thread_id : null;
  const listingId = typeof data?.listing_id === 'string' ? data.listing_id : null;
  const orderId = typeof data?.order_id === 'string' ? data.order_id : null;

  if (!threadId && !listingId && !orderId) return null;

  return {
    ...(threadId ? { threadId } : {}),
    ...(listingId ? { listingId } : {}),
    ...(orderId ? { orderId } : {})
  };
}

/**
 * Enfile la destination d'une push sans naviguer tout de suite
 * (évite la course AuthGate / splash au cold start).
 */
export function queueNotificationNavFromResponse(response: any): boolean {
  const responseId = responseIdOf(response);
  if (responseId && handledResponseIds.has(responseId)) {
    authDebug('push:nav:skipDuplicate', { responseId });
    return false;
  }

  const target = parseNotificationData(response);
  if (!target) return false;

  if (responseId) {
    handledResponseIds.add(responseId);
    if (handledResponseIds.size > 40) {
      const first = handledResponseIds.values().next().value;
      if (first) handledResponseIds.delete(first);
    }
  }

  pending = target;
  authDebug('push:nav:queued', target);
  return true;
}

/** Navigue vers la destination en file d'attente (une seule fois). */
export function flushPendingNotificationNav(router: NotificationRouter): boolean {
  if (!pending) return false;
  const target = pending;
  pending = null;

  if (target.threadId) {
    authDebug('push:nav:flush', { target: 'messages', threadId: target.threadId });
    router.push({ pathname: '/tabs/messages/[id]', params: { id: target.threadId } });
    return true;
  }
  if (target.listingId) {
    authDebug('push:nav:flush', { target: 'listing', listingId: target.listingId });
    router.push({ pathname: '/tabs/feed/[id]', params: { id: target.listingId } });
    return true;
  }
  if (target.orderId) {
    authDebug('push:nav:flush', { target: 'orders', orderId: target.orderId });
    router.push('/tabs/profile/orders');
    return true;
  }
  return false;
}
