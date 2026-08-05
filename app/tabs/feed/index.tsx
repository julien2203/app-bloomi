import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
  useWindowDimensions
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  cloneFeedListings,
  getBlockedSellerIdsForCurrentUser,
  getFeedListings,
  getMyLikedListingIds,
  type FeedListing
} from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import { theme } from '../../../lib/theme';
import { HomeHero } from '../../../components/home/HomeHero';
import { SectionHeader } from '../../../components/home/SectionHeader';
import { Screen } from '../../../components/ui/Screen';
import { Text } from '../../../components/ui/Text';
import { Button } from '../../../components/ui/Button';
import { ProductCard } from '../../../components/ProductCard';
import { useFeedFiltersStore } from '../../../lib/store/feedFilters';
import { useAuthStore } from '../../../stores/authStore';
import { useLikesStore } from '../../../stores/likesStore';
import { useNotificationsBadgeStore } from '../../../stores/notificationsBadgeStore';
import { refreshNotificationsBadge } from '../../../lib/notificationsBadge';
import { guardedPush } from '../../../lib/navigation/guardedNav';
import { openListingDetail } from '../../../lib/navigation/openListingDetail';
import { fetchTrendingListings } from '../../../lib/trendingListings';
import { fetchFeaturedInfluencers, type FeaturedInfluencer } from '../../../lib/featuredInfluencers';
import {
  InfluencerSpotlightCard,
  influencerSpotlightCardSize
} from '../../../components/feed/InfluencerSpotlightCard';
import { FeedHeader } from '../../../components/feed/FeedHeader';
import { FeedGridSkeleton } from '../../../components/feed/FeedGridSkeleton';
import { getFixedTabBarHeight } from '../../../components/navigation/FloatingTabBar';
import { getCardImagePriority, FEED_GRID_PERF_PROPS, LIST_IMAGE_PERF_PROPS } from '../../../lib/cardImagePriority';
import { subscribeBlockedUsersRevision } from '../../../lib/store/blockedUsersSync';
import { normalizeLanguage } from '../../../lib/i18n';
import { getPublishedHomeHero, type HomeHeroContent } from '../../../lib/api/homeHero';
import { authDebug, authDebugError } from '../../../lib/authDebugLog';
import {
  horizontalCardWidth,
  horizontalCarouselMinHeight,
  gridCardWidth,
  GRID_GAP,
  GRID_PADDING_X
} from '../../../lib/cardLayout';

const FEED_PAGE_SIZE = 40;
const FEED_PAGE_PROBE = FEED_PAGE_SIZE + 1;
const HORIZONTAL_CARD_IMAGE_RATIO = 1.3;

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { filters } = useFeedFiltersStore();
  const { user } = useAuthStore();
  const setLikedIds = useLikesStore((s) => s.setLikedIds);
  const setCounts = useLikesStore((s) => s.setCounts);
  const clearLikes = useLikesStore((s) => s.clear);
  const [listings, setListings] = useState<FeedListing[]>([]);
  const [sponsoredListings, setSponsoredListings] = useState<FeedListing[]>([]);
  const [trendingListings, setTrendingListings] = useState<FeedListing[]>([]);
  const [featuredInfluencers, setFeaturedInfluencers] = useState<FeaturedInfluencer[]>([]);
  const unreadNotificationsCount = useNotificationsBadgeStore((s) => s.unreadCount);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [homeHero, setHomeHero] = useState<HomeHeroContent | null>(null);
  const [hasMoreAllListings, setHasMoreAllListings] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const didLogFirstRenderRef = useRef(false);
  const listingsCountRef = useRef(0);
  const lastFetchAtRef = useRef(0);
  const hasMoreRef = useRef(false);
  const loadingMoreRef = useRef(false);
  listingsCountRef.current = listings.length;
  hasMoreRef.current = hasMoreAllListings;

  /** Évite un re-fetch complet au retour depuis Results (onglet sibling). */
  const FEED_FOCUS_REFRESH_MS = 2 * 60 * 1000;

  useEffect(() => {
    authDebug('feed:mount', { hasUser: Boolean(user?.id) });
    if (user?.id) {
      void getBlockedSellerIdsForCurrentUser(user.id);
    }
    return () => {
      authDebug('feed:unmount');
    };
  }, [user?.id]);

  const { width: screenWidth } = useWindowDimensions();
  const feedHorizontalCardWidth = useMemo(() => horizontalCardWidth(screenWidth), [screenWidth]);
  const feedGridCardWidth = useMemo(() => gridCardWidth(screenWidth), [screenWidth]);
  const influencerSpotlightSize = useMemo(() => influencerSpotlightCardSize(screenWidth), [screenWidth]);
  const feedHorizontalCarouselMinHeight = useMemo(
    () => horizontalCarouselMinHeight(feedHorizontalCardWidth, HORIZONTAL_CARD_IMAGE_RATIO),
    [feedHorizontalCardWidth]
  );
  const fixedTabBarReserveSpace = getFixedTabBarHeight(insets.bottom);

  const submitSearch = useCallback(() => {
    const q = searchText.trim();
    if (!q) return;
    router.push({
      pathname: '/tabs/search' as any,
      params: { query: q }
    });
  }, [router, searchText]);

  const fetchFeed = useCallback(async () => {
    authDebug('feed:fetch:start', {
      hasUser: Boolean(user?.id),
      filtersActive: Boolean(filters && Object.keys(filters).length > 0)
    });
    try {
      setError(null);
      const blockedSellerIds = await getBlockedSellerIdsForCurrentUser(user?.id);

      const filterBlocked = (rows: FeedListing[]) => {
        const filtered =
          blockedSellerIds.length > 0
            ? rows.filter((row) => !blockedSellerIds.includes(String(row.seller_id)))
            : rows;
        return cloneFeedListings(filtered);
      };

      void getPublishedHomeHero(normalizeLanguage(i18n.language)).then((heroConfig) => {
        setHomeHero(heroConfig);
      });

      const feedPromise = getFeedListings({
        limit: FEED_PAGE_PROBE,
        offset: 0,
        filters,
        blockedSellerIds
      });

      const sponsoredPromise = (async () => {
        try {
          const nowIso = new Date().toISOString();
          const { data, error: sErr } = await supabase
            .from('v_feed_listings')
            .select('*')
            .eq('is_sponsored', true)
            .gt('sponsored_until', nowIso)
            .order('sponsored_until', { ascending: false })
            .limit(10);
          if (sErr) throw sErr;
          return (data || []) as FeedListing[];
        } catch {
          return [] as FeedListing[];
        }
      })();

      const trendingPromise = (async () => {
        try {
          return await fetchTrendingListings({ limit: 10 });
        } catch {
          return [] as FeedListing[];
        }
      })();

      const influencersPromise = fetchFeaturedInfluencers(blockedSellerIds);

      const { data, error: fetchError } = await feedPromise;

      if (fetchError) {
        authDebugError('feed:fetch:apiError', fetchError);
        setError(fetchError);
        setListings([]);
        setHasMoreAllListings(false);
      } else {
        const rows = cloneFeedListings(data ?? []);
        const hasMore = rows.length > FEED_PAGE_SIZE;
        const visibleRows = hasMore ? rows.slice(0, FEED_PAGE_SIZE) : rows;
        authDebug('feed:fetch:mainDone', {
          count: visibleRows.length,
          hasMore,
          sponsoredPending: true
        });
        setListings(visibleRows);
        setHasMoreAllListings(hasMore);
        hasMoreRef.current = hasMore;
      }

      if (!user) {
        clearLikes();
      } else {
        void getMyLikedListingIds().then(({ data: likedIds, error: likedIdsError }) => {
          if (!likedIdsError && likedIds) {
            setLikedIds(likedIds);
          }
        });
      }

      // Compteurs instantanés: viennent directement de v_feed_listings.likes_count
      if (!fetchError && data && data.length > 0) {
        const counts: Record<string, number> = {};
        for (const l of data) {
          counts[l.id] = typeof (l as any).likes_count === 'number' ? (l as any).likes_count : 0;
        }
        setCounts(counts);
      }

      // Les sections secondaires peuvent être lourdes: on les charge après avoir affiché le feed principal.
      void Promise.all([sponsoredPromise, trendingPromise, influencersPromise])
        .then(([sponsoredRes, trendingRes, influencersRes]) => {
          authDebug('feed:fetch:sectionsDone', {
            sponsored: sponsoredRes.length,
            trending: trendingRes.length,
            influencers: influencersRes.length
          });
          setSponsoredListings(filterBlocked(sponsoredRes));
          setTrendingListings(filterBlocked(trendingRes));
          setFeaturedInfluencers(influencersRes);
        })
        .catch((sectionErr) => {
          authDebugError('feed:fetch:sectionsError', sectionErr);
          setSponsoredListings([]);
          setTrendingListings([]);
          setFeaturedInfluencers([]);
        });
    } catch (err) {
      authDebugError('feed:fetch:exception', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setListings([]);
      setHasMoreAllListings(false);
    } finally {
      authDebug('feed:fetch:finally', { loading: false });
      lastFetchAtRef.current = Date.now();
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, user, setLikedIds, setCounts, clearLikes, i18n.language]);

  useEffect(() => {
    return subscribeBlockedUsersRevision(() => {
      void fetchFeed();
    });
  }, [fetchFeed]);

  useEffect(() => {
    void refreshNotificationsBadge(user?.id);
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      authDebug('feed:focus', { listingsCached: listingsCountRef.current });
      void refreshNotificationsBadge(user?.id);

      const hasCache = listingsCountRef.current > 0;
      const cacheFresh = Date.now() - lastFetchAtRef.current < FEED_FOCUS_REFRESH_MS;

      if (hasCache && cacheFresh) {
        return () => {
          authDebug('feed:blur');
        };
      }

      if (!hasCache) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      void fetchFeed();

      return () => {
        authDebug('feed:blur');
      };
    }, [fetchFeed, user?.id])
  );

  useEffect(() => {
    if (loading || listings.length === 0 || didLogFirstRenderRef.current) return;
    didLogFirstRenderRef.current = true;
    authDebug('feed:renderListings', {
      count: listings.length,
      firstId: listings[0]?.id ?? null
    });
  }, [loading, listings]);

  const handleRefresh = () => {
    setRefreshing(true);
    void fetchFeed();
  };

  const handleListingPress = useCallback(
    (item: FeedListing, imageWidthDp?: number, imageHeightDp?: number) => {
      openListingDetail(router, item.id, {
        return_to: 'feed',
        cover_photo: item.cover_photo_url,
        detailPathBase: '/tabs/feed',
        imageWidthDp,
        imageHeightDp
      });
    },
    [router]
  );

  const loadMoreFeed = useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreRef.current || loading) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const blockedSellerIds = await getBlockedSellerIdsForCurrentUser(user?.id);
      const { data, error: fetchError } = await getFeedListings({
        limit: FEED_PAGE_PROBE,
        offset: listingsCountRef.current,
        filters,
        blockedSellerIds
      });
      if (fetchError || !data) return;

      const rows = cloneFeedListings(data);
      const filtered =
        blockedSellerIds.length > 0
          ? rows.filter((row) => !blockedSellerIds.includes(String(row.seller_id)))
          : rows;
      const hasMore = filtered.length > FEED_PAGE_SIZE;
      const page = hasMore ? filtered.slice(0, FEED_PAGE_SIZE) : filtered;
      hasMoreRef.current = hasMore;
      setHasMoreAllListings(hasMore);
      setListings((prev) => [...prev, ...page]);
    } catch (err) {
      authDebugError('feed:loadMore:exception', err);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [filters, loading]);

  const handleInfluencerPress = useCallback(
    (influencerId: string) => {
      guardedPush(router, {
        pathname: '/tabs/public-profile' as any,
        params: { user_id: influencerId }
      });
    },
    [router]
  );

  const navigateToAllResults = useCallback(() => {
    guardedPush(router, {
      pathname: '/tabs/results' as any,
      params: { section: 'all', title: t('feed.tabs.allItems') }
    });
  }, [router, t]);

  const horizontalCardImageHeight = useMemo(
    () => Math.round(feedHorizontalCardWidth * HORIZONTAL_CARD_IMAGE_RATIO),
    [feedHorizontalCardWidth]
  );
  const gridCardImageHeight = useMemo(
    () => Math.round(feedGridCardWidth * HORIZONTAL_CARD_IMAGE_RATIO),
    [feedGridCardWidth]
  );

  const renderGridListing = useCallback(
    ({ item, index }: { item: FeedListing; index: number }) => (
      <View style={styles.gridCardCell}>
        <ProductCard
          listingId={item.id}
          sellerId={item.seller_id}
          sellerName={item.seller_display_name}
          sellerIsInfluencer={Boolean(item.seller_is_influencer)}
          title={item.title}
          price={item.price}
          currency="CHF"
          brand={item.brand ?? undefined}
          size={(item as any).size ?? undefined}
          condition={item.condition ?? undefined}
          imageUrl={item.cover_photo_url}
          onPress={() =>
            handleListingPress(item, feedGridCardWidth, gridCardImageHeight)
          }
          cardWidth={feedGridCardWidth}
          imageRatio={HORIZONTAL_CARD_IMAGE_RATIO}
          imagePriority={getCardImagePriority(index)}
        />
      </View>
    ),
    [feedGridCardWidth, gridCardImageHeight, handleListingPress]
  );

  const feedListHeader = useMemo(
    () => (
      <>
        <View style={{ height: 12 }} />

        {homeHero ? (
          <HomeHero config={homeHero} unreadNotificationsCount={unreadNotificationsCount} />
        ) : null}

        {sponsoredListings.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader
              title={t('feed.tabs.sponsored')}
              titleColor="#000000"
              onPressSeeAll={() => {
                router.push({
                  pathname: '/tabs/results' as any,
                  params: { section: 'sponsored', title: t('feed.tabs.sponsored') }
                });
              }}
            />
            <FlatList
              data={sponsoredListings}
              keyExtractor={(item) => `sponsored-${item.id}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={[styles.horizontalCarousel, { minHeight: feedHorizontalCarouselMinHeight }]}
              contentContainerStyle={styles.horizontalList}
              ItemSeparatorComponent={() => <View style={styles.horizontalSeparator} />}
              {...LIST_IMAGE_PERF_PROPS}
              renderItem={({ item, index }) => (
                <ProductCard
                  listingId={item.id}
                  sellerId={item.seller_id}
                  sellerName={item.seller_display_name}
                  sellerIsInfluencer={Boolean(item.seller_is_influencer)}
                  title={item.title}
                  price={item.price}
                  currency="CHF"
                  brand={item.brand ?? undefined}
                  size={(item as any).size ?? undefined}
                  condition={item.condition ?? undefined}
                  imageUrl={item.cover_photo_url}
                  onPress={() =>
                    handleListingPress(item, feedHorizontalCardWidth, horizontalCardImageHeight)
                  }
                  cardWidth={feedHorizontalCardWidth}
                  imageRatio={HORIZONTAL_CARD_IMAGE_RATIO}
                  imagePriority={getCardImagePriority(index)}
                />
              )}
            />
          </View>
        ) : null}

        {trendingListings.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader
              title={t('feed.tabs.trending')}
              titleColor="#000000"
              onPressSeeAll={() => {
                router.push({
                  pathname: '/tabs/results' as any,
                  params: { section: 'trending', title: t('feed.tabs.trending') }
                });
              }}
            />
            <FlatList
              data={trendingListings}
              keyExtractor={(item) => `trending-${item.id}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={[styles.horizontalCarousel, { minHeight: feedHorizontalCarouselMinHeight }]}
              contentContainerStyle={styles.horizontalList}
              ItemSeparatorComponent={() => <View style={styles.horizontalSeparator} />}
              {...LIST_IMAGE_PERF_PROPS}
              renderItem={({ item, index }) => (
                <ProductCard
                  listingId={item.id}
                  sellerId={item.seller_id}
                  sellerName={item.seller_display_name}
                  sellerIsInfluencer={Boolean(item.seller_is_influencer)}
                  title={item.title}
                  price={item.price}
                  currency="CHF"
                  brand={item.brand ?? undefined}
                  size={(item as any).size ?? undefined}
                  condition={item.condition ?? undefined}
                  imageUrl={item.cover_photo_url}
                  onPress={() =>
                    handleListingPress(item, feedHorizontalCardWidth, horizontalCardImageHeight)
                  }
                  cardWidth={feedHorizontalCardWidth}
                  imageRatio={HORIZONTAL_CARD_IMAGE_RATIO}
                  imagePriority={getCardImagePriority(index)}
                />
              )}
            />
          </View>
        ) : null}

        {featuredInfluencers.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title={t('feed.tabs.influencers')} titleColor="#000000" />
            <FlatList
              data={featuredInfluencers}
              keyExtractor={(item) => `influencer-spotlight-${item.id}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={[
                styles.horizontalCarousel,
                { minHeight: influencerSpotlightSize.height + theme.spacing.gapMd }
              ]}
              contentContainerStyle={styles.horizontalList}
              ItemSeparatorComponent={() => <View style={styles.horizontalSeparator} />}
              {...LIST_IMAGE_PERF_PROPS}
              renderItem={({ item, index }) => (
                <InfluencerSpotlightCard
                  influencer={item}
                  cardWidth={influencerSpotlightSize.width}
                  cardHeight={influencerSpotlightSize.height}
                  onPress={() => handleInfluencerPress(item.id)}
                  imagePriority={getCardImagePriority(index)}
                />
              )}
            />
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeader
            title={t('feed.tabs.allItems')}
            titleColor="#000000"
            onPressSeeAll={listings.length > 0 ? navigateToAllResults : undefined}
          />
          {listings.length === 0 && !loading ? (
            <View style={styles.emptyInlineContainer}>
              <Text variant="body" color="textSecondary">
                {t('feed.emptyListings')}
              </Text>
            </View>
          ) : null}
        </View>
      </>
    ),
    [
      featuredInfluencers,
      feedHorizontalCardWidth,
      feedHorizontalCarouselMinHeight,
      handleInfluencerPress,
      handleListingPress,
      homeHero,
      horizontalCardImageHeight,
      influencerSpotlightSize.height,
      influencerSpotlightSize.width,
      listings.length,
      loading,
      navigateToAllResults,
      router,
      sponsoredListings,
      t,
      trendingListings,
      unreadNotificationsCount
    ]
  );

  const feedListFooter = useMemo(
    () => (
      <View style={styles.seeAllFooter}>
        {loadingMore ? (
          <ActivityIndicator size="small" color={theme.colors.primary} style={styles.loadMoreSpinner} />
        ) : null}
        {listings.length > 0 ? (
          <>
            <Button
              title={t('common.seeAll')}
              variant="secondary"
              onPress={navigateToAllResults}
              style={styles.seeAllButton}
            />
            {hasMoreAllListings ? (
              <Text variant="captionSm" color="textSecondary" style={styles.seeAllHint}>
                {t('feed.allItemsMoreAvailable')}
              </Text>
            ) : null}
          </>
        ) : null}
      </View>
    ),
    [hasMoreAllListings, listings.length, loadingMore, navigateToAllResults, t]
  );

  const showInitialLoading = loading && listings.length === 0;

  const feedListEmpty = useMemo(() => {
    if (showInitialLoading) {
      return <FeedGridSkeleton cardWidth={feedGridCardWidth} />;
    }
    if (!loading && listings.length === 0) {
      return (
        <View style={styles.emptyInlineContainer}>
          <Text variant="body" color="textSecondary">
            {t('feed.emptyListings')}
          </Text>
        </View>
      );
    }
    return null;
  }, [feedGridCardWidth, listings.length, loading, showInitialLoading, t]);

  return (
    <View style={styles.root}>
      <Screen scroll={false} noHorizontalPadding edges={['left', 'right']}>
        <FeedHeader
          searchText={searchText}
          onSearchTextChange={setSearchText}
          onSubmitSearch={submitSearch}
          unreadNotificationsCount={unreadNotificationsCount}
        />

        {error && listings.length === 0 && !loading ? (
          <View style={styles.centerContent}>
            <Text variant="h2" style={styles.errorTitle}>
              {t('feed.loadError')}
            </Text>
            <Text variant="body" color="textSecondary" style={styles.errorMessage}>
              {error.message}
            </Text>
            <Text
              variant="body"
              color="primary"
              style={styles.retryText}
              onPress={fetchFeed}
            >
              {t('common.retry')}
            </Text>
          </View>
        ) : (
        <FlatList
          data={listings}
          key="feed-all-items-grid"
          keyExtractor={(item) => item.id}
          numColumns={2}
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            listings.length === 0 ? styles.scrollContentEmpty : null,
            { paddingBottom: fixedTabBarReserveSpace + theme.spacing.gapMd }
          ]}
          columnWrapperStyle={listings.length > 0 ? styles.gridRow : undefined}
          ListHeaderComponent={feedListHeader}
          ListFooterComponent={feedListFooter}
          ListEmptyComponent={feedListEmpty}
          renderItem={renderGridListing}
          onEndReached={() => void loadMoreFeed()}
          onEndReachedThreshold={0.4}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          {...FEED_GRID_PERF_PROPS}
        />
        )}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: theme.spacing.gapLg
  },
  scrollContentEmpty: {
    flexGrow: 1
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.screenPaddingX
  },
  loadingText: {
    marginTop: theme.spacing.gapMd
  },
  errorTitle: {
    textAlign: 'center',
    marginBottom: theme.spacing.gapSm
  },
  errorMessage: {
    textAlign: 'center',
    marginBottom: theme.spacing.gapMd
  },
  retryText: {
    textAlign: 'center'
  },
  emptyTitle: {
    textAlign: 'center',
    marginBottom: theme.spacing.gapSm
  },
  emptyMessage: {
    textAlign: 'center'
  },
  horizontalList: {
    paddingLeft: theme.spacing.screenPaddingX,
    paddingRight: 0,
    paddingTop: theme.spacing.gapMd,
    paddingBottom: theme.spacing.gapSm
  },
  horizontalCarousel: {
    flexGrow: 0
  },
  horizontalSeparator: {
    width: 12
  },
  emptyInlineContainer: {
    alignItems: 'center',
    paddingVertical: 40
  },
  gridCardCell: {
    flex: 1,
    marginBottom: GRID_GAP
  },
  gridRow: {
    paddingHorizontal: GRID_PADDING_X,
    gap: GRID_GAP
  },
  seeAllFooter: {
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingTop: theme.spacing.gapSm,
    paddingBottom: 120,
    alignItems: 'center',
    gap: 8
  },
  seeAllButton: {
    alignSelf: 'stretch'
  },
  seeAllHint: {
    textAlign: 'center'
  },
  loadMoreSpinner: {
    marginBottom: theme.spacing.gapSm
  },
  section: {
    // pas de padding horizontal ici pour que les carrousels restent flush avec les bords;
    // le padding pour les titres / "Voir tout" est géré dans SectionHeader.
  }
});
