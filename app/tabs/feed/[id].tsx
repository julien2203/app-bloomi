import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import {
  createOrGetThreadForListing,
  getListingById,
  getListingLikesInfo,
  getPublishedListingsCountForSeller,
  likeListing,
  unlikeListing,
  type ListingDetail
} from '../../../lib/api';
import { theme } from '../../../lib/theme';
import { HIT_SLOP_COMFORTABLE, HEADER_ICON_TOUCH_CONTAINER } from '../../../lib/touchTargets';
import { Text } from '../../../components/ui/Text';
import { Button } from '../../../components/ui/Button';
import { AppIcon } from '../../../components/ui/AppIcon';
import { HeaderBackButton } from '../../../components/ui/HeaderBackButton';
import { ProductCard } from '../../../components/ProductCard';
import { useAuthStore } from '../../../stores/authStore';
import { useLikesStore } from '../../../stores/likesStore';
import { supabase } from '../../../lib/supabase';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const ITEM_WIDTH = SCREEN_WIDTH - 48; // marge 16 gauche + 16 droite + 16 peek
const ITEM_HEIGHT = ITEM_WIDTH;
const MODAL_IMAGE_HEIGHT = SCREEN_HEIGHT * 0.65;

type PhotoItem = {
  id: string;
  url: string;
  order_index: number;
  created_at: string;
};

const BUYER_PROTECTION_RATE = 0.08;
const RELATED_GRID_GAP = 8;
const RELATED_GRID_PADDING_X = 16;

const conditionLabelMap: Record<string, string> = {
  new: 'New with tags',
  like_new: 'New without tags',
  good: 'Very good',
  fair: 'Good',
  poor: 'Satisfactory'
};

export default function ListingDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const likeOptimistic = useLikesStore((s) => s.likeOptimistic);
  const unlikeOptimistic = useLikesStore((s) => s.unlikeOptimistic);
  const rollbackLike = useLikesStore((s) => s.rollback);
  const setLikeCounts = useLikesStore((s) => s.setCounts);

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [likedByMe, setLikedByMe] = useState(false);
  const [likesCount, setLikesCount] = useState<number>(0);
  const [togglingLike, setTogglingLike] = useState(false);

  const [viewsCount, setViewsCount] = useState<number>(0);
  /** Uniquement si la vue SQL n’expose pas encore seller_published_count */
  const [sellerCountFallback, setSellerCountFallback] = useState<number | 'loading' | 'error'>(
    'loading'
  );

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isImageModalVisible, setImageModalVisible] = useState(false);
  const [modalImageIndex, setModalImageIndex] = useState(0);

  const [relatedTab, setRelatedTab] = useState<'other' | 'similar'>('other');
  const [otherItems, setOtherItems] = useState<ListingDetail[]>([]);
  const [similarItems, setSimilarItems] = useState<ListingDetail[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [showBuyerProtectionInfo, setShowBuyerProtectionInfo] = useState(false);

  const fetchListing = useCallback(async () => {
    if (!id) {
      setError(new Error('ID manquant'));
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await getListingById(id);

      if (fetchError) {
        setError(fetchError);
        setListing(null);
      } else if (!data) {
        setError(new Error('Annonce introuvable'));
        setListing(null);
      } else {
        setListing(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erreur inconnue'));
      setListing(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    void fetchListing();
  }, [fetchListing]);

  const normalizePhotoUrl = useCallback((rawUrl: string) => {
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return rawUrl;
    const { data } = supabase.storage.from('listings').getPublicUrl(rawUrl);
    return data?.publicUrl ?? rawUrl;
  }, []);

  useEffect(() => {
    const loadRelated = async () => {
      if (!listing?.id) return;

      setLoadingRelated(true);
      try {
        const category = (listing.category ?? '').trim();

        const otherPromise = supabase
          .from('v_listing_detail')
          .select('*')
          .eq('seller_id', listing.seller_id)
          .eq('status', 'published')
          .neq('id', listing.id)
          .limit(6);

        const similarPromise = category
          ? supabase
              .from('v_listing_detail')
              .select('*')
              .eq('status', 'published')
              .eq('category', category)
              .neq('id', listing.id)
              .neq('seller_id', listing.seller_id)
              .limit(6)
          : Promise.resolve({ data: [], error: null } as any);

        const [{ data: otherRows }, { data: similarRows }] = await Promise.all([
          otherPromise,
          similarPromise
        ]);

        const normalizeListing = (row: any): ListingDetail => {
          const photos = Array.isArray(row?.photos) ? row.photos : [];
          const normalizedPhotos = photos.map((p: any) => ({
            ...p,
            url: typeof p?.url === 'string' ? normalizePhotoUrl(p.url) : p.url
          }));
          return { ...(row as ListingDetail), photos: normalizedPhotos };
        };

        const other = Array.isArray(otherRows) ? otherRows.map(normalizeListing) : [];
        const similar = Array.isArray(similarRows) ? similarRows.map(normalizeListing) : [];

        setOtherItems(other);
        setSimilarItems(similar);
      } catch {
        setOtherItems([]);
        setSimilarItems([]);
      } finally {
        setLoadingRelated(false);
      }
    };

    void loadRelated();
  }, [listing?.id, listing?.seller_id, normalizePhotoUrl]);

  // Likes: état initial (count + likedByMe)
  useEffect(() => {
    let mounted = true;
    const loadLikes = async () => {
      if (!listing?.id) return;
      const { data } = await getListingLikesInfo(listing.id);
      if (!mounted || !data) return;
      setLikedByMe(data.likedByMe);
      setLikesCount(data.likesCount);
    };
    void loadLikes();
    return () => {
      mounted = false;
    };
  }, [listing?.id]);

  // Views: incrémenter à chaque ouverture
  useEffect(() => {
    let mounted = true;
    const bumpViews = async () => {
      // On ne compte que les vues d'utilisateurs connectés (unique par user)
      if (!listing?.id) return;
      try {
        // Ne pas dépendre uniquement du store: on récupère l'user côté supabase
        const {
          data: { user: authedUser }
        } = await supabase.auth.getUser();
        if (!authedUser?.id) {
          console.warn('increment_listing_views skipped: no authed user');
          return;
        }

        // Vues uniques: insert/upsert (user_id, listing_id) puis count.
        // On contourne volontairement le RPC pour éviter les soucis de cache PostgREST.
        const { error: upsertErr } = await supabase
          .from('listing_views')
          .upsert(
            { user_id: authedUser.id, listing_id: listing.id },
            { onConflict: 'user_id,listing_id' }
          );
        if (upsertErr) {
          console.warn('listing_views upsert error:', upsertErr);
        }

        const { count, error: countErr } = await supabase
          .from('listing_views')
          .select('listing_id', { count: 'exact', head: true })
          .eq('listing_id', listing.id);
        if (countErr) {
          console.warn('listing_views count error:', countErr);
        } else if (typeof count === 'number' && mounted) {
          setViewsCount(count);
        }
      } catch {
        // no-op
      }
    };
    void bumpViews();
    return () => {
      mounted = false;
    };
  }, [listing?.id, user?.id]);

  useEffect(() => {
    if (!listing?.seller_id) return;
    if (typeof listing.seller_published_count === 'number') {
      return;
    }

    let mounted = true;
    setSellerCountFallback('loading');
    void (async () => {
      const { count, error: countErr } = await getPublishedListingsCountForSeller(listing.seller_id);
      if (!mounted) return;
      if (countErr) {
        setSellerCountFallback('error');
      } else {
        setSellerCountFallback(count);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [listing?.seller_id, listing?.seller_published_count]);

  const sellerItemsLabel = useMemo(() => {
    const embedded = listing?.seller_published_count;
    if (typeof embedded === 'number') {
      return embedded === 1 ? '1 item' : `${embedded} items`;
    }
    if (sellerCountFallback === 'loading') return '…';
    if (sellerCountFallback === 'error') return '—';
    if (typeof sellerCountFallback === 'number') {
      return sellerCountFallback === 1 ? '1 item' : `${sellerCountFallback} items`;
    }
    return '…';
  }, [listing?.seller_published_count, sellerCountFallback]);

  const photos: PhotoItem[] = useMemo(
    () => (listing?.photos ? (listing.photos as PhotoItem[]) : []),
    [listing]
  );

  const formattedPrice = useMemo(() => {
    if (!listing) return '';
    return `${listing.price.toFixed(2)} CHF`;
  }, [listing]);

  const formattedProtectionPrice = useMemo(() => {
    if (!listing) return '';
    const protectedPrice = listing.price * (1 + BUYER_PROTECTION_RATE);
    return `${protectedPrice.toFixed(2)} CHF`;
  }, [listing]);

  const conditionLabel = useMemo(() => {
    if (!listing?.condition) return undefined;
    return conditionLabelMap[listing.condition] ?? listing.condition;
  }, [listing]);

  const isListingReservedOrUnavailable = useMemo(() => {
    const status = String(listing?.status ?? '').toLowerCase();
    return status !== 'published';
  }, [listing?.status]);

  const handleBack = () => {
    // Sur certains cas (deep link / ouverture directe), il n'y a pas de route précédente
    // donc on renvoie explicitement vers le feed.
    if (router.canGoBack && router.canGoBack()) {
      router.back();
    } else {
      router.replace('/tabs/feed');
    }
  };

  const handleMore = () => {
    console.log('More actions');
  };

  const handleToggleLike = async () => {
    if (!listing?.id) return;
    if (togglingLike) return;

    if (!user) {
      router.push('/auth/login');
      return;
    }

    const prevLiked = likedByMe;
    const prevCount = likesCount;
    const nextLiked = !prevLiked;
    const nextCount = Math.max(0, prevCount + (nextLiked ? 1 : -1));

    setLikedByMe(nextLiked);
    setLikesCount(nextCount);
    setTogglingLike(true);

    try {
      // Seed le store pour ce listing afin d'avoir un compteur cohérent.
      setLikeCounts({ [listing.id]: prevCount });
      const snapshot = prevLiked ? unlikeOptimistic(listing.id) : likeOptimistic(listing.id);
      const res = nextLiked ? await likeListing(listing.id) : await unlikeListing(listing.id);
      if (res.error) {
        setLikedByMe(prevLiked);
        setLikesCount(prevCount);
        rollbackLike(listing.id, snapshot.prevLiked, snapshot.prevCount);
      }
    } catch {
      setLikedByMe(prevLiked);
      setLikesCount(prevCount);
      rollbackLike(listing.id, prevLiked, prevCount);
    } finally {
      setTogglingLike(false);
    }
  };

  const handleMessageSeller = () => {
    if (!listing || !user) return;
    if (user.id === listing.seller_id) return;

    void (async () => {
      const { data, error } = await createOrGetThreadForListing(listing.id, listing.seller_id);
      if (error || !data) {
        console.warn('Erreur création/récupération thread:', error);
        return;
      }

      router.push({
        pathname: '/tabs/messages/[id]',
        params: { id: data.id }
      });
    })();
  };

  const handleMakeOffer = () => {
    if (!listing) return;
    router.push({
      pathname: '/tabs/feed/make-offer',
      params: { id: listing.id }
    });
  };

  const handleBuyNow = () => {
    if (!listing) return;
    if (user?.id && user.id === listing.seller_id) return;

    const coverPhoto = photos?.[0]?.url;

    router.push({
      pathname: '/tabs/feed/listing/checkout' as any,
      params: {
        listing_id: listing.id,
        seller_id: listing.seller_id,
        amount: String(listing.price),
        title: listing.title,
        ...(coverPhoto ? { cover_photo: coverPhoto } : {})
      }
    });
  };

  const handleImagePress = (index: number) => {
    setModalImageIndex(index);
    setImageModalVisible(true);
  };

  const handleModalClose = () => {
    setImageModalVisible(false);
  };

  const handleCarouselMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / (ITEM_WIDTH + 12));
    setActiveImageIndex(index);
  };

  const formatUploadedDate = (dateString: string | null): string => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    if (Number.isNaN(diffMs) || diffMs < 0) {
      return date.toLocaleDateString();
    }

    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffMinutes < 1) return 'Just now';
    if (diffHours < 1) return `${diffMinutes} min ago`;
    if (diffDays < 1) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffWeeks < 1) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffMonths < 1) return `${diffWeeks} week${diffWeeks > 1 ? 's' : ''} ago`;
    if (diffYears < 1) return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
    return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`;
  };

  const sellerInitials = useMemo(() => {
    const name = listing?.seller_display_name ?? '';
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const second = parts.length > 1 ? parts[1][0] : '';
    return (first + second).toUpperCase();
  }, [listing]);

  if (loading) {
    return (
      <>
        <StatusBar style="dark" />
        <SafeAreaView style={styles.container}>
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text variant="body" color="textSecondary" style={styles.loadingText}>
              Chargement...
            </Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  if (error || !listing) {
    return (
      <>
        <StatusBar style="dark" />
        <SafeAreaView style={styles.container}>
          <View style={styles.centerContent}>
            <Text variant="h2" style={styles.errorTitle}>
              {error?.message || 'Annonce introuvable'}
            </Text>
            <Button title="Retry" onPress={fetchListing} variant="primary" />
            <Button
              title="Back"
              onPress={handleBack}
              variant="secondary"
              style={styles.backButton}
            />
          </View>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        {/* Header */}
        <View style={styles.header}>
          <HeaderBackButton onPress={handleBack} />
          <Text variant="body" style={styles.headerTitle}>
            Detail product
          </Text>
          <TouchableOpacity
            onPress={handleMore}
            activeOpacity={0.7}
            hitSlop={HIT_SLOP_COMFORTABLE}
            style={[styles.iconTouch, HEADER_ICON_TOUCH_CONTAINER]}
          >
            <Feather
              name="more-horizontal"
              size={24}
              color={theme.colors.textPrimary}
            />
          </TouchableOpacity>
        </View>

        {/* Scrollable content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 64 }
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Carousel */}
          <View style={styles.carouselContainer}>
            {photos.length > 0 ? (
              <>
                <FlatList
                  data={photos}
                  keyExtractor={(item, index) => item.id ?? String(index)}
                  horizontal
                  pagingEnabled={false}
                  snapToInterval={ITEM_WIDTH + 12}
                  decelerationRate="fast"
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
                  renderItem={({ item, index }) => {
                    console.log('PHOTO ITEM:', item);
                    return (
                      <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => handleImagePress(index)}
                      >
                        <Image
                          source={{ uri: item.url }}
                          style={{
                            width: ITEM_WIDTH,
                            height: ITEM_HEIGHT,
                            borderRadius: 16,
                            overflow: 'hidden',
                            backgroundColor: '#F5F5F5'
                          }}
                          resizeMode="cover"
                          onError={(e) =>
                            console.log('IMAGE ERROR:', e.nativeEvent.error)
                          }
                          onLoad={() => console.log('IMAGE LOADED:', item.url)}
                        />
                      </TouchableOpacity>
                    );
                  }}
                  onMomentumScrollEnd={handleCarouselMomentumEnd}
                />

                {/* Favorite icon */}
                <TouchableOpacity
                  style={styles.favoriteIconContainer}
                  onPress={handleToggleLike}
                  activeOpacity={0.8}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  disabled={togglingLike}
                >
                  <AppIcon
                    name={likedByMe ? 'likeHeartBold' : 'likeHeartOutline'}
                    size={30}
                    color={likedByMe ? theme.colors.primary : theme.colors.textSecondary}
                  />
                </TouchableOpacity>

                {/* Pagination dots */}
                {photos.length > 1 && (
                  <View style={styles.dotsContainer}>
                    <View style={styles.dotsWrapper}>
                      {photos.map((_, index) => (
                        // eslint-disable-next-line react/no-array-index-key
                        <View
                          key={index}
                          style={[
                            styles.dot,
                            index === activeImageIndex && styles.dotActive
                          ]}
                        />
                      ))}
                    </View>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.carouselPlaceholder}>
                <Feather
                  name="image"
                  size={32}
                  color={theme.colors.textSecondary}
                />
              </View>
            )}
          </View>

          {/* Product block */}
          <View style={styles.productBlock}>
            <Text variant="h1" style={styles.productTitle}>
              {listing.title}
            </Text>

            <View style={styles.metaRow}>
              <Text variant="captionSm" color="textSecondary" numberOfLines={1} ellipsizeMode="tail">
                {[
                  listing.brand ?? null,
                  listing.size ?? '—',
                  conditionLabel ?? 'N/A',
                  listing.city ?? 'Unknown'
                ]
                  .filter((x) => !!x && String(x).trim().length > 0)
                  .join(' · ')}
              </Text>
            </View>

            <Text variant="h2" style={styles.mainPrice}>
              {formattedPrice}
            </Text>

            <View style={styles.protectionRow}>
              <Text
                variant="captionSm"
                style={styles.protectionPrice}
              >
                {formattedProtectionPrice} includes Buyer Protection
              </Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setShowBuyerProtectionInfo(true)}
                style={styles.protectionInfoButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather name="info" size={14} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Description */}
          <View style={styles.descriptionBlock}>
            <Text variant="captionSm" color="textSecondary" style={styles.sectionLabel}>
              Item description
            </Text>
            <Text variant="body" color="textSecondary">
              {listing.description ?? 'No description provided.'}
            </Text>
          </View>

          {/* Seller block */}
          <View style={styles.sellerBlock}>
            <View style={styles.sellerInfo}>
              {listing.seller_avatar_url ? (
                <Image
                  source={{ uri: listing.seller_avatar_url }}
                  style={styles.sellerAvatar}
                />
              ) : (
                <View style={styles.sellerAvatarPlaceholder}>
                  <Text variant="body" color="appleBlack">
                    {sellerInitials}
                  </Text>
                </View>
              )}
              <View style={styles.sellerText}>
                <Text variant="body" style={styles.sellerName}>
                  {listing.seller_display_name ?? 'Seller'}
                </Text>
                <Text variant="captionSm" color="textSecondary">
                  {sellerItemsLabel}
                </Text>
              </View>
            </View>
            {user?.id !== listing.seller_id && (
              <Button
                title="Message seller"
                onPress={handleMessageSeller}
                variant="primary"
                style={styles.sellerButton}
                textStyle={styles.sellerButtonText}
              />
            )}
          </View>

          {/* Lower section */}
          <View style={styles.lowerSection}>
            {/* Favorite / Share */}
            <View style={styles.favoriteShareRow}>
              <TouchableOpacity
                style={styles.favoriteShareButton}
                activeOpacity={0.8}
                onPress={handleToggleLike}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                disabled={togglingLike}
              >
                <AppIcon
                  name={likedByMe ? 'likeHeartBold' : 'likeHeartOutline'}
                  size={18}
                  color={likedByMe ? theme.colors.primary : theme.colors.textPrimary}
                />
                <Text variant="captionSm" color="textPrimary">
                  Favorite
                </Text>
              </TouchableOpacity>
              <View style={styles.favoriteShareDivider} />
              <TouchableOpacity
                style={styles.favoriteShareButton}
                activeOpacity={0.8}
                onPress={() => console.log('Share action')}
              >
                <Feather
                  name="share-2"
                  size={18}
                  color="#000"
                />
                <Text variant="captionSm" color="textPrimary">
                  Share
                </Text>
              </TouchableOpacity>
            </View>

            {/* Details table */}
            <View style={styles.detailsList}>
              <DetailRow label="Category" value={listing.category ?? '—'} />
              <DetailRow label="Size" value={listing.size ?? '—'} withInfo />
              <DetailRow label="Condition" value={conditionLabel ?? '—'} withInfo />
              <DetailRow label="Color" value={listing.color ?? '—'} />
              <DetailRow label="Views" value={viewsCount != null ? String(viewsCount) : '—'} />
              <DetailRow label="Interested" value={String(likesCount)} />
              <DetailRow
                label="Uploaded"
                value={formatUploadedDate(listing.published_at ?? listing.created_at)}
              />
            </View>
          </View>

          {/* Other items / Similar items (bottom of page, above sticky CTAs) */}
          <View style={styles.relatedSection}>
            <View style={styles.relatedTabs}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.relatedTab}
                onPress={() => setRelatedTab('other')}
              >
                <Text
                  variant="body"
                  style={[
                    styles.relatedTabText,
                    relatedTab === 'other'
                      ? styles.relatedTabTextActive
                      : styles.relatedTabTextInactive
                  ]}
                >
                  Other listings
                </Text>
                {relatedTab === 'other' ? <View style={styles.relatedTabUnderline} /> : null}
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.relatedTab}
                onPress={() => setRelatedTab('similar')}
              >
                <Text
                  variant="body"
                  style={[
                    styles.relatedTabText,
                    relatedTab === 'similar'
                      ? styles.relatedTabTextActive
                      : styles.relatedTabTextInactive
                  ]}
                >
                  Similar items
                </Text>
                {relatedTab === 'similar' ? <View style={styles.relatedTabUnderline} /> : null}
              </TouchableOpacity>
            </View>

            <View style={styles.relatedGrid}>
              {loadingRelated ? (
                <View style={styles.relatedLoadingRow}>
                  <ActivityIndicator size="small" color={theme.colors.textSecondary} />
                </View>
              ) : (relatedTab === 'other' ? otherItems : similarItems).length === 0 ? (
                <Text variant="captionSm" color="textSecondary" style={styles.relatedEmpty}>
                  No items to show.
                </Text>
              ) : (
                (relatedTab === 'other' ? otherItems : similarItems).map((l) => {
                  const cover =
                    l.photos && l.photos.length > 0
                      ? l.photos[0]?.url ?? null
                      : null;
                  return (
                    <ProductCard
                      key={l.id}
                      listingId={l.id}
                      title={l.title}
                      price={Number(l.price) || 0}
                      brand={(l as any).brand ?? undefined}
                      size={(l as any).size ?? undefined}
                      condition={l.condition ?? undefined}
                      imageUrl={cover}
                      style={styles.relatedCard}
                      cardWidth={(SCREEN_WIDTH - RELATED_GRID_PADDING_X * 2 - RELATED_GRID_GAP) / 2}
                      imageRatio={1}
                      onPress={() => router.push(`/tabs/feed/${l.id}`)}
                    />
                  );
                })
              )}
            </View>
          </View>
        </ScrollView>

        {/* Bottom CTAs */}
        <View
          style={[
            styles.bottomCtas,
            { paddingBottom: insets.bottom + 16 }
          ]}
        >
          <Button
            title={isListingReservedOrUnavailable ? 'Reserved' : 'Make an offer'}
            onPress={handleMakeOffer}
            variant="secondary"
            style={
              isListingReservedOrUnavailable
                ? styles.bottomButtonSecondaryDisabled
                : styles.bottomButtonSecondary
            }
            disabled={isListingReservedOrUnavailable}
          />
          <Button
            title={isListingReservedOrUnavailable ? 'Reserved' : 'Buy now'}
            onPress={handleBuyNow}
            variant="google"
            style={
              isListingReservedOrUnavailable
                ? styles.bottomButtonDisabled
                : styles.bottomButtonNoBorder
            }
            disabled={isListingReservedOrUnavailable}
          />
        </View>

        {/* Image modal */}
        <Modal
          visible={isImageModalVisible}
          animationType="fade"
          transparent
          onRequestClose={handleModalClose}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View
              style={[
                styles.modalHeader,
                { top: insets.top + 8 }
              ]}
            >
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={handleModalClose}
                activeOpacity={0.8}
              >
                <Text variant="body" color="appleBlack" style={styles.modalCloseText}>
                  Close
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalImageContainer}>
              {photos[modalImageIndex]?.url ? (
                <Image
                  source={{ uri: photos[modalImageIndex]!.url }}
                  style={styles.modalImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.carouselPlaceholder}>
                  <Text variant="body" color="textSecondary">
                    Pas d'image
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.modalThumbnails}>
              <FlatList
                data={photos}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.modalThumbsContent}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    onPress={() => setModalImageIndex(index)}
                    activeOpacity={0.8}
                    style={[
                      styles.modalThumbWrapper,
                      index === modalImageIndex && styles.modalThumbWrapperActive
                    ]}
                  >
                    <Image
                      source={{ uri: item.url }}
                      style={styles.modalThumb}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                )}
              />
            </View>
          </SafeAreaView>
        </Modal>

        {/* Buyer protection info modal */}
        <Modal
          visible={showBuyerProtectionInfo}
          animationType="fade"
          transparent
          onRequestClose={() => setShowBuyerProtectionInfo(false)}
        >
          <View style={styles.bpModalOverlay}>
            <TouchableOpacity
              style={styles.bpModalBackdropPressable}
              activeOpacity={1}
              onPress={() => setShowBuyerProtectionInfo(false)}
            />
            <View style={styles.bpModalCard}>
              <Text variant="body" style={styles.bpModalTitle}>
                Buyer Protection
              </Text>
              <Text variant="captionSm" color="textSecondary" style={styles.bpModalText}>
                Buyer Protection is added for a fee to every purchase made with the "Buy now" button.
                It includes our Refund Policy.
              </Text>
              <Button
                title="Close"
                onPress={() => setShowBuyerProtectionInfo(false)}
                variant="primary"
                style={styles.bpModalCloseButton}
              />
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </>
  );
}

interface DetailRowProps {
  label: string;
  value: string;
  withInfo?: boolean;
}

function DetailRow({ label, value, withInfo }: DetailRowProps) {
  return (
    <View style={styles.detailRow}>
      <Text variant="body" style={styles.detailLabel}>
        {label}
      </Text>
      <View style={styles.detailValueContainer}>
        <Text variant="body" color="textPrimary">
          {value}
        </Text>
        {withInfo && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => console.log('Info pressed for', label)}
            style={styles.infoIcon}
          >
            <Feather
              name="info"
              size={14}
              color={theme.colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
    marginTop: theme.spacing.gapSm
  },
  errorTitle: {
    textAlign: 'center',
    marginBottom: theme.spacing.gapMd
  },
  backButton: {
    marginTop: theme.spacing.gapSm
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingVertical: theme.spacing.gapSm
  },
  headerTitle: {
    ...theme.typography.body,
    fontFamily: theme.fontFamily.semiBold
  },
  iconTouch: {
    padding: 8
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#fff'
  },
  scrollContent: {
    paddingBottom: theme.spacing.gapLg
  },
  carouselContainer: {
    width: SCREEN_WIDTH,
    height: ITEM_HEIGHT,
    backgroundColor: '#fff'
  },
  carouselPlaceholder: {
    width: SCREEN_WIDTH,
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center'
  },
  favoriteIconContainer: {
    position: 'absolute',
    top: 12,
    right: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center'
  },
  dotsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 100,
    backgroundColor: '#fff'
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5E5E5',
    marginHorizontal: 4
  },
  dotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#000'
  },
  sellerBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingTop: theme.spacing.gapLg,
    paddingBottom: theme.spacing.gapMd
  },
  sellerInfo: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  sellerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22
  },
  sellerAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.muted,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sellerText: {
    marginLeft: theme.spacing.gapSm
  },
  sellerName: {
    fontFamily: theme.fontFamily.semiBold
  },
  sellerButton: {
    flex: 0,
    borderRadius: theme.radius.button,
    height: theme.spacing.buttonHeight,
    paddingHorizontal: theme.spacing.gapMd,
    minWidth: 148
  },
  sellerButtonText: {
    fontSize: 16
  },
  productBlock: {
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingTop: theme.spacing.gapMd
  },
  brandText: {
    ...theme.typography.body,
    marginBottom: theme.spacing.gapSm
  },
  productTitle: {
    ...theme.typography.h1,
    marginBottom: theme.spacing.gapSm
  },
  metaRow: {
    marginBottom: theme.spacing.gapSm
  },
  mainPrice: {
    ...theme.typography.h2,
    fontFamily: theme.fontFamily.bold,
    marginBottom: theme.spacing.gapSm
  },
  protectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.gapLg
  },
  protectionPrice: {
    ...theme.typography.captionSm,
    color: theme.colors.danger,
    marginRight: theme.spacing.gapSm
  },
  protectionIcon: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  protectionInfoButton: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  bpModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 16
  },
  bpModalBackdropPressable: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent'
  },
  bpModalCard: {
    backgroundColor: theme.colors.backgroundWhite,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16
  },
  bpModalTitle: {
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: theme.fontFamily.semiBold
  },
  bpModalText: {
    textAlign: 'center',
    lineHeight: 18
  },
  bpModalCloseButton: {
    marginTop: 14
  },
  descriptionBlock: {
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingBottom: theme.spacing.gapLg
  },
  relatedSection: {
    marginTop: 4,
    marginBottom: theme.spacing.gapLg
  },
  relatedTabs: {
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: RELATED_GRID_PADDING_X
  },
  relatedTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  relatedTabText: {
    fontSize: 14
  },
  relatedTabTextActive: {
    color: theme.colors.textPrimary,
    fontFamily: theme.fontFamily.bold
  },
  relatedTabTextInactive: {
    color: '#AAAAAA',
    fontFamily: theme.fontFamily.regular
  },
  relatedTabUnderline: {
    marginTop: 8,
    height: 2,
    width: '100%',
    backgroundColor: '#CCFF00'
  },
  relatedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: RELATED_GRID_GAP,
    rowGap: RELATED_GRID_GAP,
    paddingHorizontal: RELATED_GRID_PADDING_X,
    paddingTop: 12,
    paddingBottom: 12
  },
  relatedCard: {
    width: (SCREEN_WIDTH - RELATED_GRID_PADDING_X * 2 - RELATED_GRID_GAP) / 2
  },
  relatedLoadingRow: {
    width: '100%',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  relatedEmpty: {
    paddingVertical: 8
  },
  sectionLabel: {
    marginBottom: theme.spacing.gapSm
  },
  lowerSection: {
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingBottom: theme.spacing.gapLg
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.gapMd
  },
  detailsList: {
    marginTop: 0
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: -theme.spacing.screenPaddingX,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5'
  },
  detailLabel: {
    ...theme.typography.body,
    fontSize: 14,
    color: theme.colors.textSecondary
  },
  detailValueContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  infoIcon: {
    marginLeft: theme.spacing.gapSm / 2
  },
  bottomCtas: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    columnGap: theme.spacing.gapSm,
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingTop: theme.spacing.gapSm,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border
  },
  bottomButton: {
    flex: 1
  },
  bottomButtonNoBorder: {
    flex: 1,
    borderWidth: 0,
    borderColor: 'transparent'
  },
  bottomButtonSecondaryDisabled: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#C3EA4F',
    opacity: 0.45
  },
  bottomButtonSecondary: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#C3EA4F'
  },
  bottomButtonDisabled: {
    opacity: 0.45
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center'
  },
  modalHeader: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10
  },
  modalCloseButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF'
  },
  modalCloseText: {
    fontSize: 15,
    fontWeight: '500'
  },
  modalImageContainer: {
    height: MODAL_IMAGE_HEIGHT,
    alignItems: 'center'
  },
  modalImage: {
    width: SCREEN_WIDTH - 32,
    height: '100%',
    borderRadius: 16
  },
  modalThumbnails: {
    marginTop: 12,
    paddingHorizontal: 16
  },
  modalThumbsContent: {
    columnGap: 8
  },
  modalThumbWrapper: {
    width: 64,
    height: 64,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 0
  },
  modalThumbWrapperActive: {
    borderWidth: 2,
    borderColor: '#CCFF00'
  },
  modalThumb: {
    width: '100%',
    height: '100%'
  },
  favoriteShareRow: {
    flexDirection: 'row',
    marginHorizontal: -theme.spacing.screenPaddingX,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5'
  },
  favoriteShareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    columnGap: 8
  },
  favoriteShareDivider: {
    width: 1,
    backgroundColor: '#E5E5E5',
    marginVertical: 12
  }
});

