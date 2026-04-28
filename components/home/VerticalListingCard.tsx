import React from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../lib/theme';
import type { FeedListing } from '../../lib/api';
import { Text } from '../ui/Text';

interface VerticalListingCardProps {
  item: FeedListing;
  onPress: () => void;
  onPressSeller?: () => void;
}

export function VerticalListingCard({
  item,
  onPress,
  onPressSeller
}: VerticalListingCardProps) {
  const likeCount = 24;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onPressSeller}
          activeOpacity={onPressSeller ? 0.85 : 1}
          disabled={!onPressSeller}
          style={styles.sellerChip}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {item.seller_avatar_url ? (
            <Image source={{ uri: item.seller_avatar_url }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar} />
          )}
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {item.seller_display_name ?? 'Vendeur'}
          </Text>
        </TouchableOpacity>
      </View>
      {item.cover_photo_url ? (
        <View style={[styles.imageContainer, styles.imageFrame]}>
          <Image source={{ uri: item.cover_photo_url }} style={styles.image} resizeMode="cover" />
        </View>
      ) : (
        <View style={styles.imageContainer}>
          <Text variant="caption" color="textSecondary">
            Pas d&apos;image
          </Text>
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.priceRow}>
          <Text variant="button" style={styles.priceMain}>
            {Math.round(item.price)} CHF
          </Text>
          <View style={styles.likes}>
            <Ionicons name="heart-outline" size={14} color={theme.colors.textSecondary} />
            <Text variant="caption" color="textSecondary">
              {likeCount}
            </Text>
          </View>
        </View>
        <Text variant="body" numberOfLines={2}>
          {item.title}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const IMAGE_HEIGHT = 150;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.background,
    marginBottom: theme.spacing.gapMd,
    overflow: 'hidden',
    ...theme.shadows.card
  },
  header: {
    paddingHorizontal: theme.spacing.gapSm,
    paddingTop: theme.spacing.gapSm
  },
  sellerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: theme.spacing.gapSm
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.muted
  },
  avatarImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.muted
  },
  imageContainer: {
    width: '100%',
    height: IMAGE_HEIGHT,
    backgroundColor: theme.colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.gapSm
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
    paddingHorizontal: theme.spacing.gapSm,
    paddingVertical: theme.spacing.gapSm
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
  likes: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: theme.spacing.gapSm / 2
  }
});

