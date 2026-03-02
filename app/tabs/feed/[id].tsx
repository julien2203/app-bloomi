/**
 * Page de détail d'annonce
 * Route dynamique: /tabs/feed/[id]
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { getListingById, type ListingDetail } from '../../../lib/api';
import { Button } from '../../../components/ui/Button';
import { theme } from '../../../lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_SIZE = SCREEN_WIDTH;

export default function ListingDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!id) {
      setError(new Error('ID manquant'));
      setLoading(false);
      return;
    }

    const fetchListing = async () => {
      try {
        setLoading(true);
        setError(null);
        const { data, error: fetchError } = await getListingById(id);

        if (fetchError) {
          setError(fetchError);
          setListing(null);
        } else if (!data) {
          setError(new Error('Annonce introuvable'));
          setListing(null);
        } else {
          setListing(data);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Erreur inconnue'));
        setListing(null);
      } finally {
        setLoading(false);
      }
    };

    fetchListing();
  }, [id]);

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('fr-CH', {
      style: 'currency',
      currency: 'CHF',
      minimumFractionDigits: 0
    }).format(price);
  };

  const handleMessageSeller = () => {
    // TODO: Implémenter la navigation vers la messagerie
    console.log('Message seller:', listing?.seller_id);
  };

  const handleBuyNow = () => {
    // TODO: Implémenter le flux d'achat avec Stripe
    console.log('Buy now:', listing?.id);
  };

  if (loading) {
    return (
      <>
        <StatusBar style="dark" />
        <SafeAreaView style={styles.container}>
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Chargement...</Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  if (error || !listing) {
    return (
      <>
        <StatusBar style="dark" />
        <SafeAreaView style={styles.container}>
          <View style={styles.centerContent}>
            <Text style={styles.errorTitle}>
              {error?.message || 'Annonce introuvable'}
            </Text>
            <Button
              title="Retour"
              onPress={() => router.back()}
              variant="primary-green"
              style={styles.backButton}
            />
          </View>
        </SafeAreaView>
      </>
    );
  }

  const mainPhoto = listing.photos && listing.photos.length > 0 
    ? listing.photos[0] 
    : null;
  const otherPhotos = listing.photos && listing.photos.length > 1
    ? listing.photos.slice(1)
    : [];

  return (
    <>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Image principale */}
          <View style={styles.mainImageContainer}>
            {mainPhoto?.url ? (
              <Image
                source={{ uri: mainPhoto.url }}
                style={styles.mainImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.imagePlaceholderText}>Pas d'image</Text>
              </View>
            )}
          </View>

          {/* Galerie horizontale si plusieurs photos */}
          {otherPhotos.length > 0 && (
            <ScrollView
              horizontal
              style={styles.galleryContainer}
              contentContainerStyle={styles.galleryContent}
              showsHorizontalScrollIndicator={false}
            >
              {otherPhotos.map((photo) => (
                <View key={photo.id} style={styles.galleryItem}>
                  {photo.url ? (
                    <Image
                      source={{ uri: photo.url }}
                      style={styles.galleryImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.galleryPlaceholder}>
                      <Text style={styles.galleryPlaceholderText}>Pas d'image</Text>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          )}

          {/* Contenu */}
          <View style={styles.content}>
            {/* Titre */}
            <Text style={styles.title}>{listing.title}</Text>

            {/* Prix */}
            <Text style={styles.price}>{formatPrice(listing.price)}</Text>

            {/* Ville */}
            {listing.city && (
              <View style={styles.locationContainer}>
                <Text style={styles.location}>{listing.city}</Text>
                {listing.country_code && (
                  <Text style={styles.country}>, {listing.country_code}</Text>
                )}
              </View>
            )}

            {/* Description */}
            {listing.description && (
              <View style={styles.descriptionContainer}>
                <Text style={styles.descriptionLabel}>Description</Text>
                <Text style={styles.description}>{listing.description}</Text>
              </View>
            )}

            {/* Informations supplémentaires */}
            <View style={styles.infoContainer}>
              {listing.condition && (
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>État</Text>
                  <Text style={styles.infoValue}>{listing.condition}</Text>
                </View>
              )}
              {listing.category && (
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Catégorie</Text>
                  <Text style={styles.infoValue}>{listing.category}</Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Boutons en bas */}
        <View style={styles.footer}>
          <Button
            title="Message seller"
            onPress={handleMessageSeller}
            variant="google-white"
            style={styles.messageButton}
          />
          <Button
            title="Buy now"
            onPress={handleBuyNow}
            variant="primary-green"
            disabled={true}
            style={styles.buyButton}
          />
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgroundWhite
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: 100
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.horizontalPadding
  },
  loadingText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginTop: 16
  },
  errorTitle: {
    ...theme.typography.h2,
    color: theme.colors.textPrimary,
    marginBottom: 24,
    textAlign: 'center'
  },
  backButton: {
    marginTop: 16
  },
  mainImageContainer: {
    width: SCREEN_WIDTH,
    height: IMAGE_SIZE,
    backgroundColor: '#f3f4f6'
  },
  mainImage: {
    width: '100%',
    height: '100%'
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6'
  },
  imagePlaceholderText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary
  },
  galleryContainer: {
    maxHeight: 120,
    marginTop: 8
  },
  galleryContent: {
    paddingHorizontal: theme.spacing.horizontalPadding,
    gap: 8
  },
  galleryItem: {
    width: 100,
    height: 100,
    borderRadius: theme.radius.cardRadius,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6'
  },
  galleryImage: {
    width: '100%',
    height: '100%'
  },
  galleryPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6'
  },
  galleryPlaceholderText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    fontSize: 10
  },
  content: {
    paddingHorizontal: theme.spacing.horizontalPadding,
    paddingTop: 24
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.textPrimary,
    marginBottom: 12
  },
  price: {
    ...theme.typography.h2,
    fontFamily: theme.fontFamily.bold,
    color: theme.colors.textPrimary,
    marginBottom: 8
  },
  locationContainer: {
    flexDirection: 'row',
    marginBottom: 24
  },
  location: {
    ...theme.typography.body,
    color: theme.colors.textSecondary
  },
  country: {
    ...theme.typography.body,
    color: theme.colors.textSecondary
  },
  descriptionContainer: {
    marginBottom: 24
  },
  descriptionLabel: {
    ...theme.typography.h3,
    color: theme.colors.textPrimary,
    marginBottom: 8
  },
  description: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    lineHeight: 24
  },
  infoContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24
  },
  infoItem: {
    flex: 1,
    minWidth: '45%'
  },
  infoLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginBottom: 4
  },
  infoValue: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    fontFamily: theme.fontFamily.semiBold
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: theme.spacing.horizontalPadding,
    paddingTop: 16,
    paddingBottom: 32,
    backgroundColor: theme.colors.backgroundWhite,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    flexDirection: 'row',
    gap: 12
  },
  messageButton: {
    flex: 1
  },
  buyButton: {
    flex: 1
  }
});
