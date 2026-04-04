import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, RefreshControl, StyleSheet, View, Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  getFeedListings,
  getMyLikedListingIds,
  type FeedListing
} from '../../../lib/api';
import { theme } from '../../../lib/theme';
import { HomeHero } from '../../../components/home/HomeHero';
import { SectionHeader } from '../../../components/home/SectionHeader';
import { Screen } from '../../../components/ui/Screen';
import { Text } from '../../../components/ui/Text';
import { ProductCard } from '../../../components/ProductCard';
import { useFeedFiltersStore } from '../../../lib/store/feedFilters';
import { useAuthStore } from '../../../stores/authStore';
import { useLikesStore } from '../../../stores/likesStore';

export default function HomeScreen() {
  const router = useRouter();
  const { filters } = useFeedFiltersStore();
  const { user } = useAuthStore();
  const setLikedIds = useLikesStore((s) => s.setLikedIds);
  const setCounts = useLikesStore((s) => s.setCounts);
  const clearLikes = useLikesStore((s) => s.clear);
  const [listings, setListings] = useState<FeedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const screenWidth = Dimensions.get('window').width;
  const gridPaddingX = 16;
  const gridGap = 12;
  const gridCardWidth = (screenWidth - gridPaddingX * 2 - gridGap) / 2;

  const fetchFeed = useCallback(async () => {
    try {
      setError(null);
      const feedPromise = getFeedListings({
        limit: 40,
        offset: 0,
        filters
      });
      const likedIdsPromise = user ? getMyLikedListingIds() : Promise.resolve({ data: [], error: null });

      const [{ data, error: fetchError }, { data: likedIds, error: likedIdsError }] =
        await Promise.all([feedPromise, likedIdsPromise]);

      if (fetchError) {
        setError(fetchError);
        setListings([]);
      } else {
        setListings(data);
      }

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
      setError(err instanceof Error ? err : new Error('Erreur inconnue'));
      setListings([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, user, setLikedIds, setCounts, clearLikes]);

  useFocusEffect(
    useCallback(() => {
      if (listings.length === 0) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      void fetchFeed();

      return () => {};
    }, [fetchFeed, listings.length])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    void fetchFeed();
  };

  const handleListingPress = (id: string) => {
    router.push(`/tabs/feed/${id}`);
  };

  const { sponsored, trending, influencers, all } = useMemo(() => {
    const s = listings.slice(0, 8);
    const t = listings.slice(8, 16);
    const i = listings.slice(16, 24);
    return {
      sponsored: s,
      trending: t.length > 0 ? t : s,
      influencers: i.length > 0 ? i : s,
      all: listings
    };
  }, [listings]);

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
            Erreur de chargement
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
      <Screen scroll noHorizontalPadding>
        <HomeHero backgroundUri={null} />

        <View style={styles.section}>
          <SectionHeader
            title="Sponsorisés"
            onPressSeeAll={() => {
              console.log('Voir tout - Sponsorisés');
            }}
          />
          <FlatList
            data={sponsored}
            keyExtractor={(item) => `sponsored-${item.id}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            ItemSeparatorComponent={() => <View style={styles.horizontalSeparator} />}
            renderItem={({ item }) => (
              <ProductCard
                listingId={item.id}
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

        <View style={styles.section}>
          <SectionHeader
            title="Tendances"
            onPressSeeAll={() => {
              console.log('Voir tout - Tendances');
            }}
          />
          <FlatList
            data={trending}
            keyExtractor={(item) => `trending-${item.id}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            ItemSeparatorComponent={() => <View style={styles.horizontalSeparator} />}
            renderItem={({ item }) => (
              <ProductCard
                listingId={item.id}
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

        <View style={styles.section}>
          <SectionHeader
            title="Influenceurs"
            onPressSeeAll={() => {
              console.log('Voir tout - Influenceurs');
            }}
          />
          <FlatList
            data={influencers}
            keyExtractor={(item) => `influencers-${item.id}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            ItemSeparatorComponent={() => <View style={styles.horizontalSeparator} />}
            renderItem={({ item }) => (
              <ProductCard
                listingId={item.id}
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

        <View style={styles.section}>
          <SectionHeader
            title="Tous les articles"
            onPressSeeAll={() => {
              console.log('Voir tout - Tous les articles');
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
                      {/* Header vendeur */}
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          marginBottom: 6
                        }}
                      >
                        {item.seller_avatar_url ? (
                          <Image
                            source={{ uri: item.seller_avatar_url }}
                            style={{ width: 24, height: 24, borderRadius: 12 }}
                          />
                        ) : (
                          <View
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 12,
                              backgroundColor: '#E5E5E5'
                            }}
                          />
                        )}
                        <Text
                          variant="captionSm"
                          style={{ fontSize: 12, fontWeight: '500' }}
                        >
                          {item.seller_display_name ?? 'Seller'}
                        </Text>
                      </View>

                      {/* Card produit réutilisée */}
                      <ProductCard
                        listingId={item.id}
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
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background
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
