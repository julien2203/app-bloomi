/**
 * Composant ListingCard - Carte d'annonce pour le feed
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '../lib/theme';
import type { FeedListing } from '../lib/api';
import { useTranslation } from 'react-i18next';
import { ListingCoverImage } from './ui/ListingCoverImage';
import { runGuardedNav } from '../lib/navigation/guardedNav';
import { openListingDetail } from '../lib/navigation/openListingDetail';
import { gridCardWidth } from '../lib/cardLayout';
import { computeBuyerDisplayPriceChf, formatCatalogPriceChf } from '../lib/formatBuyerPrice';

const IMAGE_HEIGHT = 200;

interface ListingCardProps {
  listing: FeedListing;
  onPress?: () => void;
}

export function ListingCard({ listing, onPress }: ListingCardProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const cardWidth = gridCardWidth(windowWidth);
  const displayPriceChf = computeBuyerDisplayPriceChf(listing.price);

  const handlePress = () => {
    runGuardedNav(`listing-card:${listing.id}`, () => {
      if (onPress) {
        onPress();
      } else {
        openListingDetail(router, listing.id, {
          return_to: 'feed',
          cover_photo: listing.cover_photo_url,
          detailPathBase: '/tabs/feed',
          imageWidthDp: cardWidth,
          imageHeightDp: IMAGE_HEIGHT
        });
      }
    });
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {listing.cover_photo_url ? (
        <View style={[styles.imageContainer, styles.imageFrame]}>
          <ListingCoverImage
            uri={listing.cover_photo_url}
            widthDp={cardWidth}
            heightDp={IMAGE_HEIGHT}
            recyclingKey={listing.id}
          />
        </View>
      ) : (
        <View style={styles.imageContainer}>
          <Text style={styles.imagePlaceholderText}>{t('common.noImage')}</Text>
        </View>
      )}

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {listing.title}
        </Text>
        <Text style={styles.price}>{formatCatalogPriceChf(displayPriceChf)}</Text>
        {listing.listing_city && (
          <Text style={styles.location} numberOfLines={1}>
            {listing.listing_city}
            {listing.listing_country && `, ${listing.listing_country}`}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.backgroundWhite,
    borderRadius: theme.radius.cardRadius,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  imageContainer: {
    width: '100%',
    height: IMAGE_HEIGHT,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center'
  },
  imageFrame: {
    overflow: 'hidden',
    backgroundColor: '#F5F5F5'
  },
  imagePlaceholderText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary
  },
  content: {
    padding: 16
  },
  title: {
    ...theme.typography.h2,
    color: theme.colors.textPrimary,
    marginBottom: 8
  },
  price: {
    ...theme.typography.body,
    fontFamily: theme.fontFamily.bold,
    color: theme.colors.textPrimary,
    marginBottom: 4
  },
  location: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary
  }
});
