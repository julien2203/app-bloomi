import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  InteractionManager,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Feather } from '@expo/vector-icons';
import {
  cloneListingDetail,
  getExistingThreadForListing,
  deactivateListingToDraft,
  deleteListing,
  excludeBlockedSellers,
  getBlockedSellerIdsForCurrentUser,
  getAllSellerClosetListings,
  getListingById,
  getListingLikesInfo,
  getPublishedListingsCountForSeller,
  type FeedListing,
  isListingDeleteBlockedByOrders,
  likeListing,
  unlikeListing,
  type ListingDetail
} from '../../../lib/api';
import { theme } from '../../../lib/theme';
import { HIT_SLOP_COMFORTABLE, HEADER_ICON_TOUCH_CONTAINER } from '../../../lib/touchTargets';
import { getSafeBottomInset } from '../../../lib/safeArea';
import { Text } from '../../../components/ui/Text';
import { Button } from '../../../components/ui/Button';
import { AppIcon } from '../../../components/ui/AppIcon';
import { HeaderBackButton } from '../../../components/ui/HeaderBackButton';
import { ZoomableImage } from '../../../components/ui/ZoomableImage';
import { ListingCoverImage } from '../../../components/ui/ListingCoverImage';
import { OwnerListingBottomSheet } from '../../../components/listing/OwnerListingBottomSheet';
import { ProductCard } from '../../../components/ProductCard';
import { InfluencerBadge } from '../../../components/InfluencerBadge';
import { useAuthStore } from '../../../stores/authStore';
import { openGuestAuthPrompt } from '../../../lib/guestAuthPrompt';
import { useLikesStore } from '../../../stores/likesStore';
import { supabase } from '../../../lib/supabase';
import * as Clipboard from 'expo-clipboard';
import { SafetyChoiceSheet } from '../../../components/safety/SafetyChoiceSheet';
import {
  REPORT_REASON_KEYS,
  reportReasonToDbValue,
  type ReportReasonKey
} from '../../../lib/reports';
import { translateColorList } from '../../../lib/colorI18n';
import { translateConditionLabel } from '../../../lib/conditionI18n';
import { translateCategoryLabel } from '../../../lib/categoryI18n';
import { translateSizeLabel } from '../../../lib/sizeI18n';
import { BuyerFinalPriceRow } from '../../../components/pricing/BuyerFinalPriceRow';
import { ListingPickupAddresses } from '../../../components/listing/ListingPickupAddresses';
import { LetterAplusLabelNote } from '../../../components/listing/LetterAplusLabelNote';
import { formatBuyerFinalPrice } from '../../../lib/formatBuyerPrice';
import { getListingShareUrl, shareListing } from '../../../lib/listingShare';
import {
  navigateBackFromListingDetail,
  pickListingReturnParams,
  publicProfileHref,
  resolveListingDetailPathBase
} from '../../../lib/navigation/listingDetailNav';
import { guardedPush } from '../../../lib/navigation/guardedNav';
import { openListingDetail } from '../../../lib/navigation/openListingDetail';
import { navigateToThread } from '../../../lib/navigation/navigateInTabs';
import { getBuyerListingOfferGate } from '../../../lib/listingOffers';
import {
  deliveryModeIncludesPickup,
  deliveryModeIncludesShipping,
  normalizeDeliveryMode
} from '../../../lib/deliveryMode';
import { ensureProfileShippingAddress } from '../../../lib/profileShippingAddress';
import { GRID_GAP_COMPACT, gridCardWidth } from '../../../lib/cardLayout';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const ITEM_WIDTH = SCREEN_WIDTH - 48; // marge 16 gauche + 16 droite + 16 peek
const ITEM_HEIGHT = ITEM_WIDTH;
const CAROUSEL_SNAP_INTERVAL = ITEM_WIDTH + 12;
const MODAL_IMAGE_HEIGHT = SCREEN_HEIGHT * 0.65;

type PhotoItem = {
  id: string;
  url: string;
  order_index: number;
  created_at: string;
};

const RELATED_GRID_GAP = 8;
const RELATED_GRID_PADDING_X = 16;

type ListingReportUi =
  | null
  | { step: 'reasons' }
  | { step: 'done'; title: string; message: string };

type ShippingFeeInfo = {
  fee_cents: number;
  is_promo: boolean;
};

export default function ListingDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const safeBottom = getSafeBottomInset(insets.bottom);
  const { width: windowWidth } = useWindowDimensions();
  const relatedCardWidth = useMemo(
    () => gridCardWidth(windowWidth, RELATED_GRID_PADDING_X, RELATED_GRID_GAP),
    [windowWidth]
  );
  const routeParams = useLocalSearchParams<{
    id: string;
    cover_photo?: string;
    from_offer_chat?: string;
    from_notifications?: string;
    from_notifications_origin?: string;
    return_to?: string;
    return_user_id?: string;
  }>();
  const { id, cover_photo, from_offer_chat, from_notifications, from_notifications_origin } =
    routeParams;
  const listingReturnParams = useMemo(() => pickListingReturnParams(routeParams), [
    routeParams.return_to,
    routeParams.return_user_id
  ]);

  const listingDetailPathBase = useMemo(
    () => resolveListingDetailPathBase(listingReturnParams.return_to, pathname),
    [listingReturnParams.return_to, pathname]
  );

  const coverPhotoParam =
    typeof cover_photo === 'string' && cover_photo.trim().length > 0
      ? cover_photo.trim()
      : undefined;
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
  const [modalPagerScrollEnabled, setModalPagerScrollEnabled] = useState(true);
  const modalPagerRef = useRef<FlatList<PhotoItem>>(null);
  const modalThumbsRef = useRef<FlatList<PhotoItem>>(null);
  const modalImageIndexRef = useRef(0);
  const [modalZoomLayout, setModalZoomLayout] = useState({
    width: SCREEN_WIDTH - 32,
    height: MODAL_IMAGE_HEIGHT
  });

  const [relatedTab, setRelatedTab] = useState<'other' | 'similar'>('other');
  const [otherItems, setOtherItems] = useState<FeedListing[]>([]);
  const [similarItems, setSimilarItems] = useState<ListingDetail[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [ownerSheetVisible, setOwnerSheetVisible] = useState(false);
  const [reportUi, setReportUi] = useState<ListingReportUi>(null);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [shippingFeeInfo, setShippingFeeInfo] = useState<ShippingFeeInfo | null>(null);
  const [sellerVacationMode, setSellerVacationMode] = useState(false);

  const fetchListing = useCallback(async () => {
    if (!id) {
      setError(new Error('Missing ID'));
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
        setError(new Error('Listing not found'));
        setListing(null);
      } else {
        setListing(cloneListingDetail(data));
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setListing(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    void fetchListing();
  }, [fetchListing]);

  useEffect(() => {
    if (!listing?.parcel_size || !deliveryModeIncludesShipping(listing.delivery_mode)) {
      setShippingFeeInfo(null);
      return;
    }

    let mounted = true;
    setShippingFeeInfo(null);

    void (async () => {
      const { data, error } = await supabase.rpc('get_shipping_fee', {
        p_parcel_size: listing.parcel_size
      });
      if (!mounted || error || !data) return;

      const row = data as { fee_cents?: number; is_promo?: boolean };
      if (typeof row.fee_cents !== 'number') return;

      setShippingFeeInfo({
        fee_cents: row.fee_cents,
        is_promo: Boolean(row.is_promo)
      });
    })();

    return () => {
      mounted = false;
    };
  }, [listing?.id, listing?.parcel_size, listing?.delivery_mode]);

  const normalizePhotoUrl = useCallback((rawUrl: string) => {
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return rawUrl;
    const { data } = supabase.storage.from('listings').getPublicUrl(rawUrl);
    return data?.publicUrl ?? rawUrl;
  }, []);

  useEffect(() => {
    if (!listing?.id) return;

    const task = InteractionManager.runAfterInteractions(() => {
      const loadRelated = async () => {
      setLoadingRelated(true);
      try {
        const otherPromise = getAllSellerClosetListings(listing.seller_id, {
          excludeListingId: listing.id
        });

        const similarPromise = (async () => {
          const { data: similarRows, error: similarErr } = await supabase.rpc(
            'get_similar_listings',
            {
              p_listing_id: listing.id,
              p_limit: 6
            }
          );
          if (similarErr) return [] as any[];
          return (similarRows || []) as any[];
        })();

        const [otherRes, similarRows] = await Promise.all([otherPromise, similarPromise]);

        const blockedIds = await getBlockedSellerIdsForCurrentUser();

        const normalizeListing = (row: any): ListingDetail => {
          const photos = Array.isArray(row?.photos) ? row.photos : [];
          const normalizedPhotos = photos.map((p: any) => ({
            ...p,
            url: typeof p?.url === 'string' ? normalizePhotoUrl(p.url) : p.url
          }));
          return { ...(row as ListingDetail), photos: normalizedPhotos };
        };

        const other = otherRes.error ? [] : (otherRes.data ?? []);
        let similar = Array.isArray(similarRows) ? similarRows.map(normalizeListing) : [];
        similar = excludeBlockedSellers(similar, blockedIds);

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
    });

    return () => task.cancel();
  }, [listing?.id, listing?.seller_id, normalizePhotoUrl]);

  // Likes: état initial (count + likedByMe) — après le rendu initial
  useEffect(() => {
    if (!listing?.id) return;
    let mounted = true;
    const task = InteractionManager.runAfterInteractions(() => {
      void (async () => {
        const { data } = await getListingLikesInfo(listing.id);
        if (!mounted || !data) return;
        setLikedByMe(data.likedByMe);
        setLikesCount(data.likesCount);
      })();
    });
    return () => {
      mounted = false;
      task.cancel();
    };
  }, [listing?.id]);

  // Views: incrémenter à chaque ouverture (priorité basse)
  useEffect(() => {
    if (!listing?.id) return;
    let mounted = true;
    const task = InteractionManager.runAfterInteractions(() => {
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
    });
    return () => {
      mounted = false;
      task.cancel();
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

  useEffect(() => {
    if (!listing?.seller_id) {
      setSellerVacationMode(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('vacation_mode')
        .eq('id', listing.seller_id)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setSellerVacationMode(false);
        return;
      }
      const row = data as { vacation_mode?: boolean | null };
      setSellerVacationMode(Boolean(row.vacation_mode));
    })();
    return () => {
      cancelled = true;
    };
  }, [listing?.seller_id]);

  const sellerItemsLabel = useMemo(() => {
    const embedded = listing?.seller_published_count;
    if (typeof embedded === 'number') {
      return embedded === 1
        ? t('feed.listingDetail.oneItem')
        : t('feed.listingDetail.itemsCount', { count: embedded });
    }
    if (sellerCountFallback === 'loading') return '…';
    if (sellerCountFallback === 'error') return '—';
    if (typeof sellerCountFallback === 'number') {
      return sellerCountFallback === 1
        ? t('feed.listingDetail.oneItem')
        : t('feed.listingDetail.itemsCount', { count: sellerCountFallback });
    }
    return '…';
  }, [listing?.seller_published_count, sellerCountFallback, t]);

  const photos: PhotoItem[] = useMemo(() => {
    if (listing?.photos?.length) {
      return listing.photos as PhotoItem[];
    }
    if (coverPhotoParam) {
      return [
        {
          id: 'preview-cover',
          url: coverPhotoParam,
          order_index: 0,
          created_at: ''
        }
      ];
    }
    return [];
  }, [listing?.photos, coverPhotoParam]);

  const modalPageWidth = useMemo(
    () => (modalZoomLayout.width > 0 ? modalZoomLayout.width : windowWidth - 32),
    [modalZoomLayout.width, windowWidth]
  );
  const modalPageHeight = useMemo(
    () => (modalZoomLayout.height > 0 ? modalZoomLayout.height : MODAL_IMAGE_HEIGHT),
    [modalZoomLayout.height]
  );

  modalImageIndexRef.current = modalImageIndex;

  const conditionLabel = useMemo(() => {
    if (!listing?.condition) return undefined;
    return translateConditionLabel(listing.condition, t);
  }, [listing?.condition, t]);

  const categoryLabel = useMemo(() => {
    if (!listing?.category) return '—';
    return translateCategoryLabel(
      { name: listing.category, slug: listing.category_slug },
      t
    );
  }, [listing?.category, listing?.category_slug, t]);

  const sizeLabel = useMemo(() => {
    if (!listing?.size) return undefined;
    return translateSizeLabel(listing.size, t);
  }, [listing?.size, t]);

  const colorLabel = useMemo(() => {
    if (!listing?.color) return undefined;
    const translated = translateColorList(listing.color, t);
    return translated || undefined;
  }, [listing?.color, t]);

  const isListingReservedOrUnavailable = useMemo(() => {
    const status = String(listing?.status ?? '').toLowerCase();
    return status !== 'published';
  }, [listing?.status]);
  const isPurchaseDisabled = isListingReservedOrUnavailable || sellerVacationMode;

  const isOwner = useMemo(
    () => Boolean(user?.id && listing?.seller_id && user.id === listing.seller_id),
    [user?.id, listing?.seller_id]
  );

  const exitListingDetail = useCallback(() => {
    navigateBackFromListingDetail(router, {
      ...listingReturnParams,
      from_notifications,
      from_notifications_origin,
      from_offer_chat
    });
  }, [
    from_notifications,
    from_notifications_origin,
    from_offer_chat,
    listingReturnParams,
    router
  ]);

  const handleOwnerDeleteListing = useCallback(async () => {
    if (!listing?.id) return;
    const listingId = listing.id;
    const { error } = await deleteListing(listingId);
    if (error) {
      if (isListingDeleteBlockedByOrders(error)) {
        Alert.alert(t('feed.listingDetail.cannotDelete'), error, [
          { text: t('common.ok'), style: 'cancel' },
          {
            text: t('feed.listingDetail.deactivateListing'),
            onPress: () => {
              void (async () => {
                const { error: deactErr } = await deactivateListingToDraft(listingId);
                if (deactErr) {
                  Alert.alert(t('common.error'), deactErr);
                  return;
                }
                setOwnerSheetVisible(false);
                exitListingDetail();
              })();
            }
          }
        ]);
        throw new Error(error);
      }
      Alert.alert(t('common.error'), error);
      throw new Error(error);
    }
    exitListingDetail();
  }, [exitListingDetail, listing?.id, router, t]);

  const handleDeactivateOwnListing = useCallback(async () => {
    if (!listing?.id) return;
    const { error } = await deactivateListingToDraft(listing.id);
    if (error) {
      Alert.alert(t('common.error'), error);
      throw new Error(error);
    }
    setOwnerSheetVisible(false);
    exitListingDetail();
  }, [exitListingDetail, listing?.id, t]);

  const handlePermanentDeleteDraftRequest = useCallback(
    (listingId: string) => {
      setOwnerSheetVisible(false);
      setTimeout(() => {
        Alert.alert(
          t('feed.listingDetail.deletePermanentlyTitle'),
          t('feed.listingDetail.deletePermanentlyMessage'),
          [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: () => {
              void (async () => {
                const { error: delErr } = await deleteListing(listingId);
                if (delErr) {
                  Alert.alert(t('feed.listingDetail.cannotDelete'), delErr);
                  return;
                }
                exitListingDetail();
              })();
            }
          }
        ]);
      }, 300);
    },
    [exitListingDetail, t]
  );

  const openOwnerListingMenu = useCallback(() => {
    if (!listing || !isOwner) return;
    setOwnerSheetVisible(true);
  }, [isOwner, listing]);

  const handleEditOwnListing = useCallback(() => {
    if (!listing?.id) return;
    router.push({
      pathname: `/tabs/profile/edit-listing/${listing.id}`,
      params: {
        ...listingReturnParams,
        return_listing_id: listing.id
      }
    } as any);
  }, [listing?.id, listingReturnParams, router]);

  const handleBack = () => {
    exitListingDetail();
  };

  const handleToggleLike = async () => {
    if (!listing?.id) return;
    if (togglingLike) return;
    if (isOwner) return;

    if (!user) {
      openGuestAuthPrompt();
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
    if (!listing) return;
    if (!user) {
      openGuestAuthPrompt();
      return;
    }
    if (user.id === listing.seller_id) return;

    void (async () => {
      const { data: existing, error } = await getExistingThreadForListing(listing.id);
      if (error) {
        console.warn('Erreur récupération thread:', error);
        return;
      }

      if (existing?.id) {
        router.push({
          pathname: '/tabs/messages/[id]',
          params: { id: existing.id, from_listing_id: listing.id }
        });
        return;
      }

      router.push({
        pathname: '/tabs/messages/[id]',
        params: {
          id: 'draft',
          listing_id: listing.id,
          seller_id: listing.seller_id,
          from_listing_id: listing.id
        }
      });
    })();
  };

  const openReportMenu = useCallback(() => {
    if (isOwner || !listing?.id) return;
    setReportUi({ step: 'reasons' });
  }, [isOwner, listing?.id]);

  const submitReport = useCallback(
    async (reason: ReportReasonKey) => {
      if (!listing?.id) return;
      const {
        data: { user: authedUser }
      } = await supabase.auth.getUser();
      if (!authedUser?.id) {
        openGuestAuthPrompt();
        return;
      }

      try {
        setSubmittingReport(true);
        const { error: reportError } = await supabase.from('reports').insert({
          reporter_id: authedUser.id,
          listing_id: listing.id,
          reason: reportReasonToDbValue(reason)
        });
        if (reportError) throw reportError;
        setReportUi({
          step: 'done',
          title: t('feed.listingDetail.reportThanksTitle'),
          message: t('feed.listingDetail.reportThanksMessage')
        });
      } catch (e) {
        const message =
          e instanceof Error && e.message
            ? e.message
            : t('feed.listingDetail.reportErrorMessage');
        setReportUi({
          step: 'done',
          title: t('feed.listingDetail.reportErrorTitle'),
          message
        });
      } finally {
        setSubmittingReport(false);
      }
    },
    [listing?.id, router]
  );

  const handleMakeOffer = async () => {
    if (!listing) return;
    if (!user) {
      openGuestAuthPrompt();
      return;
    }
    if (sellerVacationMode) {
      Alert.alert(t('feed.listingDetail.sellerVacationTitle'), t('feed.listingDetail.sellerVacationMessage'));
      return;
    }

    const { data: gate } = await getBuyerListingOfferGate(listing.id);
    if (gate && !gate.canOffer) {
      Alert.alert(
        t('feed.makeOffer.blockedTitle'),
        gate.reason === 'pending'
          ? t('feed.makeOffer.pendingBlocked')
          : t('feed.makeOffer.acceptedBlocked'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('feed.makeOffer.viewConversation'),
            onPress: () => navigateToThread(router, gate.threadId)
          }
        ]
      );
      return;
    }

    router.push({
      pathname: '/tabs/feed/make-offer',
      params: { id: listing.id }
    });
  };

  const handleBuyNow = async () => {
    if (!listing) return;
    if (!user) {
      openGuestAuthPrompt();
      return;
    }
    if (user.id === listing.seller_id) return;
    if (sellerVacationMode) {
      Alert.alert(t('feed.listingDetail.sellerVacationTitle'), t('feed.listingDetail.sellerVacationMessage'));
      return;
    }

    const listingDelivery = normalizeDeliveryMode(listing.delivery_mode);
    const shippingOnly =
      deliveryModeIncludesShipping(listingDelivery) && !deliveryModeIncludesPickup(listingDelivery);
    if (shippingOnly) {
      const address = await ensureProfileShippingAddress(supabase, user.id, router, t, 'buyer');
      if (!address) return;
    }

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

  const handleShareListing = useCallback(async () => {
    if (!listing?.id) return;
    const shareUrl = getListingShareUrl(listing.id);
    const title = listing.title ?? t('common.bloomiListing');
    const imageUrl = photos[0]?.url;
    try {
      await shareListing({
        listingId: listing.id,
        imageUrl,
        title,
        priceLabel: formatBuyerFinalPrice(listing.price),
        brand: listing.brand,
        headline: t('feed.listingDetail.shareHeadline'),
        url: shareUrl
      });
    } catch {
      await Clipboard.setStringAsync(shareUrl);
      Alert.alert(t('feed.listingDetail.linkCopied'));
    }
  }, [listing?.id, listing?.title, listing?.price, listing?.brand, photos, t]);

  const handleImagePress = (index: number) => {
    setModalImageIndex(index);
    setModalPagerScrollEnabled(true);
    setImageModalVisible(true);
  };

  const handleModalClose = () => {
    setActiveImageIndex(modalImageIndexRef.current);
    setImageModalVisible(false);
    setModalPagerScrollEnabled(true);
  };

  const scrollModalToIndex = useCallback(
    (index: number, animated = true) => {
      const clamped = Math.max(0, Math.min(index, photos.length - 1));
      setModalImageIndex(clamped);
      setModalPagerScrollEnabled(true);
      if (modalPageWidth <= 0) return;
      modalPagerRef.current?.scrollToOffset({
        offset: clamped * modalPageWidth,
        animated
      });
      modalThumbsRef.current?.scrollToIndex({
        index: clamped,
        animated,
        viewPosition: 0.5
      });
    },
    [modalPageWidth, photos.length]
  );

  const updateModalIndexFromOffset = useCallback(
    (offsetX: number) => {
      if (modalPageWidth <= 0) return;
      const index = Math.round(offsetX / modalPageWidth);
      const clamped = Math.max(0, Math.min(index, photos.length - 1));
      setModalImageIndex((prev) => {
        if (prev === clamped) return prev;
        setModalPagerScrollEnabled(true);
        return clamped;
      });
    },
    [modalPageWidth, photos.length]
  );

  const handleModalPagerScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      updateModalIndexFromOffset(event.nativeEvent.contentOffset.x);
    },
    [updateModalIndexFromOffset]
  );

  const handleModalZoomChange = useCallback((index: number, zoomed: boolean) => {
    if (index !== modalImageIndexRef.current) return;
    setModalPagerScrollEnabled(!zoomed);
  }, []);

  useEffect(() => {
    if (!isImageModalVisible || photos.length === 0 || modalPageWidth <= 0) return;
    const frame = requestAnimationFrame(() => {
      scrollModalToIndex(modalImageIndexRef.current, false);
    });
    return () => cancelAnimationFrame(frame);
  }, [isImageModalVisible, modalPageWidth, photos.length, scrollModalToIndex]);

  useEffect(() => {
    if (!isImageModalVisible || photos.length === 0) return;
    modalThumbsRef.current?.scrollToIndex({
      index: modalImageIndex,
      animated: true,
      viewPosition: 0.5
    });
  }, [isImageModalVisible, modalImageIndex, photos.length]);

  const updateCarouselIndexFromOffset = useCallback(
    (offsetX: number) => {
      const index = Math.round(offsetX / CAROUSEL_SNAP_INTERVAL);
      const clamped = Math.max(0, Math.min(index, photos.length - 1));
      setActiveImageIndex((prev) => (prev === clamped ? prev : clamped));
    },
    [photos.length]
  );

  const handleCarouselScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      updateCarouselIndexFromOffset(event.nativeEvent.contentOffset.x);
    },
    [updateCarouselIndexFromOffset]
  );

  const handleCarouselScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      updateCarouselIndexFromOffset(event.nativeEvent.contentOffset.x);
    },
    [updateCarouselIndexFromOffset]
  );

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

    if (diffMinutes < 1) return t('feed.listingDetail.justNow');
    if (diffHours < 1) return t('feed.listingDetail.minutesAgo', { count: diffMinutes });
    if (diffDays < 1) return t('feed.listingDetail.hoursAgo', { count: diffHours });
    if (diffWeeks < 1) return t('feed.listingDetail.daysAgo', { count: diffDays });
    if (diffMonths < 1) return t('feed.listingDetail.weeksAgo', { count: diffWeeks });
    if (diffYears < 1) return t('feed.listingDetail.monthsAgo', { count: diffMonths });
    return t('feed.listingDetail.yearsAgo', { count: diffYears });
  };

  const sellerInitials = useMemo(() => {
    const name = listing?.seller_display_name ?? '';
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const second = parts.length > 1 ? parts[1][0] : '';
    return (first + second).toUpperCase();
  }, [listing]);

  const hasPreviewPhotos = photos.length > 0;
  const isShellLoading = loading && !listing;

  if (loading && !hasPreviewPhotos) {
    return (
      <>
        <StatusBar style="dark" />
        <SafeAreaView style={styles.container}>
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text variant="body" color="textSecondary" style={styles.loadingText}>
              {t('common.loading')}
            </Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  if (!loading && (error || !listing)) {
    return (
      <>
        <StatusBar style="dark" />
        <SafeAreaView style={styles.container}>
          <View style={styles.centerContent}>
            <Text variant="h2" style={styles.errorTitle}>
              {error?.message || t('feed.listingDetail.notFound')}
            </Text>
            <Button title={t('common.retry')} onPress={fetchListing} variant="primary" />
            <Button
              title={t('common.back')}
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
            {t('feed.listingDetail.title')}
          </Text>
          {isOwner ? (
            <TouchableOpacity
              onPress={openOwnerListingMenu}
              activeOpacity={0.7}
              hitSlop={HIT_SLOP_COMFORTABLE}
              style={[styles.iconTouch, HEADER_ICON_TOUCH_CONTAINER]}
              accessibilityRole="button"
              accessibilityLabel={t('feed.listingDetail.listingMenu')}
            >
              <Text variant="body" style={styles.headerMenuDots}>
                •••
              </Text>
            </TouchableOpacity>
          ) : user?.id ? (
            <TouchableOpacity
              onPress={openReportMenu}
              activeOpacity={0.7}
              hitSlop={HIT_SLOP_COMFORTABLE}
              style={[styles.iconTouch, HEADER_ICON_TOUCH_CONTAINER]}
              accessibilityRole="button"
              accessibilityLabel={t('feed.listingDetail.reportListing')}
            >
              <Text variant="body" style={styles.headerMenuDots}>
                •••
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.iconTouch, HEADER_ICON_TOUCH_CONTAINER]} />
          )}
        </View>

        {/* Scrollable content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: safeBottom + 64 }
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
                  snapToInterval={CAROUSEL_SNAP_INTERVAL}
                  decelerationRate="fast"
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
                  scrollEventThrottle={16}
                  onScroll={handleCarouselScroll}
                  onScrollEndDrag={handleCarouselScrollEnd}
                  onMomentumScrollEnd={handleCarouselScrollEnd}
                  renderItem={({ item, index }) => (
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => handleImagePress(index)}
                    >
                      <View
                        style={{
                          width: ITEM_WIDTH,
                          height: ITEM_HEIGHT,
                          borderRadius: 16,
                          overflow: 'hidden',
                          backgroundColor: '#F5F5F5'
                        }}
                      >
                        <ListingCoverImage
                          uri={item.url}
                          widthDp={ITEM_WIDTH}
                          heightDp={ITEM_HEIGHT}
                          recyclingKey={`${listing?.id ?? id}-${item.id}`}
                          priority={index === 0 ? 'high' : index < 3 ? 'normal' : 'low'}
                        />
                      </View>
                    </TouchableOpacity>
                  )}
                />

                {/* Favorite icon — hidden for your own listing */}
                {!isOwner && !isShellLoading ? (
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
                      color={likedByMe ? '#C3EA4F' : theme.colors.appleBlack}
                      outline={!likedByMe}
                      strokeWidth={2.4}
                    />
                  </TouchableOpacity>
                ) : null}

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
          {isShellLoading ? (
            <View style={styles.shellLoadingBlock}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <View style={styles.shellLine} />
              <View style={[styles.shellLine, styles.shellLineShort]} />
            </View>
          ) : listing ? (
          <View style={styles.productBlock}>
            <Text variant="h1" style={styles.productTitle}>
              {listing.title}
            </Text>

            <View style={styles.metaRow}>
              <View style={styles.metaChip}>
                <Text variant="captionSm" color="textSecondary" numberOfLines={1} ellipsizeMode="tail">
                  {listing.brand ?? '—'}
                </Text>
              </View>
              <View style={styles.metaChip}>
                <Text variant="captionSm" color="textSecondary" numberOfLines={1} ellipsizeMode="tail">
                  {sizeLabel ?? '—'}
                </Text>
              </View>
              <View style={styles.metaChip}>
                <Text variant="captionSm" color="textSecondary" numberOfLines={1} ellipsizeMode="tail">
                  {conditionLabel ?? 'N/A'}
                </Text>
              </View>
            </View>
            <View style={styles.fullBleedSeparator} />

            <View style={styles.mainPriceRow}>
              <BuyerFinalPriceRow
                itemPriceChf={listing.price}
                variant="h2"
                textStyle={styles.mainPrice}
              />
            </View>

            {deliveryModeIncludesShipping(listing.delivery_mode) &&
            listing.parcel_size &&
            shippingFeeInfo ? (
              <View style={styles.deliveryRow}>
                <Text style={styles.deliveryText}>
                  {t('feed.listingDetail.shipping', {
                    price: (shippingFeeInfo.fee_cents / 100).toFixed(2)
                  })}
                </Text>
                {shippingFeeInfo.is_promo ? (
                  <View style={styles.shippingPromoBadge}>
                    <Text style={styles.shippingPromoBadgeText}>
                      {t('feed.listingDetail.shippingPromo')}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
            {deliveryModeIncludesShipping(listing.delivery_mode) &&
            listing.parcel_size === 'letter_aplus' ? (
              <LetterAplusLabelNote style={styles.letterAplusNote} />
            ) : null}
            {deliveryModeIncludesPickup(listing.delivery_mode) ? (
              <View style={styles.pickupBlock}>
                <Text style={styles.deliveryText}>{t('feed.listingDetail.pickup')}</Text>
                <ListingPickupAddresses listing={listing} />
              </View>
            ) : null}
          </View>
          ) : null}

          {!isShellLoading && listing ? (
          <>
          {/* Seller block — juste sous le prix (même espacement que ligne → prix) */}
          <View style={styles.sellerBlock}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() =>
                guardedPush(
                  router,
                  publicProfileHref(listing.seller_id, listingReturnParams)
                )
              }
              style={styles.sellerInfo}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {listing.seller_avatar_url ? (
                <Image source={{ uri: listing.seller_avatar_url }} style={styles.sellerAvatar} />
              ) : (
                <View style={styles.sellerAvatarPlaceholder}>
                  <Text variant="h3" color="appleBlack">
                    {sellerInitials}
                  </Text>
                </View>
              )}
              <View style={styles.sellerText}>
                <View style={styles.sellerNameRow}>
                  <Text
                    variant="h3"
                    style={styles.sellerName}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {listing.seller_display_name ?? t('common.seller')}
                  </Text>
                  {listing.seller_is_influencer ? (
                    <InfluencerBadge size={22} style={styles.sellerInfluencerBadge} />
                  ) : null}
                </View>
                <Text variant="captionSm" color="textSecondary">
                  {sellerItemsLabel}
                </Text>
              </View>
            </TouchableOpacity>
            {user?.id !== listing.seller_id && (
              <Button
                title={t('feed.listingDetail.messageSeller')}
                onPress={handleMessageSeller}
                variant="primary"
                style={styles.sellerButton}
                textStyle={styles.sellerButtonText}
              />
            )}
          </View>

          <View style={styles.separator} />

          {/* Description */}
          <View style={styles.descriptionBlock}>
            <Text variant="captionSm" color="textSecondary" style={styles.sectionLabel}>
              {t('feed.listingDetail.itemDescription')}
            </Text>
            <Text variant="body" color="textSecondary">
              {listing.description ?? t('feed.listingDetail.noDescription')}
            </Text>
          </View>

          {/* Lower section */}
          <View style={styles.lowerSection}>
            {/* Favorite / Share */}
            <View style={styles.favoriteShareRow}>
              {!isOwner ? (
                <>
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
                      color={likedByMe ? '#C3EA4F' : theme.colors.appleBlack}
                      outline={!likedByMe}
                      strokeWidth={2.2}
                    />
                    <Text variant="captionSm" color="textPrimary">
                      {t('feed.listingDetail.favorite')}
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.favoriteShareDivider} />
                </>
              ) : null}
              <TouchableOpacity
                style={[styles.favoriteShareButton, isOwner && styles.favoriteShareButtonFull]}
                activeOpacity={0.8}
                onPress={() => {
                  void handleShareListing();
                }}
              >
                <Feather
                  name="share-2"
                  size={18}
                  color="#000"
                />
                <Text variant="captionSm" color="textPrimary">
                  {t('feed.listingDetail.share')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Details table */}
            <View style={styles.detailsList}>
              <DetailRow label={t('feed.listingDetail.category')} value={categoryLabel} />
              <DetailRow label={t('feed.listingDetail.size')} value={sizeLabel ?? '—'} />
              <DetailRow label={t('feed.listingDetail.condition')} value={conditionLabel ?? '—'} />
              <DetailRow label={t('feed.listingDetail.color')} value={colorLabel ?? '—'} />
              <DetailRow label={t('feed.listingDetail.views')} value={viewsCount != null ? String(viewsCount) : '—'} />
              <DetailRow label={t('feed.listingDetail.interested')} value={String(likesCount)} />
              <DetailRow
                label={t('feed.listingDetail.uploaded')}
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
                  {t('feed.listingDetail.otherListings')}
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
                  {t('feed.listingDetail.similarItems')}
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
                  {t('feed.listingDetail.noRelatedItems')}
                </Text>
              ) : (
                (relatedTab === 'other' ? otherItems : similarItems).map((l) => {
                  const isOtherTab = relatedTab === 'other';
                  const cover = isOtherTab
                    ? (l as FeedListing).cover_photo_url ?? null
                    : (l as ListingDetail).photos?.[0]?.url ?? null;
                  return (
                    <ProductCard
                      key={l.id}
                      listingId={l.id}
                      sellerId={l.seller_id}
                      sellerName={l.seller_display_name ?? null}
                      sellerAvatarUrl={l.seller_avatar_url ?? null}
                      sellerIsInfluencer={Boolean(l.seller_is_influencer)}
                      title={l.title}
                      price={Number(l.price) || 0}
                      brand={(l as any).brand ?? undefined}
                      size={(l as any).size ?? undefined}
                      condition={l.condition ?? undefined}
                      imageUrl={cover}
                      style={styles.relatedCard}
                      cardWidth={relatedCardWidth}
                      imageRatio={1.3}
                      onPress={() =>
                        openListingDetail(router, l.id, {
                          ...listingReturnParams,
                          cover_photo: cover,
                          detailPathBase: listingDetailPathBase,
                          imageWidthDp: relatedCardWidth,
                          imageHeightDp: Math.round(relatedCardWidth * 1.3)
                        })
                      }
                    />
                  );
                })
              )}
            </View>
          </View>
          </>
          ) : null}
        </ScrollView>

        {listing ? (
        <OwnerListingBottomSheet
          visible={ownerSheetVisible}
          onClose={() => setOwnerSheetVisible(false)}
          onEdit={handleEditOwnListing}
          onDeleteConfirmed={handleOwnerDeleteListing}
          onDeactivateListing={
            String(listing?.status ?? '').toLowerCase() === 'draft'
              ? undefined
              : handleDeactivateOwnListing
          }
          activeListingId={listing?.id ?? null}
          listingStatus={listing?.status ?? null}
          onRequestPermanentDeleteDraft={handlePermanentDeleteDraftRequest}
        />
        ) : null}

        {/* Bottom CTAs — buyer vs seller (owner) */}
        {listing && !isShellLoading ? (
        <View
          style={[
            styles.bottomCtas,
            { paddingBottom: safeBottom + 16 }
          ]}
        >
          {isOwner ? (
            <Button
              title={t('feed.listingDetail.editListing')}
              onPress={handleEditOwnListing}
              variant="google"
              style={styles.bottomButtonOwnerFull}
            />
          ) : (
            <>
              <Button
                title={
                  sellerVacationMode
                    ? t('feed.listingDetail.sellerOnVacation')
                    : isListingReservedOrUnavailable
                    ? t('feed.listingDetail.reserved')
                    : t('feed.listingDetail.makeOffer')
                }
                onPress={handleMakeOffer}
                variant="secondary"
                style={
                  isPurchaseDisabled
                    ? styles.bottomButtonSecondaryDisabled
                    : styles.bottomButtonSecondary
                }
                disabled={isPurchaseDisabled}
              />
              <Button
                title={
                  sellerVacationMode
                    ? t('feed.listingDetail.sellerOnVacation')
                    : isListingReservedOrUnavailable
                    ? t('feed.listingDetail.reserved')
                    : t('feed.listingDetail.buyNow')
                }
                onPress={handleBuyNow}
                variant="google"
                style={
                  isPurchaseDisabled
                    ? styles.bottomButtonDisabled
                    : styles.bottomButtonBuyNow
                }
                disabled={isPurchaseDisabled}
              />
            </>
          )}
        </View>
        ) : null}

        {/* Image modal */}
        <Modal
          visible={isImageModalVisible}
          animationType="fade"
          transparent
          presentationStyle="fullScreen"
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
                  {t('common.close')}
                </Text>
              </TouchableOpacity>
            </View>

            <View
              style={styles.modalImageContainer}
              onLayout={(event) => {
                const { width, height } = event.nativeEvent.layout;
                if (width > 0 && height > 0) {
                  setModalZoomLayout({ width, height });
                }
              }}
            >
              {photos.length > 0 ? (
                <FlatList
                  ref={modalPagerRef}
                  data={photos}
                  keyExtractor={(item, index) => item.id ?? String(index)}
                  horizontal
                  pagingEnabled
                  bounces={photos.length > 1}
                  nestedScrollEnabled
                  scrollEnabled={modalPagerScrollEnabled}
                  showsHorizontalScrollIndicator={false}
                  style={{ width: modalPageWidth, height: modalPageHeight }}
                  getItemLayout={(_, index) => ({
                    length: modalPageWidth,
                    offset: modalPageWidth * index,
                    index
                  })}
                  onMomentumScrollEnd={handleModalPagerScrollEnd}
                  onScrollEndDrag={handleModalPagerScrollEnd}
                  onScrollToIndexFailed={(info) => {
                    modalPagerRef.current?.scrollToOffset({
                      offset: info.index * modalPageWidth,
                      animated: false
                    });
                  }}
                  renderItem={({ item, index }) => {
                    return (
                      <ZoomableImage
                        uri={item.url}
                        width={modalPageWidth}
                        height={modalPageHeight}
                        maxScale={4}
                        allowPagerSwipe={photos.length > 1}
                        isActive={index === modalImageIndex}
                        onZoomChange={(zoomed) => handleModalZoomChange(index, zoomed)}
                      />
                    );
                  }}
                />
              ) : (
                <View style={styles.carouselPlaceholder}>
                  <Text variant="body" color="textSecondary">
                    {t('common.noImage')}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.modalThumbnails}>
              <FlatList
                ref={modalThumbsRef}
                data={photos}
                keyExtractor={(item, index) => item.id ?? String(index)}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.modalThumbsContent}
                onScrollToIndexFailed={(info) => {
                  modalThumbsRef.current?.scrollToOffset({
                    offset: Math.max(0, info.index * 72 - 32),
                    animated: true
                  });
                }}
                renderItem={({ item, index }) => (
                    <TouchableOpacity
                      onPress={() => scrollModalToIndex(index)}
                      activeOpacity={0.8}
                      style={[
                        styles.modalThumbWrapper,
                        index === modalImageIndex && styles.modalThumbWrapperActive
                      ]}
                    >
                      <ListingCoverImage
                        uri={item.url}
                        widthDp={64}
                        heightDp={64}
                        recyclingKey={`modal-thumb-${item.id}`}
                        priority={index === modalImageIndex ? 'high' : 'low'}
                      />
                    </TouchableOpacity>
                )}
              />
            </View>
          </SafeAreaView>
        </Modal>

        {reportUi?.step === 'reasons' ? (
          <SafetyChoiceSheet
            visible
            onClose={() => {
              if (!submittingReport) setReportUi(null);
            }}
            title={t('feed.listingDetail.reportTitle')}
            message={t('feed.listingDetail.reportMessage')}
            actions={[
              ...REPORT_REASON_KEYS.map((reason) => ({
                label: t(`safety.reportReasons.${reason}`),
                disabled: submittingReport,
                onPress: () => {
                  if (!submittingReport) void submitReport(reason);
                }
              })),
              {
                label: t('common.cancel'),
                disabled: submittingReport,
                onPress: () => setReportUi(null)
              }
            ]}
          />
        ) : null}
        {reportUi?.step === 'done' ? (
          <SafetyChoiceSheet
            visible
            onClose={() => setReportUi(null)}
            title={reportUi.title}
            message={reportUi.message}
            actions={[{ label: t('common.ok'), onPress: () => setReportUi(null) }]}
          />
        ) : null}
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
  shellLoadingBlock: {
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingVertical: theme.spacing.gapLg,
    alignItems: 'center',
    gap: theme.spacing.gapMd
  },
  shellLine: {
    alignSelf: 'stretch',
    height: 14,
    borderRadius: 7,
    backgroundColor: '#EFEFEF'
  },
  shellLineShort: {
    width: '55%',
    alignSelf: 'center'
  },
  inlineLoadingRow: {
    paddingVertical: theme.spacing.gapMd,
    alignItems: 'center',
    justifyContent: 'center'
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
  headerMenuDots: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    letterSpacing: 0.5,
    paddingHorizontal: 4
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
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: theme.spacing.gapSm,
    rowGap: theme.spacing.gapMd,
    paddingHorizontal: theme.spacing.screenPaddingX,
    marginTop: theme.spacing.gapMd,
    paddingBottom: 0
  },
  sellerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    // Réserve assez de place au nom ; si bouton + nom ne tiennent pas → wrap
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 200,
    minWidth: 0
  },
  sellerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28
  },
  sellerAvatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.muted,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sellerText: {
    marginLeft: theme.spacing.gapMd,
    flex: 1,
    flexShrink: 1,
    minWidth: 0
  },
  sellerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0
  },
  sellerName: {
    fontFamily: theme.fontFamily.semiBold,
    fontSize: 18,
    lineHeight: 24,
    flexShrink: 1,
    minWidth: 0
  },
  sellerInfluencerBadge: {
    flexShrink: 0
  },
  sellerButton: {
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: 148,
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
    ...theme.typography.h2,
    fontSize: 24,
    lineHeight: 30,
    marginBottom: theme.spacing.gapSm
  },
  metaRow: {
    marginBottom: theme.spacing.gapSm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  metaChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: theme.colors.backgroundWhite
  },
  mainPriceRow: {
    marginBottom: theme.spacing.gapSm
  },
  mainPrice: {
    ...theme.typography.h2,
    fontFamily: theme.fontFamily.bold
  },
  deliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: 8,
    rowGap: 4,
    marginBottom: 4
  },
  letterAplusNote: {
    marginBottom: 4
  },
  deliveryText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#666666'
  },
  pickupBlock: {
    marginBottom: 4
  },
  shippingPromoBadge: {
    backgroundColor: '#C3EA4F',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  shippingPromoBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    color: '#000000',
    fontFamily: theme.fontFamily.semiBold
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
  reportReasonButton: {
    marginTop: 8
  },
  descriptionBlock: {
    paddingHorizontal: theme.spacing.screenPaddingX,
    marginTop: 0,
    paddingTop: 0,
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
    backgroundColor: '#C3EA4F'
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
    flexGrow: 0,
    flexShrink: 0
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
    marginTop: theme.spacing.gapMd,
    marginBottom: theme.spacing.gapMd
  },
  fullBleedSeparator: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.gapMd,
    marginHorizontal: -theme.spacing.screenPaddingX
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
  bottomButtonBuyNow: {
    flex: 1,
    backgroundColor: '#C3EA4F',
    borderWidth: 0,
    borderColor: 'transparent'
  },
  bottomButtonOwnerFull: {
    flex: 1,
    borderWidth: 0,
    borderColor: 'transparent'
  },
  bottomButtonSecondaryDisabled: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: '#F0F0F0',
    opacity: 0.45
  },
  bottomButtonSecondary: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: '#F0F0F0'
  },
  bottomButtonDisabled: {
    opacity: 0.45
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)'
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    minHeight: MODAL_IMAGE_HEIGHT
  },
  modalThumbnails: {
    paddingTop: 12,
    paddingBottom: 8,
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
    borderColor: '#C3EA4F'
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
  favoriteShareButtonFull: {
    flex: 1
  },
  favoriteShareDivider: {
    width: 1,
    backgroundColor: '#E5E5E5',
    marginVertical: 12
  }
});

