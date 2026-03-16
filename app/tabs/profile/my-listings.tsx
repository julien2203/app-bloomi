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
import { Feather } from '@expo/vector-icons';
import { theme } from '../../../lib/theme';
import { ListingCard } from '../../../components/ListingCard';
import { Button } from '../../../components/ui/Button';
import { getMyListingsFeed, deleteListing, type FeedListing } from '../../../lib/api';

export default function MyListingsScreen() {
  const router = useRouter();
  const [listings, setListings] = useState<FeedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadListings = useCallback(async () => {
    try {
      setError(null);
      const { data, error: apiError } = await getMyListingsFeed();

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

  const renderItem = ({ item }: { item: FeedListing }) => {
    const isDeleting = deletingId === item.id;

    return (
      <View style={styles.cardContainer}>
        <ListingCard listing={item} />
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
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
        <Feather name="alert-circle" size={40} color={theme.colors.error} style={styles.errorIcon} />
        <Text style={styles.errorTitle}>Une erreur est survenue</Text>
        <Button
          title="Réessayer"
          onPress={loadListings}
          variant="secondary"
          style={styles.retryButton}
        />
        </View>
      </SafeAreaView>
    );
  }

  if (listings.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
        <Feather name="package" size={48} color={theme.colors.textSecondary} style={styles.emptyIcon} />
        <Text style={styles.emptyTitle}>Vous n'avez pas encore d'annonces</Text>
        <Text style={styles.emptyMessage}>Publiez votre première annonce</Text>
        <Button
          title="Vendre un article"
          onPress={() => router.push('/tabs/sell')}
          variant="primary"
          style={styles.emptyCtaButton}
        />
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
  emptyIcon: {
    marginBottom: 16
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
  errorIcon: {
    marginBottom: 16
  },
  errorMessage: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16
  },
  retryButton: {
    marginTop: 8
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
    textAlign: 'center',
    marginBottom: 16
  },
  emptyCtaButton: {
    marginTop: 8
  }
});

