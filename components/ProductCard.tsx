import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
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
import { formatCatalogPriceChf, computeBuyerDisplayPriceChf } from '../lib/formatBuyerPrice';
import { translateSizeLabel } from '../lib/sizeI18n';
import { runGuardedNav } from '../lib/navigation/guardedNav';
import { gridCardWidth } from '../lib/cardLayout';

const CARD_TEXT_MAX_FONT_SCALE = 1.25;

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
  const { width: windowWidth } = useWindowDimensions();
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
  const displayPriceChf = useMemo(() => {
    if (!Number.isFinite(safePrice) || safePrice <= 0) return 0;
    return computeBuyerDisplayPriceChf(safePrice);
  }, [safePrice]);
  const displaySize = useMemo(
    () => (size?.trim() ? translateSizeLabel(size, t) : null),
    [size, t]
  );

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
    if (typeof cardWidth === 'number' && Number.isFinite(cardWidth) && cardWidth > 0) {
      return Math.min(cardWidth, windowWidth - 32);
    }
    return gridCardWidth(windowWidth);
  }, [cardWidth, windowWidth]);

  const effectiveImageHeight = useMemo(() => {
    const r = typeof imageRatio === 'number' && Number.isFinite(imageRatio) && imageRatio > 0 ? imageRatio : 1;
    return Math.round(effectiveWidth * r);
  }, [effectiveWidth, imageRatio]);

  const handlePress = useMemo(() => {
    if (!onPress) return undefined;
    return () => runGuardedNav(`product-card:${listingId}`, onPress);
  }, [listingId, onPress]);

  return (
    <TouchableOpacity
      style={[styles.container, { width: effectiveWidth }, style]}
      activeOpacity={0.85}
      onPress={handlePress}
      disabled={!handlePress}
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
          <Text
            variant="captionSm"
            numberOfLines={1}
            ellipsizeMode="tail"
            maxFontSizeMultiplier={CARD_TEXT_MAX_FONT_SCALE}
            style={styles.title}
          >
            {title}
          </Text>
        )}

        {(brand || displaySize) && (
          <Text
            variant="captionSm"
            color="textSecondary"
            numberOfLines={1}
            ellipsizeMode="tail"
            maxFontSizeMultiplier={CARD_TEXT_MAX_FONT_SCALE}
            style={styles.meta}
          >
            {[brand ?? null, displaySize]
              .filter((x) => !!x && String(x).trim().length > 0)
              .join(' · ')}
          </Text>
        )}

        <View style={styles.priceBlock}>
          <Text
            variant="captionSm"
            numberOfLines={1}
            ellipsizeMode="tail"
            maxFontSizeMultiplier={CARD_TEXT_MAX_FONT_SCALE}
            style={styles.price}
          >
            {formatCatalogPriceChf(displayPriceChf)}
          </Text>
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
    alignSelf: 'stretch',
    marginBottom: 4
  },
  meta: {
    marginBottom: 4
  },
  title: {
    marginBottom: 4,
    alignSelf: 'stretch'
  },
  price: {
    color: '#171819',
    fontFamily: theme.fontFamily.semiBold
  }
});
