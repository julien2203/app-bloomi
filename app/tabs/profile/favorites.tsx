import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../../lib/supabase';
import { getMyLikedListings, unlikeListing, type LikedListingCard } from '../../../lib/api';
import { theme } from '../../../lib/theme';
import { Text } from '../../../components/ui/Text';
import { AppIcon } from '../../../components/ui/AppIcon';
import { HeaderBackButton } from '../../../components/ui/HeaderBackButton';
import { useAuthStore } from '../../../stores/authStore';
import { useLikesStore } from '../../../stores/likesStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_PADDING_H = 12;
const GAP = 12;
const ITEM_WIDTH = (SCREEN_WIDTH - GRID_PADDING_H * 2 - GAP) / 2;
const ITEM_HEIGHT = Math.round(ITEM_WIDTH * 1.2);

type Item = LikedListingCard;

export default function FavoritesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const unlikeOptimistic = useLikesStore((s) => s.unlikeOptimistic);
  const rollbackLike = useLikesStore((s) => s.rollback);

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlikingIds, setUnlikingIds] = useState<Record<string, boolean>>({});

  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 800, useNativeDriver: true })
      ])
    ).start();
  }, [shimmer]);

  const load = async () => {
    setLoading(true);
    const { data } = await getMyLikedListings();
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  // Realtime: retirer instantanément si un unlike arrive (multi-device / autre écran)
  useEffect(() => {
    if (!user?.id) return;
    // const channel = supabase // TODO: réactiver le realtime
    //   .channel('likes:favorites') // TODO: réactiver le realtime
    //   .on( // TODO: réactiver le realtime
    //     'postgres_changes', // TODO: réactiver le realtime
    //     { // TODO: réactiver le realtime
    //       event: 'DELETE',
    //       schema: 'public',
    //       table: 'likes',
    //       filter: `user_id=eq.${user.id}`
    //     },
    //     (payload) => { // TODO: réactiver le realtime
    //       const oldRow = payload.old as any;
    //       const listingId = oldRow?.listing_id as string | undefined;
    //       if (!listingId) {
    //         // Fallback si old row n'est pas disponible/configurée côté Realtime
    //         void load();
    //         return;
    //       }
    //       setItems((prev) => prev.filter((x) => x.id !== listingId));
    //     } // TODO: réactiver le realtime
    //   ) // TODO: réactiver le realtime
    //   .subscribe(); // TODO: réactiver le realtime

    // return () => { // TODO: réactiver le realtime
    //   void supabase.removeChannel(channel); // TODO: réactiver le realtime
    // }; // TODO: réactiver le realtime
  }, [user?.id]);

  const handleUnlike = async (listingId: string) => {
    if (unlikingIds[listingId]) return;

    // Optimistic remove
    const prev = items;
    const snapshot = unlikeOptimistic(listingId);
    setItems((p) => p.filter((x) => x.id !== listingId));
    setUnlikingIds((s) => ({ ...s, [listingId]: true }));

    try {
      const res = await unlikeListing(listingId);
      if (res.error) {
        setItems(prev);
        rollbackLike(listingId, snapshot.prevLiked, snapshot.prevCount);
      }
    } catch {
      setItems(prev);
      rollbackLike(listingId, snapshot.prevLiked, snapshot.prevCount);
    } finally {
      setUnlikingIds((s) => ({ ...s, [listingId]: false }));
    }
  };

  const renderSkeleton = useMemo(() => {
    const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });
    const boxes = Array.from({ length: 6 }, (_, i) => i);
    return (
      <View style={styles.grid}>
        {boxes.map((i) => (
          <Animated.View
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            style={[
              styles.skeletonBox,
              {
                opacity
              }
            ]}
          />
        ))}
      </View>
    );
  }, [shimmer]);

  const renderEmpty = () => (
    <View style={styles.empty}>
      <AppIcon name="likeHeartOutline" size={48} color="#AAAAAA" />
      <Text variant="body" style={styles.emptyTitle}>
        No favorites yet
      </Text>
      <Text variant="captionSm" style={styles.emptySubtitle}>
        Items you like will appear here
      </Text>
    </View>
  );

  const renderItem = ({ item }: { item: Item }) => {
    const price = `${item.price.toFixed(2)} CHF`;
    const priceIncl = `${(item.price * 1.08).toFixed(2)} CHF`;

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => router.push(`/tabs/feed/${item.id}`)}
        style={styles.card}
      >
        {item.cover_photo_url ? (
          <Image source={{ uri: item.cover_photo_url }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder} />
        )}

        <TouchableOpacity
          onPress={() => void handleUnlike(item.id)}
          activeOpacity={0.85}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.heartBtn}
        >
          <AppIcon name="likeHeartBold" size={22} color="#C3EA4F" />
        </TouchableOpacity>

        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.9)']}
          style={styles.gradient}
        >
          <Text numberOfLines={1} style={styles.title}>
            {item.title}
          </Text>

          {!!item.brand && (
            <Text numberOfLines={1} style={styles.brand}>
              {item.brand} · {item.size ?? '—'}
            </Text>
          )}
          {!item.brand && (
            <Text numberOfLines={1} style={styles.brand}>
              {item.size ?? '—'}
            </Text>
          )}

          <View style={styles.priceRow}>
            <Text style={styles.price}>{price}</Text>
            <Text style={styles.priceIncl}>{priceIncl}</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="dark" />

      <View style={styles.header}>
        <HeaderBackButton onPress={() => router.back()} />
        <Text variant="body" style={styles.headerTitle}>
          Favorites items
        </Text>
        <View style={styles.headerRightPlaceholder} />
      </View>
      <View style={styles.headerSeparator} />

      {loading ? (
        renderSkeleton
      ) : items.length === 0 ? (
        renderEmpty()
      ) : (
        <FlatList
          data={items}
          keyExtractor={(x) => x.id}
          numColumns={2}
          renderItem={renderItem}
          contentContainerStyle={{
            marginTop: 20,
            paddingHorizontal: GRID_PADDING_H,
            paddingBottom: insets.bottom + 16
          }}
          columnWrapperStyle={{ gap: GAP }}
          ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgroundWhite
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12
  },
  headerTitle: {
    ...theme.typography.body,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary
  },
  headerRightPlaceholder: {
    width: 28
  },
  headerSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5E5'
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: GAP,
    rowGap: GAP,
    paddingHorizontal: GRID_PADDING_H
  },
  skeletonBox: {
    width: ITEM_WIDTH,
    height: ITEM_HEIGHT,
    backgroundColor: '#E5E5E5'
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32
  },
  emptyTitle: {
    marginTop: 12,
    fontWeight: '600',
    color: theme.colors.textPrimary
  },
  emptySubtitle: {
    marginTop: 6,
    color: '#AAAAAA',
    textAlign: 'center'
  },
  card: {
    width: ITEM_WIDTH,
    height: ITEM_HEIGHT,
    backgroundColor: '#000000',
    borderRadius: 12,
    overflow: 'hidden'
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 12
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#111111',
    borderRadius: 12
  },
  heartBtn: {
    position: 'absolute',
    top: 8,
    right: 8
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 10,
    paddingTop: 26,
    paddingBottom: 10
  },
  title: {
    color: theme.colors.googleWhite,
    fontSize: 13,
    fontWeight: '500'
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
    marginTop: 6
  },
  price: {
    color: theme.colors.googleWhite,
    fontSize: 13,
    fontWeight: '700'
  },
  priceIncl: {
    color: '#C3EA4F',
    fontSize: 12,
    textDecorationLine: 'line-through'
  },
  meta: {
    marginTop: 4,
    color: theme.colors.googleWhite,
    fontSize: 12
  },
  brand: {
    marginTop: 4,
    color: '#C3EA4F',
    fontSize: 12
  }
});

