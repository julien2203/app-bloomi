import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { theme } from '../../lib/theme';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { Text } from '../../components/ui/Text';
import { Button } from '../../components/ui/Button';
import type { FeedListing } from '../../lib/api';
import {
  createOrGetThreadForListing,
  deactivateListingToDraft,
  deleteListing,
  getSellerDraftListingsForCloset,
  isListingDeleteBlockedByOrders
} from '../../lib/api';
import { HeaderBackButton } from '../../components/ui/HeaderBackButton';
import { AppIcon } from '../../components/ui/AppIcon';
import { HIT_SLOP_COMFORTABLE, HEADER_ICON_TOUCH_CONTAINER } from '../../lib/touchTargets';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProductCard } from '../../components/ProductCard';
import { InfluencerBadge } from '../../components/InfluencerBadge';
import { OwnerListingBottomSheet } from '../../components/listing/OwnerListingBottomSheet';

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
const STAR_ORANGE = '#F59E0B';
const COVER_HEIGHT = 160;
const PAGE_SIZE = 20;
const COVER_SOURCE = require('../../assets/home/cover-profile.png');
const PROFILE_AVATAR_SIZE = 56;
const PROFILE_TEXT_LEFT_GAP = 10;

function formatRelativeDate(dateString: string | null): string {
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

  if (diffMinutes < 1) return 'Just now';
  if (diffHours < 1) return `${diffMinutes}m ago`;
  if (diffDays < 1) return `${diffHours}h ago`;
  if (diffWeeks < 1) return `${diffDays}d ago`;
  if (diffMonths < 1) return `${diffWeeks}w ago`;
  if (diffYears < 1) return `${diffMonths}mo ago`;
  return `${diffYears}y ago`;
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

function formatTimeAgoEn(dateString: string | null): string {
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

  if (minutes < 1) return 'just now';
  if (hours < 1) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  if (days < 1) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  if (weeks < 1) return `${days} day${days === 1 ? '' : 's'} ago`;
  if (months < 1) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  if (years < 1) return `${months} month${months === 1 ? '' : 's'} ago`;
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

export default function PublicProfileScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const params = useLocalSearchParams<PublicProfileParams>();

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
  const lastLoadMoreScrollYRef = useRef<number>(-1);
  const [closetOwnerMenuListing, setClosetOwnerMenuListing] = useState<FeedListing | null>(null);

  const resolvedUsername = profile?.display_name ?? usernameParam ?? 'Profil';
  const myId = user?.id ?? null;
  const isMe = Boolean(myId && profile?.id && myId === profile.id);

  const ratingValue = useMemo(() => {
    const raw = profile?.average_rating ?? 0;
    const n = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(n) ? n : 0;
  }, [profile?.average_rating]);

  const reviewsCount = useMemo(() => profile?.reviews_count ?? 0, [profile?.reviews_count]);

  const loadProfile = useCallback(async () => {
    if (!userIdParam && !usernameParam) {
      setProfile(null);
      setLoadingInitial(false);
      return;
    }

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

      const p = (data as any as PublicProfile | null) ?? null;
      setProfile(p);

      if (p?.id) {
        // Followers / Following counts
        try {
          const { count: followers } = await supabase
            .from('follows')
            .select('follower_id', { count: 'exact', head: true })
            .eq('following_id', p.id);
          setFollowersCount(followers ?? 0);
        } catch {
          setFollowersCount(0);
        }

        try {
          const { count: following } = await supabase
            .from('follows')
            .select('following_id', { count: 'exact', head: true })
            .eq('follower_id', p.id);
          setFollowingCount(following ?? 0);
        } catch {
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

            setIsFollowing(!!row);
          } catch {
            setIsFollowing(false);
          }
        } else {
          setIsFollowing(false);
        }
      }
    } catch (e) {
      setProfile(null);
      const message =
        e instanceof Error && e.message ? e.message : 'Unable to load this profile.';
      Alert.alert('Error', message);
    } finally {
      setLoadingInitial(false);
    }
  }, [myId, userIdParam, usernameParam]);

  const loadClosetPage = useCallback(
    async (opts?: { reset?: boolean }) => {
      const sellerId = profile?.id ?? null;
      if (!sellerId) return;

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
        const { data, error } = await supabase
          .from('v_feed_listings')
          .select('*')
          .eq('seller_id', sellerId)
          .eq('status', 'published')
          .order('created_at', { ascending: false })
          .range(nextOffset, nextOffset + PAGE_SIZE - 1);

        if (error) throw error;

        const rows = (data || []) as FeedListing[];
        setClosetItems((prev) => (reset ? rows : [...prev, ...rows]));
        setClosetOffset(nextOffset + rows.length);
        setClosetHasMore(rows.length === PAGE_SIZE);

        if (reset && myId && myId === sellerId) {
          const draftRes = await getSellerDraftListingsForCloset(sellerId);
          if (draftRes.error) {
            // eslint-disable-next-line no-console
            console.log('Erreur chargement brouillons:', draftRes.error);
            setClosetDraftItems([]);
          } else {
            setClosetDraftItems(draftRes.data ?? []);
          }
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log('Erreur chargement closet:', e);
      } finally {
        closetLoadingRef.current = false;
        setClosetLoadingMore(false);
      }
    },
    [closetHasMore, closetOffset, profile?.id, myId]
  );

  const loadReviews = useCallback(async () => {
    const reviewedId = profile?.id ?? null;
    if (!reviewedId) return;
    setReviewsLoading(true);
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('id, reviewer_id, rating, comment, created_at')
        .eq('reviewed_id', reviewedId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      const rows = (data || []) as ReviewRow[];
      setReviews(rows);

      const reviewerIds = Array.from(new Set(rows.map((r) => r.reviewer_id).filter(Boolean)));
      if (reviewerIds.length > 0) {
        const { data: profs, error: profErr } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', reviewerIds);
        if (profErr) throw profErr;

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
      // eslint-disable-next-line no-console
      console.log('Erreur chargement reviews:', e);
      setReviews([]);
      setReviewersById({});
    } finally {
      setReviewsLoading(false);
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
    Alert.alert('Options', '', [
      {
        text: 'Report',
        onPress: () => Alert.alert('Thanks', 'Reporting will be available soon.')
      },
      {
        text: 'Block',
        style: 'destructive',
        onPress: () => Alert.alert('Block', 'Blocking will be available soon.')
      },
      { text: 'Cancel', style: 'cancel' }
    ]);
  }, []);

  const onToggleFollow = useCallback(async () => {
    if (!profile?.id) return;
    if (!myId) {
      router.push('/auth/login');
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
        e instanceof Error && e.message ? e.message : 'Unable to update follow status.';
      Alert.alert('Error', message);
    } finally {
      setTogglingFollow(false);
    }
  }, [followersCount, isFollowing, isMe, myId, profile?.id, router, togglingFollow]);

  const onPressMessage = useCallback(() => {
    if (!profile?.id || !myId) {
      router.push('/auth/login');
      return;
    }
    if (isMe) return;

    const firstListing = closetItems[0] ?? null;
    if (!firstListing?.id) {
      Alert.alert(
        'Message',
        'This seller has no active listing to start a conversation from.'
      );
      return;
    }

    void (async () => {
      const { data, error } = await createOrGetThreadForListing(firstListing.id, profile.id);
      if (error || !data) {
        Alert.alert('Error', error ?? 'Unable to create conversation.');
        return;
      }
      router.push({ pathname: '/tabs/messages/[id]', params: { id: data.id } });
    })();
  }, [closetItems, isMe, myId, profile?.id, router]);

  const locationLine = useMemo(() => {
    const loc = (profile as any)?.location ?? null;
    return String(loc ?? '').trim();
  }, [profile]);

  const timeAgo = useMemo(
    () => formatTimeAgoEn(profile?.created_at ?? null),
    [profile?.created_at]
  );

  const closetListData = useMemo(() => {
    if (isMe) return [...closetDraftItems, ...closetItems];
    return closetItems;
  }, [closetDraftItems, closetItems, isMe]);

  const closetCountLabel = useMemo(() => {
    const n = isMe ? closetDraftItems.length + closetItems.length : closetItems.length;
    return `${n} item${n !== 1 ? 's' : ''}`;
  }, [closetDraftItems.length, closetItems.length, isMe]);

  const closetCardWidth = useMemo(() => {
    const { width } = Dimensions.get('window');
    const pad = theme.spacing.screenPaddingX * 2;
    const gap = 8;
    return (width - pad - gap) / 2;
  }, []);

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
        Alert.alert('Suppression impossible', error, [
          { text: 'OK', style: 'cancel' },
          {
            text: "Désactiver l'annonce",
            onPress: () => {
              void (async () => {
                const { error: deactErr } = await deactivateListingToDraft(listingId);
                if (deactErr) {
                  Alert.alert('Erreur', deactErr);
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
      Alert.alert('Error', error);
      throw new Error(error);
    }
  }, []);

  const handleDeactivateClosetListing = useCallback(async () => {
    const listing = closetOwnerMenuListing;
    if (!listing) return;
    const { error } = await deactivateListingToDraft(listing.id);
    if (error) {
      Alert.alert('Erreur', error);
      throw new Error(error);
    }
    setClosetItems((prev) => prev.filter((x) => x.id !== listing.id));
  }, [closetOwnerMenuListing]);

  const handlePermanentDeleteDraftRequest = useCallback((listingId: string) => {
    setClosetOwnerMenuListing(null);
    setTimeout(() => {
      Alert.alert('Cette action est irréversible.', 'Supprimer définitivement ?', [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
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
                Alert.alert('Suppression impossible', error);
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

  const renderClosetItem = useCallback(
    ({ item }: { item: FeedListing }) => (
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
            onPress={() => router.push({ pathname: '/tabs/feed/[id]', params: { id: item.id } })}
            imageRatio={1}
          />
          {isMe ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Listing menu"
              hitSlop={HIT_SLOP_COMFORTABLE}
              style={styles.closetMenuBtn}
              onPress={() => openClosetListingMenu(item)}
            >
              <Text variant="captionSm" style={styles.closetMenuBtnText}>
                •••
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    ),
    [closetCardWidth, isMe, openClosetListingMenu, router]
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

  const headerTitle = resolvedUsername || 'Profil';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header (même layout que les autres écrans) */}
      <View style={styles.header}>
        <HeaderBackButton onPress={() => router.back()} />
        <Text variant="body" style={styles.headerTitle} numberOfLines={1}>
          {headerTitle}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Menu"
          hitSlop={HIT_SLOP_COMFORTABLE}
          onPress={openMenu}
          style={[styles.iconTouch, HEADER_ICON_TOUCH_CONTAINER]}
        >
          <AppIcon name="menuDotsOutline" size={20} color={theme.colors.textPrimary} />
        </Pressable>
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
          <Image source={COVER_SOURCE} style={styles.coverImage} />
        </View>

        {/* Profile block */}
        <View style={styles.profileBlock}>
          <View style={styles.profileLeft}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
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
                  ({reviewsCount} Reviews)
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
              {isMe ? 'Edit profile' : isFollowing ? 'Following' : 'Follow'}
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
                <Text style={styles.secondaryText}> followers, </Text>
                <Text style={styles.limeNumber}>{followingCount}</Text>
                <Text style={styles.secondaryText}> following</Text>
              </Text>
            </View>
          </View>

          {!isMe ? (
            <Pressable onPress={onPressMessage} style={styles.messageButton}>
              <Text variant="caption" style={styles.messageButtonText}>
                Message
              </Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.fineSeparator} />

        {/* Tabs */}
        <View style={styles.tabsRow}>
          <Pressable style={[styles.tab, styles.tabLeft]} onPress={() => setTab('closet')}>
            <Text style={tab === 'closet' ? styles.tabTextActive : styles.tabTextInactive}>
              Closet
            </Text>
            {tab === 'closet' ? <View style={styles.tabUnderline} /> : null}
          </Pressable>

          <Pressable style={styles.tab} onPress={() => setTab('reviews')}>
            <Text style={tab === 'reviews' ? styles.tabTextActive : styles.tabTextInactive}>
              Reviews
            </Text>
            {tab === 'reviews' ? <View style={styles.tabUnderline} /> : null}
          </Pressable>
        </View>
        <View style={styles.fineSeparator} />

        {/* Tab content */}
        {tab === 'closet' ? (
          <View style={styles.tabContent}>
            <Text variant="captionSm" color="textSecondary" style={styles.sectionMeta}>
              {closetCountLabel}
            </Text>

            {loadingInitial && closetListData.length === 0 ? (
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
                  No reviews yet
                </Text>
              </View>
            ) : (
              <View style={styles.reviewsList}>
                {reviews.map((r) => {
                  const reviewer = reviewersById[r.reviewer_id];
                  const name = reviewer?.display_name ?? 'Utilisateur';
                  const avatar = reviewer?.avatar_url ?? null;
                  return (
                    <View key={r.id} style={styles.reviewRow}>
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
                            {formatRelativeDate(r.created_at)}
                          </Text>
                        </View>
                        {renderReviewStars(r.rating)}
                        {r.comment ? (
                          <Text variant="caption" color="textSecondary" style={styles.reviewComment}>
                            {r.comment}
                          </Text>
                        ) : null}
                      </View>
                    </View>
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
            router.push(`/tabs/profile/edit-listing/${closetOwnerMenuListing.id}` as any);
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
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    flex: 1,
    textAlign: 'center'
  },
  iconTouch: {
    // style hook for touch container composition
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
  coverWrap: {
    height: COVER_HEIGHT,
    width: '100%',
    backgroundColor: theme.colors.muted
  },
  coverImage: {
    width: '100%',
    height: COVER_HEIGHT,
    resizeMode: 'cover'
  },
  coverPlaceholder: {
    width: '100%',
    height: COVER_HEIGHT,
    backgroundColor: theme.colors.muted
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
  }
});

