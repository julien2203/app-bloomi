import React, { useMemo, useState } from 'react';
import {
  Dimensions,
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle
} from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '../lib/theme';
import { Text } from './ui/Text';
import { AppIcon } from './ui/AppIcon';
import { InfluencerBadge } from './InfluencerBadge';
import { useAuthStore } from '../stores/authStore';
import { likeListing, unlikeListing } from '../lib/api';
import { useLikesStore } from '../stores/likesStore';

interface ProductCardProps {
  listingId: string;
  /** When it matches the signed-in user, the like control is read-only (your own listing). */
  sellerId?: string | null;
  sellerName?: string | null;
  sellerAvatarUrl?: string | null;
  sellerIsInfluencer?: boolean;
  title?: string;
  price: number;
  currency?: 'CHF';
  brand?: string;
  size?: string;
  condition?: string;
  imageUrl?: string | null;
  likedCount?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Largeur de card (sinon calculée pour une grille 2 colonnes) */
  cardWidth?: number;
  /** Hauteur image = width * ratio (ex: 1.0 ou 1.2) */
  imageRatio?: number;
}

export function ProductCard({
  listingId,
  sellerId = null,
  sellerName = null,
  sellerAvatarUrl = null,
  sellerIsInfluencer = false,
  title,
  price,
  currency = 'CHF',
  brand,
  size,
  condition,
  imageUrl,
  likedCount = 0,
  onPress,
  style,
  cardWidth,
  imageRatio = 1
}: ProductCardProps) {
  const router = useRouter();
  const { user } = useAuthStore();

  const isOwnListing = useMemo(
    () => Boolean(user?.id && sellerId && user.id === sellerId),
    [user?.id, sellerId]
  );

  const [toggling, setToggling] = useState<boolean>(false);
  const likedByMe = useLikesStore((s) => !!s.likedIds[listingId]);
  const likesCount = useLikesStore((s) => s.countsByListingId[listingId] ?? likedCount);
  const likeOptimistic = useLikesStore((s) => s.likeOptimistic);
  const unlikeOptimistic = useLikesStore((s) => s.unlikeOptimistic);
  const rollback = useLikesStore((s) => s.rollback);

  const formattedPrice = `${price.toFixed(2)} ${currency}`;
  const formattedPriceIncl = `${(price * 1.08).toFixed(2)} ${currency} incl.`;
  const sellerDisplayName = (sellerName ?? '').trim();
  const sellerInitial = sellerDisplayName ? sellerDisplayName[0]!.toUpperCase() : '';

  const heartIcon = useMemo(() => {
    if (likedByMe) return { name: 'likeHeartBold' as const, color: theme.colors.primary };
    return { name: 'likeHeartOutline' as const, color: theme.colors.textSecondary };
  }, [likedByMe]);

  const handleToggleLike = async () => {
    if (toggling) return;
    if (isOwnListing) return;
    if (!user) {
      router.push('/auth/login');
      return;
    }

    const snapshot = likedByMe ? unlikeOptimistic(listingId) : likeOptimistic(listingId);
    setToggling(true);

    try {
      const res = snapshot.prevLiked
        ? await unlikeListing(listingId)
        : await likeListing(listingId);
      if (res.error) {
        rollback(listingId, snapshot.prevLiked, snapshot.prevCount);
      }
    } catch {
      rollback(listingId, snapshot.prevLiked, snapshot.prevCount);
    } finally {
      setToggling(false);
    }
  };

  const effectiveWidth = useMemo(() => {
    if (typeof cardWidth === 'number' && Number.isFinite(cardWidth) && cardWidth > 0) return cardWidth;
    const { width } = Dimensions.get('window');
    const padding = 16;
    const gap = 12;
    return (width - padding * 2 - gap) / 2;
  }, [cardWidth]);

  const effectiveImageHeight = useMemo(() => {
    const r = typeof imageRatio === 'number' && Number.isFinite(imageRatio) && imageRatio > 0 ? imageRatio : 1;
    return Math.round(effectiveWidth * r);
  }, [effectiveWidth, imageRatio]);

  return (
    <TouchableOpacity
      style={[styles.container, { width: effectiveWidth }, style]}
      activeOpacity={0.85}
      onPress={onPress}
    >
      {imageUrl ? (
        <View style={[styles.imageContainer, styles.imageFrame, { height: effectiveImageHeight }]}>
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
          <View style={styles.imageOverlayTopRight}>
            {isOwnListing ? (
              <View style={styles.likeOverlayButton}>
                <AppIcon name="likeHeartOutline" size={16} color={theme.colors.googleWhite} />
              </View>
            ) : (
              <TouchableOpacity
                style={styles.likeOverlayButton}
                activeOpacity={0.8}
                onPress={handleToggleLike}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                disabled={toggling}
              >
                <AppIcon
                  name={heartIcon.name}
                  size={16}
                  color={likedByMe ? '#C3EA4F' : theme.colors.googleWhite}
                />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.imageOverlayBottomLeft}>
            <View style={styles.sellerOverlayRow}>
              {sellerAvatarUrl ? (
                <Image source={{ uri: sellerAvatarUrl }} style={styles.sellerAvatar} resizeMode="cover" />
              ) : (
                <View style={[styles.sellerAvatar, styles.sellerAvatarFallback]}>
                  <Text variant="captionSm" style={styles.sellerAvatarInitials}>
                    {sellerInitial}
                  </Text>
                </View>
              )}
              {sellerIsInfluencer ? (
                <View style={styles.sellerNameBadgeRow}>
                  <InfluencerBadge size={13} />
                </View>
              ) : null}
            </View>
          </View>
        </View>
      ) : (
        <View style={[styles.imageContainer, { height: effectiveImageHeight }]}>
          <Text variant="caption" color="textSecondary">
            Pas d&apos;image
          </Text>
        </View>
      )}

      <View style={styles.body}>
        {/* Titre */}
        {title && (
          <Text variant="captionSm" numberOfLines={1} ellipsizeMode="tail" style={styles.title}>
            {title}
          </Text>
        )}

        {/* Marque + taille sur la même ligne */}
        {(brand || size) && (
          <Text
            variant="captionSm"
            color="textSecondary"
            numberOfLines={1}
            ellipsizeMode="tail"
            style={styles.meta}
          >
            {[brand ?? null, size ?? null]
              .filter((x) => !!x && String(x).trim().length > 0)
              .join(' · ')}
          </Text>
        )}

        {/* Prix */}
        <View style={styles.priceBlock}>
          <Text variant="captionSm" style={styles.priceMain} numberOfLines={1} ellipsizeMode="tail">
            {formattedPrice}
          </Text>
          <Text
            variant="captionSm"
            color="primary"
            style={styles.priceIncl}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {formattedPriceIncl}
          </Text>
        </View>

      </View>
    </TouchableOpacity>
  );
}

const RADIUS = 8;

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    overflow: 'hidden'
  },
  imageContainer: {
    width: '100%',
    borderTopLeftRadius: RADIUS,
    borderTopRightRadius: RADIUS,
    backgroundColor: theme.colors.muted,
    alignItems: 'center',
    justifyContent: 'center'
  },
  imageFrame: {
    overflow: 'hidden',
    backgroundColor: '#F5F5F5'
  },
  image: {
    width: '100%',
    height: '100%'
  },
  imageOverlayTopRight: {
    position: 'absolute',
    top: 8,
    right: 8
  },
  imageOverlayBottomLeft: {
    position: 'absolute',
    left: 8,
    top: 8,
    right: 8
  },
  likeOverlayButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
    padding: 4
  },
  sellerOverlayRow: {
    alignItems: 'flex-start'
  },
  sellerNameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    maxWidth: '100%'
  },
  sellerNameFlex: {
    flexShrink: 1
  },
  sellerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.googleWhite
  },
  sellerAvatarFallback: {
    backgroundColor: '#E5E5E5',
    alignItems: 'center',
    justifyContent: 'center'
  },
  sellerAvatarInitials: {
    color: '#000000',
    fontFamily: theme.fontFamily.semiBold
  },
  sellerNameOverlay: {
    marginTop: 4,
    color: theme.colors.googleWhite,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2
  },
  body: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    flex: 1,
    minWidth: 0
  },
  priceBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    marginBottom: 4,
    columnGap: 6
  },
  priceIncl: {
    flexShrink: 1,
    textAlign: 'right',
    color: '#C3EA4F',
    fontFamily: theme.fontFamily.semiBold
  },
  meta: {
    marginBottom: 4
  },
  title: {
    marginBottom: 4,
    alignSelf: 'stretch'
  },
  priceMain: {
    fontFamily: theme.fontFamily.semiBold,
    color: '#171819',
    flexShrink: 0
  },
  
});

