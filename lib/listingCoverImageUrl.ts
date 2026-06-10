import { PixelRatio } from 'react-native';
import { SUPABASE_URL } from './env';

const SUPABASE_OBJECT_PUBLIC = '/storage/v1/object/public/';
const SUPABASE_RENDER_PUBLIC = '/storage/v1/render/image/public/';

type CoverImageOptions = {
  widthPx: number;
  heightPx?: number;
  quality?: number;
};

/**
 * Builds a Supabase Storage on-the-fly resize URL for listing cover images.
 * Falls back to the original URL when the source is not a Supabase public object URL.
 */
export function getListingCoverImageUrl(
  url: string | null | undefined,
  layoutWidthDp: number,
  layoutHeightDp?: number
): string | null {
  if (!url?.trim()) return null;

  const widthPx = Math.min(
    1200,
    Math.max(64, Math.ceil(layoutWidthDp * PixelRatio.get()))
  );
  const heightPx =
    layoutHeightDp != null
      ? Math.min(1600, Math.max(64, Math.ceil(layoutHeightDp * PixelRatio.get())))
      : undefined;

  return buildSupabaseRenderUrl(url.trim(), { widthPx, heightPx, quality: 80 });
}

function buildSupabaseRenderUrl(
  url: string,
  { widthPx, heightPx, quality = 80 }: CoverImageOptions
): string {
  const renderUrl = toSupabaseRenderUrl(url);
  if (!renderUrl) return url;

  const params = new URLSearchParams();
  params.set('width', String(widthPx));
  if (heightPx != null) {
    params.set('height', String(heightPx));
    params.set('resize', 'cover');
  }
  params.set('quality', String(quality));

  return `${renderUrl}?${params.toString()}`;
}

function toSupabaseRenderUrl(url: string): string | null {
  const base = SUPABASE_URL.replace(/\/$/, '');

  if (url.startsWith(base + SUPABASE_OBJECT_PUBLIC)) {
    return url.replace(SUPABASE_OBJECT_PUBLIC, SUPABASE_RENDER_PUBLIC);
  }

  try {
    const parsed = new URL(url);
    const baseParsed = new URL(base);
    if (parsed.origin !== baseParsed.origin) return null;

    const idx = parsed.pathname.indexOf(SUPABASE_OBJECT_PUBLIC);
    if (idx === -1) return null;

    const objectPath = parsed.pathname.slice(idx + SUPABASE_OBJECT_PUBLIC.length);
    return `${base}${SUPABASE_RENDER_PUBLIC}${objectPath}`;
  } catch {
    return null;
  }
}
