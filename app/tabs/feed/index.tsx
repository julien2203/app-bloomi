import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import {
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
import { ProductCard } from '../../../components/ProductCard';
import { useFeedFiltersStore } from '../../../lib/store/feedFilters';
import { useAuthStore } from '../../../stores/authStore';
import { useLikesStore } from '../../../stores/likesStore';
import { useNotificationsBadgeStore } from '../../../stores/notificationsBadgeStore';
import { FeedHeader } from '../../../components/feed/FeedHeader';

export default function HomeScreen() {
  const router = useRouter();
  const { filters } = useFeedFiltersStore();
  const { user } = useAuthStore();
  const setLikedIds = useLikesStore((s) => s.setLikedIds);
  const setCounts = useLikesStore((s) => s.setCounts);
  const clearLikes = useLikesStore((s) => s.clear);
  const [listings, setListings] = useState<FeedListing[]>([]);
  const [sponsoredListings, setSponsoredListings] = useState<FeedListing[]>([]);
  const [trendingListings, setTrendingListings] = useState<FeedListing[]>([]);
  const [influencerListings, setInfluencerListings] = useState<FeedListing[]>([]);
  const unreadNotificationsCount = useNotificationsBadgeStore((s) => s.unreadCount);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');

  const notificationsChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const notificationsBadgeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const screenWidth = Dimensions.get('window').width;
  const gridPaddingX = 16;
  const gridGap = 12;
  const gridCardWidth = (screenWidth - gridPaddingX * 2 - gridGap) / 2;

  const submitSearch = useCallback(() => {
    const q = searchText.trim();
    if (!q) return;
    router.push({
      pathname: '/tabs/results' as any,
      params: { section: 'search', query: q, title: 'Recherche' }
    });
  }, [router, searchText]);

  const fetchFeed = useCallback(async () => {
    try {
      setError(null);
      const feedPromise = getFeedListings({
        limit: 40,
        offset: 0,
        filters
      });
      const likedIdsPromise = user ? getMyLikedListingIds() : Promise.resolve({ data: [], error: null });

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
          const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          // 1) Récupérer les annonces récentes + views_count depuis `listings`
          const { data: recentListings, error: recentErr } = await supabase
            .from('listings')
            .select('id, views_count')
            .eq('status', 'published')
            .gte('created_at', from)
            .order('created_at', { ascending: false })
            .limit(80);
          if (recentErr) throw recentErr;

          const ids = (recentListings || []).map((r: any) => String(r.id)).filter(Boolean);
          if (ids.length === 0) return [] as FeedListing[];

          const viewsById: Record<string, number> = {};
          for (const r of recentListings as any[]) {
            const id = String(r.id);
            const v = typeof r.views_count === 'number' ? r.views_count : Number(r.views_count ?? 0);
            viewsById[id] = Number.isFinite(v) ? v : 0;
          }

          // 2) Récupérer les cartes via la view (inclut likes_count)
          const { data: cards, error: cardsErr } = await supabase
            .from('v_feed_listings')
            .select('*')
            .in('id', ids);
          if (cardsErr) throw cardsErr;

          const rows = (cards || []) as FeedListing[];
          const scored = rows
            .map((r) => {
              const views = viewsById[r.id] ?? 0;
              const likes = typeof (r as any).likes_count === 'number' ? (r as any).likes_count : 0;
              return { r, score: views + likes * 2 };
            })
            // Ne pas afficher des tendances sans signaux
            .filter((x) => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 10)
            .map((x) => x.r);

          return scored;
        } catch {
          return [] as FeedListing[];
        }
      })();

      const influencersPromise = (async () => {
        try {
          const { data: profs, error: pErr } = await supabase
            .from('profiles')
            .select('id')
            .eq('is_influencer', true)
            .limit(50);
          if (pErr) throw pErr;
          const ids = (profs || []).map((p: any) => String(p.id)).filter(Boolean);
          if (ids.length === 0) return [] as FeedListing[];

          const { data, error: iErr } = await supabase
            .from('v_feed_listings')
            .select('*')
            .in('seller_id', ids)
            .eq('status', 'published')
            .order('created_at', { ascending: false })
            .limit(10);
          if (iErr) throw iErr;
          return (data || []) as FeedListing[];
        } catch {
          return [] as FeedListing[];
        }
      })();

      const [
        { data, error: fetchError },
        { data: likedIds, error: likedIdsError },
        sponsoredRes,
        trendingRes,
        influencersRes
      ] = await Promise.all([
        feedPromise,
        likedIdsPromise,
        sponsoredPromise,
        trendingPromise,
        influencersPromise
      ]);

      if (fetchError) {
        setError(fetchError);
        setListings([]);
      } else {
        setListings(data);
      }

      setSponsoredListings(sponsoredRes);
      setTrendingListings(trendingRes);
      setInfluencerListings(influencersRes);

      // Hydrate store instantanément dès qu'on a l'info user-likes.
      if (!user) {
        clearLikes();
      } else if (!likedIdsError && likedIds) {
        setLikedIds(likedIds);
      }

      // Compteurs instantanés: viennent directement de v_feed_listings.likes_count
      if (!fetchError && data && data.length > 0) {
        const counts: Record<string, number> = {};
        for (const l of data) {
          counts[l.id] = typeof (l as any).likes_count === 'number' ? (l as any).likes_count : 0;
        }
        setCounts(counts);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setListings([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, user, setLikedIds, setCounts, clearLikes]);

  const loadUnreadNotificationsCount = useCallback(async () => {
    const setUnread = useNotificationsBadgeStore.getState().setUnreadCount;
    if (!user?.id) {
      setUnread(0);
      return;
    }
    try {
      const { count, error: cErr } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('read_at', null);
      if (cErr) throw cErr;
      setUnread(count ?? 0);
    } catch {
      setUnread(0);
    }
  }, [user?.id]);

  const scheduleUnreadBadgeReload = useCallback(() => {
    if (notificationsBadgeDebounceRef.current) {
      clearTimeout(notificationsBadgeDebounceRef.current);
    }
    notificationsBadgeDebounceRef.current = setTimeout(() => {
      notificationsBadgeDebounceRef.current = null;
      void loadUnreadNotificationsCount();
    }, 450);
  }, [loadUnreadNotificationsCount]);

  useEffect(() => {
    void loadUnreadNotificationsCount();
  }, [loadUnreadNotificationsCount]);

  // Realtime: badge mis à jour sur nouvelles notifications
  useEffect(() => {
    // cleanup
    if (notificationsChannelRef.current) {
      void supabase.removeChannel(notificationsChannelRef.current);
      notificationsChannelRef.current = null;
    }

    if (!user?.id) return;

    const ch = supabase
      .channel(`notifications:user:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => {
          scheduleUnreadBadgeReload();
        }
      )
      .subscribe();

    notificationsChannelRef.current = ch;

    return () => {
      void supabase.removeChannel(ch);
      notificationsChannelRef.current = null;
      if (notificationsBadgeDebounceRef.current) {
        clearTimeout(notificationsBadgeDebounceRef.current);
        notificationsBadgeDebounceRef.current = null;
      }
    };
  }, [scheduleUnreadBadgeReload, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadUnreadNotificationsCount();

      if (listings.length === 0) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      void fetchFeed();

      return () => {};
    }, [fetchFeed, listings.length, loadUnreadNotificationsCount])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    void fetchFeed();
  };

  const handleListingPress = (id: string) => {
    router.push(`/tabs/feed/${id}`);
  };

  const all = listings;

  const chunk = <T,>(arr: T[], size: number): T[][] =>
    Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
      arr.slice(i * size, i * size + size)
    );

  if (loading) {
    return (
      <Screen>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text variant="body" color="textSecondary" style={styles.loadingText}>
            Chargement du feed...
          </Text>
        </View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen scroll noHorizontalPadding>
        <View style={styles.centerContent}>
          <Text variant="h2" style={styles.errorTitle}>
            Loading error
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
            Réessayer
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <View style={styles.root}>
      <Screen scroll={false} noHorizontalPadding>
        {/* Sticky search bar (not scrolling) */}
        <FeedHeader
          searchText={searchText}
          onSearchTextChange={setSearchText}
          onSubmitSearch={submitSearch}
          unreadNotificationsCount={unreadNotificationsCount}
        />

        {/* Scroll only below */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          {/* 12px gap below sticky bar */}
          <View style={{ height: 12 }} />

          <HomeHero backgroundUri={null} unreadNotificationsCount={unreadNotificationsCount} />

          {sponsoredListings.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader
                title="Sponsored"
                onPressSeeAll={() => {
                  router.push({
                    pathname: '/tabs/results' as any,
                    params: { section: 'sponsored', title: 'Sponsored' }
                  });
                }}
              />
              <FlatList
                data={sponsoredListings}
                keyExtractor={(item) => `sponsored-${item.id}`}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalList}
                ItemSeparatorComponent={() => <View style={styles.horizontalSeparator} />}
                renderItem={({ item }) => (
                  <ProductCard
                    listingId={item.id}
                    sellerId={item.seller_id}
                    sellerName={item.seller_display_name}
                    sellerAvatarUrl={item.seller_avatar_url}
                    sellerIsInfluencer={Boolean(item.seller_is_influencer)}
                    title={item.title}
                    price={item.price}
                    currency="CHF"
                    brand={item.brand ?? undefined}
                    size={(item as any).size ?? undefined}
                    condition={item.condition ?? undefined}
                    imageUrl={item.cover_photo_url}
                    onPress={() => handleListingPress(item.id)}
                    cardWidth={167}
                    imageRatio={1}
                    style={styles.horizontalCard}
                  />
                )}
              />
            </View>
          ) : null}

        {trendingListings.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader
              title="Trending"
              onPressSeeAll={() => {
                router.push({
                  pathname: '/tabs/results' as any,
                  params: { section: 'trending', title: 'Trending' }
                });
              }}
            />
            <FlatList
              data={trendingListings}
              keyExtractor={(item) => `trending-${item.id}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              ItemSeparatorComponent={() => <View style={styles.horizontalSeparator} />}
              renderItem={({ item }) => (
                <ProductCard
                  listingId={item.id}
                  sellerId={item.seller_id}
                  sellerName={item.seller_display_name}
                  sellerAvatarUrl={item.seller_avatar_url}
                  sellerIsInfluencer={Boolean(item.seller_is_influencer)}
                  title={item.title}
                  price={item.price}
                  currency="CHF"
                  brand={item.brand ?? undefined}
                  size={(item as any).size ?? undefined}
                  condition={item.condition ?? undefined}
                  imageUrl={item.cover_photo_url}
                  onPress={() => handleListingPress(item.id)}
                  cardWidth={167}
                  imageRatio={1}
                  style={styles.horizontalCard}
                />
              )}
            />
          </View>
        ) : null}

        {influencerListings.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader
              title="Influencers"
              onPressSeeAll={() => {
                router.push({
                  pathname: '/tabs/results' as any,
                  params: { section: 'influencer', title: 'Influencers' }
                });
              }}
            />
            <FlatList
              data={influencerListings}
              keyExtractor={(item) => `influencers-${item.id}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              ItemSeparatorComponent={() => <View style={styles.horizontalSeparator} />}
              renderItem={({ item }) => (
                <ProductCard
                  listingId={item.id}
                  sellerId={item.seller_id}
                  sellerName={item.seller_display_name}
                  sellerAvatarUrl={item.seller_avatar_url}
                  sellerIsInfluencer={Boolean(item.seller_is_influencer)}
                  title={item.title}
                  price={item.price}
                  currency="CHF"
                  brand={item.brand ?? undefined}
                  size={(item as any).size ?? undefined}
                  condition={item.condition ?? undefined}
                  imageUrl={item.cover_photo_url}
                  onPress={() => handleListingPress(item.id)}
                  cardWidth={167}
                  imageRatio={1}
                  style={styles.horizontalCard}
                />
              )}
            />
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeader
            title="All items"
            onPressSeeAll={() => {
              router.push({
                pathname: '/tabs/results' as any,
                params: { section: 'all', title: 'All items' }
              });
            }}
          />
          {listings.length === 0 && !loading ? (
            <View style={styles.emptyInlineContainer}>
              <Text variant="body" color="textSecondary">
                Aucune annonce pour le moment
              </Text>
            </View>
          ) : (
            <View style={styles.gridContent}>
              {chunk(all, 2).map((pair, rowIndex) => (
                <View
                  // eslint-disable-next-line react/no-array-index-key
                  key={rowIndex}
                  style={{
                    flexDirection: 'row',
                    gap: 12,
                    paddingHorizontal: 16,
                    marginBottom: 12
                  }}
                >
                  {pair.map((item) => (
                    <View key={item.id} style={{ flex: 1 }}>
                      {/* Card produit réutilisée */}
                      <ProductCard
                        listingId={item.id}
                        sellerId={item.seller_id}
                        sellerName={item.seller_display_name}
                        sellerAvatarUrl={item.seller_avatar_url}
                        sellerIsInfluencer={Boolean(item.seller_is_influencer)}
                        title={item.title}
                        price={item.price}
                        currency="CHF"
                        brand={item.brand ?? undefined}
                        size={(item as any).size ?? undefined}
                        condition={item.condition ?? undefined}
                        imageUrl={item.cover_photo_url}
                        onPress={() => handleListingPress(item.id)}
                        cardWidth={gridCardWidth}
                        imageRatio={1}
                      />
                    </View>
                  ))}
                  {pair.length === 1 && <View style={{ flex: 1 }} />}
                </View>
              ))}
            </View>
          )}
        </View>
        </ScrollView>
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
    paddingBottom: theme.spacing.gapLg * 2
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
  horizontalSeparator: {
    width: 12
  },
  horizontalCard: {
    width: 167
  },
  emptyInlineContainer: {
    alignItems: 'center',
    paddingVertical: 40
  },
  gridContent: {
    paddingTop: theme.spacing.gapMd,
    paddingBottom: 120
  },
  gridRow: {
    columnGap: theme.spacing.gapMd
  },
  section: {
    // pas de padding horizontal ici pour que les carrousels restent flush avec les bords;
    // le padding pour les titres / "Voir tout" est géré dans SectionHeader.
  }
});
