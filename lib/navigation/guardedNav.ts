import type { Href, Router } from 'expo-router';

const DEFAULT_GUARD_MS = 800;

const lockUntilByKey = new Map<string, number>();

function hrefToKey(href: Href): string {
  return typeof href === 'string' ? href : JSON.stringify(href);
}

/** Bloque les navigations dupliquées (double-tap) pour une clé donnée. */
export function acquireNavLock(key: string, ms = DEFAULT_GUARD_MS): boolean {
  const now = Date.now();
  const until = lockUntilByKey.get(key) ?? 0;
  if (now < until) return false;
  lockUntilByKey.set(key, now + ms);
  return true;
}

export function runGuardedNav(key: string, action: () => void, ms = DEFAULT_GUARD_MS): void {
  if (!acquireNavLock(key, ms)) return;
  action();
}

export function guardedPush(
  router: Pick<Router, 'push'>,
  href: Href,
  ms = DEFAULT_GUARD_MS
): boolean {
  const key = `push:${hrefToKey(href)}`;
  if (!acquireNavLock(key, ms)) return false;
  router.push(href);
  return true;
}
