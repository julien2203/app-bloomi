/**
 * Écran Sell - Création d'annonce
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { TextField } from '../../../components/ui/TextField';
import { Button } from '../../../components/ui/Button';
import { theme } from '../../../lib/theme';
import { useAuthStore } from '../../../stores/authStore';
import { createListing, uploadListingPhoto, addListingPhoto } from '../../../lib/api';
import type { ListingInsert } from '../../../lib/types';

type Photo = {
  uri: string;
  type?: string;
  name?: string;
};

export default function SellScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [city, setCity] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    title?: string;
    price?: string;
    city?: string;
    photos?: string;
  }>({});

  const requestPermissions = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission requise',
        'Nous avons besoin de l\'accès à vos photos pour créer une annonce.'
      );
      return false;
    }
    return true;
  };

  const pickImage = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      allowsEditing: false
    });

    if (!result.canceled && result.assets) {
      const newPhotos = result.assets.map((asset) => ({
        uri: asset.uri,
        type: asset.type || 'image/jpeg',
        name: asset.fileName || `photo-${Date.now()}.jpg`
      }));
      setPhotos((prev) => [...prev, ...newPhotos]);
      if (errors.photos) {
        setErrors((prev) => ({ ...prev, photos: undefined }));
      }
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    if (!title.trim()) {
      newErrors.title = 'Le titre est requis';
    }

    const priceNum = parseFloat(price);
    if (!price || isNaN(priceNum) || priceNum <= 0) {
      newErrors.price = 'Un prix valide est requis';
    }

    if (!city.trim()) {
      newErrors.city = 'La ville est requise';
    }

    if (photos.length === 0) {
      newErrors.photos = 'Au moins une photo est requise';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePublish = async () => {
    if (!user) {
      Alert.alert('Erreur', 'Vous devez être connecté pour créer une annonce');
      return;
    }

    if (!validate()) {
      return;
    }

    setLoading(true);

    try {
      // Créer le listing
      const listingData: ListingInsert = {
        seller_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        price: parseFloat(price),
        status: 'published',
        category: null,
        condition: null,
        delivery_mode: 'both',
        city: city.trim(),
        country_code: 'CH',
        latitude: null,
        longitude: null
      };

      const listingResult = await createListing(listingData);

      if (listingResult.error || !listingResult.data) {
        throw new Error(listingResult.error || 'Erreur lors de la création de l\'annonce');
      }

      const listing = listingResult.data;

      // Upload les photos
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        const filename = photo.name || `photo-${i}-${Date.now()}.jpg`;

        const { data: photoUrl, error: uploadError } = await uploadListingPhoto(
          photo,
          user.id,
          listing.id,
          filename
        );

        if (uploadError || !photoUrl) {
          console.error('Erreur upload photo:', uploadError);
          continue; // Continue avec les autres photos même si une échoue
        }

        // Ajouter la photo au listing
        await addListingPhoto(listing.id, photoUrl, i);
      }

      // Rediriger vers le feed
      router.replace('/tabs/feed');
    } catch (error) {
      Alert.alert(
        'Erreur',
        error instanceof Error ? error.message : 'Une erreur est survenue lors de la publication'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Vendre un article</Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Titre */}
          <TextField
            label="Titre *"
            value={title}
            onChangeText={setTitle}
            placeholder="Ex: iPhone 13 Pro - 256GB"
            error={errors.title}
            maxLength={100}
          />

          {/* Description */}
          <TextField
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="Décrivez votre article..."
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            style={styles.descriptionInput}
          />

          {/* Prix */}
          <TextField
            label="Prix (CHF) *"
            value={price}
            onChangeText={(text) => {
              setPrice(text.replace(/[^0-9.]/g, ''));
              if (errors.price) {
                setErrors((prev) => ({ ...prev, price: undefined }));
              }
            }}
            placeholder="0"
            keyboardType="numeric"
            error={errors.price}
          />

          {/* Ville */}
          <TextField
            label="Ville *"
            value={city}
            onChangeText={setCity}
            placeholder="Ex: Genève"
            error={errors.city}
            maxLength={50}
          />

          {/* Photos */}
          <View style={styles.photosSection}>
            <Text style={styles.photosLabel}>Photos *</Text>
            {errors.photos && <Text style={styles.error}>{errors.photos}</Text>}

            <ScrollView
              horizontal
              style={styles.photosContainer}
              contentContainerStyle={styles.photosContent}
              showsHorizontalScrollIndicator={false}
            >
              {photos.map((photo, index) => (
                <View key={index} style={styles.photoItem}>
                  <Image source={{ uri: photo.uri }} style={styles.photo} />
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removePhoto(index)}
                  >
                    <Text style={styles.removeButtonText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity style={styles.addPhotoButton} onPress={pickImage}>
                <Text style={styles.addPhotoText}>+ Ajouter</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </ScrollView>

        {/* Bouton Publish */}
        <View style={styles.footer}>
          <Button
            title={loading ? 'Publication...' : 'Publish'}
            onPress={handlePublish}
            variant="primary-green"
            disabled={loading}
            loading={loading}
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
  header: {
    paddingHorizontal: theme.spacing.horizontalPadding,
    paddingTop: 16,
    paddingBottom: 8
  },
  headerTitle: {
    ...theme.typography.h1,
    color: theme.colors.textPrimary
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.horizontalPadding,
    paddingTop: 16,
    paddingBottom: 100
  },
  descriptionInput: {
    minHeight: 120,
    paddingTop: 14
  },
  photosSection: {
    marginTop: 8,
    marginBottom: 16
  },
  photosLabel: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    marginBottom: 8,
    fontWeight: '500'
  },
  photosContainer: {
    marginTop: 8
  },
  photosContent: {
    gap: 12
  },
  photoItem: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: theme.radius.cardRadius,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6'
  },
  photo: {
    width: '100%',
    height: '100%'
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  removeButtonText: {
    color: theme.colors.googleWhite,
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 20
  },
  addPhotoButton: {
    width: 100,
    height: 100,
    borderRadius: theme.radius.cardRadius,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.googleWhite
  },
  addPhotoText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center'
  },
  error: {
    ...theme.typography.caption,
    color: '#EF4444',
    marginTop: 4
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
    borderTopColor: '#e5e7eb'
  }
});
