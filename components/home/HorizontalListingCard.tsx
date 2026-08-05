import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../lib/theme';
import type { FeedListing } from '../../lib/api';
import { Text } from '../ui/Text';
import { useTranslation } from 'react-i18next';
import { computeBuyerDisplayPriceChf, formatCatalogPriceChf } from '../../lib/formatBuyerPrice';
import { ListingCoverImage } from '../ui/ListingCoverImage';

interface HorizontalListingCardProps {
  item: FeedListing;
  onPress: () => void;
  onPressSeller?: () => void;
}

const CARD_WIDTH = 220;
const IMAGE_HEIGHT = 120;

export function HorizontalListingCard({
  item,
  onPress,
  onPressSeller
}: HorizontalListingCardProps) {
  const { t } = useTranslation();
  const likeCount = 12;
  const itemPrice = Number(item.price);
  const displayPriceChf =
    itemPrice > 0 && !isNaN(itemPrice) ? computeBuyerDisplayPriceChf(itemPrice) : 0;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.8}>
      {item.cover_photo_url ? (
        <View style={[styles.imageContainer, styles.imageFrame]}>
          <ListingCoverImage
            uri={item.cover_photo_url}
            widthDp={CARD_WIDTH}
            heightDp={IMAGE_HEIGHT}
            recyclingKey={item.id}
          />
        </View>
      ) : (
        <View style={styles.imageContainer}>
          <Text variant="caption" color="textSecondary">
            {t('common.noImage')}
          </Text>
        </View>
      )}
      <View style={styles.body}>
        {onPressSeller ? (
          <TouchableOpacity
            onPress={onPressSeller}
            style={styles.sellerRow}
            activeOpacity={0.85}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text variant="caption" color="textSecondary" numberOfLines={1}>
              {item.seller_display_name ?? 'Vendeur'}
            </Text>
          </TouchableOpacity>
        ) : null}
        <View style={styles.priceRow}>
          <Text variant="button" style={styles.priceMain}>
            {formatCatalogPriceChf(displayPriceChf)}
          </Text>
        </View>
        <Text variant="caption" color="textSecondary" numberOfLines={1}>
          {item.category ?? 'Marque inconnue'} · {item.condition ?? '—'}
        </Text>
        <View style={styles.footer}>
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {item.listing_city}
          </Text>
          <View style={styles.likes}>
            <Ionicons name="heart-outline" size={14} color={theme.colors.textSecondary} />
            <Text variant="caption" color="textSecondary">
              {likeCount}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.background,
    marginRight: theme.spacing.gapMd,
    overflow: 'hidden',
    ...theme.shadows.card
  },
  imageContainer: {
    width: '100%',
    height: IMAGE_HEIGHT,
    backgroundColor: theme.colors.muted,
    alignItems: 'center',
    justifyContent: 'center'
  },
  imageFrame: {
    overflow: 'hidden',
    backgroundColor: '#F5F5F5'
  },
  body: {
    paddingHorizontal: theme.spacing.gapMd,
    paddingVertical: theme.spacing.gapSm
  },
  sellerRow: {
    marginBottom: theme.spacing.gapSm / 2
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.gapSm / 2
  },
  priceMain: {
    color: '#171819',
    fontFamily: theme.fontFamily.bold
  },
  priceIncl: {
    color: '#C3EA4F',
    fontFamily: theme.fontFamily.semiBold
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.gapSm
  },
  likes: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: theme.spacing.gapSm / 2
  }
});
