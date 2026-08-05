/**
 * Réécrit les liens système vers les routes in-app.
 * - `https://bloomi.ch/listing/{id}` → fiche article
 * - `bloomi://dressing/{userId}` → dressing public
 */
export function redirectSystemPath({
  path,
  initial
}: {
  path: string;
  initial: boolean;
}): string {
  try {
    const dressingFromPath = path.match(/^\/?dressing\/([^/?#]+)/)?.[1]?.trim();
    if (dressingFromPath) {
      return `/dressing/${dressingFromPath}`;
    }

    const listingFromPath = path.match(/^\/?listing\/([^/?#]+)/)?.[1]?.trim();
    if (listingFromPath) {
      return `/tabs/feed/${listingFromPath}`;
    }

    if (initial && (path.startsWith('http://') || path.startsWith('https://'))) {
      const url = new URL(path);
      if (
        (url.hostname === 'bloomi.ch' || url.hostname === 'www.bloomi.ch') &&
        (url.pathname === '/onboarding-return' || url.pathname === '/onboarding-refresh')
      ) {
        return '/tabs/profile/activate-seller-account';
      }
      const dressingFromUrl = extractDressingIdFromUrl(url);
      if (dressingFromUrl) {
        return `/dressing/${dressingFromUrl}`;
      }
      const listingFromUrl = extractListingIdFromUrl(url);
      if (listingFromUrl) {
        return `/tabs/feed/${listingFromUrl}`;
      }
    }

    if (initial && path.startsWith('bloomi://')) {
      const url = new URL(path);
      const dressingFromUrl = extractDressingIdFromUrl(url);
      if (dressingFromUrl) {
        return `/dressing/${dressingFromUrl}`;
      }
      const listingFromUrl = extractListingIdFromUrl(url);
      if (listingFromUrl) {
        return `/tabs/feed/${listingFromUrl}`;
      }
    }

    return path;
  } catch {
    return path;
  }
}

function extractDressingIdFromUrl(url: URL): string | null {
  if (url.protocol === 'bloomi:' && url.host === 'dressing') {
    const id = url.pathname.replace(/^\//, '').trim();
    return id || null;
  }

  if (
    (url.hostname === 'bloomi.ch' || url.hostname === 'www.bloomi.ch') &&
    url.pathname.startsWith('/dressing/')
  ) {
    const id = url.pathname.replace(/^\/dressing\//, '').split('/')[0]?.trim();
    return id || null;
  }

  if (url.pathname.includes('closet-share')) {
    const id = url.searchParams.get('id')?.trim();
    return id || null;
  }

  return null;
}

function extractListingIdFromUrl(url: URL): string | null {
  if (url.protocol === 'bloomi:' && url.host === 'listing') {
    const id = url.pathname.replace(/^\//, '').trim();
    return id || null;
  }

  if (
    (url.hostname === 'bloomi.ch' || url.hostname === 'www.bloomi.ch') &&
    url.pathname.startsWith('/listing/')
  ) {
    const id = url.pathname.replace(/^\/listing\//, '').split('/')[0]?.trim();
    return id || null;
  }

  if (url.pathname.includes('listing-share')) {
    const id = url.searchParams.get('id')?.trim();
    return id || null;
  }

  return null;
}
