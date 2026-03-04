import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { getFeedListings, type FeedListing } from '../../../lib/api';
import { theme } from '../../../lib/theme';
import { HomeHero } from '../../../components/home/HomeHero';
import { SectionHeader } from '../../../components/home/SectionHeader';
import { BottomNav } from '../../../components/home/BottomNav';
import { Screen } from '../../../components/ui/Screen';
import { Text } from '../../../components/ui/Text';
import { ProductCard } from '../../../components/ProductCard';

export default function HomeScreen() {
  const router = useRouter();
  const [listings, setListings] = useState<FeedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFeed = async () => {
    try {
      setError(null);
      const { data, error: fetchError } = await getFeedListings({ limit: 40, offset: 0 });

      if (fetchError) {
        setError(fetchError);
        setListings([]);
      } else {
        setListings(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erreur inconnue'));
      setListings([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchFeed();
  }, []);

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

  if (listings.length === 0) {
    return (
      <Screen>
        <View style={styles.centerContent}>
          <Text variant="h2" style={styles.emptyTitle}>
            Aucune annonce pour le moment
          </Text>
          <Text variant="body" color="textSecondary" style={styles.emptyMessage}>
            Le feed sera alimenté lorsque des annonces seront publiées.
          </Text>
        </View>
      </Screen>
    );
  }

  const heroImage = listings[0]?.cover_photo_url ?? null;

  return (
    <View style={styles.root}>
      <Screen scroll noHorizontalPadding>
        <HomeHero backgroundUri={heroImage} />

        <View style={styles.section}>
          <SectionHeader title="Sponsorisés" />
          <FlatList
            data={sponsored}
            keyExtractor={(item) => `sponsored-${item.id}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            ItemSeparatorComponent={() => <View style={styles.horizontalSeparator} />}
            renderItem={({ item }) => {
              const brand = item.category ?? undefined;
              const condition = item.condition ?? undefined;
              return (
                <ProductCard
                  title={item.title}
                  price={item.price}
                  currency="CHF"
                  brand={brand}
                  condition={condition}
                  imageUrl={item.cover_photo_url}
                  likedCount={0}
                  onPress={() => handleListingPress(item.id)}
                  style={styles.horizontalCard}
                />
              );
            }}
          />
        </View>

        <View style={styles.section}>
          <SectionHeader title="Tendances" />
          <FlatList
            data={trending}
            keyExtractor={(item) => `trending-${item.id}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            ItemSeparatorComponent={() => <View style={styles.horizontalSeparator} />}
            renderItem={({ item }) => {
              const brand = item.category ?? undefined;
              const condition = item.condition ?? undefined;
              return (
                <ProductCard
                  title={item.title}
                  price={item.price}
                  currency="CHF"
                  brand={brand}
                  condition={condition}
                  imageUrl={item.cover_photo_url}
                  likedCount={0}
                  onPress={() => handleListingPress(item.id)}
                  style={styles.horizontalCard}
                />
              );
            }}
          />
        </View>

        <View style={styles.section}>
          <SectionHeader title="Influenceurs" />
          <FlatList
            data={influencers}
            keyExtractor={(item) => `influencers-${item.id}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            ItemSeparatorComponent={() => <View style={styles.horizontalSeparator} />}
            renderItem={({ item }) => {
              const brand = item.category ?? undefined;
              const condition = item.condition ?? undefined;
              return (
                <ProductCard
                  title={item.title}
                  price={item.price}
                  currency="CHF"
                  brand={brand}
                  condition={condition}
                  imageUrl={item.cover_photo_url}
                  likedCount={0}
                  onPress={() => handleListingPress(item.id)}
                  style={styles.horizontalCard}
                />
              );
            }}
          />
        </View>

        <View style={styles.section}>
          <SectionHeader title="Tous les articles" />
          <FlatList
            data={all}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.gridContent}
            scrollEnabled={false}
            renderItem={({ item }) => {
              const brand = item.category ?? undefined;
              const condition = item.condition ?? undefined;
              return (
                <View style={styles.gridItem}>
                  <ProductCard
                    title={item.title}
                    price={item.price}
                    currency="CHF"
                    brand={brand}
                    condition={condition}
                    imageUrl={item.cover_photo_url}
                    likedCount={0}
                    onPress={() => handleListingPress(item.id)}
                  />
                </View>
              );
            }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={theme.colors.primary}
              />
            }
          />
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
    paddingLeft: 0,
    paddingRight: 0,
    paddingTop: theme.spacing.gapMd,
    paddingBottom: theme.spacing.gapSm
  },
  horizontalSeparator: {
    width: 12
  },
  horizontalCard: {
    width: 167,
    height: 240
  },
  gridContent: {
    paddingLeft: 0,
    paddingRight: 0,
    paddingTop: theme.spacing.gapMd,
    paddingBottom: 120
  },
  gridRow: {
    columnGap: theme.spacing.gapMd
  },
  gridItem: {
    flex: 1
  },
  section: {
    paddingLeft: theme.spacing.screenPaddingX
  }
});
