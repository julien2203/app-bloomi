/** Bump after blocking someone so feed/search refresh listings without relying only on focus. */

let revision = 0;
const listeners = new Set<() => void>();

export function bumpBlockedUsersRevision(): void {
  revision += 1;
  listeners.forEach((l) => l());
}

export function subscribeBlockedUsersRevision(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getBlockedUsersRevision(): number {
  return revision;
}
