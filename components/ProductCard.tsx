import React, { useMemo, useState } from 'react';
import {
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle
} from 'react-native';
import type { ImagePriority } from 'expo-image';
import { useRouter } from 'expo-router';
import { theme } from '../lib/theme';
import { Text } from './ui/Text';
import { AppIcon } from './ui/AppIcon';
import { ListingCoverImage } from './ui/ListingCoverImage';
import { useAuthStore } from '../stores/authStore';
import { likeListing, unlikeListing } from '../lib/api';
import { useLikesStore } from '../stores/likesStore';
import { useTranslation } from 'react-i18next';
import { computeBuyerFees } from '../lib/fees';

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
  /** Priorité de chargement de l'image (visible en premier sur le feed). */
  imagePriority?: ImagePriority;
}

function ProductCardComponent({
  listingId,
  sellerId = null,
  title,
  price,
  currency = 'CHF',
  brand,
  size,
  imageUrl,
  likedCount = 0,
  onPress,
  style,
  cardWidth,
  imageRatio = 1,
  imagePriority = 'normal'
}: ProductCardProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuthStore();

  const isOwnListing = useMemo(
    () => Boolean(user?.id && sellerId && user.id === sellerId),
    [user?.id, sellerId]
  );

  const [toggling, setToggling] = useState<boolean>(false);
  const likedByMe = useLikesStore((s) => !!s.likedIds[listingId]);
  const likeOptimistic = useLikesStore((s) => s.likeOptimistic);
  const unlikeOptimistic = useLikesStore((s) => s.unlikeOptimistic);
  const rollback = useLikesStore((s) => s.rollback);

  const safePrice = Number(price);
  const formattedPrice = `${(Number.isFinite(safePrice) ? safePrice : 0).toFixed(2)} ${currency}`;
  const fees = safePrice > 0 && !isNaN(safePrice) ? computeBuyerFees(safePrice) : null;
  const formattedPriceIncl = fees
    ? `${fees.finalPriceChf.toFixed(2)} ${currency} ${t('feed.pricing.priceIncl')}`
    : null;

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
          <ListingCoverImage
            uri={imageUrl}
            widthDp={effectiveWidth}
            heightDp={effectiveImageHeight}
            recyclingKey={listingId}
            priority={imagePriority}
          />
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
        </View>
      ) : (
        <View style={[styles.imageContainer, { height: effectiveImageHeight }]}>
          <Text variant="caption" color="textSecondary">
            {t('common.noImage')}
          </Text>
        </View>
      )}

      <View style={styles.body}>
        {title && (
          <Text variant="captionSm" numberOfLines={1} ellipsizeMode="tail" style={styles.title}>
            {title}
          </Text>
        )}

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

        <View style={styles.priceBlock}>
          <Text variant="captionSm" style={styles.priceMain} numberOfLines={1} ellipsizeMode="tail">
            {formattedPrice}
          </Text>
          {formattedPriceIncl ? (
            <Text
              variant="captionSm"
              color="primary"
              style={styles.priceIncl}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {formattedPriceIncl}
            </Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export const ProductCard = React.memo(ProductCardComponent);

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
  imageOverlayTopRight: {
    position: 'absolute',
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
  }
});
