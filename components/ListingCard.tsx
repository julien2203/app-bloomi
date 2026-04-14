/**
 * Composant ListingCard - Carte d'annonce pour le feed
 */

import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '../lib/theme';
import type { FeedListing } from '../lib/api';

interface ListingCardProps {
  listing: FeedListing;
  onPress?: () => void;
}

export function ListingCard({ listing, onPress }: ListingCardProps) {
  const router = useRouter();

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('fr-CH', {
      style: 'currency',
      currency: 'CHF',
      minimumFractionDigits: 0
    }).format(price);
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/tabs/feed/${listing.id}`);
    }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {listing.cover_photo_url ? (
        <View style={[styles.imageContainer, styles.imageFrame]}>
          <Image
            source={{ uri: listing.cover_photo_url }}
            style={styles.image}
            resizeMode="cover"
          />
        </View>
      ) : (
        <View style={styles.imageContainer}>
          <Text style={styles.imagePlaceholderText}>Pas d'image</Text>
        </View>
      )}

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {listing.title}
        </Text>
        <Text style={styles.price}>{formatPrice(listing.price)}</Text>
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
    height: 200,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center'
  },
  imageFrame: {
    overflow: 'hidden',
    backgroundColor: '#F5F5F5'
  },
  image: {
    width: '100%',
    height: '100%'
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
