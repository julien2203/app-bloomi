import React from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../lib/theme';
import type { FeedListing } from '../../lib/api';
import { Text } from '../ui/Text';

interface HorizontalListingCardProps {
  item: FeedListing;
  onPress: () => void;
}

export function HorizontalListingCard({ item, onPress }: HorizontalListingCardProps) {
  const likeCount = 12;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.8}>
      {item.cover_photo_url ? (
        <Image source={{ uri: item.cover_photo_url }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Text variant="caption" color="textSecondary">
            Pas d&apos;image
          </Text>
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.priceRow}>
          <Text variant="button">{Math.round(item.price)} CHF</Text>
          <Text variant="caption" color="danger">
            {Math.round(item.price * 1.08)} CHF incl.
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

const CARD_WIDTH = 220;
const IMAGE_HEIGHT = 120;

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.background,
    marginRight: theme.spacing.gapMd,
    overflow: 'hidden',
    ...theme.shadows.card
  },
  image: {
    width: '100%',
    height: IMAGE_HEIGHT,
    backgroundColor: theme.colors.muted
  },
  imagePlaceholder: {
    width: '100%',
    height: IMAGE_HEIGHT,
    backgroundColor: theme.colors.muted,
    alignItems: 'center',
    justifyContent: 'center'
  },
  body: {
    paddingHorizontal: theme.spacing.gapMd,
    paddingVertical: theme.spacing.gapSm
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.gapSm / 2
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

