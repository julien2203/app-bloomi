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
import { useAuthStore } from '../stores/authStore';
import { likeListing, unlikeListing } from '../lib/api';
import { useLikesStore } from '../stores/likesStore';

interface ProductCardProps {
  listingId: string;
  /** When it matches the signed-in user, the like control is read-only (your own listing). */
  sellerId?: string | null;
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
            color="danger"
            style={styles.priceIncl}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {formattedPriceIncl}
          </Text>
        </View>

        {/* Like — disabled for your own listings */}
        <View style={styles.likesRow}>
          {isOwnListing ? (
            <View style={styles.likes} accessibilityElementsHidden>
              <AppIcon name="likeHeartOutline" size={16} color={theme.colors.textSecondary} />
              <Text variant="captionSm" color="textSecondary">
                {likesCount}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.likes}
              activeOpacity={0.8}
              onPress={handleToggleLike}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              disabled={toggling}
            >
              <AppIcon name={heartIcon.name} size={16} color={heartIcon.color} />
              <Text variant="captionSm" color="textSecondary">
                {likesCount}
              </Text>
            </TouchableOpacity>
          )}
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
  body: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    flex: 1,
    minWidth: 0
  },
  priceBlock: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    marginBottom: 4,
    gap: 2
  },
  priceIncl: {
    flexShrink: 1,
    alignSelf: 'stretch'
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
    flexShrink: 1
  },
  likesRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4
  },
  likes: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
    flexShrink: 0
  },
  
});

