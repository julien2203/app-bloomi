import { router } from 'expo-router';
import { parseDressingSellerIdFromUrl } from '../closetShare';
import {
  queueSharedDressing,
  queueSharedDressingFromUrl
} from './pendingShareDeepLinkNav';

export function isDressingDeepLinkUrl(url: string | null | undefined): boolean {
  return Boolean(url && parseDressingSellerIdFromUrl(url));
}

export function dressingEntryPath(sellerId: string): `/dressing/${string}` {
  const id = String(sellerId ?? '').trim();
  return `/dressing/${id}`;
}

/**
 * Enfile la destination puis passe par `/dressing/{id}`.
 * La navigation finale vers public-profile est faite par Redirect
 * (ou flush AuthGate si le cold start a raté le replace).
 */
export function navigateToSharedDressing(sellerId: string) {
  const id = String(sellerId ?? '').trim();
  if (!id) return;
  queueSharedDressing(id);
  router.replace(dressingEntryPath(id));
}

export function navigateToSharedDressingFromUrl(url: string) {
  if (!queueSharedDressingFromUrl(url)) return;
  const sellerId = parseDressingSellerIdFromUrl(url);
  if (!sellerId) return;
  router.replace(dressingEntryPath(sellerId));
}
