import { Platform, Share, type ShareContent } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

const DEFAULT_PUBLIC_SHARE_BASE_URL = 'https://bloomi.ch';

/** Deep link custom scheme — fallback interne (page web, scripts). */
export function getListingDeepLink(listingId: string): string {
  return `bloomi://listing/${String(listingId ?? '').trim()}`;
}

/** URL HTTPS publique — partage (Instagram, messages) et Universal Links. */
export function getListingWebUrl(listingId: string): string {
  const id = String(listingId ?? '').trim();
  if (!id) return DEFAULT_PUBLIC_SHARE_BASE_URL;

  const template = process.env.EXPO_PUBLIC_LISTING_SHARE_URL?.trim();
  if (template) {
    return template.replaceAll('{id}', encodeURIComponent(id));
  }

  return `${DEFAULT_PUBLIC_SHARE_BASE_URL.replace(/\/+$/, '')}/listing/${encodeURIComponent(id)}`;
}

/** Alias explicite pour le partage in-app. */
export const getListingShareUrl = getListingWebUrl;

export function parseListingIdFromUrl(url: string): string | null {
  try {
    const trimmed = url?.trim();
    if (!trimmed) return null;

    if (trimmed.toLowerCase().startsWith('bloomi://')) {
      const parsed = new URL(trimmed);
      if (parsed.host !== 'listing') return null;
      const id = parsed.pathname.replace(/^\//, '').trim();
      return id || null;
    }

    const parsed = new URL(trimmed);

    const fromQuery = parsed.searchParams.get('id')?.trim();
    if (fromQuery && parsed.pathname.includes('listing-share')) {
      return fromQuery;
    }

    const pathMatch = parsed.pathname.match(/\/listing\/([^/?#]+)/i);
    if (pathMatch?.[1]) {
      return decodeURIComponent(pathMatch[1]).trim() || null;
    }

    return null;
  } catch {
    return null;
  }
}

export type ListingShareInput = {
  title: string;
  priceLabel: string;
  brand?: string | null;
  headline: string;
  url: string;
};

export type ListingShareOptions = ListingShareInput & {
  listingId: string;
  imageUrl?: string | null;
};

function buildListingShareText(input: ListingShareInput): string {
  const detailLine = input.brand
    ? `${input.title}\n${input.priceLabel} · ${input.brand}`
    : `${input.title}\n${input.priceLabel}`;

  return [input.headline, '', detailLine, '', input.url].join('\n');
}

/** Partage avec l'URL HTTPS bloomi.ch/listing/… */
export function getListingShareContent(input: ListingShareInput): ShareContent {
  return {
    title: input.title,
    message: buildListingShareText(input),
    url: input.url
  };
}

async function downloadListingShareImage(
  imageUrl: string | null | undefined,
  listingId: string
): Promise<string | null> {
  const url = imageUrl?.trim();
  if (!url) return null;

  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) return null;

  const safeId = String(listingId).replace(/[^a-zA-Z0-9-]/g, '');
  const dest = `${cacheDir}bloomi-share-${safeId}.jpg`;

  try {
    await FileSystem.deleteAsync(dest, { idempotent: true });
    const result = await FileSystem.downloadAsync(url, dest);
    if (result.status !== 200) return null;
    return result.uri;
  } catch {
    return null;
  }
}

/**
 * Partage texte + image de couverture (iOS uniquement).
 * Android : texte seul — WhatsApp et la plupart des apps Android ne combinent
 * pas image + texte dans un seul intent (fallback précédent = image seule).
 */
export async function shareListing(options: ListingShareOptions): Promise<void> {
  const content = getListingShareContent(options);
  const dialogTitle = options.title;

  if (Platform.OS === 'android') {
    await Share.share(content, { dialogTitle });
    return;
  }

  const localImageUri = await downloadListingShareImage(
    options.imageUrl,
    options.listingId
  );

  if (localImageUri) {
    await Share.share({ ...content, url: localImageUri });
    return;
  }

  await Share.share(content);
}
