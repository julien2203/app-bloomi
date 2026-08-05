import type { Href, Router } from 'expo-router';
import { notificationsShortcutHref } from './feedShortcutNav';
import { navigateInTabs } from './navigateInTabs';

export const LISTING_RETURN_TO = 'return_to';
export const LISTING_RETURN_USER_ID = 'return_user_id';
export const LISTING_RETURN_LISTING_ID = 'return_listing_id';
export const PROFILE_RETURN_TO = 'profile_return_to';
export const RETURN_QUERY = 'return_query';
export const RETURN_SEARCH_TAB = 'return_search_tab';
export const FAVORITES_STACK = 'favorites_stack';

export type ListingReturnTo =
  | 'feed'
  | 'profile'
  | 'public-profile'
  | 'favorites'
  | 'search'
  | 'results'
  | 'messages';

export type ListingReturnParams = {
  return_to?: string;
  return_user_id?: string;
  return_listing_id?: string;
  profile_return_to?: string;
  return_query?: string;
  return_search_tab?: string;
  favorites_stack?: string;
};

type SearchParams = Record<string, string | string[] | undefined>;

function paramString(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function pickListingReturnParams(params: SearchParams): ListingReturnParams {
  const out: ListingReturnParams = {};
  const return_to = paramString(params[LISTING_RETURN_TO]);
  const return_user_id = paramString(params[LISTING_RETURN_USER_ID]);
  const return_listing_id = paramString(params[LISTING_RETURN_LISTING_ID]);
  const profile_return_to = paramString(params[PROFILE_RETURN_TO]);
  const return_query = paramString(params[RETURN_QUERY]);
  const return_search_tab = paramString(params[RETURN_SEARCH_TAB]);
  const favorites_stack = paramString(params[FAVORITES_STACK]);
  if (return_to) out.return_to = return_to;
  if (return_user_id) out.return_user_id = return_user_id;
  if (return_listing_id) out.return_listing_id = return_listing_id;
  if (profile_return_to) out.profile_return_to = profile_return_to;
  if (return_query) out.return_query = return_query;
  if (return_search_tab) out.return_search_tab = return_search_tab;
  if (favorites_stack) out.favorites_stack = favorites_stack;
  return out;
}

export function buildListingDetailParams(
  listingId: string,
  opts?: ListingReturnParams & { cover_photo?: string; extra?: Record<string, string> }
): Record<string, string> {
  const params: Record<string, string> = { id: listingId, ...opts?.extra };
  if (opts?.return_to) params[LISTING_RETURN_TO] = opts.return_to;
  if (opts?.return_user_id) params[LISTING_RETURN_USER_ID] = opts.return_user_id;
  if (opts?.profile_return_to) params[PROFILE_RETURN_TO] = opts.profile_return_to;
  if (opts?.return_query) params[RETURN_QUERY] = opts.return_query;
  if (opts?.return_search_tab) params[RETURN_SEARCH_TAB] = opts.return_search_tab;
  return params;
}

type ListingDetailPathBase = '/tabs/feed' | '/tabs/search' | '/tabs/results' | '/tabs/public-profile';

export function resolveListingDetailPathBase(
  returnTo?: string,
  pathname?: string
): ListingDetailPathBase {
  if (pathname?.includes('/tabs/public-profile')) return '/tabs/public-profile';
  if (pathname?.includes('/tabs/results')) return '/tabs/results';
  if (pathname?.includes('/tabs/search')) return '/tabs/search';
  switch (returnTo) {
    case 'public-profile':
      return '/tabs/public-profile';
    case 'results':
      return '/tabs/results';
    case 'search':
      return '/tabs/search';
    default:
      return '/tabs/feed';
  }
}

export function listingDetailHref(
  listingId: string,
  opts?: ListingReturnParams & { cover_photo?: string; detailPathBase?: ListingDetailPathBase }
): Href {
  const params = buildListingDetailParams(listingId, opts);
  if (opts?.cover_photo) params.cover_photo = opts.cover_photo;
  const base = opts?.detailPathBase ?? '/tabs/feed';
  return { pathname: `${base}/[id]` as '/tabs/feed/[id]', params };
}

type ListingBackContext = ListingReturnParams & {
  from_notifications?: string;
  from_notifications_origin?: string;
  from_offer_chat?: string;
  fallback?: Href;
};

function hrefForReturnTo(ctx: ListingReturnParams): Href | null {
  switch (ctx.return_to) {
    case 'public-profile':
      if (ctx.return_user_id) {
        const params: Record<string, string> = { user_id: ctx.return_user_id };
        const profileReturnTo = ctx.profile_return_to;
        if (profileReturnTo) params[LISTING_RETURN_TO] = profileReturnTo;
        if (ctx.return_query) params[RETURN_QUERY] = ctx.return_query;
        if (ctx.return_search_tab) params[RETURN_SEARCH_TAB] = ctx.return_search_tab;
        return {
          pathname: '/tabs/public-profile',
          params
        };
      }
      return '/tabs/public-profile';
    case 'profile':
      return '/tabs/profile';
    case 'favorites':
      return ctx.favorites_stack === 'feed' ? '/tabs/feed/favorites' : '/tabs/profile/favorites';
    case 'search':
      if (ctx.return_query || ctx.return_search_tab) {
        const params: Record<string, string> = {};
        if (ctx.return_query) params.query = ctx.return_query;
        if (
          ctx.return_search_tab === 'members' ||
          ctx.return_search_tab === 'listings'
        ) {
          params.search_tab = ctx.return_search_tab;
        }
        return { pathname: '/tabs/search', params };
      }
      return '/tabs/search';
    case 'results':
      return '/tabs/results';
    case 'messages':
      return '/tabs/messages';
    case 'feed':
      return '/tabs/feed';
    default:
      return null;
  }
}

function shouldUseNavigateInTabs(returnTo?: string): boolean {
  return returnTo === 'search' || returnTo === 'results';
}

function navigateToReturnHref(router: Router, ctx: ListingReturnParams) {
  const returnHref = hrefForReturnTo(ctx);
  if (!returnHref) return false;
  if (shouldUseNavigateInTabs(ctx.return_to)) {
    navigateInTabs(returnHref);
  } else {
    router.replace(returnHref);
  }
  return true;
}

/** Retour depuis la fiche article (feed/[id]). */
export function navigateBackFromListingDetail(router: Router, ctx: ListingBackContext) {
  if (ctx.from_notifications === '1') {
    const origin =
      ctx.from_notifications_origin === 'feed' || ctx.from_notifications_origin === 'profile'
        ? ctx.from_notifications_origin
        : undefined;
    router.replace({
      pathname: notificationsShortcutHref(origin),
      params: origin ? { from: origin } : undefined
    });
    return;
  }
  if (ctx.from_offer_chat === '1') {
    router.replace('/tabs/feed');
    return;
  }
  // Pop d'abord (animation retour correcte). return_to / replace seulement si pas d'historique.
  if (router.canGoBack?.()) {
    router.back();
    return;
  }
  if (navigateToReturnHref(router, ctx)) return;

  router.replace(ctx.fallback ?? '/tabs/feed');
}

/** Retour depuis l’édition d’annonce (profil / dressing). */
export function navigateBackFromEditListing(router: Router, ctx: ListingReturnParams) {
  if (ctx.return_listing_id) {
    router.replace(
      listingDetailHref(ctx.return_listing_id, {
        return_to: ctx.return_to,
        return_user_id: ctx.return_user_id,
        profile_return_to: ctx.profile_return_to,
        return_query: ctx.return_query,
        return_search_tab: ctx.return_search_tab,
        detailPathBase: resolveListingDetailPathBase(ctx.return_to)
      })
    );
    return;
  }
  if (navigateToReturnHref(router, ctx)) return;

  // Ne pas utiliser router.back() : la pile edit-listing peut contenir des sous-écrans (catégorie, etc.).
  router.replace('/tabs/profile');
}

export function listingDetailFromPublicProfileHref(
  listingId: string,
  userId: string,
  publicProfileCtx: ListingReturnParams,
  opts?: { cover_photo?: string }
): Href {
  return listingDetailHref(listingId, {
    return_to: 'public-profile',
    return_user_id: userId,
    profile_return_to: publicProfileCtx.return_to,
    return_query: publicProfileCtx.return_query,
    return_search_tab: publicProfileCtx.return_search_tab,
    cover_photo: opts?.cover_photo,
    detailPathBase: '/tabs/public-profile'
  });
}

export function publicProfileHref(
  userId: string,
  opts?: ListingReturnParams & { username?: string }
): Href {
  const params: Record<string, string> = { user_id: userId };
  if (opts?.username) params.username = opts.username;
  if (opts?.return_to) params[LISTING_RETURN_TO] = opts.return_to;
  if (opts?.return_user_id) params[LISTING_RETURN_USER_ID] = opts.return_user_id;
  if (opts?.return_query) params[RETURN_QUERY] = opts.return_query;
  if (opts?.return_search_tab) params[RETURN_SEARCH_TAB] = opts.return_search_tab;
  return { pathname: '/tabs/public-profile', params };
}

/** Retour depuis le profil public (dressing vendeur). */
export function navigateBackFromPublicProfile(
  router: Router,
  ctx: ListingReturnParams & { isMe?: boolean }
) {
  if (ctx.isMe) {
    router.replace('/tabs/profile');
    return;
  }
  // Pop d'abord (ex. Search → dressing) pour l'animation retour ; replace en fallback.
  if (router.canGoBack?.()) {
    router.back();
    return;
  }
  if (navigateToReturnHref(router, ctx)) return;

  router.replace('/tabs/feed');
}
