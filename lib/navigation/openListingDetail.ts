import { Image } from 'expo-image';
import type { Router } from 'expo-router';
import { getListingCoverImageUrl } from '../listingCoverImageUrl';
import { guardedPush } from './guardedNav';
import { listingDetailHref, type ListingReturnParams } from './listingDetailNav';

type OpenListingDetailOpts = ListingReturnParams & {
  cover_photo?: string | null;
  detailPathBase?: '/tabs/feed' | '/tabs/search' | '/tabs/results' | '/tabs/public-profile';
  imageWidthDp?: number;
  imageHeightDp?: number;
};

/** Précharge la cover card (expo-image) avant navigation vers la fiche annonce. */
export function prefetchListingCoverImage(coverUrl: string | null | undefined): void {
  const uri = getListingCoverImageUrl(coverUrl);
  if (uri) void Image.prefetch(uri);
}

export function openListingDetail(
  router: Pick<Router, 'push'>,
  listingId: string,
  opts?: OpenListingDetailOpts
): boolean {
  if (opts?.cover_photo) {
    prefetchListingCoverImage(opts.cover_photo);
  }
  return guardedPush(
    router,
    listingDetailHref(listingId, {
      return_to: opts?.return_to,
      return_user_id: opts?.return_user_id,
      return_listing_id: opts?.return_listing_id,
      profile_return_to: opts?.profile_return_to,
      return_query: opts?.return_query,
      return_search_tab: opts?.return_search_tab,
      favorites_stack: opts?.favorites_stack,
      cover_photo: opts?.cover_photo ?? undefined,
      detailPathBase: opts?.detailPathBase
    })
  );
}
