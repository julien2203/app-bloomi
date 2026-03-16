import React, { useCallback, useMemo, useState } from 'react';
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
import { getListingById, type ListingDetail, createOrGetThreadForListing } from '../../../lib/api';
import { theme } from '../../../lib/theme';
import { Text } from '../../../components/ui/Text';
import { Button } from '../../../components/ui/Button';
import { AppIcon } from '../../../components/ui/AppIcon';
import { useAuthStore } from '../../../stores/authStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ITEM_WIDTH = SCREEN_WIDTH - 48; // marge 16 gauche + 16 droite + 16 peek
const ITEM_HEIGHT = ITEM_WIDTH;

type PhotoItem = {
  id: string;
  url: string;
  order_index: number;
  created_at: string;
};

const BUYER_PROTECTION_RATE = 0.08;

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

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isImageModalVisible, setImageModalVisible] = useState(false);
  const [modalImageIndex, setModalImageIndex] = useState(0);

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
        console.log('LISTING DATA:', JSON.stringify(data, null, 2));
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

  const handleBack = () => {
    // Sur certains cas (deep link / ouverture directe), il n'y a pas de route précédente
    // donc on renvoie explicitement vers le feed.
    // @ts-expect-error canGoBack est disponible sur le router Expo
    if (router.canGoBack && router.canGoBack()) {
      router.back();
    } else {
      router.replace('/tabs/feed');
    }
  };

  const handleMore = () => {
    console.log('More actions');
  };

  const handleFavoritePress = () => {
    console.log('Favorite pressed');
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
    console.log('Make an offer:', listing?.id);
  };

  const handleBuyNow = () => {
    console.log('Buy now:', listing?.id);
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
          <TouchableOpacity
            onPress={handleBack}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <AppIcon
              name="arrowLeftOutline"
              size={24}
              color={theme.colors.textPrimary}
            />
          </TouchableOpacity>
          <Text variant="body" style={styles.headerTitle}>
            Detail product
          </Text>
          <TouchableOpacity onPress={handleMore} activeOpacity={0.7}>
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
                  onPress={handleFavoritePress}
                  activeOpacity={0.8}
                >
                  <AppIcon
                    name="likeHeartBold"
                    size={20}
                    color="#C3EA4F"
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
                  1 item
                </Text>
              </View>
            </View>
            {user?.id !== listing.seller_id && (
              <Button
                title="Message seller"
                onPress={handleMessageSeller}
                variant="primary"
                style={styles.sellerButton}
              />
            )}
          </View>

          {/* Product block */}
          <View style={styles.productBlock}>
            {listing.brand && (
              <Text
                variant="body"
                style={styles.brandText}
              >
                {listing.brand}
              </Text>
            )}

            <Text variant="h1" style={styles.productTitle}>
              {listing.title}
            </Text>

            <View style={styles.metaRow}>
              <Text variant="captionSm" color="textSecondary">
                {listing.size ?? '—'} • {conditionLabel ?? 'N/A'} • {listing.city ?? 'Unknown'}
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
              <View style={styles.protectionIcon}>
                <AppIcon
                  name="shieldCheckOutline"
                  size={16}
                  color={theme.colors.danger}
                />
              </View>
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

          {/* Lower section */}
          <View style={styles.lowerSection}>
            {/* Buyer protection block */}
            <View style={styles.buyerProtectionBlock}>
              <View style={styles.buyerProtectionIcon}>
                <Text variant="body">🛡</Text>
              </View>
              <View style={styles.buyerProtectionTextContainer}>
                <Text variant="body" style={styles.buyerProtectionTitle}>
                  Buyer protection fee
                </Text>
                <Text variant="captionSm" color="textSecondary" style={styles.buyerProtectionText}>
                  Our{' '}
                  <Text style={styles.buyerProtectionUnderline}>
                    Buyer Protection
                  </Text>{' '}
                  is added for a fee to every purchase made with the "Buy now" button. Buyer
                  Protection includes our{' '}
                  <Text style={styles.buyerProtectionUnderline}>
                    Refund Policy
                  </Text>
                  .
                </Text>
              </View>
            </View>

            {/* Favorite / Share */}
            <View style={styles.favoriteShareRow}>
              <TouchableOpacity
                style={styles.favoriteShareButton}
                activeOpacity={0.8}
                onPress={() => console.log('Favorite action')}
              >
                <AppIcon
                  name="likeHeartOutline"
                  size={18}
                  color="#000"
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
              <DetailRow label="Views" value="—" />
              <DetailRow label="Interested" value="—" />
              <DetailRow
                label="Uploaded"
                value={formatUploadedDate(listing.published_at ?? listing.created_at)}
              />
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
            title="Make an offer"
            onPress={handleMakeOffer}
            variant="secondary"
            style={styles.bottomButtonSecondary}
          />
          <Button
            title="Buy now"
            onPress={handleBuyNow}
            variant="primary"
            style={styles.bottomButton}
          />
        </View>

        {/* Image modal */}
        <Modal
          visible={isImageModalVisible}
          animationType="fade"
          transparent={false}
          onRequestClose={handleModalClose}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={handleModalClose}
                activeOpacity={0.8}
              >
                <Text variant="body" color="appleBlack">
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
        <Text variant="body" color="textSecondary">
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
    width: 118,
    borderRadius: 52,
    height: 36
  },
  productBlock: {
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingTop: theme.spacing.gapMd
  },
  brandText: {
    ...theme.typography.body,
    textDecorationLine: 'underline',
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
  descriptionBlock: {
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingBottom: theme.spacing.gapLg
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
    color: '#000'
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
  bottomButtonSecondary: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#C3EA4F'
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.9)'
  },
  modalHeader: {
    alignItems: 'flex-end',
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingTop: theme.spacing.gapSm
  },
  modalCloseButton: {
    paddingHorizontal: theme.spacing.gapMd,
    paddingVertical: theme.spacing.gapSm,
    borderRadius: theme.radius.button,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FFFFFF'
  },
  modalImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16
  },
  modalImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12
  },
  modalThumbnails: {
    paddingVertical: theme.spacing.gapSm,
    paddingHorizontal: theme.spacing.screenPaddingX
  },
  modalThumbWrapper: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.card,
    overflow: 'hidden',
    marginRight: theme.spacing.gapSm,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  modalThumbWrapperActive: {
    borderColor: theme.colors.primary
  },
  modalThumb: {
    width: '100%',
    height: '100%'
  },
  buyerProtectionBlock: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginHorizontal: -theme.spacing.screenPaddingX,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5'
  },
  buyerProtectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#C3EA4F',
    alignItems: 'center',
    justifyContent: 'center'
  },
  buyerProtectionTextContainer: {
    flex: 1
  },
  buyerProtectionTitle: {
    fontWeight: '600',
    fontSize: 14
  },
  buyerProtectionText: {
    fontSize: 12,
    lineHeight: 18
  },
  buyerProtectionUnderline: {
    textDecorationLine: 'underline'
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

