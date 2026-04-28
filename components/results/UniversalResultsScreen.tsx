import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  View
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../ui/Screen';
import { Text } from '../ui/Text';
import { theme } from '../../lib/theme';
import { AppIcon } from '../ui/AppIcon';
import { ProductCard } from '../ProductCard';
import { supabase } from '../../lib/supabase';
import type { FeedListing } from '../../lib/api';
import { type FeedFilters, useFeedFiltersStore } from '../../lib/store/feedFilters';
import { useSearchFiltersStore } from '../../lib/store/searchFilters';
import { HIT_SLOP_COMFORTABLE, HEADER_ICON_TOUCH_CONTAINER } from '../../lib/touchTargets';
import { HeaderBackButton } from '../ui/HeaderBackButton';
import { getFixedTabBarHeight } from '../../components/navigation/FloatingTabBar';
import {
  FILTERS_PATH_SEARCH_STACK,
  FILTERS_PATH_TABS_ROOT,
  filtersScreenPath,
  type FiltersStackBase
} from '../../lib/navigation/filterRoutes';

export type ResultsSection = 'sponsored' | 'trending' | 'influencer' | 'all' | 'search';

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
  active_count: number;
  thumbs: Array<{ id: string; cover_photo_url: string | null }>;
};

type MixedItem =
  | { type: 'listing'; data: ResultsListing }
  | { type: 'showcase'; data: SellerShowcase; id: string };

const PAGE_SIZE = 20;

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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_PADDING_X = 16;
const GRID_GAP = 8;
const GRID_CARD_WIDTH = (SCREEN_WIDTH - GRID_PADDING_X * 2 - GRID_GAP) / 2;

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
}) {
  const {
    title,
    section,
    initialQuery,
    showBack = true,
    reloadOnFocus = false,
    standaloneSearch = false,
    searchFocusReloadNonce = 0
  } = props;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const feedStore = useFeedFiltersStore();
  const searchStore = useSearchFiltersStore();
  const { filters, setFilter, resetFilters } = standaloneSearch ? searchStore : feedStore;
  const fixedTabBarReserveSpace = getFixedTabBarHeight(insets.bottom);
  const isSearchTabScreen = standaloneSearch && section === 'search';

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

  const pageRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showcaseReqRef = useRef(0);

  const [nearbyModalOpen, setNearbyModalOpen] = useState(false);
  const [nearbyDraftKm, setNearbyDraftKm] = useState<number | null>(filters.nearbyKm ?? null);
  const [nearbyConfirming, setNearbyConfirming] = useState(false);

  /** Genre DB (`categories.gender`) pour la catégorie sélectionnée — pills actives sur Search */
  const [resolvedCategoryGenderDb, setResolvedCategoryGenderDb] = useState<string | null>(null);
  /** Libellés candidats pour `v_feed_listings.category` (nom + slug catégorie). */
  const [resolvedCategoryLabels, setResolvedCategoryLabels] = useState<string[]>([]);

  const headerTitle = useMemo(() => {
    if (typeof title === 'string' && title.trim()) return title;
    switch (section) {
      case 'sponsored':
        return 'Sponsored';
      case 'trending':
        return 'Trending';
      case 'influencer':
        return 'Influencers';
      case 'all':
        return 'All items';
      case 'search':
      default:
        return 'Search';
    }
  }, [section, title]);

  const effectiveFilters = filters;

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
    const cid = filters.categoryId;
    if (!cid) {
      setResolvedCategoryGenderDb(null);
      setResolvedCategoryLabels([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('gender, name, slug')
        .eq('id', cid)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setResolvedCategoryGenderDb(null);
        setResolvedCategoryLabels([]);
        return;
      }
      const row = data as { gender?: string | null; name?: string | null; slug?: string | null };
      const g = row.gender;
      setResolvedCategoryGenderDb(typeof g === 'string' && g.length > 0 ? g : null);
      const cands = [row.name, row.slug]
        .map((x) => (x != null ? String(x).trim() : ''))
        .filter(Boolean);
      setResolvedCategoryLabels([...new Set(cands)]);
    })();
    return () => {
      cancelled = true;
    };
  }, [filters.categoryId]);

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

      if (f.categoryId && resolvedCategoryLabels.length > 0) {
        queryBuilder = queryBuilder.in('category', resolvedCategoryLabels);
      }
      if (f.conditionIds && f.conditionIds.length > 0) {
        queryBuilder = queryBuilder.in('condition', f.conditionIds);
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

  const applySearchQuery = useCallback(
    (qb: any) => {
      const trimmed = query.trim();
      if (!trimmed) return qb;
      // PostgREST ilike wildcard: use *...* (more robust than %...% in filter strings).
      const pattern = `*${trimmed}*`;
      const orFilter = `title.ilike.${pattern},description.ilike.${pattern},brand.ilike.${pattern}`;
      // eslint-disable-next-line no-console
      console.log('[Results] applySearchQuery', { section, query: trimmed, orFilter });
      return qb.or(orFilter);
    },
    [query, section]
  );

  const loadPage = useCallback(
    async (page: number, replace: boolean) => {
      if (page === 0) setLoading(true);
      else setLoadingMore(true);

      try {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const liveFilters = standaloneSearch
          ? useSearchFiltersStore.getState().filters
          : useFeedFiltersStore.getState().filters;

        // eslint-disable-next-line no-console
        console.log('[Results] active filters', {
          section,
          query: query.trim(),
          categoryId: liveFilters.categoryId ?? null,
          conditionIds: liveFilters.conditionIds ?? [],
          priceMin: liveFilters.priceMin ?? null,
          priceMax: liveFilters.priceMax ?? null,
          brandIds: liveFilters.brandIds ?? [],
          resolvedBrandNames,
          sizeIds: liveFilters.sizeIds ?? [],
          resolvedSizeLabels,
          colorIds: liveFilters.colorIds ?? [],
          resolvedColorNames
        });
        const sort = (liveFilters.sortBy as any) ?? 'recent';
        const hasNearby =
          liveFilters.nearbyKm != null &&
          Number(liveFilters.nearbyKm) > 0;

        if (hasNearby) {
          const perm = await Location.requestForegroundPermissionsAsync();
          if (!perm.granted) {
            if (replace) {
              setResults([]);
              setHasMore(false);
              setResultCount(0);
            }
            return;
          }
          const pos = await Location.getCurrentPositionAsync({});
          const { data, error } = await supabase.rpc('nearby_feed_listings', {
            p_lat: Number(pos.coords.latitude),
            p_lon: Number(pos.coords.longitude),
            p_radius_km: Number(liveFilters.nearbyKm),
            p_limit: PAGE_SIZE,
            p_offset: from,
            p_section: section,
            p_query: query.trim() ? query.trim() : null,
            p_category: resolvedCategoryLabels[0] ?? null,
            p_conditions: (liveFilters.conditionIds.length ? liveFilters.conditionIds : null) as any,
            p_price_min: liveFilters.priceMin ?? null,
            p_price_max: liveFilters.priceMax ?? null,
            p_brands: (resolvedBrandNames.length ? resolvedBrandNames : null) as any,
            p_sizes: (resolvedSizeLabels.length ? resolvedSizeLabels : null) as any,
            p_colors: (resolvedColorNames.length ? resolvedColorNames : null) as any,
            p_influencer_ids: section === 'influencer' ? ((influencerIds ?? null) as any) : null
          });

          if (error) {
            console.warn('Results error:', error.message);
            if (replace) {
              setResults([]);
              setHasMore(false);
              setResultCount(0);
            }
            return;
          }

          const newItems = (data || []) as ResultsListing[];
          // eslint-disable-next-line no-console
          console.log('[Results] loadPage nearby ok', {
            section,
            km: liveFilters.nearbyKm,
            page,
            replace,
            returned: newItems.length
          });
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

          if (!user?.id) {
            // fallback = newest
            let qb: any = supabase.from('v_feed_listings').select('*', { count: 'exact' });
            qb = applySectionConstraints(qb);
            qb = applyFilters(qb);
            qb = applySearchQuery(qb);
            if (section === 'search') {
              qb = applySearchListingOrder(qb, sort);
            } else {
              qb = qb.order('created_at', { ascending: false });
            }
            qb = qb.range(from, to);
            const { data, error, count } = await qb;
            if (error) {
              console.warn('Results error:', error.message);
              if (replace) {
                setResults([]);
                setHasMore(false);
                setResultCount(0);
              }
              return;
            }
            const newItems = (data || []) as ResultsListing[];
            console.log('[Results] loadPage ok', { section, query: query.trim(), page, replace, returned: newItems.length, count });
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

          const likedIds = (likesRows || []).map((r: any) => String(r.listing_id)).filter(Boolean);

          if (likedIds.length === 0) {
            let qb: any = supabase.from('v_feed_listings').select('*', { count: 'exact' });
            qb = applySectionConstraints(qb);
            qb = applyFilters(qb);
            qb = applySearchQuery(qb);
            if (section === 'search') {
              qb = applySearchListingOrder(qb, sort);
            } else {
              qb = qb.order('created_at', { ascending: false });
            }
            qb = qb.range(from, to);
            const { data, error, count } = await qb;
            if (error) {
              console.warn('Results error:', error.message);
              if (replace) {
                setResults([]);
                setHasMore(false);
                setResultCount(0);
              }
              return;
            }
            const newItems = (data || []) as ResultsListing[];
            console.log('[Results] loadPage ok', { section, query: query.trim(), page, replace, returned: newItems.length, count });
            setResults((prev) => (replace ? newItems : [...prev, ...newItems]));
            pageRef.current = page;
            setHasMore(newItems.length === PAGE_SIZE);
            setResultCount(typeof count === 'number' ? count : newItems.length);
            return;
          }

          // liked matching current constraints/filters/search
          let likedQ: any = supabase.from('v_feed_listings').select('*').in('id', likedIds);
          likedQ = applySectionConstraints(likedQ);
          likedQ = applyFilters(likedQ);
          likedQ = applySearchQuery(likedQ);
          const { data: likedData } = await likedQ;
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
            restQ = applySearchQuery(restQ);
            if (section === 'search') {
              restQ = applySearchListingOrder(restQ, sort);
            } else {
              restQ = restQ.order('created_at', { ascending: false });
            }
            const quoted = likedIds.map((x) => `"${x}"`).join(',');
            restQ = restQ.not('id', 'in', `(${quoted})`).range(restOffset, restOffset + remaining - 1);
            const { data: restData } = await restQ;
            restItems = (restData || []) as ResultsListing[];
          }

          const newItems = [...likedSlice, ...restItems];
          console.log('[Results] loadPage ok', {
            section,
            query: query.trim(),
            page,
            replace,
            returned: newItems.length,
            likedReturned: likedSlice.length,
            restReturned: restItems.length
          });
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
        qb = applySearchQuery(qb);
        if (section === 'search') {
          qb = applySearchListingOrder(qb, sort);
        }

        let { data, error, count } = await qb;
        if (error) {
          // Fallback for older v_feed_listings views missing `brand`
          const msg = String((error as any)?.message ?? '').toLowerCase();
          const brandMissing =
            msg.includes('column') && msg.includes('v_feed_listings.brand') && msg.includes('does not exist');
          if (brandMissing && section === 'search' && query.trim().length > 0) {
            const trimmed = query.trim();
            const pattern = `*${trimmed}*`;
            const orFilter = `title.ilike.${pattern},description.ilike.${pattern}`;
            // eslint-disable-next-line no-console
            console.log('[Results] fallback without brand', { orFilter });

            let qb2: any = baseQb;
            qb2 = applyBaseSection(qb2);
            qb2 = applyFilters(qb2);
            qb2 = qb2.or(orFilter);
            if (section === 'search') {
              qb2 = applySearchListingOrder(qb2, sort);
            }
            ({ data, error, count } = await qb2);
          }
        }

        if (error) {
          // eslint-disable-next-line no-console
          console.warn('Results error:', error.message);
          if (replace) {
            setResults([]);
            setHasMore(false);
            setResultCount(0);
          }
          return;
        }

        const newItems = (data || []) as ResultsListing[];
        // eslint-disable-next-line no-console
        console.log('[Results] loadPage ok', {
          section,
          query: query.trim(),
          page,
          replace,
          returned: newItems.length,
          count
        });
        setResults((prev) => (replace ? newItems : [...prev, ...newItems]));
        pageRef.current = page;
        setHasMore(newItems.length === PAGE_SIZE);
        setResultCount(typeof count === 'number' ? count : newItems.length);
      } finally {
        setLoading(false);
        setLoadingMore(false);
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
      resolvedCategoryLabels,
      influencerIds,
      resolvedBrandNames,
      resolvedColorNames,
      resolvedSizeLabels
    ]
  );

  const triggerReload = useCallback(() => {
    pageRef.current = 0;
    void loadPage(0, true);
  }, [loadPage]);

  const skipFirstSearchFocusReload = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (!reloadOnFocus || section !== 'search') return;
      if (skipFirstSearchFocusReload.current) {
        skipFirstSearchFocusReload.current = false;
        return;
      }
      triggerReload();
    }, [reloadOnFocus, section, triggerReload, effectiveFilters])
  );

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

  // Initial load
  useEffect(() => {
    triggerReload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, influencerIds]);

  // Debounce recherche
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      triggerReload();
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, triggerReload]);

  // Refresh quand filtres changent ou quand les libellés résolus sont prêts (évite la course async ID → texte)
  useEffect(() => {
    triggerReload();
  }, [
    effectiveFilters,
    resolvedBrandNames,
    resolvedSizeLabels,
    resolvedColorNames,
    resolvedCategoryLabels,
    triggerReload
  ]);

  useEffect(() => {
    if (!standaloneSearch || section !== 'search') return;
    if (!searchFocusReloadNonce) return;
    triggerReload();
  }, [searchFocusReloadNonce, standaloneSearch, section, triggerReload]);

  const handleLoadMore = () => {
    if (loadingMore || loading || !hasMore) return;
    void loadPage(pageRef.current + 1, false);
  };

  const handleClearQuery = () => setQuery('');

  const resultLabel = useMemo(() => {
    if (resultCount == null) return '';
    if (searchStyleFilters) {
      if (resultCount >= 500) return '500+ résultats';
      if (resultCount === 1) return '1 résultat';
      return `${resultCount} résultats`;
    }
    if (resultCount >= 500) return '500+ results';
    if (resultCount === 1) return '1 result';
    return `${resultCount} results`;
  }, [resultCount, searchStyleFilters]);

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
        Alert.alert('Localisation', 'Activez la localisation pour utiliser ce filtre');
        return;
      }
      await Location.getCurrentPositionAsync({});
      setFilter('nearbyKm', km);
      setNearbyModalOpen(false);
    } catch {
      Alert.alert('Localisation', 'Activez la localisation pour utiliser ce filtre');
    } finally {
      setNearbyConfirming(false);
    }
  }, [nearbyDraftKm, setFilter]);

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
          pathname: (
            filtersRouteBase === FILTERS_PATH_TABS_ROOT
              ? `${FILTERS_PATH_TABS_ROOT}/index`
              : filtersRouteBase
          ) as any,
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
        router.push({
          pathname: filtersScreenPath(filtersRouteBase, 'brand-gender') as any,
          params: resultsParams
        });
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

  const isAnyFilterActive =
    Boolean(effectiveFilters.categoryId) ||
    Boolean(effectiveFilters.conditionIds && effectiveFilters.conditionIds.length) ||
    Boolean(effectiveFilters.priceMin != null) ||
    Boolean(effectiveFilters.priceMax != null) ||
    Boolean(effectiveFilters.brandIds && effectiveFilters.brandIds.length) ||
    Boolean(effectiveFilters.sizeIds && effectiveFilters.sizeIds.length) ||
    Boolean(effectiveFilters.colorIds && effectiveFilters.colorIds.length) ||
    Boolean(effectiveFilters.nearbyKm != null);

  const pillActive = (name: string) => {
    switch (name) {
      case 'Clear':
        return isAnyFilterActive;
      case 'Women':
        return resolvedCategoryGenderDb === SEARCH_CATEGORY_DB_GENDER.Women;
      case 'Men':
        return resolvedCategoryGenderDb === SEARCH_CATEGORY_DB_GENDER.Men;
      case 'Kids':
        return resolvedCategoryGenderDb === SEARCH_CATEGORY_DB_GENDER.Kids;
      case 'Baby':
        return resolvedCategoryGenderDb === SEARCH_CATEGORY_DB_GENDER.Baby;
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
          .select('id, display_name, avatar_url, is_influencer, company_name')
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

  const renderMixedItem = ({ item }: { item: MixedItem }) => {
    if (item.type === 'showcase') {
      return (
        <View style={styles.showcaseRow}>
          <SellerShowcaseCard
            showcase={item.data}
            onPress={() =>
              router.push({
                pathname: '/tabs/public-profile' as any,
                params: { user_id: item.data.id }
              })
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
          sellerAvatarUrl={item.data.seller_avatar_url ?? undefined}
          sellerIsInfluencer={Boolean(item.data.seller_is_influencer)}
          title={item.data.title}
          price={item.data.price}
          currency="CHF"
          brand={item.data.brand ?? undefined}
          size={(item.data as any).size ?? undefined}
          condition={item.data.condition ?? undefined}
          imageUrl={item.data.cover_photo_url}
          onPress={() => router.push(`/tabs/feed/${item.data.id}`)}
          cardWidth={GRID_CARD_WIDTH}
          imageRatio={1}
        />
      </View>
    );
  };

  const keyExtractor = (item: MixedItem) => {
    if (item.type === 'listing') return item.data.id;
    return item.id;
  };

  const handleBack = () => {
    const canGoBack = typeof (router as any).canGoBack === 'function' ? (router as any).canGoBack() : true;
    if (!canGoBack) return;
    router.back();
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
              placeholder="Search for items or members"
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
                accessibilityLabel="Effacer la recherche"
              >
                <Text style={styles.clearText}>×</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Filters */}
        <View style={styles.filtersRow}>
          <FlatList
            data={[...filterPills]}
            keyExtractor={(item) => item}
            horizontal
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
                      Tout effacer
                    </Text>
                  ) : item === 'Filter' ? (
                    <View style={styles.filterIconRow}>
                      <Text style={styles.filterIconText}>≡</Text>
                      <Text style={styles.filterText}>Filter</Text>
                    </View>
                  ) : item === 'Nearby' ? (
                    <Text style={styles.filterText}>
                      {effectiveFilters.nearbyKm != null ? `${effectiveFilters.nearbyKm} km` : 'Nearby'}
                    </Text>
                  ) : (
                    <Text style={styles.filterText}>{item}</Text>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {!searchStyleFilters ? (
        <Modal
          visible={nearbyModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setNearbyModalOpen(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setNearbyModalOpen(false)}>
            <Pressable style={styles.modalCard} onPress={() => null}>
              <Text style={styles.modalTitle}>Nearby</Text>
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
                  <Text style={styles.modalBtnText}>Reset</Text>
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
                    <Text style={styles.modalBtnTextPrimary}>Apply</Text>
                  )}
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
        ) : null}

        {/* Result count */}
        {resultLabel && !loading ? (
          <Text variant="body" style={styles.resultCountText}>
            {resultLabel}
          </Text>
        ) : null}

        {/* Results grid */}
        {loading ? (
          <View style={styles.skeletonContainer}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              // eslint-disable-next-line react/no-array-index-key
              <View key={i} style={styles.skeletonBox} />
            ))}
          </View>
        ) : results.length === 0 ? (
          <View style={styles.emptyContainer}>
            <AppIcon name="searchOutline" size={48} color="#AAAAAA" />
            <Text style={[styles.emptyTitle, searchStyleFilters && styles.emptyTitleStandalone]}>
              {searchStyleFilters ? 'Aucun résultat' : 'No results found'}
            </Text>
            {!searchStyleFilters ? (
              <Text style={styles.emptySubtitle}>Try different keywords or filters</Text>
            ) : null}
          </View>
        ) : (
          <FlatList
            key="results-grid-2"
            data={mixedData}
            keyExtractor={keyExtractor}
            numColumns={2}
            renderItem={renderMixedItem as any}
            contentContainerStyle={[
              styles.listContent,
              searchStyleFilters && styles.listContentTabSearch,
              isSearchTabScreen ? { paddingBottom: fixedTabBarReserveSpace + 8 } : null
            ]}
            columnWrapperStyle={styles.listRow}
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
  const badge = showcase.is_influencer
    ? 'Influenceur'
    : showcase.company_name && showcase.company_name.trim().length > 0
      ? 'Pro'
      : 'Particulier';

  const title = (showcase.display_name ?? '').trim() || 'Seller';

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
            <Text style={styles.showcaseCountText}>{`${showcase.active_count} articles actifs`}</Text>
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
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    fontSize: 14,
    color: theme.colors.textPrimary
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

