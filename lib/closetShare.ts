import { Platform, Share, type ShareContent } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

const DEFAULT_PUBLIC_SHARE_BASE_URL = 'https://bloomi.ch';

/** Deep link custom scheme — fallback interne (page web, scripts). */
export function getDressingDeepLink(sellerId: string): string {
  return `bloomi://dressing/${String(sellerId ?? '').trim()}`;
}

/** URL HTTPS publique — partage (Instagram, bio, messages) et Universal Links. */
export function getDressingWebUrl(sellerId: string): string {
  const id = String(sellerId ?? '').trim();
  if (!id) return DEFAULT_PUBLIC_SHARE_BASE_URL;

  const template = process.env.EXPO_PUBLIC_CLOSET_SHARE_URL?.trim();
  if (template) {
    return template.replaceAll('{id}', encodeURIComponent(id));
  }

  return `${DEFAULT_PUBLIC_SHARE_BASE_URL.replace(/\/+$/, '')}/dressing/${encodeURIComponent(id)}`;
}

/** Alias explicite pour le partage in-app. */
export const getDressingShareUrl = getDressingWebUrl;

export function parseDressingSellerIdFromUrl(url: string): string | null {
  try {
    const trimmed = url?.trim();
    if (!trimmed) return null;

    if (trimmed.toLowerCase().startsWith('bloomi://')) {
      const parsed = new URL(trimmed);
      if (parsed.host !== 'dressing') return null;
      const id = parsed.pathname.replace(/^\//, '').trim();
      return id || null;
    }

    const parsed = new URL(trimmed);

    const fromQuery = parsed.searchParams.get('id')?.trim();
    if (fromQuery && parsed.pathname.includes('closet-share')) {
      return fromQuery;
    }

    const pathMatch = parsed.pathname.match(/\/dressing\/([^/?#]+)/i);
    if (pathMatch?.[1]) {
      return decodeURIComponent(pathMatch[1]).trim() || null;
    }

    return null;
  } catch {
    return null;
  }
}

export type ClosetShareInput = {
  displayName: string;
  headline: string;
  url: string;
};

export type ClosetShareOptions = ClosetShareInput & {
  sellerId: string;
  imageUrl?: string | null;
};

function buildClosetShareText(input: ClosetShareInput): string {
  return [input.headline, '', input.url].join('\n');
}

export function getClosetShareContent(input: ClosetShareInput): ShareContent {
  return {
    title: input.displayName,
    message: buildClosetShareText(input)
  };
}

async function downloadClosetShareImage(
  imageUrl: string | null | undefined,
  sellerId: string
): Promise<string | null> {
  const url = imageUrl?.trim();
  if (!url) return null;

  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) return null;

  const safeId = String(sellerId).replace(/[^a-zA-Z0-9-]/g, '');
  const dest = `${cacheDir}bloomi-closet-share-${safeId}.jpg`;

  try {
    await FileSystem.deleteAsync(dest, { idempotent: true });
    const result = await FileSystem.downloadAsync(url, dest);
    if (result.status !== 200) return null;
    return result.uri;
  } catch {
    return null;
  }
}

/** Partage avec l'URL HTTPS bloomi.ch/dressing/… (Universal Links). */
export async function shareCloset(options: ClosetShareOptions): Promise<void> {
  const content = getClosetShareContent(options);
  const dialogTitle = options.displayName;

  if (Platform.OS === 'android') {
    await Share.share(content, { dialogTitle });
    return;
  }

  const localImageUri = await downloadClosetShareImage(options.imageUrl, options.sellerId);

  if (localImageUri) {
    await Share.share({ ...content, url: localImageUri });
    return;
  }

  await Share.share(content);
}
