import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import { theme } from '../../lib/theme';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { openGuestAuthPrompt } from '../../lib/guestAuthPrompt';
import { sendPushNotificationWithUserJwt } from '../../lib/pushNotifications';
import { Text } from '../../components/ui/Text';
import { Button } from '../../components/ui/Button';
import type { FeedListing } from '../../lib/api';
import {
  cloneFeedListings,
  getExistingThreadForListing,
  deactivateListingToDraft,
  deleteListing,
  getSellerClosetListings,
  getSellerDraftListingsForCloset,
  isListingDeleteBlockedByOrders
} from '../../lib/api';
import { HeaderBackButton } from '../../components/ui/HeaderBackButton';
import { AppIcon } from '../../components/ui/AppIcon';
import { HIT_SLOP_COMFORTABLE, HEADER_ICON_TOUCH_CONTAINER } from '../../lib/touchTargets';
import { getSafeBottomInset } from '../../lib/safeArea';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ZoomableImage } from '../../components/ui/ZoomableImage';
import { ProductCard } from '../../components/ProductCard';
import { GRID_GAP_COMPACT, gridCardWidth } from '../../lib/cardLayout';
import { InfluencerBadge } from '../../components/InfluencerBadge';
import { OwnerListingBottomSheet } from '../../components/listing/OwnerListingBottomSheet';
import { SafetyChoiceSheet } from '../../components/safety/SafetyChoiceSheet';
import { bumpBlockedUsersRevision } from '../../lib/store/blockedUsersSync';
import { REPORT_REASON_KEYS, reportReasonToDbValue } from '../../lib/reports';
import { useTranslation } from 'react-i18next';
import {
  listingDetailFromPublicProfileHref,
  navigateBackFromPublicProfile,
  pickListingReturnParams,
  publicProfileHref
} from '../../lib/navigation/listingDetailNav';
import { guardedPush } from '../../lib/navigation/guardedNav';
import { Feather } from '@expo/vector-icons';
import { Rocket, TrendingUp } from 'lucide-react-native';
import { useStripe } from '@stripe/stripe-react-native';
import * as Clipboard from 'expo-clipboard';
import { getDressingShareUrl, shareCloset } from '../../lib/closetShare';
import { BoostDurationSheet } from '../../components/listing/BoostDurationSheet';
import { BoostPaymentCancelledError, runBoostPayment } from '../../lib/runBoostPayment';
import type { BoostSponsorType } from '../../lib/fees';

type PublicProfileParams = {
  user_id?: string;
  username?: string;
};

type PublicProfile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  is_influencer?: boolean | null;
  cover_image?: string | null;
  city?: string | null;
  country?: string | null;
  location?: string | null;
  created_at: string | null;
  average_rating?: number | string | null;
  reviews_count?: number | null;
};

type ReviewRow = {
  id: string;
  reviewer_id: string;
  rating: number;
  comment: string | null;
  created_at: string | null;
};

type ReviewerMini = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

type TabKey = 'closet' | 'reviews';

const LIME = '#C3EA4F';
const BOOST_GREEN = theme.colors.primary;
const STAR_ORANGE = '#F59E0B';
const COVER_HEIGHT = 160;
const PAGE_SIZE = 20;
const PROFILE_AVATAR_SIZE = 56;
const PROFILE_TEXT_LEFT_GAP = 10;

function formatRelativeDate(dateString: string | null, t: (key: string, options?: any) => string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) return date.toLocaleDateString();

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
}

function formatMemberSince(dateString: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) return '';
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 7) return `${diffDays}d`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 8) return `${diffWeeks}w`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 24) return `${diffMonths}mo`;
  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears}y`;
}

function formatTimeAgoEn(dateString: string | null, t: (key: string, options?: any) => string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) return '';

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (minutes < 1) return t('feed.listingDetail.justNow');
  if (hours < 1) return t('feed.listingDetail.minutesAgo', { count: minutes });
  if (days < 1) return t('feed.listingDetail.hoursAgo', { count: hours });
  if (weeks < 1) return t('feed.listingDetail.daysAgo', { count: days });
  if (months < 1) return t('feed.listingDetail.weeksAgo', { count: weeks });
  if (years < 1) return t('feed.listingDetail.monthsAgo', { count: months });
  return t('feed.listingDetail.yearsAgo', { count: years });
}

export default function PublicProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { user } = useAuthStore();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const params = useLocalSearchParams<PublicProfileParams>();
  const returnCtx = useMemo(() => pickListingReturnParams(params), [params]);

  const userIdParam = useMemo(() => String(params.user_id ?? '').trim(), [params.user_id]);
  const usernameParam = useMemo(() => String(params.username ?? '').trim(), [params.username]);

  const [tab, setTab] = useState<TabKey>('closet');

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [followersCount, setFollowersCount] = useState<number>(0);
  const [followingCount, setFollowingCount] = useState<number>(0);
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [togglingFollow, setTogglingFollow] = useState(false);

  const [closetItems, setClosetItems] = useState<FeedListing[]>([]);
  const [closetDraftItems, setClosetDraftItems] = useState<FeedListing[]>([]);
  const [closetOffset, setClosetOffset] = useState(0);
  const [closetLoadingMore, setClosetLoadingMore] = useState(false);
  const [closetHasMore, setClosetHasMore] = useState(true);
  const closetLoadingRef = useRef(false);

  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [reviewersById, setReviewersById] = useState<Record<string, ReviewerMini>>({});
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const lastLoadMoreScrollYRef = useRef<number>(-1);
  const [closetOwnerMenuListing, setClosetOwnerMenuListing] = useState<FeedListing | null>(null);

  type SafetyModalState =
    | { kind: 'menu_self' }
    | { kind: 'menu_other' }
    | { kind: 'report_reasons' }
    | { kind: 'block_confirm' }
    | { kind: 'done'; title: string; message: string };

  const [safetyModal, setSafetyModal] = useState<SafetyModalState | null>(null);
  const [safetyBusy, setSafetyBusy] = useState(false);

  const [profilePhotoZoomUri, setProfilePhotoZoomUri] = useState<string | null>(null);
  const [selectedReview, setSelectedReview] = useState<ReviewRow | null>(null);
  const [profilePhotoZoomLayout, setProfilePhotoZoomLayout] = useState({ width: 0, height: 0 });

  const [boostSheet, setBoostSheet] = useState<{
    sponsorType: BoostSponsorType;
    listingId: string;
  } | null>(null);
  const [boostPaying, setBoostPaying] = useState(false);

  const resolvedUsername = profile?.display_name ?? usernameParam ?? t('profile.title');
  const myId = user?.id ?? null;
  const isMe = Boolean(myId && profile?.id && myId === profile.id);

  const ratingValue = useMemo(() => {
    const raw = profile?.average_rating ?? 0;
    const n = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(n) ? n : 0;
  }, [profile?.average_rating]);

  const reviewsCount = useMemo(() => profile?.reviews_count ?? 0, [profile?.reviews_count]);

  /** Invalide les réponses async d'un dressing précédent (réutilisation de l'écran). */
  const loadGenRef = useRef(0);

  const resetSellerUi = useCallback(() => {
    setProfile(null);
    setFollowersCount(0);
    setFollowingCount(0);
    setIsFollowing(false);
    setTogglingFollow(false);
    setClosetItems([]);
    setClosetDraftItems([]);
    setClosetOffset(0);
    setClosetHasMore(true);
    setClosetLoadingMore(false);
    closetLoadingRef.current = false;
    lastLoadMoreScrollYRef.current = -1;
    setReviews([]);
    setReviewersById({});
    setReviewsLoading(false);
    setClosetOwnerMenuListing(null);
    setSafetyModal(null);
    setSelectedReview(null);
    setBoostSheet(null);
    setTab('closet');
  }, []);

  // Avant paint : vider l'ancien dressing dès que user_id / username change (évite le flash Android).
  useLayoutEffect(() => {
    loadGenRef.current += 1;
    resetSellerUi();
    setLoadingInitial(Boolean(userIdParam || usernameParam));
  }, [userIdParam, usernameParam, resetSellerUi]);

  const loadProfile = useCallback(async () => {
    if (!userIdParam && !usernameParam) {
      setProfile(null);
      setLoadingInitial(false);
      return;
    }

    const gen = loadGenRef.current;
    setLoadingInitial(true);
    try {
      let q = supabase
        .from('profiles')
        .select(
          'id, display_name, avatar_url, cover_image, city, country, location, created_at, average_rating, reviews_count, is_influencer'
        );

      if (userIdParam) q = q.eq('id', userIdParam);
      else q = q.eq('display_name', usernameParam);

      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      if (gen !== loadGenRef.current) return;

      const p = (data as any as PublicProfile | null) ?? null;
      setProfile(p);

      if (p?.id) {
        // Followers / Following counts
        try {
          const { count: followers } = await supabase
            .from('follows')
            .select('follower_id', { count: 'exact', head: true })
            .eq('following_id', p.id);
          if (gen !== loadGenRef.current) return;
          setFollowersCount(followers ?? 0);
        } catch {
          if (gen !== loadGenRef.current) return;
          setFollowersCount(0);
        }

        try {
          const { count: following } = await supabase
            .from('follows')
            .select('following_id', { count: 'exact', head: true })
            .eq('follower_id', p.id);
          if (gen !== loadGenRef.current) return;
          setFollowingCount(following ?? 0);
        } catch {
          if (gen !== loadGenRef.current) return;
          setFollowingCount(0);
        }

        // Is following?
        if (myId && myId !== p.id) {
          try {
            const { data: row, error: followErr } = await supabase
              .from('follows')
              .select('follower_id, following_id')
              .eq('follower_id', myId)
              .eq('following_id', p.id)
              .maybeSingle();

            if (followErr && (followErr as any)?.code !== 'PGRST116') {
              throw followErr;
            }

            if (gen !== loadGenRef.current) return;
            setIsFollowing(!!row);
          } catch {
            if (gen !== loadGenRef.current) return;
            setIsFollowing(false);
          }
        } else {
          setIsFollowing(false);
        }
      }
    } catch (e) {
      if (gen !== loadGenRef.current) return;
      setProfile(null);
      const message =
        e instanceof Error && e.message ? e.message : t('profile.publicProfile.unableLoadProfile');
      Alert.alert(t('common.error'), message);
    } finally {
      if (gen === loadGenRef.current) {
        setLoadingInitial(false);
      }
    }
  }, [myId, userIdParam, usernameParam, t]);

  const loadClosetPage = useCallback(
    async (opts?: { reset?: boolean }) => {
      const sellerId = profile?.id ?? null;
      if (!sellerId) return;
      const gen = loadGenRef.current;

      const reset = Boolean(opts?.reset);
      const nextOffset = reset ? 0 : closetOffset;
      if (!reset && (!closetHasMore || closetLoadingRef.current)) return;

      if (reset) {
        setClosetHasMore(true);
        setClosetOffset(0);
        if (!myId || myId !== sellerId) {
          setClosetDraftItems([]);
        }
      }

      closetLoadingRef.current = true;
      setClosetLoadingMore(true);
      try {
        const { data, error } = await getSellerClosetListings(sellerId, {
          offset: nextOffset,
          limit: PAGE_SIZE
        });

        if (error) throw new Error(error);
        if (gen !== loadGenRef.current) return;

        const rows = cloneFeedListings(data ?? []);
        setClosetItems((prev) => (reset ? rows : [...prev, ...rows]));
        setClosetOffset(nextOffset + rows.length);
        setClosetHasMore(rows.length === PAGE_SIZE);

        if (reset && myId && myId === sellerId) {
          const draftRes = await getSellerDraftListingsForCloset(sellerId);
          if (gen !== loadGenRef.current) return;
          if (draftRes.error) {
            // eslint-disable-next-line no-console
            console.log('Erreur chargement brouillons:', draftRes.error);
            setClosetDraftItems([]);
          } else {
            setClosetDraftItems(cloneFeedListings(draftRes.data ?? []));
          }
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log('Erreur chargement closet:', e);
      } finally {
        if (gen === loadGenRef.current) {
          closetLoadingRef.current = false;
          setClosetLoadingMore(false);
        }
      }
    },
    [closetHasMore, closetOffset, profile?.id, myId]
  );

  const loadReviews = useCallback(async () => {
    const reviewedId = profile?.id ?? null;
    if (!reviewedId) return;
    const gen = loadGenRef.current;
    setReviewsLoading(true);
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('id, reviewer_id, rating, comment, created_at')
        .eq('reviewed_id', reviewedId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      if (gen !== loadGenRef.current) return;
      const rows = (data || []) as ReviewRow[];
      setReviews(rows);

      const reviewerIds = Array.from(new Set(rows.map((r) => r.reviewer_id).filter(Boolean)));
      if (reviewerIds.length > 0) {
        const { data: profs, error: profErr } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', reviewerIds);
        if (profErr) throw profErr;
        if (gen !== loadGenRef.current) return;

        const map: Record<string, ReviewerMini> = {};
        (profs || []).forEach((p: any) => {
          map[String(p.id)] = {
            id: String(p.id),
            display_name: p.display_name ?? null,
            avatar_url: p.avatar_url ?? null
          };
        });
        setReviewersById(map);
      } else {
        setReviewersById({});
      }
    } catch (e) {
      if (gen !== loadGenRef.current) return;
      // eslint-disable-next-line no-console
      console.log('Erreur chargement reviews:', e);
      setReviews([]);
      setReviewersById({});
    } finally {
      if (gen === loadGenRef.current) {
        setReviewsLoading(false);
      }
    }
  }, [profile?.id]);

  // Stabiliser les callbacks utilisés dans les effets (évite les boucles quand
  // loadClosetPage change à cause de closetOffset/hasMore).
  const loadClosetPageRef = useRef(loadClosetPage);
  const loadReviewsRef = useRef(loadReviews);
  useEffect(() => {
    loadClosetPageRef.current = loadClosetPage;
  }, [loadClosetPage]);
  useEffect(() => {
    loadReviewsRef.current = loadReviews;
  }, [loadReviews]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!profile?.id) return;
    void loadClosetPageRef.current({ reset: true });
    void loadReviewsRef.current();
  }, [profile?.id, myId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadProfile();
      await loadClosetPage({ reset: true });
      await loadReviews();
    } finally {
      setRefreshing(false);
    }
  }, [loadClosetPage, loadProfile, loadReviews]);

  const openMenu = useCallback(() => {
    if (isMe) {
      setSafetyModal({ kind: 'menu_self' });
      return;
    }
    setSafetyModal({ kind: 'menu_other' });
  }, [isMe]);

  const onToggleFollow = useCallback(async () => {
    if (!profile?.id) return;
    if (!myId) {
      openGuestAuthPrompt();
      return;
    }
    if (isMe) {
      router.push('/tabs/profile/edit-profile');
      return;
    }
    if (togglingFollow) return;

    const prev = isFollowing;
    const prevFollowers = followersCount;
    const next = !prev;

    setIsFollowing(next);
    setFollowersCount(Math.max(0, prevFollowers + (next ? 1 : -1)));
    setTogglingFollow(true);

    try {
      if (next) {
        const { error } = await supabase.from('follows').insert({
          follower_id: myId,
          following_id: profile.id
        });
        if (error) throw error;

        const { data: myProfile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', myId)
          .maybeSingle();
        const followerName =
          typeof (myProfile as { display_name?: string } | null)?.display_name === 'string'
            ? String((myProfile as { display_name: string }).display_name).trim()
            : '';
        void sendPushNotificationWithUserJwt({
          user_id: profile.id,
          titleKey: 'push.newFollower.title',
          bodyKey: 'push.newFollower.body',
          bodyParams: { name: followerName || 'Someone' },
          notification_type: 'new_followers',
          data: { follower_id: myId }
        });
      } else {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', myId)
          .eq('following_id', profile.id);
        if (error) throw error;
      }
    } catch (e) {
      setIsFollowing(prev);
      setFollowersCount(prevFollowers);
      const message =
        e instanceof Error && e.message ? e.message : t('profile.publicProfile.unableFollow');
      Alert.alert(t('common.error'), message);
    } finally {
      setTogglingFollow(false);
    }
  }, [followersCount, isFollowing, isMe, myId, profile?.id, router, togglingFollow]);

  const onPressMessage = useCallback(() => {
    if (!profile?.id) return;
    if (!myId) {
      openGuestAuthPrompt();
      return;
    }
    if (isMe) return;

    const firstListing = closetItems[0] ?? null;
    if (!firstListing?.id) {
      Alert.alert(
        t('profile.publicProfile.message'),
        t('profile.publicProfile.noListingChat')
      );
      return;
    }

    void (async () => {
      const { data: existing, error } = await getExistingThreadForListing(firstListing.id);
      if (error) {
        Alert.alert(
          t('common.error'),
          error ?? t('profile.publicProfile.unableCreateConversation')
        );
        return;
      }

      if (existing?.id) {
        router.push({ pathname: '/tabs/messages/[id]', params: { id: existing.id } });
        return;
      }

      router.push({
        pathname: '/tabs/messages/[id]',
        params: {
          id: 'draft',
          listing_id: firstListing.id,
          seller_id: profile.id
        }
      });
    })();
  }, [closetItems, isMe, myId, profile?.id, router]);

  const locationLine = useMemo(() => {
    const loc = (profile as any)?.location ?? null;
    return String(loc ?? '').trim();
  }, [profile]);

  const timeAgo = useMemo(
    () => formatTimeAgoEn(profile?.created_at ?? null, t),
    [profile?.created_at, t]
  );

  const closetListData = useMemo(() => {
    if (isMe) return [...closetDraftItems, ...closetItems];
    return closetItems;
  }, [closetDraftItems, closetItems, isMe]);

  const coverImageUri = useMemo(() => {
    const raw = String(profile?.cover_image ?? '').trim();
    return raw.length > 0 ? raw : null;
  }, [profile?.cover_image]);

  const handlePickCoverImage = useCallback(async () => {
    if (!isMe || !myId || coverUploading) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert(
          t('profile.publicProfile.permissionRequired'),
          t('profile.publicProfile.coverPermission')
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.85,
        aspect: [3, 1]
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;
      const picked = result.assets[0];
      const coverPath = `${myId}/cover-${Date.now()}.jpg`;
      setCoverUploading(true);

      const base64 = await FileSystem.readAsStringAsync(picked.uri, {
        encoding: FileSystem.EncodingType.Base64
      });
      const fileBuffer = decodeBase64(base64);

      const { error: uploadErr } = await supabase.storage.from('cover').upload(coverPath, fileBuffer, {
        upsert: true,
        contentType: picked.mimeType || 'image/jpeg'
      });
      if (uploadErr) throw uploadErr;

      const { data: publicData } = supabase.storage.from('cover').getPublicUrl(coverPath);
      const publicUrl = publicData?.publicUrl ?? '';
      if (!publicUrl) throw new Error(t('profile.publicProfile.unableUpdateCover'));

      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ cover_image: publicUrl })
        .eq('id', myId);
      if (updateErr) throw updateErr;

      setProfile((prev) => (prev ? { ...prev, cover_image: publicUrl } : prev));
    } catch (e) {
      Alert.alert(
        t('common.error'),
        e instanceof Error ? e.message : t('profile.publicProfile.unableUpdateCover')
      );
    } finally {
      setCoverUploading(false);
    }
  }, [coverUploading, isMe, myId]);

  const closetCountLabel = useMemo(() => {
    const n = isMe ? closetDraftItems.length + closetItems.length : closetItems.length;
    return n === 1
      ? t('feed.listingDetail.oneItem')
      : t('feed.listingDetail.itemsCount', { count: n });
  }, [closetDraftItems.length, closetItems.length, isMe, t]);

  const closetCardWidth = useMemo(
    () => gridCardWidth(windowWidth, theme.spacing.screenPaddingX, GRID_GAP_COMPACT),
    [windowWidth]
  );

  const handleBack = useCallback(() => {
    navigateBackFromPublicProfile(router, { ...returnCtx, isMe });
  }, [isMe, returnCtx, router]);

  const handleDeleteClosetListing = useCallback(async (listingId: string) => {
    let removedSnapshot: FeedListing | undefined;
    setClosetItems((prev) => {
      removedSnapshot = prev.find((x) => x.id === listingId);
      return prev.filter((x) => x.id !== listingId);
    });

    const { error } = await deleteListing(listingId);
    if (error) {
      if (removedSnapshot) {
        setClosetItems((prev) =>
          prev.some((x) => x.id === listingId) ? prev : [removedSnapshot, ...prev]
        );
      }
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
                setClosetItems((prev) => prev.filter((x) => x.id !== listingId));
                setClosetDraftItems((prev) => prev.filter((x) => x.id !== listingId));
                setClosetOwnerMenuListing(null);
              })();
            }
          }
        ]);
        throw new Error(error);
      }
      Alert.alert(t('common.error'), error);
      throw new Error(error);
    }
  }, [t]);

  const handleDeactivateClosetListing = useCallback(async () => {
    const listing = closetOwnerMenuListing;
    if (!listing) return;
    const { error } = await deactivateListingToDraft(listing.id);
    if (error) {
      Alert.alert(t('common.error'), error);
      throw new Error(error);
    }
    setClosetItems((prev) => prev.filter((x) => x.id !== listing.id));
  }, [closetOwnerMenuListing]);

  const handlePermanentDeleteDraftRequest = useCallback((listingId: string) => {
    setClosetOwnerMenuListing(null);
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
              let removedSnapshot: FeedListing | undefined;
              setClosetDraftItems((prev) => {
                removedSnapshot = prev.find((x) => x.id === listingId);
                return prev.filter((x) => x.id !== listingId);
              });
              const { error } = await deleteListing(listingId);
              if (error) {
                if (removedSnapshot) {
                  setClosetDraftItems((prev) =>
                    prev.some((x) => x.id === listingId) ? prev : [...prev, removedSnapshot]
                  );
                }
                Alert.alert(t('feed.listingDetail.cannotDelete'), error);
                return;
              }
            })();
          }
        }
      ]);
    }, 300);
  }, []);

  const openClosetListingMenu = useCallback((listing: FeedListing) => {
    if (!isMe) return;
    setClosetOwnerMenuListing(listing);
  }, [isMe]);

  const openListingBoost = useCallback(
    (listingId: string) => {
      if (!isMe || !myId) return;
      setBoostSheet({ sponsorType: 'listing', listingId });
    },
    [isMe, myId]
  );

  const openDressingBoost = useCallback(() => {
    if (!isMe || !myId) return;
    const anchorId = closetItems.find(
      (it) => String(it.status ?? '').toLowerCase() === 'published'
    )?.id;
    if (!anchorId) {
      Alert.alert(t('common.error'), t('profile.publicProfile.noPublishedForDressingBoost'));
      return;
    }
    setBoostSheet({ sponsorType: 'dressing', listingId: anchorId });
  }, [closetItems, isMe, myId, t]);

  const handleBoostConfirm = useCallback(
    async (durationDays: 3 | 7) => {
      if (!boostSheet || !myId || boostPaying) return;

      setBoostPaying(true);
      try {
        const result = await runBoostPayment({
          listingId: boostSheet.listingId,
          sellerId: myId,
          sponsorType: boostSheet.sponsorType,
          durationDays,
          initPaymentSheet,
          presentPaymentSheet
        });

        setBoostSheet(null);
        Alert.alert(
          t('common.success'),
          t('profile.publicProfile.boostSuccess', { count: result.updated_count })
        );
        void loadClosetPage({ reset: true });
      } catch (e) {
        if (e instanceof BoostPaymentCancelledError) return;
        Alert.alert(
          t('feed.checkout.paymentFailed'),
          e instanceof Error ? e.message : t('auth.signUp.somethingWrong')
        );
      } finally {
        setBoostPaying(false);
      }
    },
    [
      boostPaying,
      boostSheet,
      initPaymentSheet,
      loadClosetPage,
      myId,
      presentPaymentSheet,
      t
    ]
  );

  const renderClosetItem = useCallback(
    ({ item }: { item: FeedListing }) => {
      const isPublished = String(item.status ?? '').toLowerCase() === 'published';

      return (
      <View style={styles.gridItem}>
        <View style={styles.closetCardWrap}>
          <ProductCard
            listingId={item.id}
            sellerId={item.seller_id}
            sellerName={item.seller_display_name}
            sellerAvatarUrl={item.seller_avatar_url}
            sellerIsInfluencer={Boolean(item.seller_is_influencer)}
            title={item.title}
            price={Number(item.price)}
            currency="CHF"
            brand={(item as any)?.brand ?? undefined}
            size={(item as any)?.size ?? undefined}
            condition={item.condition ?? undefined}
            imageUrl={item.cover_photo_url}
            cardWidth={closetCardWidth}
            onPress={() =>
              guardedPush(
                router,
                listingDetailFromPublicProfileHref(
                  item.id,
                  profile?.id ?? userIdParam ?? '',
                  returnCtx,
                  { cover_photo: item.cover_photo_url ?? undefined }
                )
              )
            }
            imageRatio={1.3}
          />
          {isMe ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('profile.publicProfile.listingMenu')}
              hitSlop={HIT_SLOP_COMFORTABLE}
              style={styles.closetMenuBtn}
              onPress={() => openClosetListingMenu(item)}
            >
              <Text variant="captionSm" style={styles.closetMenuBtnText}>
                •••
              </Text>
            </Pressable>
          ) : null}
          {isMe && isPublished ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('profile.publicProfile.boostButton')}
              style={styles.boostCardButton}
              onPress={() => openListingBoost(item.id)}
            >
              <Rocket size={14} color={BOOST_GREEN} strokeWidth={2.2} />
              <Text variant="captionSm" style={styles.boostCardButtonText}>
                {t('profile.publicProfile.boostButton')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      );
    },
    [
      closetCardWidth,
      isMe,
      openClosetListingMenu,
      openListingBoost,
      profile?.id,
      returnCtx,
      router,
      t,
      userIdParam
    ]
  );

  const renderReviewStars = useCallback((value: number) => {
    return (
      <View style={styles.reviewStarsRow}>
        {([1, 2, 3, 4, 5] as const).map((i) => (
          <AppIcon
            key={i}
            name={value >= i ? 'starBold' : 'starOutline'}
            size={14}
            color={value >= i ? theme.colors.primary : theme.colors.textSecondary}
          />
        ))}
      </View>
    );
  }, []);

  const closeSafetyModal = () => {
    if (!safetyBusy) setSafetyModal(null);
  };

  const renderSafetyModal = () => {
    if (!safetyModal) return null;

    if (safetyModal.kind === 'menu_self') {
      return (
        <SafetyChoiceSheet
          visible
          onClose={closeSafetyModal}
          title={t('profile.publicProfile.options')}
          actions={[{ label: t('common.close'), onPress: closeSafetyModal }]}
        />
      );
    }

    if (safetyModal.kind === 'menu_other') {
      return (
        <SafetyChoiceSheet
          visible
          onClose={closeSafetyModal}
          title={t('profile.publicProfile.userActions')}
          message={t('profile.publicProfile.safetyMenuMessage')}
          actions={[
            {
              label: t('profile.publicProfile.report'),
              onPress: () => {
                if (!myId) {
                  closeSafetyModal();
                  openGuestAuthPrompt();
                  return;
                }
                setSafetyModal({ kind: 'report_reasons' });
              }
            },
            {
              label: t('profile.publicProfile.blockSeller'),
              variant: 'destructive',
              onPress: () => {
                if (!myId) {
                  closeSafetyModal();
                  openGuestAuthPrompt();
                  return;
                }
                setSafetyModal({ kind: 'block_confirm' });
              }
            },
            { label: t('common.cancel'), onPress: closeSafetyModal }
          ]}
        />
      );
    }

    if (safetyModal.kind === 'report_reasons') {
      return (
        <SafetyChoiceSheet
          visible
          onClose={closeSafetyModal}
          title={t('profile.publicProfile.reportSeller')}
          message={t('safety.reportReasonsHint')}
          actions={[
            ...REPORT_REASON_KEYS.map((reason) => ({
              label: t(`safety.reportReasons.${reason}`),
              disabled: safetyBusy,
              onPress: () => {
                void (async () => {
                  if (!myId || !profile?.id) return;
                  const listingIdToReport = closetItems[0]?.id;
                  if (!listingIdToReport) {
                    setSafetyModal({
                      kind: 'done',
                      title: t('profile.publicProfile.nothingToReport'),
                      message: t('profile.publicProfile.noListingReport')
                    });
                    return;
                  }
                  setSafetyBusy(true);
                  try {
                    const { error } = await supabase.from('reports').insert({
                      reporter_id: myId,
                      listing_id: listingIdToReport,
                      reason: reportReasonToDbValue(reason)
                    });
                    if (error) {
                      setSafetyModal({
                        kind: 'done',
                        title: t('feed.listingDetail.reportErrorTitle'),
                        message: error.message
                      });
                    } else {
                      setSafetyModal({
                        kind: 'done',
                        title: t('feed.listingDetail.reportThanksTitle'),
                        message: t('feed.listingDetail.reportThanksMessage')
                      });
                    }
                  } finally {
                    setSafetyBusy(false);
                  }
                })();
              }
            })),
            {
              label: t('common.back'),
              disabled: safetyBusy,
              onPress: () => setSafetyModal({ kind: 'menu_other' })
            },
            { label: t('common.cancel'), disabled: safetyBusy, onPress: closeSafetyModal }
          ]}
        />
      );
    }

    if (safetyModal.kind === 'block_confirm') {
      return (
        <SafetyChoiceSheet
          visible
          onClose={closeSafetyModal}
          title={t('profile.publicProfile.blockTitle', { name: resolvedUsername })}
          message={t('safety.blockConfirmMessage')}
          actions={[
            {
              label: t('common.notNow'),
              disabled: safetyBusy,
              onPress: closeSafetyModal
            },
            {
              label: safetyBusy ? t('safety.blocking') : t('safety.blockAction'),
              variant: 'destructive',
              disabled: safetyBusy,
              onPress: () => {
                void (async () => {
                  if (!myId || !profile?.id) return;
                  setSafetyBusy(true);
                  try {
                    const { error } = await supabase.from('blocked_users').insert({
                      blocker_id: myId,
                      blocked_id: profile.id
                    });
                    if (error && error.code !== '23505') {
                      setSafetyModal({
                        kind: 'done',
                        title: t('profile.publicProfile.couldNotBlock'),
                        message: error.message
                      });
                      return;
                    }
                    bumpBlockedUsersRevision();
                    setClosetItems((prev) => prev.filter((item) => item.seller_id !== profile.id));
                    setClosetDraftItems((prev) => prev.filter((item) => item.seller_id !== profile.id));
                    setSafetyModal({
                      kind: 'done',
                      title: t('profile.publicProfile.sellerBlocked'),
                      message: t('profile.publicProfile.sellerBlockedMessage')
                    });
                  } finally {
                    setSafetyBusy(false);
                  }
                })();
              }
            }
          ]}
        />
      );
    }

    if (safetyModal.kind === 'done') {
      return (
        <SafetyChoiceSheet
          visible
          onClose={closeSafetyModal}
          title={safetyModal.title}
          message={safetyModal.message}
          actions={[{ label: t('common.ok'), onPress: closeSafetyModal }]}
        />
      );
    }

    return null;
  };

  const headerTitle = resolvedUsername || t('profile.title');
  const canShareCloset = Boolean(profile?.id) && closetItems.length > 0;

  const handleShareCloset = useCallback(async () => {
    if (!profile?.id) return;
    const shareUrl = getDressingShareUrl(profile.id);
    const headline = isMe
      ? t('profile.publicProfile.shareClosetHeadline')
      : t('profile.publicProfile.shareClosetHeadlineOther', { name: resolvedUsername });
    const imageUrl =
      profile.avatar_url?.trim() ||
      closetItems[0]?.cover_photo_url?.trim() ||
      null;
    try {
      await shareCloset({
        sellerId: profile.id,
        imageUrl,
        displayName: resolvedUsername,
        headline,
        url: shareUrl
      });
    } catch {
      await Clipboard.setStringAsync(shareUrl);
      Alert.alert(t('feed.listingDetail.linkCopied'));
    }
  }, [closetItems, isMe, profile?.avatar_url, profile?.id, resolvedUsername, t]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header (même layout que les autres écrans) */}
      <View style={styles.header}>
        <HeaderBackButton onPress={handleBack} />
        <Text variant="body" style={styles.headerTitle} numberOfLines={1}>
          {headerTitle}
        </Text>
        <View style={styles.headerActions}>
          {canShareCloset ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('profile.publicProfile.shareCloset')}
              hitSlop={HIT_SLOP_COMFORTABLE}
              onPress={() => void handleShareCloset()}
              style={[styles.iconTouch, HEADER_ICON_TOUCH_CONTAINER]}
            >
              <Feather name="share-2" size={20} color={theme.colors.textPrimary} />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('profile.publicProfile.menu')}
            hitSlop={HIT_SLOP_COMFORTABLE}
            onPress={openMenu}
            style={[styles.iconTouch, HEADER_ICON_TOUCH_CONTAINER]}
          >
            <AppIcon name="menuDotsOutline" size={20} color={theme.colors.textPrimary} />
          </Pressable>
        </View>
      </View>
      <View style={styles.headerSeparator} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        stickyHeaderIndices={[]}
        onScroll={(e) => {
          if (tab !== 'closet') return;
          if (!closetHasMore || closetLoadingRef.current) return;

          const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
          const paddingToBottom = 220;
          const nearBottom =
            layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;

          if (!nearBottom) return;

          // Empêcher les appels en boucle quand la hauteur du contenu change.
          const y = contentOffset.y;
          if (y - lastLoadMoreScrollYRef.current < 120) return;
          lastLoadMoreScrollYRef.current = y;

          void loadClosetPage();
        }}
        scrollEventThrottle={16}
      >
        {/* Cover */}
        <View style={styles.coverWrap}>
          {coverImageUri ? (
            <Pressable
              onPress={() => setProfilePhotoZoomUri(coverImageUri)}
              accessibilityRole="imagebutton"
              accessibilityLabel={t('profile.publicProfile.viewCoverPhoto')}
            >
              <Image source={{ uri: coverImageUri }} style={styles.coverImage} />
            </Pressable>
          ) : (
            <View style={styles.coverPlaceholder}>
              {isMe ? (
                <Text variant="caption" style={styles.coverPlaceholderText}>
                  {t('profile.publicProfile.addCover')}
                </Text>
              ) : null}
            </View>
          )}
          {isMe ? (
            <Pressable
              onPress={() => {
                void handlePickCoverImage();
              }}
              style={({ pressed }) => [styles.coverEditButton, pressed && styles.coverEditButtonPressed]}
              disabled={coverUploading}
            >
              <Text variant="captionSm" style={styles.coverEditButtonText}>
                {coverUploading ? t('common.loading') : t('common.edit')}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {/* Profile block */}
        <View style={styles.profileBlock}>
          <View style={styles.profileLeft}>
            {profile?.avatar_url ? (
              <Pressable
                onPress={() => setProfilePhotoZoomUri(profile.avatar_url)}
                accessibilityRole="imagebutton"
                accessibilityLabel={t('profile.publicProfile.viewProfilePhoto')}
              >
                <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
              </Pressable>
            ) : (
              <View style={styles.avatarPlaceholder} />
            )}

            <View style={styles.nameAndRating}>
              {loadingInitial ? (
                <View style={[styles.skeletonLine, { width: 120 }]} />
              ) : (
                <View style={styles.usernameBadgeRow}>
                  <Text variant="body" style={styles.username} numberOfLines={1}>
                    {resolvedUsername}
                  </Text>
                  {profile?.is_influencer ? <InfluencerBadge size={22} style={styles.profileInfluencerBadge} /> : null}
                </View>
              )}

              <View style={styles.ratingRow}>
                <AppIcon name="starBold" size={14} color={STAR_ORANGE} />
                <Text variant="captionSm" style={styles.ratingValue}>
                  {ratingValue.toFixed(1)}
                </Text>
                <Text variant="captionSm" color="textSecondary" style={styles.reviewsCountText}>
                  {t('profile.publicProfile.reviewsCount', { count: reviewsCount })}
                </Text>
              </View>
            </View>
          </View>

          <Pressable
            onPress={onToggleFollow}
            disabled={togglingFollow}
            style={[
              styles.followButton,
              isMe
                ? styles.editButton
                : isFollowing
                ? styles.followingButton
                : styles.followPill
            ]}
          >
            <Text
              variant="caption"
              style={[
                styles.followButtonText,
                isFollowing && !isMe ? styles.followingText : null
              ]}
            >
              {isMe
                ? t('profile.editProfile')
                : isFollowing
                ? t('profile.publicProfile.followingBtn')
                : t('profile.publicProfile.follow')}
            </Text>
          </Pressable>
        </View>

        {/* Secondary info */}
        <View style={styles.fineSeparator} />
        <View style={styles.secondaryInfo}>
          <View style={styles.secondaryLeft}>
            <View style={styles.secondaryLine}>
              <AppIcon name="mapPointOutline" size={14} color="#888888" />
              <Text style={styles.secondaryText} numberOfLines={1}>
                {locationLine || '—'}
              </Text>
            </View>
            <View style={styles.secondaryLine}>
              {/* Pas d'icône "clock" dans le set actuel → on utilise un pictogramme neutre */}
              <AppIcon name="billListOutline" size={14} color="#888888" />
              <Text style={styles.secondaryText} numberOfLines={1}>
                {timeAgo || '—'}
              </Text>
            </View>
            <View style={styles.secondaryLine}>
              <AppIcon name="infoCircleOutline" size={14} color="#888888" />
              <Text style={styles.secondaryText} numberOfLines={1}>
                <Text style={styles.limeNumber}>{followersCount}</Text>
                <Text style={styles.secondaryText}> {t('profile.publicProfile.followers')}</Text>
                <Text style={styles.secondaryText}> · </Text>
                <Text style={styles.limeNumber}>{followingCount}</Text>
                <Text style={styles.secondaryText}> {t('profile.publicProfile.followingCount')}</Text>
              </Text>
            </View>
          </View>

          {!isMe ? (
            <Pressable onPress={onPressMessage} style={styles.messageButton}>
              <Text variant="caption" style={styles.messageButtonText}>
                {t('profile.publicProfile.message')}
              </Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.fineSeparator} />

        {/* Tabs */}
        <View style={styles.tabsRow}>
          <Pressable style={[styles.tab, styles.tabLeft]} onPress={() => setTab('closet')}>
            <Text style={tab === 'closet' ? styles.tabTextActive : styles.tabTextInactive}>
              {t('profile.publicProfile.closet')}
            </Text>
            {tab === 'closet' ? <View style={styles.tabUnderline} /> : null}
          </Pressable>

          <Pressable style={styles.tab} onPress={() => setTab('reviews')}>
            <Text style={tab === 'reviews' ? styles.tabTextActive : styles.tabTextInactive}>
              {t('profile.publicProfile.reviews')}
            </Text>
            {tab === 'reviews' ? <View style={styles.tabUnderline} /> : null}
          </Pressable>
        </View>
        <View style={styles.fineSeparator} />

        {/* Tab content */}
        {tab === 'closet' ? (
          <View style={styles.tabContent}>
            <View style={styles.closetMetaRow}>
              <Text variant="captionSm" color="textSecondary" style={styles.closetCountText}>
                {closetCountLabel}
              </Text>
              {isMe ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('profile.publicProfile.sponsorDressing')}
                  style={styles.sponsorDressingButton}
                  onPress={openDressingBoost}
                >
                  <TrendingUp size={14} color={BOOST_GREEN} strokeWidth={2.2} />
                  <Text variant="captionSm" style={styles.sponsorDressingButtonText} numberOfLines={1}>
                    {t('profile.publicProfile.sponsorDressing')}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {loadingInitial ? (
              <View style={styles.skeletonGrid}>
                {[0, 1, 2, 3].map((k) => (
                  <View key={k} style={styles.skeletonCard} />
                ))}
              </View>
            ) : (
              <FlatList
                data={closetListData}
                keyExtractor={(it) => it.id}
                numColumns={2}
                renderItem={renderClosetItem}
                columnWrapperStyle={styles.gridRow}
                contentContainerStyle={styles.gridContent}
                scrollEnabled={false}
                ListFooterComponent={
                  closetLoadingMore && closetItems.length > 0 ? (
                    <View style={styles.loadingMore}>
                      <ActivityIndicator size="small" color={theme.colors.textSecondary} />
                    </View>
                  ) : null
                }
              />
            )}
          </View>
        ) : (
          <View style={styles.tabContent}>
            {reviewsLoading ? (
              <View style={styles.reviewsLoading}>
                <ActivityIndicator size="small" color={theme.colors.textSecondary} />
              </View>
            ) : reviews.length === 0 ? (
              <View style={styles.emptyReviews}>
                <Text variant="body" color="textSecondary">
                  {t('profile.publicProfile.noReviews')}
                </Text>
              </View>
            ) : (
              <View style={styles.reviewsList}>
                {reviews.map((r) => {
                  const reviewer = reviewersById[r.reviewer_id];
                  const name = reviewer?.display_name ?? 'User';
                  const avatar = reviewer?.avatar_url ?? null;
                  const hasLongComment = Boolean(r.comment && r.comment.length > 120);
                  return (
                    <Pressable
                      key={r.id}
                      style={({ pressed }) => [styles.reviewRow, pressed && styles.reviewRowPressed]}
                      onPress={() => setSelectedReview(r)}
                      accessibilityRole="button"
                      accessibilityLabel={t('profile.publicProfile.viewReview')}
                    >
                      {avatar ? (
                        <Image source={{ uri: avatar }} style={styles.reviewAvatar} />
                      ) : (
                        <View style={styles.reviewAvatarPlaceholder} />
                      )}

                      <View style={styles.reviewBody}>
                        <View style={styles.reviewTopRow}>
                          <Text variant="caption" style={styles.reviewName} numberOfLines={1}>
                            {name}
                          </Text>
                          <Text variant="captionSm" color="textSecondary">
                            {formatRelativeDate(r.created_at, t)}
                          </Text>
                        </View>
                        {renderReviewStars(r.rating)}
                        {r.comment ? (
                          <>
                            <Text
                              variant="caption"
                              color="textSecondary"
                              style={styles.reviewComment}
                              numberOfLines={3}
                            >
                              {r.comment}
                            </Text>
                            {hasLongComment ? (
                              <Text variant="captionSm" style={styles.reviewReadMore}>
                                {t('profile.publicProfile.readMoreReview')}
                              </Text>
                            ) : null}
                          </>
                        ) : (
                          <Text variant="captionSm" color="textSecondary" style={styles.reviewComment}>
                            {t('profile.publicProfile.reviewNoComment')}
                          </Text>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        )}

        <View style={{ height: 28 }} />
      </ScrollView>

      <OwnerListingBottomSheet
        visible={!!closetOwnerMenuListing}
        onClose={() => setClosetOwnerMenuListing(null)}
        onEdit={() => {
          if (closetOwnerMenuListing) {
            router.push({
              pathname: `/tabs/profile/edit-listing/${closetOwnerMenuListing.id}`,
              params: {
                return_to: 'public-profile',
                return_user_id: profile?.id ?? userIdParam,
                profile_return_to: returnCtx.return_to,
                return_query: returnCtx.return_query,
                return_search_tab: returnCtx.return_search_tab
              }
            } as any);
          }
        }}
        onDeleteConfirmed={async () => {
          if (!closetOwnerMenuListing) return;
          await handleDeleteClosetListing(closetOwnerMenuListing.id);
        }}
        onDeactivateListing={
          String(closetOwnerMenuListing?.status ?? '').toLowerCase() === 'draft'
            ? undefined
            : handleDeactivateClosetListing
        }
        activeListingId={closetOwnerMenuListing?.id ?? null}
        listingStatus={closetOwnerMenuListing?.status ?? null}
        onRequestPermanentDeleteDraft={handlePermanentDeleteDraftRequest}
      />
      <BoostDurationSheet
        visible={boostSheet != null}
        sponsorType={boostSheet?.sponsorType ?? 'listing'}
        paying={boostPaying}
        onClose={() => {
          if (!boostPaying) setBoostSheet(null);
        }}
        onConfirm={handleBoostConfirm}
      />

      <Modal
        visible={profilePhotoZoomUri != null}
        animationType="fade"
        transparent
        presentationStyle="fullScreen"
        onRequestClose={() => setProfilePhotoZoomUri(null)}
      >
        <SafeAreaView style={styles.photoZoomModalContainer}>
          <View style={[styles.photoZoomModalHeader, { top: insets.top + 8 }]}>
            <TouchableOpacity
              style={styles.photoZoomCloseButton}
              onPress={() => setProfilePhotoZoomUri(null)}
              activeOpacity={0.8}
            >
              <Text variant="body" color="appleBlack" style={styles.photoZoomCloseText}>
                {t('common.close')}
              </Text>
            </TouchableOpacity>
          </View>

          <View
            style={styles.photoZoomImageContainer}
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout;
              if (width > 0 && height > 0) {
                setProfilePhotoZoomLayout({ width, height });
              }
            }}
          >
            {profilePhotoZoomUri ? (
              <ZoomableImage
                uri={profilePhotoZoomUri}
                width={profilePhotoZoomLayout.width}
                height={profilePhotoZoomLayout.height}
                maxScale={4}
              />
            ) : null}
          </View>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={selectedReview != null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedReview(null)}
      >
        <View style={styles.reviewDetailRoot} pointerEvents="box-none">
          <Pressable
            style={styles.reviewDetailBackdrop}
            onPress={() => setSelectedReview(null)}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          />
          <View
            style={[styles.reviewDetailSheet, { paddingBottom: Math.max(getSafeBottomInset(insets.bottom), 16) }]}
            accessibilityViewIsModal
          >
            <View style={styles.reviewDetailHandleZone}>
              <View style={styles.reviewDetailHandle} />
            </View>
            <Text variant="h3" style={styles.reviewDetailTitle}>
              {t('profile.publicProfile.reviewDetailTitle')}
            </Text>
            {selectedReview ? (
              <ScrollView
                style={styles.reviewDetailScroll}
                bounces={false}
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled"
              >
                {(() => {
                  const reviewer = reviewersById[selectedReview.reviewer_id];
                  const name = reviewer?.display_name ?? 'User';
                  const avatar = reviewer?.avatar_url ?? null;
                  return (
                    <View style={styles.reviewDetailContent}>
                      <View style={styles.reviewDetailHeader}>
                        {avatar ? (
                          <Image source={{ uri: avatar }} style={styles.reviewDetailAvatar} />
                        ) : (
                          <View style={styles.reviewDetailAvatarPlaceholder} />
                        )}
                        <View style={styles.reviewDetailHeaderText}>
                          <Text variant="body" style={styles.reviewDetailName}>
                            {name}
                          </Text>
                          <Text variant="captionSm" color="textSecondary">
                            {formatRelativeDate(selectedReview.created_at, t)}
                          </Text>
                        </View>
                      </View>
                      {renderReviewStars(selectedReview.rating)}
                      <Text variant="body" color="textSecondary" style={styles.reviewDetailComment}>
                        {selectedReview.comment?.trim()
                          ? selectedReview.comment
                          : t('profile.publicProfile.reviewNoComment')}
                      </Text>
                    </View>
                  );
                })()}
              </ScrollView>
            ) : null}
            <Pressable
              style={({ pressed }) => [styles.reviewDetailCloseButton, pressed && styles.reviewDetailClosePressed]}
              onPress={() => setSelectedReview(null)}
              accessibilityRole="button"
            >
              <Text variant="body" style={styles.reviewDetailCloseLabel}>
                {t('common.close')}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {renderSafetyModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background
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
    fontFamily: theme.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    flex: 1,
    textAlign: 'center'
  },
  iconTouch: {
    // style hook for touch container composition
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 72,
    justifyContent: 'flex-end'
  },
  headerSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5E5'
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    paddingTop: 0
  },
  photoZoomModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)'
  },
  photoZoomModalHeader: {
    position: 'absolute',
    right: 16,
    zIndex: 10
  },
  photoZoomCloseButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF'
  },
  photoZoomCloseText: {
    fontSize: 15,
    fontWeight: '500'
  },
  photoZoomImageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16
  },
  coverWrap: {
    height: COVER_HEIGHT,
    width: '100%',
    backgroundColor: '#F0F0F0'
  },
  coverImage: {
    width: '100%',
    height: COVER_HEIGHT,
    resizeMode: 'cover'
  },
  coverPlaceholder: {
    width: '100%',
    height: COVER_HEIGHT,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center'
  },
  coverPlaceholderText: {
    color: theme.colors.textSecondary
  },
  coverEditButton: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5E5'
  },
  coverEditButtonPressed: {
    opacity: 0.75
  },
  coverEditButtonText: {
    color: '#000000',
    fontFamily: theme.fontFamily.semiBold
  },
  profileBlock: {
    marginTop: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  avatar: {
    width: PROFILE_AVATAR_SIZE,
    height: PROFILE_AVATAR_SIZE,
    borderRadius: PROFILE_AVATAR_SIZE / 2,
    borderWidth: 2,
    borderColor: theme.colors.googleWhite,
    backgroundColor: theme.colors.muted,
    marginTop: 0
  },
  avatarPlaceholder: {
    width: PROFILE_AVATAR_SIZE,
    height: PROFILE_AVATAR_SIZE,
    borderRadius: PROFILE_AVATAR_SIZE / 2,
    borderWidth: 2,
    borderColor: theme.colors.googleWhite,
    backgroundColor: theme.colors.muted,
    marginTop: 0
  },
  nameAndRating: {
    flex: 1,
    paddingLeft: PROFILE_TEXT_LEFT_GAP
  },
  username: {
    fontSize: 15,
    fontFamily: theme.fontFamily.bold,
    color: theme.colors.appleBlack,
    flexShrink: 1
  },
  usernameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
    flex: 1
  },
  profileInfluencerBadge: {
    flexShrink: 0
  },
  ratingRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  ratingValue: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontFamily: theme.fontFamily.semiBold
  },
  reviewsCountText: {
    fontSize: 13
  },
  followButton: {
    minWidth: 86,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: 'flex-start'
  },
  followPill: {
    backgroundColor: LIME
  },
  followingButton: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.primary
  },
  editButton: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  followButtonText: {
    color: theme.colors.appleBlack,
    fontFamily: theme.fontFamily.semiBold,
    fontSize: 14
  },
  followingText: {
    color: theme.colors.textPrimary
  },
  secondaryInfo: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  secondaryLeft: {
    flex: 1,
    // Même écart horizontal que l’espace avatar → texte du bloc profil
    paddingLeft: PROFILE_TEXT_LEFT_GAP
  },
  secondaryLine: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6
  },
  secondaryText: {
    fontSize: 13,
    color: '#888888'
  },
  limeNumber: {
    fontSize: 13,
    color: LIME,
    fontFamily: theme.fontFamily.semiBold
  },
  messageButton: {
    borderRadius: 20,
    paddingHorizontal: 26,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.background
  },
  messageButtonText: {
    color: theme.colors.textPrimary,
    fontFamily: theme.fontFamily.semiBold
  },
  fineSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5E5'
  },
  tabsRow: {
    flexDirection: 'row',
    width: '100%'
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    position: 'relative'
  },
  tabLeft: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#E5E5E5'
  },
  tabTextActive: {
    fontSize: 15,
    fontFamily: theme.fontFamily.semiBold,
    color: theme.colors.textPrimary
  },
  tabTextInactive: {
    fontSize: 15,
    fontFamily: theme.fontFamily.regular,
    color: '#AAAAAA'
  },
  tabUnderline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: LIME,
    borderRadius: 0
  },
  tabContent: {
    paddingTop: 10
  },
  sectionMeta: {
    paddingHorizontal: theme.spacing.screenPaddingX,
    marginBottom: 10
  },
  closetMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.screenPaddingX,
    marginBottom: 10,
    gap: 8
  },
  closetCountText: {
    flexShrink: 1
  },
  sponsorDressingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BOOST_GREEN,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexShrink: 0
  },
  sponsorDressingButtonText: {
    color: theme.colors.appleBlack,
    fontFamily: theme.fontFamily.semiBold,
    fontSize: 11,
    maxWidth: 148
  },
  boostCardButton: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BOOST_GREEN,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 8
  },
  boostCardButtonText: {
    color: theme.colors.appleBlack,
    fontFamily: theme.fontFamily.semiBold,
    fontSize: 12
  },
  gridContent: {
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingBottom: 10
  },
  gridRow: {
    gap: 8
  },
  gridItem: {
    flex: 1,
    marginBottom: 8
  },
  closetCardWrap: {
    position: 'relative'
  },
  closetMenuBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 10,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border
  },
  closetMenuBtnText: {
    fontWeight: '700',
    color: theme.colors.textPrimary,
    letterSpacing: 0.5
  },
  loadingMore: {
    paddingVertical: 16
  },
  skeletonLine: {
    height: 14,
    borderRadius: 8,
    backgroundColor: theme.colors.muted
  },
  skeletonGrid: {
    paddingHorizontal: theme.spacing.screenPaddingX,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  skeletonCard: {
    width: '48%',
    height: 210,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.muted
  },
  reviewsLoading: {
    paddingVertical: 18,
    alignItems: 'center'
  },
  emptyReviews: {
    paddingVertical: 40,
    alignItems: 'center'
  },
  reviewsList: {
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingBottom: 12
  },
  reviewRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border
  },
  reviewRowPressed: {
    opacity: 0.72
  },
  reviewAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.muted
  },
  reviewAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.muted
  },
  reviewBody: {
    flex: 1
  },
  reviewTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10
  },
  reviewName: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontFamily: theme.fontFamily.semiBold
  },
  reviewStarsRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 4
  },
  reviewComment: {
    marginTop: 6
  },
  reviewReadMore: {
    marginTop: 4,
    color: theme.colors.primary,
    fontFamily: theme.fontFamily.semiBold
  },
  reviewDetailRoot: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  reviewDetailBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)'
  },
  reviewDetailSheet: {
    maxHeight: '78%',
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingTop: 8
  },
  reviewDetailHandleZone: {
    alignItems: 'center',
    paddingVertical: 8
  },
  reviewDetailHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border
  },
  reviewDetailTitle: {
    marginBottom: 12
  },
  reviewDetailScroll: {
    flexGrow: 0
  },
  reviewDetailContent: {
    paddingBottom: 8
  },
  reviewDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10
  },
  reviewDetailAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.muted
  },
  reviewDetailAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.muted
  },
  reviewDetailHeaderText: {
    flex: 1,
    gap: 2
  },
  reviewDetailName: {
    fontFamily: theme.fontFamily.semiBold
  },
  reviewDetailComment: {
    marginTop: 12,
    lineHeight: 22
  },
  reviewDetailCloseButton: {
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border
  },
  reviewDetailClosePressed: {
    opacity: 0.7
  },
  reviewDetailCloseLabel: {
    fontFamily: theme.fontFamily.semiBold
  }
});

