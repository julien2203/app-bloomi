import {
  toListingCardImageUrl,
  toListingFullImageUrl
} from './listingPhotoUtils';

/**
 * Listing cover / photo display URLs.
 *
 * No Supabase Image Transformations (billed per origin image).
 * Feed/grids use pre-generated `*.card.jpg` siblings; detail/zoom uses full.
 */
export function getListingCoverImageUrl(
  url: string | null | undefined,
  _layoutWidthDp?: number,
  _layoutHeightDp?: number
): string | null {
  return toListingCardImageUrl(url);
}

export function getListingFullImageUrl(url: string | null | undefined): string | null {
  return toListingFullImageUrl(url);
}
