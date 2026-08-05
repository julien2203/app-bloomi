import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Alert,
  FlatList,
  Keyboard,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  View,
  useWindowDimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../ui/Screen';
import { Text } from '../ui/Text';
import { theme } from '../../lib/theme';
import { AppIcon } from '../ui/AppIcon';
import { ProductCard } from '../ProductCard';
import { getCardImagePriority, LIST_IMAGE_PERF_PROPS } from '../../lib/cardImagePriority';
import { supabase } from '../../lib/supabase';
import {
  cloneFeedListings,
  excludeBlockedSellers,
  getBlockedSellerIdsForCurrentUser,
  searchMemberProfiles,
  type FeedListing,
  type MemberSearchRow
} from '../../lib/api';
import { type FeedFilters, useFeedFiltersStore } from '../../lib/store/feedFilters';
import { useSearchFiltersStore } from '../../lib/store/searchFilters';
import { HIT_SLOP_COMFORTABLE, HEADER_ICON_TOUCH_CONTAINER } from '../../lib/touchTargets';
import { HeaderBackButton } from '../ui/HeaderBackButton';
import { getFixedTabBarHeight } from '../../components/navigation/FloatingTabBar';
import { navigateInTabs } from '../../lib/navigation/navigateInTabs';
import {
  FILTERS_PATH_SEARCH_STACK,
  FILTERS_PATH_TABS_ROOT,
  filtersScreenPath,
  type FiltersStackBase
} from '../../lib/navigation/filterRoutes';
import { navigateToBrandFilter } from '../../lib/navigation/brandFilterNav';
import { subscribeBlockedUsersRevision } from '../../lib/store/blockedUsersSync';
import { useTranslation } from 'react-i18next';
import { translateCategoryLabel } from '../../lib/categoryI18n';
import { expandConditionFilterValues } from '../../lib/conditionI18n';
import { publicProfileHref } from '../../lib/navigation/listingDetailNav';
import { openListingDetail } from '../../lib/navigation/openListingDetail';
import { InfluencerBadge } from '../InfluencerBadge';
import { fetchTrendingListings, filterTrendingListings } from '../../lib/trendingListings';
import { GRID_GAP_COMPACT, GRID_PADDING_X, gridCardWidth } from '../../lib/cardLayout';

export type ResultsSection = 'sponsored' | 'trending' | 'influencer' | 'all' | 'search';

type SearchResultTab = 'listings' | 'members';

type ResultsListing = FeedListing & {
  likes_count?: number | null;
  is_sponsored?: boolean | null;
  sponsored_until?: string | null;
  size?: string | null;
  color?: string | null;
};

type SellerShowcase = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  is_influencer: boolean | null;
  company_name: string | null;
  seller_type: 'individual' | 'pro' | 'sole_proprietorship' | null;
  active_count: number;
  thumbs: Array<{ id: string; cover_photo_url: string | null }>;
};

type MixedItem =
  | { type: 'listing'; data: ResultsListing }
  | { type: 'showcase'; data: SellerShowcase; id: string };

/** Snapshot de la liste « tous les articles » avant une recherche (onglet Search). */
type BrowseSnapshot = {
  results: ResultsListing[];
  page: number;
  hasMore: boolean;
  resultCount: number | null;
  scrollOffset: number;
  filtersKey: string;
};

const PAGE_SIZE = 20;

function filtersAreActive(f: FeedFilters): boolean {
  return (
    Boolean(f.categoryIds?.length) ||
    Boolean(f.conditionIds?.length) ||
    f.priceMin != null ||
    f.priceMax != null ||
    Boolean(f.brandIds?.length) ||
    Boolean(f.sizeIds?.length) ||
    Boolean(f.colorIds?.length) ||
    f.nearbyKm != null
  );
}

function buildListingSearchOrFilter(rawQuery: string): string | null {
  const trimmed = rawQuery.trim();
  if (!trimmed) return null;
  const escaped = trimmed.replace(/"/g, '""');
  const pattern = `"*${escaped}*"`;
  return `title.ilike.${pattern},description.ilike.${pattern},brand.ilike.${pattern}`;
}

function buildListingSearchOrFilterTitleDesc(rawQuery: string): string | null {
  const trimmed = rawQuery.trim();
  if (!trimmed) return null;
  const escaped = trimmed.replace(/"/g, '""');
  const pattern = `"*${escaped}*"`;
  return `title.ilike.${pattern},description.ilike.${pattern}`;
}

/** Tri sur la section Search une fois les filtres appliqués (`applyBaseSection` pour Search ne pose pas l’ordre). */
function applySearchListingOrder(qb: any, sortBy: string | undefined) {
  switch (sortBy) {
    case 'price_asc':
      return qb.order('price', { ascending: true }).order('created_at', { ascending: false });
    case 'price_desc':
      return qb.order('price', { ascending: false }).order('created_at', { ascending: false });
    case 'relevance':
    case 'recent':
    default:
      return qb.order('created_at', { ascending: false });
  }
}

/** Pills catégories (EN) sur l’onglet Search → même flux que `filters/category-gender` (param `gender` Woman/Men/Kids/Baby). */
const SEARCH_CATEGORY_GENDER_LABELS = ['Women', 'Men', 'Kids', 'Baby'] as const;
type SearchCategoryGenderLabel = (typeof SEARCH_CATEGORY_GENDER_LABELS)[number];
const SEARCH_CATEGORY_TO_FILTER_GENDER: Record<
  SearchCategoryGenderLabel,
  'Woman' | 'Men' | 'Kids' | 'Baby'
> = {
  Women: 'Woman',
  Men: 'Men',
  Kids: 'Kids',
  Baby: 'Baby'
};
const SEARCH_CATEGORY_DB_GENDER: Record<SearchCategoryGenderLabel, string> = {
  Women: 'femme',
  Men: 'homme',
  Kids: 'enfant',
  Baby: 'bebe'
};

type ResultsFilterPill =
  | SearchCategoryGenderLabel
  | 'Clear'
  | 'Filter'
  | 'Nearby'
  | 'Size'
  | 'Brand'
  | 'Condition'
  | 'Color'
  | 'Price';

export function UniversalResultsScreen(props: {
  title?: string;
  section: ResultsSection;
  initialQuery?: string;
  showBack?: boolean;
  /** Tab Search : au retour des filtres, relance la requête (focus) */
  reloadOnFocus?: boolean;
  /** Onglet Search uniquement : pills genre + filtres alignés, skeleton au reload, pas de vitrines vendeurs */
  standaloneSearch?: boolean;
  /** Incrémenté par le tab Search à chaque focus : force un reload aligné sur le store Zustand */
  searchFocusReloadNonce?: number;
  /** Onglet Search : restaurer Articles / Membres au retour depuis un profil */
  initialSearchTab?: SearchResultTab;
}) {
  const { t } = useTranslation();
  const {
    title,
    section,
    initialQuery,
    showBack = true,
    reloadOnFocus = false,
    standaloneSearch = false,
    searchFocusReloadNonce = 0,
    initialSearchTab
  } = props;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const resultsGridCardWidth = useMemo(
    () => gridCardWidth(screenWidth, GRID_PADDING_X, GRID_GAP_COMPACT),
    [screenWidth]
  );
  const feedStore = useFeedFiltersStore();
  const searchStore = useSearchFiltersStore();
  const { filters, setFilter, resetFilters } = standaloneSearch ? searchStore : feedStore;
  const fixedTabBarReserveSpace = getFixedTabBarHeight(insets.bottom);
  const isSearchTabScreen = standaloneSearch && section === 'search';
  const listingDetailPathBase: '/tabs/feed' | '/tabs/search' | '/tabs/results' =
    isSearchTabScreen ? '/tabs/search' : '/tabs/results';

  /** Même rangée de pills que l’onglet Search (Clear + genre + taille, etc.) pour les écrans Results « View all » (sponsored, trending, …). */
  const searchStyleFilters = useMemo(
    () =>
      standaloneSearch ||
      ['sponsored', 'trending', 'influencer', 'all'].includes(section),
    [standaloneSearch, section]
  );

  const [query, setQuery] = useState(initialQuery ?? '');
  const [results, setResults] = useState<ResultsListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [resultCount, setResultCount] = useState<number | null>(null);

  const [influencerIds, setInfluencerIds] = useState<string[] | null>(null);
  const [showcases, setShowcases] = useState<SellerShowcase[]>([]);
  const [loadingShowcases, setLoadingShowcases] = useState(false);

  const [searchResultTab, setSearchResultTab] = useState<SearchResultTab>(
    initialSearchTab === 'members' ? 'members' : 'listings'
  );
  const [memberResults, setMemberResults] = useState<MemberSearchRow[]>([]);
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberLoadingMore, setMemberLoadingMore] = useState(false);
  const [memberHasMore, setMemberHasMore] = useState(true);
  const memberPageRef = useRef(0);

  const pageRef = useRef(0);
  const loadRequestRef = useRef(0);
  const memberLoadRequestRef = useRef(0);
  const reloadScheduleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevQueryForDebounceRef = useRef(query);
  const showcaseReqRef = useRef(0);
  const resultsListRef = useRef<FlatList<MixedItem> | null>(null);
  const browseSnapshotRef = useRef<BrowseSnapshot | null>(null);
  const browseScrollOffsetRef = useRef(0);
  const pendingBrowseScrollRef = useRef<number | null>(null);
  const resultsRef = useRef(results);
  resultsRef.current = results;
  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;
  const resultCountRef = useRef(resultCount);
  resultCountRef.current = resultCount;

  const [nearbyModalOpen, setNearbyModalOpen] = useState(false);
  const [nearbyDraftKm, setNearbyDraftKm] = useState<number | null>(filters.nearbyKm ?? null);
  const [nearbyConfirming, setNearbyConfirming] = useState(false);
  const skeletonOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;

  /** Genre DB (`categories.gender`) pour la catégorie sélectionnée — pills actives sur Search */
  const [resolvedCategoryGenderDb, setResolvedCategoryGenderDb] = useState<string | null>(null);
  /** Libellés candidats pour `v_feed_listings.category` (nom + slug catégorie). */
  const [resolvedCategoryLabels, setResolvedCategoryLabels] = useState<string[]>([]);
  const [resolvedSelectedCategoryNames, setResolvedSelectedCategoryNames] = useState<string[]>([]);

  const headerTitle = useMemo(() => {
    if (typeof title === 'string' && title.trim()) return title;
    switch (section) {
      case 'sponsored':
        return t('feed.tabs.sponsored');
      case 'trending':
        return t('feed.tabs.trending');
      case 'influencer':
        return t('feed.tabs.influencers');
      case 'all':
        return t('feed.tabs.allItems');
      case 'search':
      default:
        return t('navigation.search');
    }
  }, [section, t, title]);

  const effectiveFilters = filters;

  const isAnyFilterActive = useMemo(
    () => filtersAreActive(effectiveFilters),
    [effectiveFilters]
  );

  // Resolve ID-based filters (sizeIds/brandIds/colorIds) into text labels stored on listings.
  // In this codebase, listings store brand/size/color as TEXT, and filter tables map ids -> labels/names.
  const [resolvedSizeLabels, setResolvedSizeLabels] = useState<string[]>([]);
  const [resolvedBrandNames, setResolvedBrandNames] = useState<string[]>([]);
  const [resolvedColorNames, setResolvedColorNames] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      // Sizes
      const sizeIds = effectiveFilters.sizeIds ?? [];
      if (sizeIds.length > 0) {
        const idsAsNumbers = sizeIds.map((id) => Number(id)).filter((n) => Number.isFinite(n));
        const { data, error } = await supabase
          .from('sizes')
          .select('id, label')
          .in('id', idsAsNumbers.length ? idsAsNumbers : [-1]);
        if (!cancelled) {
          if (error) setResolvedSizeLabels([]);
          else {
            const byId = new Map<string, string>();
            for (const r of (data || []) as any[]) {
              byId.set(String(r.id), String(r.label));
            }
            setResolvedSizeLabels(
              sizeIds.map((id) => byId.get(String(id))).filter((x): x is string => Boolean(x))
            );
          }
        }
      } else {
        setResolvedSizeLabels([]);
      }

      // Brands
      const brandIds = effectiveFilters.brandIds ?? [];
      if (brandIds.length > 0) {
        const idsAsNumbers = brandIds.map((id) => Number(id)).filter((n) => Number.isFinite(n));
        const { data, error } = await supabase
          .from('brands')
          .select('id, name')
          .in('id', idsAsNumbers.length ? idsAsNumbers : [-1]);
        if (!cancelled) {
          if (error) setResolvedBrandNames([]);
          else {
            const byId = new Map<string, string>();
            for (const r of (data || []) as any[]) {
              byId.set(String(r.id), String(r.name));
            }
            setResolvedBrandNames(
              brandIds.map((id) => byId.get(String(id))).filter((x): x is string => Boolean(x))
            );
          }
        }
      } else {
        setResolvedBrandNames([]);
      }

      // Colors
      const colorIds = effectiveFilters.colorIds ?? [];
      if (colorIds.length > 0) {
        const idsAsNumbers = colorIds.map((id) => Number(id)).filter((n) => Number.isFinite(n));
        const { data, error } = await supabase
          .from('colors')
          .select('id, name')
          .in('id', idsAsNumbers.length ? idsAsNumbers : [-1]);
        if (!cancelled) {
          if (error) setResolvedColorNames([]);
          else {
            const byId = new Map<string, string>();
            for (const r of (data || []) as any[]) {
              byId.set(String(r.id), String(r.name));
            }
            setResolvedColorNames(
              colorIds.map((id) => byId.get(String(id))).filter((x): x is string => Boolean(x))
            );
          }
        }
      } else {
        setResolvedColorNames([]);
      }
    };

    void resolve();
    return () => {
      cancelled = true;
    };
  }, [
    effectiveFilters.sizeIds,
    effectiveFilters.brandIds,
    effectiveFilters.colorIds
  ]);

  useEffect(() => {
    const categoryIds = filters.categoryIds ?? [];
    if (categoryIds.length === 0) {
      setResolvedCategoryGenderDb(null);
      setResolvedCategoryLabels([]);
      setResolvedSelectedCategoryNames([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, gender, name, slug')
        .in('id', categoryIds as any);
      if (cancelled) return;
      if (error || !data || data.length === 0) {
        setResolvedCategoryGenderDb(null);
        setResolvedCategoryLabels([]);
        setResolvedSelectedCategoryNames([]);
        return;
      }
      const rows = data as Array<{
        id: string | number;
        gender?: string | null;
        name?: string | null;
        slug?: string | null;
      }>;
      const byId = new Map<string, (typeof rows)[number]>();
      for (const row of rows) byId.set(String(row.id), row);
      const orderedRows = categoryIds
        .map((id) => byId.get(String(id)))
        .filter((row): row is (typeof rows)[number] => Boolean(row));
      const genders = new Set(
        orderedRows
          .map((row) => (typeof row.gender === 'string' ? row.gender : null))
          .filter((g): g is string => Boolean(g && g.length > 0))
      );
      setResolvedCategoryGenderDb(genders.size === 1 ? Array.from(genders)[0] : null);
      const cands = orderedRows.flatMap((row) => [row.name, row.slug])
        .map((x) => (x != null ? String(x).trim() : ''))
        .filter(Boolean);
      setResolvedCategoryLabels([...new Set(cands)]);
      setResolvedSelectedCategoryNames(
        orderedRows
          .map((row) => {
            const name = row.name != null ? String(row.name).trim() : '';
            if (!name) return '';
            return translateCategoryLabel({ name, slug: row.slug }, t);
          })
          .filter(Boolean)
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [filters.categoryIds, t]);

  const browseFiltersKey = useMemo(
    () =>
      JSON.stringify({
        f: effectiveFilters,
        brands: resolvedBrandNames,
        sizes: resolvedSizeLabels,
        colors: resolvedColorNames,
        categories: resolvedCategoryLabels,
        section
      }),
    [
      effectiveFilters,
      resolvedBrandNames,
      resolvedColorNames,
      resolvedCategoryLabels,
      resolvedSizeLabels,
      section
    ]
  );

  const loadInfluencerIds = useCallback(async () => {
    if (section !== 'influencer') return;
    if (influencerIds !== null) return;
    const { data, error } = await supabase.from('profiles').select('id').eq('is_influencer', true).limit(500);
    if (error) {
      setInfluencerIds([]);
      return;
    }
    const ids = (data || []).map((r: any) => String(r.id)).filter(Boolean);
    setInfluencerIds(ids);
  }, [influencerIds, section]);

  const applyBaseSection = useCallback(
    (qb: any) => {
      const nowIso = new Date().toISOString();
      switch (section) {
        case 'sponsored':
          return qb
            .eq('is_sponsored', true)
            .gt('sponsored_until', nowIso)
            .order('sponsored_until', { ascending: false })
            .order('created_at', { ascending: false });
        case 'trending': {
          const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          return qb
            .gte('created_at', from)
            .order('likes_count', { ascending: false, nullsLast: true })
            .order('created_at', { ascending: false });
        }
        case 'influencer': {
          const ids = influencerIds ?? [];
          if (ids.length === 0) return qb.in('seller_id', ['__none__']);
          return qb
            .in('seller_id', ids)
            .eq('status', 'published')
            .order('created_at', { ascending: false });
        }
        case 'all':
          return qb.eq('status', 'published').order('created_at', { ascending: false });
        case 'search':
          return qb.eq('status', 'published');
        default:
          return qb.eq('status', 'published').order('created_at', { ascending: false });
      }
    },
    [influencerIds, section]
  );

  const applySectionConstraints = useCallback(
    (qb: any) => {
      const nowIso = new Date().toISOString();
      switch (section) {
        case 'sponsored':
          return qb.eq('is_sponsored', true).gt('sponsored_until', nowIso);
        case 'trending': {
          const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          return qb.gte('created_at', from);
        }
        case 'influencer': {
          const ids = influencerIds ?? [];
          if (ids.length === 0) return qb.in('seller_id', ['__none__']);
          return qb.in('seller_id', ids).eq('status', 'published');
        }
        case 'all':
        case 'search':
        default:
          return qb.eq('status', 'published');
      }
    },
    [influencerIds, section]
  );

  const applyFilters = useCallback(
    (qb: any) => {
      const f: FeedFilters = standaloneSearch
        ? useSearchFiltersStore.getState().filters
        : useFeedFiltersStore.getState().filters;
      let queryBuilder = qb;

      if (f.categoryIds && f.categoryIds.length > 0) {
        queryBuilder = queryBuilder.in(
          'category_id',
          f.categoryIds.map((id) => Number(id))
        );
      }
      if (f.conditionIds && f.conditionIds.length > 0) {
        const conditions = expandConditionFilterValues(f.conditionIds);
        if (conditions.length > 0) queryBuilder = queryBuilder.in('condition', conditions);
      }
      if (f.priceMin != null) {
        queryBuilder = queryBuilder.gte('price', f.priceMin);
      }
      if (f.priceMax != null) {
        queryBuilder = queryBuilder.lte('price', f.priceMax);
      }
      if (resolvedBrandNames.length > 0) {
        queryBuilder = queryBuilder.in('brand', resolvedBrandNames);
      }
      if (resolvedSizeLabels.length > 0) {
        queryBuilder = queryBuilder.in('size', resolvedSizeLabels);
      }
      if (resolvedColorNames.length > 0) {
        if (resolvedColorNames.length === 1) {
          queryBuilder = queryBuilder.ilike('color', `*${resolvedColorNames[0]}*`);
        } else {
          queryBuilder = queryBuilder.or(
            resolvedColorNames.map((c) => `color.ilike.*${c}*`).join(',')
          );
        }
      }

      return queryBuilder;
    },
    [
      standaloneSearch,
      resolvedCategoryLabels,
      resolvedBrandNames,
      resolvedColorNames,
      resolvedSizeLabels
    ]
  );

  const applySearchQuery = useCallback((qb: any, searchText?: string) => {
    const orFilter = buildListingSearchOrFilter(searchText ?? query);
    if (!orFilter) return qb;
    return qb.or(orFilter);
  }, [query]);

  const loadPage = useCallback(
    async (page: number, replace: boolean) => {
      const reqId = ++loadRequestRef.current;
      const capturedQuery = query.trim();
      const isCurrent = () => reqId === loadRequestRef.current;

      if (page === 0) setLoading(true);
      else setLoadingMore(true);

      const liveFiltersEarly = standaloneSearch
        ? useSearchFiltersStore.getState().filters
        : useFeedFiltersStore.getState().filters;

      try {
        const blockedIds = await getBlockedSellerIdsForCurrentUser();
        if (!isCurrent()) return;

        const stripBlocked = (items: ResultsListing[]) =>
          cloneFeedListings(excludeBlockedSellers(items, blockedIds)) as ResultsListing[];

        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const liveFilters = liveFiltersEarly;

        const sort = (liveFilters.sortBy as any) ?? 'recent';
        const hasNearby =
          liveFilters.nearbyKm != null &&
          Number(liveFilters.nearbyKm) > 0;

        if (section === 'trending' && !hasNearby) {
          const allTrending = await fetchTrendingListings();
          if (!isCurrent()) return;
          const filtered = filterTrendingListings(allTrending, {
            filters: liveFilters,
            brandNames: resolvedBrandNames,
            sizeLabels: resolvedSizeLabels,
            colorNames: resolvedColorNames,
            query: capturedQuery
          });
          const pageItems = filtered.slice(from, from + PAGE_SIZE);
          const newItems = stripBlocked(pageItems as ResultsListing[]);
          if (!isCurrent()) return;
          setResults((prev) => (replace ? newItems : [...prev, ...newItems]));
          pageRef.current = page;
          setHasMore(from + PAGE_SIZE < filtered.length);
          setResultCount(filtered.length);
          return;
        }

        if (hasNearby) {
          const perm = await Location.requestForegroundPermissionsAsync();
          if (!isCurrent()) return;
          if (!perm.granted) {
            if (replace) {
              setResults([]);
              setHasMore(false);
              setResultCount(0);
            }
            return;
          }
          const pos = await Location.getCurrentPositionAsync({});
          if (!isCurrent()) return;
          const { data, error } = await supabase.rpc('nearby_feed_listings', {
            p_lat: Number(pos.coords.latitude),
            p_lon: Number(pos.coords.longitude),
            p_radius_km: Number(liveFilters.nearbyKm),
            p_limit: PAGE_SIZE,
            p_offset: from,
            p_section: section,
            p_query: capturedQuery ? capturedQuery : null,
            p_category_id:
              liveFilters.categoryIds && liveFilters.categoryIds.length === 1
                ? Number(liveFilters.categoryIds[0])
                : null,
            p_category: resolvedCategoryLabels[0] ?? null,
            p_conditions: (liveFilters.conditionIds.length
              ? expandConditionFilterValues(liveFilters.conditionIds)
              : null) as any,
            p_price_min: liveFilters.priceMin ?? null,
            p_price_max: liveFilters.priceMax ?? null,
            p_brands: (resolvedBrandNames.length ? resolvedBrandNames : null) as any,
            p_sizes: (resolvedSizeLabels.length ? resolvedSizeLabels : null) as any,
            p_colors: (resolvedColorNames.length ? resolvedColorNames : null) as any,
            p_influencer_ids: section === 'influencer' ? ((influencerIds ?? null) as any) : null
          });

          if (error) {
            console.warn('Results error:', error.message);
            if (!isCurrent()) return;
            if (replace) {
              setResults([]);
              setHasMore(false);
              setResultCount(0);
            }
            return;
          }

          let newItems = (data || []) as ResultsListing[];
          if (liveFilters.categoryIds && liveFilters.categoryIds.length > 0) {
            const allowedCategoryIds = new Set(liveFilters.categoryIds.map((id) => Number(id)));
            newItems = newItems.filter((row) =>
              allowedCategoryIds.has(Number((row as any).category_id))
            );
          }
          newItems = stripBlocked(newItems);
          if (!isCurrent()) return;
          setResults((prev) => (replace ? newItems : [...prev, ...newItems]));
          pageRef.current = page;
          setHasMore(newItems.length === PAGE_SIZE);
          setResultCount(null);
          return;
        }

        const isRelevance = sort === 'relevance';

        // Relevance: liked listings first (by like date desc), then newest.
        if (isRelevance) {
          const {
            data: { user }
          } = await supabase.auth.getUser();
          if (!isCurrent()) return;

          if (!user?.id) {
            let qb: any = supabase.from('v_feed_listings').select('*', { count: 'exact' });
            qb = applySectionConstraints(qb);
            qb = applyFilters(qb);
            qb = applySearchQuery(qb, capturedQuery);
            if (section === 'search') {
              qb = applySearchListingOrder(qb, sort);
            } else {
              qb = qb.order('created_at', { ascending: false });
            }
            qb = qb.range(from, to);
            const { data, error, count } = await qb;
            if (error) {
              console.warn('Results error:', error.message);
              if (!isCurrent()) return;
              if (replace) {
                setResults([]);
                setHasMore(false);
                setResultCount(0);
              }
              return;
            }
            let newItems = (data || []) as ResultsListing[];
            newItems = stripBlocked(newItems);
            if (!isCurrent()) return;
            setResults((prev) => (replace ? newItems : [...prev, ...newItems]));
            pageRef.current = page;
            setHasMore(newItems.length === PAGE_SIZE);
            setResultCount(typeof count === 'number' ? count : newItems.length);
            return;
          }

          const { data: likesRows } = await supabase
            .from('likes')
            .select('listing_id, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(500);
          if (!isCurrent()) return;

          const likedIds = (likesRows || []).map((r: any) => String(r.listing_id)).filter(Boolean);

          if (likedIds.length === 0) {
            let qb: any = supabase.from('v_feed_listings').select('*', { count: 'exact' });
            qb = applySectionConstraints(qb);
            qb = applyFilters(qb);
            qb = applySearchQuery(qb, capturedQuery);
            if (section === 'search') {
              qb = applySearchListingOrder(qb, sort);
            } else {
              qb = qb.order('created_at', { ascending: false });
            }
            qb = qb.range(from, to);
            const { data, error, count } = await qb;
            if (error) {
              console.warn('Results error:', error.message);
              if (!isCurrent()) return;
              if (replace) {
                setResults([]);
                setHasMore(false);
                setResultCount(0);
              }
              return;
            }
            let newItems = (data || []) as ResultsListing[];
            newItems = stripBlocked(newItems);
            if (!isCurrent()) return;
            setResults((prev) => (replace ? newItems : [...prev, ...newItems]));
            pageRef.current = page;
            setHasMore(newItems.length === PAGE_SIZE);
            setResultCount(typeof count === 'number' ? count : newItems.length);
            return;
          }

          let likedQ: any = supabase.from('v_feed_listings').select('*').in('id', likedIds);
          likedQ = applySectionConstraints(likedQ);
          likedQ = applyFilters(likedQ);
          likedQ = applySearchQuery(likedQ, capturedQuery);
          const { data: likedData } = await likedQ;
          if (!isCurrent()) return;

          const likedById = new Map<string, ResultsListing>();
          (likedData || []).forEach((row: any) => likedById.set(String(row.id), row as ResultsListing));
          const likedOrdered = likedIds.map((id) => likedById.get(id)).filter(Boolean) as ResultsListing[];

          const likedLen = likedOrdered.length;
          const offsetAll = from;
          const likedSlice = offsetAll < likedLen ? likedOrdered.slice(offsetAll, offsetAll + PAGE_SIZE) : [];
          const remaining = Math.max(0, PAGE_SIZE - likedSlice.length);

          let restItems: ResultsListing[] = [];
          if (remaining > 0) {
            const restOffset = Math.max(0, offsetAll - likedLen);
            let restQ: any = supabase.from('v_feed_listings').select('*');
            restQ = applySectionConstraints(restQ);
            restQ = applyFilters(restQ);
            restQ = applySearchQuery(restQ, capturedQuery);
            if (section === 'search') {
              restQ = applySearchListingOrder(restQ, sort);
            } else {
              restQ = restQ.order('created_at', { ascending: false });
            }
            const quoted = likedIds.map((x) => `"${x}"`).join(',');
            restQ = restQ.not('id', 'in', `(${quoted})`).range(restOffset, restOffset + remaining - 1);
            const { data: restData } = await restQ;
            if (!isCurrent()) return;
            restItems = (restData || []) as ResultsListing[];
          }

          let newItems = [...likedSlice, ...restItems];
          newItems = stripBlocked(newItems);
          if (!isCurrent()) return;
          setResults((prev) => (replace ? newItems : [...prev, ...newItems]));
          pageRef.current = page;
          setHasMore(newItems.length === PAGE_SIZE);
          setResultCount(null);
          return;
        }

        const baseQb: any = supabase.from('v_feed_listings').select('*', { count: 'exact' }).range(from, to);
        let qb: any = baseQb;
        qb = applyBaseSection(qb);
        qb = applyFilters(qb);
        qb = applySearchQuery(qb, capturedQuery);
        if (section === 'search') {
          qb = applySearchListingOrder(qb, sort);
        }

        let { data, error, count } = await qb;
        if (!isCurrent()) return;

        if (error) {
          const msg = String((error as any)?.message ?? '').toLowerCase();
          const brandMissing =
            msg.includes('column') && msg.includes('v_feed_listings.brand') && msg.includes('does not exist');
          const fallbackOr = buildListingSearchOrFilterTitleDesc(capturedQuery);
          if (brandMissing && section === 'search' && fallbackOr) {
            let qb2: any = baseQb;
            qb2 = applyBaseSection(qb2);
            qb2 = applyFilters(qb2);
            qb2 = qb2.or(fallbackOr);
            if (section === 'search') {
              qb2 = applySearchListingOrder(qb2, sort);
            }
            ({ data, error, count } = await qb2);
            if (!isCurrent()) return;
          }
        }

        if (error) {
          console.warn('Results error:', error.message);
          if (!isCurrent()) return;
          if (replace) {
            setResults([]);
            setHasMore(false);
            setResultCount(0);
          }
          return;
        }

        let newItems = (data || []) as ResultsListing[];
        newItems = stripBlocked(newItems);
        if (!isCurrent()) return;
        setResults((prev) => (replace ? newItems : [...prev, ...newItems]));
        pageRef.current = page;
        setHasMore(newItems.length === PAGE_SIZE);
        setResultCount(typeof count === 'number' ? count : newItems.length);
      } finally {
        if (reqId === loadRequestRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [
      applyBaseSection,
      applySectionConstraints,
      applyFilters,
      applySearchQuery,
      query,
      section,
      standaloneSearch,
      isSearchTabScreen,
      resolvedCategoryLabels,
      influencerIds,
      resolvedBrandNames,
      resolvedColorNames,
      resolvedSizeLabels
    ]
  );

  const triggerReload = useCallback(() => {
    pageRef.current = 0;
    setResultCount(null);
    setHasMore(true);
    setShowcases([]);
    void loadPage(0, true);
  }, [loadPage]);

  const restoreBrowseFromSnapshot = useCallback(() => {
    const snap = browseSnapshotRef.current;
    if (!snap || snap.filtersKey !== browseFiltersKey) return false;

    loadRequestRef.current += 1;
    pageRef.current = snap.page;
    setResults(snap.results);
    setHasMore(snap.hasMore);
    setResultCount(snap.resultCount);
    setLoading(false);
    setLoadingMore(false);
    pendingBrowseScrollRef.current = snap.scrollOffset;
    return true;
  }, [browseFiltersKey]);

  const loadMembers = useCallback(
    async (page: number, replace: boolean) => {
      if (!isSearchTabScreen) return;
      const trimmed = query.trim();
      const reqId = ++memberLoadRequestRef.current;
      const isCurrent = () => reqId === memberLoadRequestRef.current;

      if (!trimmed) {
        if (!isCurrent()) return;
        setMemberResults([]);
        setMemberHasMore(false);
        setMemberLoading(false);
        setMemberLoadingMore(false);
        return;
      }

      if (replace) {
        setMemberLoading(true);
      } else {
        setMemberLoadingMore(true);
      }

      try {
        const limit = 20;
        const offset = page * limit;
        const { data, error } = await searchMemberProfiles({
          query: trimmed,
          limit,
          offset
        });
        if (!isCurrent()) return;
        if (error) throw new Error(error);
        const rows = data ?? [];
        setMemberResults((prev) => (replace ? rows : [...prev, ...rows]));
        setMemberHasMore(rows.length >= limit);
        memberPageRef.current = page;
      } catch {
        if (!isCurrent()) return;
        if (replace) setMemberResults([]);
        setMemberHasMore(false);
      } finally {
        if (reqId === memberLoadRequestRef.current) {
          setMemberLoading(false);
          setMemberLoadingMore(false);
        }
      }
    },
    [isSearchTabScreen, query]
  );

  const triggerMemberReload = useCallback(() => {
    memberPageRef.current = 0;
    void loadMembers(0, true);
  }, [loadMembers]);

  useEffect(() => {
    return subscribeBlockedUsersRevision(() => {
      browseSnapshotRef.current = null;
      triggerReload();
      triggerMemberReload();
    });
  }, [triggerReload, triggerMemberReload]);

  useEffect(() => {
    void loadInfluencerIds();
  }, [loadInfluencerIds]);

  // Si on arrive avec un query (navigation), initialiser/mettre à jour le champ et lancer la recherche.
  useEffect(() => {
    if (typeof initialQuery === 'string') {
      setQuery(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery, section]);

  useEffect(() => {
    if (initialSearchTab === 'members' || initialSearchTab === 'listings') {
      setSearchResultTab(initialSearchTab);
    }
  }, [initialSearchTab]);

  // Un seul reload orchestré : debounce 300 ms sur la saisie Search, immédiat sur filtres / focus.
  useEffect(() => {
    const prevQuery = prevQueryForDebounceRef.current;
    const queryChanged = prevQuery !== query;
    prevQueryForDebounceRef.current = query;

    if (
      isSearchTabScreen &&
      !prevQuery.trim() &&
      query.trim() &&
      resultsRef.current.length > 0
    ) {
      browseSnapshotRef.current = {
        results: cloneFeedListings(resultsRef.current) as ResultsListing[],
        page: pageRef.current,
        hasMore: hasMoreRef.current,
        resultCount: resultCountRef.current,
        scrollOffset: browseScrollOffsetRef.current,
        filtersKey: browseFiltersKey
      };
    }

    const delay = queryChanged && isSearchTabScreen ? 300 : 0;

    if (reloadScheduleRef.current) clearTimeout(reloadScheduleRef.current);
    reloadScheduleRef.current = setTimeout(() => {
      const canRestoreBrowse =
        isSearchTabScreen &&
        !query.trim() &&
        browseSnapshotRef.current != null &&
        browseSnapshotRef.current.filtersKey === browseFiltersKey;

      if (canRestoreBrowse && restoreBrowseFromSnapshot()) {
        if (isSearchTabScreen) triggerMemberReload();
        return;
      }

      browseSnapshotRef.current = null;
      triggerReload();
      if (isSearchTabScreen) triggerMemberReload();
    }, delay);

    return () => {
      if (reloadScheduleRef.current) clearTimeout(reloadScheduleRef.current);
    };
  }, [
    query,
    effectiveFilters,
    resolvedBrandNames,
    resolvedSizeLabels,
    resolvedColorNames,
    resolvedCategoryLabels,
    searchFocusReloadNonce,
    section,
    influencerIds,
    isSearchTabScreen,
    browseFiltersKey,
    triggerReload,
    triggerMemberReload,
    restoreBrowseFromSnapshot
  ]);

  useEffect(() => {
    if (!query.trim()) {
      setSearchResultTab('listings');
      setMemberResults([]);
    }
  }, [query]);

  const handleLoadMore = () => {
    if (loadingMore || loading || !hasMore) return;
    void loadPage(pageRef.current + 1, false);
  };

  const handleLoadMoreMembers = () => {
    if (memberLoadingMore || memberLoading || !memberHasMore) return;
    void loadMembers(memberPageRef.current + 1, false);
  };

  const handleClearQuery = () => setQuery('');

  const handleResultsScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!isSearchTabScreen || query.trim()) return;
      browseScrollOffsetRef.current = event.nativeEvent.contentOffset.y;
    },
    [isSearchTabScreen, query]
  );

  const handleResultsContentSizeChange = useCallback(() => {
    const offset = pendingBrowseScrollRef.current;
    if (offset == null) return;
    pendingBrowseScrollRef.current = null;
    resultsListRef.current?.scrollToOffset({ offset, animated: false });
  }, []);

  const showSearchTypeTabs = isSearchTabScreen && query.trim().length > 0;

  const resultLabel = useMemo(() => {
    if (showSearchTypeTabs && searchResultTab === 'members') {
      if (memberLoading && memberResults.length === 0) return '';
      const count = memberResults.length;
      if (count === 0) return '';
      if (count === 1) return t('filters.oneMemberResult');
      return t('filters.membersCount', { count });
    }
    if (resultCount == null) return '';
    if (resultCount >= 500) return t('filters.results500Plus');
    if (resultCount === 1) return t('filters.oneResult');
    return t('filters.resultsCount', { count: resultCount });
  }, [
    memberLoading,
    memberResults.length,
    resultCount,
    searchResultTab,
    showSearchTypeTabs,
    t
  ]);

  const showSkeletonOverlay =
    showSearchTypeTabs && searchResultTab === 'members'
      ? memberLoading && memberResults.length === 0
      : loading && results.length === 0;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(skeletonOpacity, {
        toValue: showSkeletonOverlay ? 1 : 0,
        duration: 180,
        useNativeDriver: true
      }),
      Animated.timing(contentOpacity, {
        toValue: showSkeletonOverlay ? 0 : 1,
        duration: 180,
        useNativeDriver: true
      })
    ]).start();
  }, [contentOpacity, showSkeletonOverlay, skeletonOpacity]);

  /** Onglet Search + `standaloneSearch` : filtres sur la pile Search ; sinon (ex. Results) route tab `filters`. */
  const filtersRouteBase = useMemo<FiltersStackBase>(() => {
    if (standaloneSearch && section === 'search') return FILTERS_PATH_SEARCH_STACK;
    return FILTERS_PATH_TABS_ROOT;
  }, [standaloneSearch, section]);

  const confirmNearby = useCallback(async () => {
    const km = nearbyDraftKm;
    if (!km) {
      setFilter('nearbyKm', null);
      setNearbyModalOpen(false);
      return;
    }
    try {
      setNearbyConfirming(true);
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t('filters.locationTitle'), t('filters.locationEnable'));
        return;
      }
      await Location.getCurrentPositionAsync({});
      setFilter('nearbyKm', km);
      setNearbyModalOpen(false);
    } catch {
      Alert.alert(t('filters.locationTitle'), t('filters.locationEnable'));
    } finally {
      setNearbyConfirming(false);
    }
  }, [nearbyDraftKm, setFilter, t]);

  const handlePressFilter = (type: ResultsFilterPill) => {
    const resultsParams = {
      returnTo: section === 'search' ? 'search' : 'results',
      resultsSection: section,
      resultsQuery: query.trim(),
      resultsTitle: headerTitle
    };
    switch (type) {
      case 'Clear':
        resetFilters();
        break;
      case 'Women':
      case 'Men':
      case 'Kids':
      case 'Baby':
        router.push({
          pathname: filtersScreenPath(filtersRouteBase, 'category-gender') as any,
          params: {
            gender: SEARCH_CATEGORY_TO_FILTER_GENDER[type],
            ...resultsParams
          }
        });
        break;
      case 'Filter':
        router.push({
          pathname: filtersRouteBase as any,
          params: resultsParams
        });
        break;
      case 'Nearby':
        setNearbyDraftKm(effectiveFilters.nearbyKm ?? null);
        setNearbyModalOpen(true);
        break;
      case 'Size':
        router.push({
          pathname: filtersScreenPath(filtersRouteBase, 'size') as any,
          params: resultsParams
        });
        break;
      case 'Brand':
        void navigateToBrandFilter(
          router,
          filtersRouteBase,
          effectiveFilters.categoryIds ?? [],
          resultsParams,
          t('filters.brand')
        );
        break;
      case 'Condition':
        router.push({
          pathname: filtersScreenPath(filtersRouteBase, 'condition') as any,
          params: resultsParams
        });
        break;
      case 'Color':
        router.push({
          pathname: filtersScreenPath(filtersRouteBase, 'color') as any,
          params: resultsParams
        });
        break;
      case 'Price':
        router.push({
          pathname: filtersScreenPath(filtersRouteBase, 'price') as any,
          params: resultsParams
        });
        break;
      default:
        break;
    }
  };

  const pillActive = (name: string) => {
    switch (name) {
      case 'Clear':
        return isAnyFilterActive;
      case 'Women':
        return (
          (effectiveFilters.categoryIds?.length ?? 0) > 0 &&
          resolvedCategoryGenderDb === SEARCH_CATEGORY_DB_GENDER.Women
        );
      case 'Men':
        return (
          (effectiveFilters.categoryIds?.length ?? 0) > 0 &&
          resolvedCategoryGenderDb === SEARCH_CATEGORY_DB_GENDER.Men
        );
      case 'Kids':
        return (
          (effectiveFilters.categoryIds?.length ?? 0) > 0 &&
          resolvedCategoryGenderDb === SEARCH_CATEGORY_DB_GENDER.Kids
        );
      case 'Baby':
        return (
          (effectiveFilters.categoryIds?.length ?? 0) > 0 &&
          resolvedCategoryGenderDb === SEARCH_CATEGORY_DB_GENDER.Baby
        );
      case 'Filter':
        return isAnyFilterActive;
      case 'Nearby':
        return effectiveFilters.nearbyKm != null;
      case 'Size':
        return Boolean(effectiveFilters.sizeIds?.length);
      case 'Brand':
        return Boolean(effectiveFilters.brandIds?.length);
      case 'Condition':
        return Boolean(effectiveFilters.conditionIds?.length);
      case 'Color':
        return Boolean(effectiveFilters.colorIds?.length);
      case 'Price':
        return effectiveFilters.priceMin != null || effectiveFilters.priceMax != null;
      default:
        return false;
    }
  };

  const shouldInjectShowcases =
    section === 'search' && query.trim().length > 0 && !standaloneSearch;

  const filterPills = useMemo(
    () =>
      searchStyleFilters
        ? ([
            ...(isSearchTabScreen ? (['Filter'] as const) : []),
            'Clear',
            ...SEARCH_CATEGORY_GENDER_LABELS,
            'Size',
            'Brand',
            'Condition',
            'Color',
            'Price'
          ] as const)
        : (['Filter', 'Nearby', 'Size', 'Brand', 'Condition', 'Color', 'Price'] as const),
    [isSearchTabScreen, searchStyleFilters]
  );

  const filterPillLabel = useMemo(() => {
    const count = effectiveFilters.categoryIds?.length ?? 0;
    if (count === 0) return t('filters.filter');
    if (count === 1) return resolvedSelectedCategoryNames[0] || t('filters.category');
    return t('filters.categoriesCount', { count });
  }, [effectiveFilters.categoryIds, resolvedSelectedCategoryNames, t]);

  const getFilterPillText = useCallback(
    (item: ResultsFilterPill): string => {
      switch (item) {
        case 'Women':
          return t('filters.woman');
        case 'Men':
          return t('filters.men');
        case 'Kids':
          return t('filters.kids');
        case 'Baby':
          return t('filters.baby');
        case 'Size':
          return t('filters.size');
        case 'Brand':
          return t('filters.brand');
        case 'Condition':
          return t('filters.condition');
        case 'Color':
          return t('filters.color');
        case 'Price':
          return t('filters.price');
        case 'Filter':
          return filterPillLabel;
        case 'Nearby':
          return effectiveFilters.nearbyKm != null ? `${effectiveFilters.nearbyKm} km` : t('filters.nearby');
        case 'Clear':
          return t('common.clearAll');
        default:
          return String(item);
      }
    },
    [effectiveFilters.nearbyKm, filterPillLabel, t]
  );

  const listingSellerIds = useMemo(() => {
    if (!shouldInjectShowcases) return [];
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const r of results) {
      const sid = String((r as any).seller_id ?? '').trim();
      if (!sid || seen.has(sid)) continue;
      seen.add(sid);
      ids.push(sid);
    }
    return ids;
  }, [results, shouldInjectShowcases]);

  const loadShowcases = useCallback(async () => {
    if (!shouldInjectShowcases) {
      setShowcases([]);
      return;
    }
    if (results.length === 0) {
      setShowcases([]);
      return;
    }

    const reqId = ++showcaseReqRef.current;
    setLoadingShowcases(true);
    try {
      const sellerIds = listingSellerIds.slice(0, 40);
      if (sellerIds.length === 0) {
        setShowcases([]);
        return;
      }

      const [profilesRes, thumbsRes, activeRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, display_name, avatar_url, is_influencer, company_name, seller_type')
          .in('id', sellerIds)
          .limit(40),
        supabase
          .from('v_feed_listings')
          .select('id, seller_id, cover_photo_url, created_at')
          .in('seller_id', sellerIds)
          .eq('status', 'published')
          .order('created_at', { ascending: false })
          .range(0, 399),
        supabase
          .from('listings')
          .select('id, seller_id')
          .in('seller_id', sellerIds)
          .eq('status', 'published')
          .range(0, 9999)
      ]);

      if (reqId !== showcaseReqRef.current) return;

      if (profilesRes.error) throw profilesRes.error;
      if (thumbsRes.error) throw thumbsRes.error;
      if (activeRes.error) throw activeRes.error;

      const profileById = new Map<string, any>();
      for (const p of (profilesRes.data || []) as any[]) {
        profileById.set(String(p.id), p);
      }

      const thumbsBySeller = new Map<string, Array<{ id: string; cover_photo_url: string | null }>>();
      for (const row of (thumbsRes.data || []) as any[]) {
        const sid = String(row.seller_id);
        if (!thumbsBySeller.has(sid)) thumbsBySeller.set(sid, []);
        const arr = thumbsBySeller.get(sid)!;
        if (arr.length >= 3) continue;
        arr.push({ id: String(row.id), cover_photo_url: (row.cover_photo_url as string | null) ?? null });
      }

      const activeCountBySeller = new Map<string, number>();
      for (const row of (activeRes.data || []) as any[]) {
        const sid = String(row.seller_id);
        activeCountBySeller.set(sid, (activeCountBySeller.get(sid) ?? 0) + 1);
      }

      const built: SellerShowcase[] = [];
      for (const sid of sellerIds) {
        const p = profileById.get(sid);
        if (!p) continue;
        built.push({
          id: sid,
          display_name: (p.display_name as string | null) ?? null,
          avatar_url: (p.avatar_url as string | null) ?? null,
          is_influencer: (p.is_influencer as boolean | null) ?? null,
          company_name: (p.company_name as string | null) ?? null,
          seller_type: (p.seller_type as SellerShowcase['seller_type']) ?? null,
          active_count: activeCountBySeller.get(sid) ?? 0,
          thumbs: thumbsBySeller.get(sid) ?? []
        });
      }

      setShowcases(built);
    } catch {
      if (reqId !== showcaseReqRef.current) return;
      setShowcases([]);
    } finally {
      if (reqId !== showcaseReqRef.current) return;
      setLoadingShowcases(false);
    }
  }, [listingSellerIds, results.length, shouldInjectShowcases]);

  useEffect(() => {
    void loadShowcases();
  }, [loadShowcases]);

  const mixedData: MixedItem[] = useMemo(() => {
    if (!shouldInjectShowcases || showcases.length === 0) {
      return results.map((r) => ({ type: 'listing', data: r } as MixedItem));
    }

    const slots = new Set<number>([7]);
    for (let i = 17; i < results.length; i += 10) slots.add(i);

    const out: MixedItem[] = [];
    let showcaseIdx = 0;

    for (let i = 0; i < results.length; i++) {
      out.push({ type: 'listing', data: results[i] });

      if (slots.has(i) && showcaseIdx < showcases.length) {
        const s = showcases[showcaseIdx++];
        out.push({ type: 'showcase', data: s, id: `showcase-${s.id}-${i}` });
      }
    }

    return out;
  }, [results, showcases, shouldInjectShowcases]);

  const renderMixedItem = ({ item, index }: { item: MixedItem; index: number }) => {
    if (item.type === 'showcase') {
      return (
        <View style={styles.showcaseRow}>
          <SellerShowcaseCard
            showcase={item.data}
            onPress={() =>
              router.push(
                publicProfileHref(item.data.id, {
                  return_to: section === 'search' ? 'search' : undefined,
                  return_query: section === 'search' ? query.trim() || undefined : undefined
                })
              )
            }
          />
        </View>
      );
    }

    return (
      <View style={styles.cardWrapper}>
        <ProductCard
          listingId={item.data.id}
          sellerId={item.data.seller_id}
          sellerName={item.data.seller_display_name ?? undefined}
          sellerIsInfluencer={Boolean(item.data.seller_is_influencer)}
          title={item.data.title}
          price={item.data.price}
          currency="CHF"
          brand={item.data.brand ?? undefined}
          size={(item.data as any).size ?? undefined}
          condition={item.data.condition ?? undefined}
          imageUrl={item.data.cover_photo_url}
          onPress={() =>
            openListingDetail(router, item.data.id, {
              return_to: section === 'search' ? 'search' : 'results',
              detailPathBase: listingDetailPathBase,
              cover_photo: item.data.cover_photo_url,
              imageWidthDp: resultsGridCardWidth,
              imageHeightDp: Math.round(resultsGridCardWidth * 1.3)
            })
          }
          cardWidth={resultsGridCardWidth}
          imageRatio={1.3}
          imagePriority={getCardImagePriority(index)}
        />
      </View>
    );
  };

  const keyExtractor = (item: MixedItem) => {
    if (item.type === 'listing') return item.data.id;
    return item.id;
  };

  const renderMemberItem = useCallback(
    ({ item }: { item: MemberSearchRow }) => {
      const displayName = (item.display_name ?? '').trim() || t('common.bloomiUser');
      const company = (item.company_name ?? '').trim();
      const subtitle =
        company && company.toLowerCase() !== displayName.toLowerCase() ? company : null;

      return (
        <Pressable
          style={styles.memberRow}
          onPress={() =>
            router.push(
              publicProfileHref(item.id, {
                return_to: 'search',
                return_query: query.trim() || undefined,
                return_search_tab: 'members'
              })
            )
          }
        >
          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={styles.memberAvatar} />
          ) : (
            <View style={styles.memberAvatarPlaceholder} />
          )}
          <View style={styles.memberTextCol}>
            <View style={styles.memberNameRow}>
              <Text style={styles.memberName} numberOfLines={1}>
                {displayName}
              </Text>
              {item.is_influencer ? <InfluencerBadge size={16} /> : null}
            </View>
            {subtitle ? (
              <Text style={styles.memberSubtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <AppIcon name="altArrowRightOutline" size={18} color={theme.colors.textSecondary} />
        </Pressable>
      );
    },
    [query, router, t]
  );

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (section === 'search') {
      navigateInTabs('/tabs/search');
      return;
    }
    navigateInTabs('/tabs/feed');
  };

  return (
    <Screen noHorizontalPadding scroll={false}>
      <View style={styles.root} onTouchStart={() => Keyboard.dismiss()}>
        {/* Header */}
        <View style={styles.header}>
          {showBack ? <HeaderBackButton onPress={handleBack} /> : <View style={styles.headerSide} />}
          <Text variant="body" style={styles.headerTitle}>
            {headerTitle}
          </Text>
          <View style={styles.headerSide} />
        </View>
        <View style={styles.headerSeparator} />

        {/* Search bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchContainer}>
            <View style={styles.searchLeadingIcon} pointerEvents="none">
              <AppIcon name="searchOutline" size={18} color="#AAAAAA" />
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder={t('filters.searchPlaceholder')}
              placeholderTextColor="#AAAAAA"
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              allowFontScaling={false}
              maxFontSizeMultiplier={1}
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={handleClearQuery}
                hitSlop={HIT_SLOP_COMFORTABLE}
                style={styles.searchTrailingIconButton}
                accessibilityRole="button"
                accessibilityLabel={t('filters.clearSearch')}
              >
                <Text style={styles.clearText}>×</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {(!showSearchTypeTabs || searchResultTab === 'listings') ? (
        <View style={styles.filtersRow}>
          <FlatList
            data={[...filterPills]}
            keyExtractor={(item) => item}
            horizontal
            removeClippedSubviews={false}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersContent}
            renderItem={({ item }) => {
              const active = pillActive(item);
              const clearDisabled = item === 'Clear' && !isAnyFilterActive;
              return (
                <TouchableOpacity
                  style={[
                    styles.filterPill,
                    active && styles.filterPillActive,
                    clearDisabled && styles.filterPillDisabled
                  ]}
                  onPress={() => handlePressFilter(item as ResultsFilterPill)}
                  activeOpacity={clearDisabled ? 1 : 0.8}
                  disabled={clearDisabled}
                >
                  {item === 'Clear' ? (
                    <Text style={[styles.filterText, clearDisabled && styles.filterTextDisabled]}>
                      {getFilterPillText(item as ResultsFilterPill)}
                    </Text>
                  ) : item === 'Filter' ? (
                    <View style={styles.filterIconRow}>
                      <Text style={styles.filterIconText}>≡</Text>
                      <Text style={styles.filterText}>{getFilterPillText(item as ResultsFilterPill)}</Text>
                    </View>
                  ) : item === 'Nearby' ? (
                    <Text style={styles.filterText}>
                      {getFilterPillText(item as ResultsFilterPill)}
                    </Text>
                  ) : (
                    <Text style={styles.filterText}>{getFilterPillText(item as ResultsFilterPill)}</Text>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </View>
        ) : null}

        {!searchStyleFilters ? (
        <Modal
          visible={nearbyModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setNearbyModalOpen(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setNearbyModalOpen(false)}>
            <Pressable style={styles.modalCard} onPress={() => null}>
              <Text style={styles.modalTitle}>{t('filters.nearby')}</Text>
              {([5, 10, 25, 50, 100] as const).map((km) => {
                const selected = nearbyDraftKm === km;
                return (
                  <TouchableOpacity
                    key={km}
                    activeOpacity={0.8}
                    onPress={() => setNearbyDraftKm(km)}
                    style={[styles.modalRow, selected && styles.modalRowSelected]}
                  >
                    <Text style={styles.modalRowText}>{km} km</Text>
                  </TouchableOpacity>
                );
              })}

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    setNearbyDraftKm(null);
                    setFilter('nearbyKm', null);
                    setNearbyModalOpen(false);
                  }}
                  disabled={nearbyConfirming}
                  style={[styles.modalBtn, nearbyConfirming && styles.modalBtnDisabled]}
                >
                  <Text style={styles.modalBtnText}>{t('common.reset')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={confirmNearby}
                  disabled={nearbyConfirming}
                  style={[styles.modalBtn, styles.modalBtnPrimary, nearbyConfirming && styles.modalBtnDisabled]}
                >
                  {nearbyConfirming ? (
                    <ActivityIndicator size="small" color={theme.colors.appleBlack} />
                  ) : (
                    <Text style={styles.modalBtnTextPrimary}>{t('common.apply')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
        ) : null}

        <View style={styles.resultCountSlot}>
          {showSearchTypeTabs ? (
            <View style={styles.searchTypeBar}>
              <View style={styles.searchTypeTabs}>
                <TouchableOpacity
                  style={styles.searchTypeTabBtn}
                  onPress={() => setSearchResultTab('listings')}
                  activeOpacity={0.7}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: searchResultTab === 'listings' }}
                >
                  <Text
                    style={[
                      styles.searchTypeLabel,
                      searchResultTab === 'listings' && styles.searchTypeLabelActive
                    ]}
                  >
                    {t('filters.searchTabListings')}
                  </Text>
                  {searchResultTab === 'listings' ? (
                    <View style={styles.searchTypeUnderline} />
                  ) : null}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.searchTypeTabBtn}
                  onPress={() => setSearchResultTab('members')}
                  activeOpacity={0.7}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: searchResultTab === 'members' }}
                >
                  <Text
                    style={[
                      styles.searchTypeLabel,
                      searchResultTab === 'members' && styles.searchTypeLabelActive
                    ]}
                  >
                    {t('filters.searchTabMembers')}
                  </Text>
                  {searchResultTab === 'members' ? (
                    <View style={styles.searchTypeUnderline} />
                  ) : null}
                </TouchableOpacity>
              </View>
              {resultLabel &&
              !(searchResultTab === 'members' ? memberLoading : loading) ? (
                <Text variant="captionSm" color="textSecondary" style={styles.searchTypeCount}>
                  {resultLabel}
                </Text>
              ) : null}
            </View>
          ) : resultLabel && !loading ? (
            <Text variant="body" style={styles.resultCountText}>
              {resultLabel}
            </Text>
          ) : null}
        </View>

        <View style={styles.resultsStage}>
          <Animated.View style={[styles.resultsLayer, { opacity: contentOpacity }]}>
            {showSearchTypeTabs && searchResultTab === 'members' ? (
              memberResults.length === 0 && !memberLoading ? (
                <View style={styles.emptyContainer}>
                  <AppIcon name="searchOutline" size={48} color="#AAAAAA" />
                  <Text style={[styles.emptyTitle, styles.emptyTitleStandalone]}>
                    {t('filters.noMembersResults')}
                  </Text>
                  <Text style={styles.emptySubtitle}>{t('filters.noMembersHint')}</Text>
                </View>
              ) : (
                <FlatList
                  key="member-search-list"
                  data={memberResults}
                  keyExtractor={(item) => item.id}
                  renderItem={renderMemberItem}
                  contentContainerStyle={[
                    styles.memberListContent,
                    { paddingBottom: fixedTabBarReserveSpace + 8 }
                  ]}
                  onEndReached={handleLoadMoreMembers}
                  onEndReachedThreshold={0.5}
                  ListFooterComponent={
                    memberLoadingMore ? (
                      <View style={styles.footerLoading}>
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                      </View>
                    ) : null
                  }
                  showsVerticalScrollIndicator={false}
                />
              )
            ) : results.length === 0 ? (
              <View style={styles.emptyContainer}>
                <AppIcon name="searchOutline" size={48} color="#AAAAAA" />
                <Text style={[styles.emptyTitle, searchStyleFilters && styles.emptyTitleStandalone]}>
                  {searchStyleFilters ? t('filters.noResults') : t('filters.noResultsFound')}
                </Text>
                {!searchStyleFilters ? (
                  <Text style={styles.emptySubtitle}>{t('filters.noResultsHint')}</Text>
                ) : null}
              </View>
            ) : (
              <FlatList
                ref={resultsListRef}
                key="results-grid-2"
                data={mixedData}
                keyExtractor={keyExtractor}
                numColumns={2}
                {...LIST_IMAGE_PERF_PROPS}
                renderItem={renderMixedItem as any}
                contentContainerStyle={[
                  styles.listContent,
                  searchStyleFilters && styles.listContentTabSearch,
                  isSearchTabScreen ? { paddingBottom: fixedTabBarReserveSpace + 8 } : null
                ]}
                columnWrapperStyle={styles.listRow}
                onScroll={handleResultsScroll}
                scrollEventThrottle={16}
                onContentSizeChange={handleResultsContentSizeChange}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={
                  loadingMore ? (
                    <View style={styles.footerLoading}>
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                    </View>
                  ) : null
                }
                showsVerticalScrollIndicator={false}
              />
            )}
          </Animated.View>

          <Animated.View
            pointerEvents="none"
            style={[styles.skeletonOverlay, { opacity: skeletonOpacity }]}
          >
            <View style={styles.skeletonContainer}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                // eslint-disable-next-line react/no-array-index-key
                <View key={i} style={styles.skeletonBox} />
              ))}
            </View>
          </Animated.View>
        </View>
      </View>
    </Screen>
  );
}

function SellerShowcaseCard({
  showcase,
  onPress
}: {
  showcase: SellerShowcase;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const badge = showcase.is_influencer
    ? t('feed.tabs.influencers')
    : showcase.seller_type === 'sole_proprietorship'
      ? t('auth.sellerType.soleProprietorship')
      : showcase.seller_type === 'pro' ||
          (showcase.company_name && showcase.company_name.trim().length > 0)
        ? t('auth.sellerType.professional')
        : t('auth.sellerType.individual');

  const title = (showcase.display_name ?? '').trim() || t('common.seller');

  const thumbs =
    showcase.thumbs.length > 0
      ? showcase.thumbs.slice(0, 3)
      : [
          { id: 'a', cover_photo_url: null },
          { id: 'b', cover_photo_url: null },
          { id: 'c', cover_photo_url: null }
        ];

  return (
    <Pressable onPress={onPress} style={styles.showcaseCard}>
      <View style={styles.showcaseHeader}>
        {showcase.avatar_url ? (
          <Image source={{ uri: showcase.avatar_url }} style={styles.showcaseAvatar} />
        ) : (
          <View style={styles.showcaseAvatarPlaceholder} />
        )}
        <View style={styles.showcaseHeaderText}>
          <Text variant="body" style={styles.showcaseName} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.showcaseMetaRow}>
            <View style={styles.showcaseBadge}>
              <Text style={styles.showcaseBadgeText}>{badge}</Text>
            </View>
            <Text style={styles.showcaseCountText}>
              {t('filters.activeListings', { count: showcase.active_count })}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.showcaseThumbsRow}>
        {thumbs.map((t) => (
          <View key={t.id} style={styles.showcaseThumbWrap}>
            {t.cover_photo_url ? (
              <Image source={{ uri: t.cover_photo_url }} style={styles.showcaseThumb} />
            ) : (
              <View style={styles.showcaseThumbPlaceholder} />
            )}
          </View>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.backgroundWhite
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.backgroundWhite
  },
  headerTitle: {
    ...theme.typography.body,
    fontFamily: theme.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    flex: 1
  },
  headerSide: {
    width: 28
  },
  headerSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.separator
  },
  searchRow: {
    paddingHorizontal: 16,
    marginTop: 12
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F6',
    borderRadius: 24,
    minHeight: 48,
    paddingVertical: 4,
    paddingHorizontal: 10,
    columnGap: 6
  },
  searchLeadingIcon: {
    ...HEADER_ICON_TOUCH_CONTAINER
  },
  searchTrailingIconButton: {
    ...HEADER_ICON_TOUCH_CONTAINER
  },
  searchInput: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 15
  },
  clearText: {
    fontSize: 18,
    color: '#AAAAAA'
  },
  filtersRow: {
    marginTop: 12
  },
  searchTypeBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    columnGap: 12
  },
  searchTypeTabs: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    columnGap: 20
  },
  searchTypeTabBtn: {
    paddingBottom: 6,
    alignItems: 'center',
    minWidth: 56
  },
  searchTypeLabel: {
    fontSize: 14,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    fontFamily: theme.fontFamily.medium
  },
  searchTypeLabelActive: {
    color: theme.colors.textPrimary,
    fontFamily: theme.fontFamily.semiBold
  },
  searchTypeUnderline: {
    marginTop: 6,
    height: 2,
    width: '100%',
    borderRadius: 1,
    backgroundColor: theme.colors.primary
  },
  searchTypeCount: {
    paddingBottom: 6,
    textAlign: 'right',
    flexShrink: 0
  },
  memberListContent: {
    paddingHorizontal: 16,
    paddingTop: 4
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.separator,
    columnGap: 12
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.muted
  },
  memberAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.muted
  },
  memberTextCol: {
    flex: 1,
    minWidth: 0
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6
  },
  memberName: {
    flexShrink: 1,
    fontFamily: theme.fontFamily.semiBold,
    fontSize: 15,
    color: theme.colors.textPrimary
  },
  memberSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: theme.colors.textSecondary
  },
  filtersContent: {
    paddingHorizontal: 16,
    columnGap: 8
  },
  filterPill: {
    borderWidth: 1,
    borderColor: theme.colors.separator,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: theme.colors.googleWhite,
    marginRight: 8
  },
  filterPillActive: {
    backgroundColor: '#C3EA4F'
  },
  filterPillDisabled: {
    opacity: 0.45
  },
  filterTextDisabled: {
    color: '#AAAAAA'
  },
  filterIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6
  },
  filterIconText: {
    fontSize: 16,
    color: theme.colors.textPrimary
  },
  filterText: {
    fontSize: 14,
    color: theme.colors.textPrimary
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 16,
    justifyContent: 'flex-end',
    paddingBottom: 24
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16
  },
  modalTitle: {
    ...theme.typography.body,
    fontFamily: theme.fontFamily.semiBold,
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginBottom: 12
  },
  modalRow: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.separator,
    backgroundColor: '#FFFFFF',
    marginBottom: 8
  },
  modalRowSelected: {
    borderColor: '#C3EA4F',
    backgroundColor: '#C3EA4F'
  },
  modalRowText: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    fontSize: 15
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10
  },
  modalBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.separator,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF'
  },
  modalBtnPrimary: {
    backgroundColor: '#C3EA4F',
    borderColor: '#C3EA4F'
  },
  modalBtnText: {
    fontSize: 14,
    color: theme.colors.textPrimary,
    fontFamily: theme.fontFamily.semiBold
  },
  modalBtnTextPrimary: {
    fontSize: 14,
    color: theme.colors.appleBlack,
    fontFamily: theme.fontFamily.semiBold
  },
  modalBtnDisabled: {
    opacity: 0.6
  },
  resultCountText: {
    fontSize: 14,
    color: theme.colors.textPrimary
  },
  resultCountSlot: {
    minHeight: 28,
    justifyContent: 'center',
    paddingTop: 10,
    paddingBottom: 4,
    paddingHorizontal: 16
  },
  resultsStage: {
    flex: 1,
    position: 'relative'
  },
  resultsLayer: {
    flex: 1
  },
  skeletonOverlay: {
    ...StyleSheet.absoluteFillObject
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24
  },
  /** Ajustements de padding quand l'écran reprend le style de l'onglet Search */
  listContentTabSearch: {
    paddingBottom: 16
  },
  listRow: {
    columnGap: 8,
    marginBottom: 12
  },
  cardWrapper: {
    flex: 1
  },
  showcaseRow: {
    width: '100%',
    paddingHorizontal: 16,
    marginBottom: 12
  },
  showcaseCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.separator,
    backgroundColor: theme.colors.backgroundWhite,
    padding: 12
  },
  showcaseHeader: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  showcaseAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.muted
  },
  showcaseAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.muted
  },
  showcaseHeaderText: {
    flex: 1,
    marginLeft: 10
  },
  showcaseName: {
    ...theme.typography.body,
    fontFamily: theme.fontFamily.semiBold,
    color: theme.colors.textPrimary
  },
  showcaseMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8
  },
  showcaseBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: theme.colors.muted
  },
  showcaseBadgeText: {
    fontSize: 12,
    color: theme.colors.textPrimary,
    fontFamily: theme.fontFamily.semiBold
  },
  showcaseCountText: {
    fontSize: 12,
    color: theme.colors.textSecondary
  },
  showcaseThumbsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12
  },
  showcaseThumbWrap: {
    flex: 1
  },
  showcaseThumb: {
    width: '100%',
    height: 72,
    borderRadius: 12,
    backgroundColor: theme.colors.muted
  },
  showcaseThumbPlaceholder: {
    width: '100%',
    height: 72,
    borderRadius: 12,
    backgroundColor: theme.colors.muted
  },
  skeletonContainer: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 16,
    rowGap: 12,
    columnGap: 8,
    alignContent: 'flex-start'
  },
  skeletonBox: {
    width: '48%',
    height: 220,
    backgroundColor: theme.colors.separator,
    borderRadius: 12
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 16,
    color: '#888888'
  },
  emptyTitleStandalone: {
    textAlign: 'center',
    fontFamily: theme.fontFamily.medium
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#AAAAAA',
    textAlign: 'center'
  },
  footerLoading: {
    paddingVertical: 12
  }
});

