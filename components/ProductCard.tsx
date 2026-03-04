import React from 'react';
import {
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle
} from 'react-native';
import { theme } from '../lib/theme';
import { Text } from './ui/Text';
import { AppIcon } from './ui/AppIcon';

interface ProductCardProps {
  title?: string;
  price: number;
  currency?: 'CHF';
  brand?: string;
  condition?: string;
  imageUrl?: string | null;
  likedCount?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function ProductCard({
  title,
  price,
  currency = 'CHF',
  brand,
  condition,
  imageUrl,
  likedCount = 0,
  onPress,
  style
}: ProductCardProps) {
  const formattedPrice = `${price.toFixed(2)} ${currency}`;
  const formattedPriceIncl = `${(price * 1.08).toFixed(2)} ${currency} incl.`;

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      activeOpacity={0.85}
      onPress={onPress}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.image}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Text variant="caption" color="textSecondary">
            Pas d&apos;image
          </Text>
        </View>
      )}

      <View style={styles.body}>
        <View style={styles.priceRow}>
          <Text variant="captionSm" style={styles.priceMain}>
            {formattedPrice}
          </Text>
          <Text variant="captionSm" color="danger">
            {formattedPriceIncl}
          </Text>
        </View>

        {brand && (
          <Text
            variant="captionSm"
            color="textSecondary"
            numberOfLines={1}
            style={styles.meta}
          >
            {brand}
          </Text>
        )}

        {condition && (
          <Text
            variant="captionSm"
            color="textSecondary"
            numberOfLines={1}
            style={styles.meta}
          >
            {condition}
          </Text>
        )}

        <View style={styles.footer}>
          <View style={styles.titleContainer}>
            {title && (
              <Text variant="captionSm" numberOfLines={1}>
                {title}
              </Text>
            )}
          </View>
          <View style={styles.likes}>
            <AppIcon
              name="likeHeartOutline"
              size={16}
              color={theme.colors.textSecondary}
            />
            <Text variant="captionSm" color="textSecondary">
              {likedCount}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const IMAGE_HEIGHT = 144; // ~60% de la carte
const RADIUS = 8;

const styles = StyleSheet.create({
  container: {
    height: 240,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    overflow: 'hidden'
  },
  image: {
    width: '100%',
    height: IMAGE_HEIGHT,
    borderTopLeftRadius: RADIUS,
    borderTopRightRadius: RADIUS,
    backgroundColor: theme.colors.muted
  },
  imagePlaceholder: {
    width: '100%',
    height: IMAGE_HEIGHT,
    borderTopLeftRadius: RADIUS,
    borderTopRightRadius: RADIUS,
    backgroundColor: theme.colors.muted,
    alignItems: 'center',
    justifyContent: 'center'
  },
  body: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    flex: 1
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  meta: {
    marginBottom: 4
  },
  priceMain: {
    fontFamily: theme.fontFamily.semiBold
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4
  },
  titleContainer: {
    flex: 1,
    marginRight: 4
  },
  likes: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4
  }
});

