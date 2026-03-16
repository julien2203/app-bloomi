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
  const conditionLabelMap: Record<string, string> = {
    new: 'New with tags',
    like_new: 'New without tags',
    good: 'Very good',
    fair: 'Good',
    poor: 'Satisfactory'
  };

  const formattedPrice = `${price.toFixed(2)} ${currency}`;
  const formattedPriceIncl = `${(price * 1.08).toFixed(2)} ${currency} incl.`;
  const conditionLabel = condition ? conditionLabelMap[condition] ?? condition : undefined;

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
        {/* Ligne prix */}
        <View style={styles.priceRow}>
          <Text variant="captionSm" style={styles.priceMain}>
            {formattedPrice}
          </Text>
          <Text variant="captionSm" color="danger">
            {formattedPriceIncl}
          </Text>
        </View>

        {/* Titre */}
        {title && (
          <Text variant="captionSm" numberOfLines={1} style={styles.title}>
            {title}
          </Text>
        )}

        {/* Marque sous le titre */}
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

        {/* Ligne état (gauche) / like (droite) */}
        <View style={styles.conditionRow}>
          {conditionLabel ? (
            <Text
              variant="captionSm"
              color="textSecondary"
              numberOfLines={1}
            >
              {conditionLabel}
            </Text>
          ) : (
            <View />
          )}

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

const IMAGE_HEIGHT = 168; // image un peu plus haute
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
  title: {
    marginBottom: 4
  },
  priceMain: {
    fontFamily: theme.fontFamily.semiBold
  },
  conditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4
  },
  likes: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4
  }
});

