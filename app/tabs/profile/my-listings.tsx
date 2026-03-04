import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  View,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { theme } from '../../../lib/theme';
import { ListingCard } from '../../../components/ListingCard';
import { Button } from '../../../components/ui/Button';
import { getMyListings, deleteListing, type FeedListing } from '../../../lib/api';
import type { Listing } from '../../../lib/types';

export default function MyListingsScreen() {
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadListings = useCallback(async () => {
    try {
      setError(null);
      const { data, error: apiError } = await getMyListings();

      if (apiError) {
        setError(apiError);
        setListings([]);
      } else {
        setListings(data ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erreur inconnue'));
      setListings([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadListings();
  }, [loadListings]);

  const handleRefresh = () => {
    setRefreshing(true);
    void loadListings();
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Supprimer l’annonce',
      'Êtes-vous sûr de vouloir supprimer cette annonce ? Cette action est définitive.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingId(id);
              const { error: apiError } = await deleteListing(id);
              if (apiError) {
                Alert.alert('Erreur', apiError.message);
                return;
              }
              setListings((prev) => prev.filter((listing) => listing.id !== id));
            } catch (err) {
              Alert.alert(
                'Erreur',
                err instanceof Error ? err.message : 'Une erreur est survenue lors de la suppression.'
              );
            } finally {
              setDeletingId(null);
            }
          }
        }
      ]
    );
  };

  const handleEdit = (id: string) => {
    router.push(`/tabs/profile/edit-listing/${id}`);
  };

  const toFeedListing = (item: Listing): FeedListing => ({
    id: item.id,
    seller_id: item.seller_id,
    title: item.title,
    description: item.description,
    price: item.price,
    status: item.status,
    category: item.category,
    condition: item.condition,
    delivery_mode: item.delivery_mode,
    city: item.city,
    country_code: item.country_code,
    created_at: item.created_at,
    published_at: item.published_at,
    updated_at: item.updated_at,
    cover_photo_url: null,
    cover_photo_order: null,
    seller_display_name: null,
    seller_avatar_url: null,
    listing_city: item.city ?? '',
    listing_country: item.country_code ?? ''
  });

  const renderItem = ({ item }: { item: Listing }) => {
    const isDeleting = deletingId === item.id;

    return (
      <View style={styles.cardContainer}>
        <ListingCard listing={toFeedListing(item)} />
        <View style={styles.actions}>
          <Button
            title="Edit"
            onPress={() => handleEdit(item.id)}
            variant="google-white"
            style={styles.actionButton}
          />
          <Button
            title={isDeleting ? 'Deleting...' : 'Delete'}
            onPress={() => handleDelete(item.id)}
            variant="facebook-blue"
            style={styles.actionButton}
            disabled={isDeleting}
            loading={isDeleting}
          />
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Chargement de vos annonces...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorTitle}>Erreur de chargement</Text>
          <Text style={styles.errorMessage}>{error.message}</Text>
          <Text style={styles.retryText} onPress={loadListings}>
            Réessayer
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (listings.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.emptyTitle}>Aucune annonce</Text>
          <Text style={styles.emptyMessage}>
            Vous n’avez pas encore créé d’annonce. Rendez-vous dans l’onglet &quot;Vendre&quot; pour en
            ajouter une.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mes annonces</Text>
      </View>
      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgroundWhite
  },
  header: {
    paddingHorizontal: theme.spacing.horizontalPadding,
    paddingTop: 16,
    paddingBottom: 8
  },
  headerTitle: {
    ...theme.typography.h1,
    color: theme.colors.textPrimary
  },
  listContent: {
    paddingHorizontal: theme.spacing.horizontalPadding,
    paddingTop: 8,
    paddingBottom: 16
  },
  cardContainer: {
    marginBottom: 16
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8
  },
  actionButton: {
    minWidth: 100
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
    marginBottom: 8
  },
  errorMessage: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16
  },
  retryText: {
    ...theme.typography.body,
    color: theme.colors.primary,
    fontFamily: theme.fontFamily.semiBold
  },
  emptyTitle: {
    ...theme.typography.h2,
    color: theme.colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center'
  },
  emptyMessage: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center'
  }
});

