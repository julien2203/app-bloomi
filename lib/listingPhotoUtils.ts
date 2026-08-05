import type * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

export const MAX_LISTING_PHOTOS = 5;

/** Full / détail (zoom) — longest edge. */
export const LISTING_PHOTO_MAX_EDGE_PX = 1200;
export const LISTING_PHOTO_JPEG_QUALITY = 0.8;

/**
 * Variante feed / grilles — fichier sibling `*.card.jpg`.
 * Assez pour ~180–220dp @3x sans saturer l’egress.
 */
export const LISTING_CARD_MAX_EDGE_PX = 640;
export const LISTING_CARD_JPEG_QUALITY = 0.7;

/** Hors plage 0…n pour éviter listing_photos_listing_order_unique pendant insert/reorder. */
export const LISTING_PHOTO_TEMP_ORDER_BASE = 10_000;

export function temporaryListingPhotoOrderIndex(slot: number): number {
  return LISTING_PHOTO_TEMP_ORDER_BASE + slot;
}

export type ListingPhotoAsset = {
  uri: string;
  type?: string;
  name?: string;
  width?: number;
  height?: number;
};

export type PrepareListingPhotoOptions = {
  maxEdgePx?: number;
  quality?: number;
};

export function inferFileExtension(asset: ImagePicker.ImagePickerAsset): string {
  const mime = String((asset as { mimeType?: string }).mimeType ?? '').toLowerCase();
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('heic')) return 'heic';
  if (mime.includes('heif')) return 'heif';
  if (mime.includes('jpg') || mime.includes('jpeg')) return 'jpg';

  const source = String(asset.fileName ?? asset.uri ?? '').toLowerCase();
  const dotIndex = source.lastIndexOf('.');
  if (dotIndex >= 0 && dotIndex < source.length - 1) {
    return source.slice(dotIndex + 1).replace(/[^a-z0-9]/g, '') || 'jpg';
  }
  return 'jpg';
}

export function inferMimeType(asset: ImagePicker.ImagePickerAsset, ext: string): string {
  const mime = String((asset as { mimeType?: string }).mimeType ?? '').toLowerCase();
  if (mime.startsWith('image/')) return mime;

  switch (ext) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'heic':
      return 'image/heic';
    case 'heif':
      return 'image/heif';
    case 'jpg':
    case 'jpeg':
    default:
      return 'image/jpeg';
  }
}

export function assetsToListingPhotos(
  assets: ImagePicker.ImagePickerAsset[]
): ListingPhotoAsset[] {
  const ts = Date.now();
  return assets.map((asset, index) => {
    const ext = inferFileExtension(asset);
    const mime = inferMimeType(asset, ext);
    const rawName = String(asset.fileName ?? '').trim();
    const safeBase = rawName
      ? rawName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9-_]/g, '_')
      : `photo-${ts}-${index}`;
    return {
      uri: asset.uri,
      type: mime,
      name: `${safeBase}.${ext}`,
      width: typeof asset.width === 'number' ? asset.width : undefined,
      height: typeof asset.height === 'number' ? asset.height : undefined
    };
  });
}

function jpgStorageName(suggestedName?: string | null): string {
  const raw = String(suggestedName ?? 'photo').trim();
  const base = (raw.includes('.') ? raw.replace(/\.[^/.]+$/, '') : raw)
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${base || 'photo'}.jpg`;
}

/** `photo.jpg` → `photo.card.jpg` (idempotent si déjà `.card.`). */
export function toListingCardStorageFilename(filename: string): string {
  const trimmed = String(filename || '').trim() || 'photo.jpg';
  if (/\.card\.(jpe?g|png|webp)$/i.test(trimmed)) {
    return trimmed.replace(/\.(jpe?g|png|webp)$/i, '.jpg');
  }
  return trimmed.replace(/\.(jpe?g|png|webp)$/i, '.card.jpg');
}

/**
 * URL publique full → URL card sibling (même bucket/path).
 * Ne change pas les non-URLs / déjà-card.
 */
export function toListingCardImageUrl(url: string | null | undefined): string | null {
  const raw = url?.trim();
  if (!raw) return null;
  if (/\.card\.(jpe?g|png|webp)(\?|#|$)/i.test(raw)) return raw;
  if (!/\.(jpe?g|png|webp)(\?|#|$)/i.test(raw)) return raw;
  return raw.replace(/\.(jpe?g|png|webp)(\?[^#]*)?(#.*)?$/i, '.card.$1$2$3');
}

/** URL card → full (ou inchangée). */
export function toListingFullImageUrl(url: string | null | undefined): string | null {
  const raw = url?.trim();
  if (!raw) return null;
  return raw.replace(/\.card\.(jpe?g|png|webp)(\?[^#]*)?(#.*)?$/i, '.$1$2$3');
}

/**
 * Resize (max edge) + JPEG encode before Storage upload.
 */
export async function prepareListingPhotoForUpload(
  file: ListingPhotoAsset,
  options?: PrepareListingPhotoOptions
): Promise<ListingPhotoAsset> {
  const maxEdge = options?.maxEdgePx ?? LISTING_PHOTO_MAX_EDGE_PX;
  const quality = options?.quality ?? LISTING_PHOTO_JPEG_QUALITY;

  try {
    const w = typeof file.width === 'number' && file.width > 0 ? file.width : 0;
    const h = typeof file.height === 'number' && file.height > 0 ? file.height : 0;
    const actions: ImageManipulator.Action[] = [];

    if (w > 0 && h > 0 && Math.max(w, h) > maxEdge) {
      actions.push(w >= h ? { resize: { width: maxEdge } } : { resize: { height: maxEdge } });
    }

    let result = await ImageManipulator.manipulateAsync(file.uri, actions, {
      compress: quality,
      format: ImageManipulator.SaveFormat.JPEG
    });

    if (Math.max(result.width, result.height) > maxEdge) {
      result = await ImageManipulator.manipulateAsync(
        result.uri,
        result.width >= result.height
          ? [{ resize: { width: maxEdge } }]
          : [{ resize: { height: maxEdge } }],
        {
          compress: quality,
          format: ImageManipulator.SaveFormat.JPEG
        }
      );
    }

    return {
      uri: result.uri,
      type: 'image/jpeg',
      name: jpgStorageName(file.name),
      width: result.width,
      height: result.height
    };
  } catch {
    return file;
  }
}

/** Nom de fichier storage garanti unique (évite les collisions upsert: false). */
export function buildListingStorageFilename(
  orderIndex: number,
  _suggestedName?: string | null
): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `photo-${orderIndex}-${ts}-${rand}.jpg`;
}
