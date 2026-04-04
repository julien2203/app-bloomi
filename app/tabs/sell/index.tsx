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
  TextInput,
  Modal
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { Button } from '../../../components/ui/Button';
import { AppIcon } from '../../../components/ui/AppIcon';
import { HeaderBackButton } from '../../../components/ui/HeaderBackButton';
import { theme } from '../../../lib/theme';
import { useAuthStore } from '../../../stores/authStore';
import { createListing, uploadListingPhoto, addListingPhoto } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import { ensureProfileExists } from '../../../lib/profile';
import type { ListingInsert } from '../../../lib/types';
import { useSellFormStore } from '../../../lib/store/sellForm';
import * as Location from 'expo-location';

type Photo = {
  uri: string;
  type?: string;
  name?: string;
};

const TITLE_MAX = 60;
const DESCRIPTION_MAX = 300;

const CONDITION_LABELS: Record<string, string> = {
  new: 'New with tags',
  like_new: 'New without tags',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor'
};

const ALLOWED_COUNTRIES = ['CH', 'FR', 'DE', 'IT'] as const;
type AllowedCountry = (typeof ALLOWED_COUNTRIES)[number];

export default function SellScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { values: sellValues, resetForm } = useSellFormStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [city, setCity] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    title?: string;
    price?: string;
    photos?: string;
  }>({});
  const [showPublishSheet, setShowPublishSheet] = useState(false);
  const [showPhotoTips, setShowPhotoTips] = useState(false);

  React.useEffect(() => {
    const loadCityFromProfile = async () => {
      if (!user) return;
      try {
        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('city')
          .eq('id', user.id)
          .single();

        if (!profileError && data?.city) {
          setCity(data.city);
        } else {
          setCity('');
        }
      } catch {
        setCity('');
      }
    };

    void loadCityFromProfile();
  }, [user]);

  const resolveGeoForListing = async (): Promise<{
    latitude: number | null;
    longitude: number | null;
    city: string | null;
    country_code: AllowedCountry | null;
  }> => {
    // 1) Try GPS
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({});
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        const places = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        const place = places && places.length > 0 ? places[0] : null;

        const cityDetected =
          (place as any)?.city ||
          (place as any)?.subregion ||
          (place as any)?.region ||
          null;
        const iso = String((place as any)?.isoCountryCode ?? '').toUpperCase();

        if (ALLOWED_COUNTRIES.includes(iso as any)) {
          return {
            latitude: Number.isFinite(lat) ? lat : null,
            longitude: Number.isFinite(lng) ? lng : null,
            city: cityDetected ? String(cityDetected) : null,
            country_code: iso as AllowedCountry
          };
        }
      }
    } catch {
      // ignore → fallback below
    }

    // 2) Fallback to profile columns
    try {
      const { data } = await supabase
        .from('profiles')
        .select('city, country, latitude, longitude')
        .eq('id', user?.id ?? '')
        .maybeSingle();

      const rawCountry = String((data as any)?.country ?? '').toUpperCase();
      const cc: AllowedCountry | null = ALLOWED_COUNTRIES.includes(rawCountry as any)
        ? (rawCountry as AllowedCountry)
        : null;

      const lat = (data as any)?.latitude;
      const lng = (data as any)?.longitude;
      const latNum = typeof lat === 'number' ? lat : lat != null ? Number(lat) : null;
      const lngNum = typeof lng === 'number' ? lng : lng != null ? Number(lng) : null;

      return {
        latitude: Number.isFinite(latNum as any) ? (latNum as number) : null,
        longitude: Number.isFinite(lngNum as any) ? (lngNum as number) : null,
        city: (data as any)?.city ? String((data as any).city) : null,
        country_code: cc
      };
    } catch {
      return { latitude: null, longitude: null, city: null, country_code: null };
    }
  };

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

    const priceFromStore =
      typeof sellValues.price === 'number' && Number.isFinite(sellValues.price)
        ? sellValues.price
        : undefined;
    const priceNum = priceFromStore ?? parseFloat(price);
    if (!priceNum || Number.isNaN(priceNum) || priceNum <= 0) {
      newErrors.price = 'Un prix valide est requis';
    }

    if (photos.length === 0) {
      newErrors.photos = 'Au moins une photo est requise';
    }

    setErrors(newErrors);
    const hasErrors = Object.keys(newErrors).length > 0;

    if (hasErrors) {
      const firstError =
        newErrors.title ||
        newErrors.price ||
        newErrors.photos ||
        'Veuillez corriger les champs en rouge';

      Alert.alert('Formulaire incomplet', firstError);
    }

    return !hasErrors;
  };

  const conditionLabel =
    sellValues.condition != null
      ? CONDITION_LABELS[sellValues.condition] ?? sellValues.condition
      : null;

  const colorLabel =
    sellValues.color && sellValues.color.length > 0
      ? sellValues.color.map((c) => c.name).join(', ')
      : null;

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
      // S'assurer que le profil existe pour respecter la contrainte FK listings.seller_id -> profiles.id
      const { data: sessionData } = await supabase.auth.getSession();
      await ensureProfileExists(sessionData.session, {
        // En attendant la vérification SMS réelle, on utilise un numéro de test
        phone: user.phone ?? '+41791234567',
        country: 'CH'
      });

      // Bloquer la publication si le vendeur n'a pas complété Stripe Connect
      const { data: stripeRow, error: stripeErr } = await supabase
        .from('profiles')
        .select('stripe_connect_onboarding_completed')
        .eq('id', user.id)
        .maybeSingle();

      if (stripeErr) {
        throw new Error(stripeErr.message);
      }

      const stripeCompleted = Boolean(
        (stripeRow as { stripe_connect_onboarding_completed?: boolean | null } | null)
          ?.stripe_connect_onboarding_completed
      );

      if (!stripeCompleted) {
        Alert.alert(
          'Activer votre compte vendeur',
          "Avant de publier une annonce, vous devez activer votre compte vendeur pour pouvoir recevoir des paiements.",
          [
            { text: 'Plus tard', style: 'cancel' },
            {
              text: 'Activer mon compte',
              onPress: () => router.push('/tabs/profile/activate-seller-account')
            }
          ]
        );
        return;
      }

      // Créer le listing
      const priceFromStore =
        typeof sellValues.price === 'number' && Number.isFinite(sellValues.price)
          ? sellValues.price
          : undefined;
      const priceNum = priceFromStore ?? parseFloat(price);

      const geo = await resolveGeoForListing();

      const listingData: ListingInsert = {
        seller_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        price: priceNum,
        status: 'published',
        category: sellValues.category?.name ?? null,
        condition: sellValues.condition ?? null,
        brand: sellValues.brand?.name ?? null,
        size: sellValues.size?.label ?? null,
        color:
          sellValues.color && sellValues.color.length > 0
            ? sellValues.color.map((c) => c.name).join(', ')
            : null,
        delivery_mode: 'both',
        city: geo.city ?? (city.trim() ? city.trim() : null),
        country_code: geo.country_code ?? 'CH',
        latitude: geo.latitude,
        longitude: geo.longitude
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
          // On log en warning pour éviter un écran rouge en dev, mais on ne bloque pas la publication
          console.warn('Erreur upload photo (non bloquant):', uploadError);
          continue; // Continue avec les autres photos même si une échoue
        }

        // Ajouter la photo au listing
        await addListingPhoto(listing.id, photoUrl, i);
      }

      // Réinitialiser le formulaire pour la prochaine annonce (store + état local)
      resetForm();
      setTitle('');
      setDescription('');
      setPrice('');
      setPhotos([]);
      setErrors({});

      // Afficher la bottom sheet de mise en avant
      setShowPublishSheet(true);
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
          <HeaderBackButton onPress={() => router.back()} />
          <Text style={styles.headerTitle}>Sell an item</Text>
          <View style={styles.headerRightPlaceholder} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 120 }
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Photos */}
          <View style={styles.photosSection}>
            {errors.photos && <Text style={styles.error}>{errors.photos}</Text>}

            {photos.length === 0 ? (
              <TouchableOpacity
                style={styles.photoUploadButton}
                onPress={pickImage}
                activeOpacity={0.85}
              >
                <AppIcon name="addSquareOutline" size={20} color="#121212" />
                <Text style={styles.photoUploadText}>Upload photos</Text>
              </TouchableOpacity>
            ) : (
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

                <TouchableOpacity
                  style={styles.photoAddTile}
                  onPress={pickImage}
                  activeOpacity={0.85}
                >
                  <Feather name="plus" size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </ScrollView>
            )}

            <Text style={[styles.photoHint, { textAlign: 'center' }]}>
              Add up to 5 photos.{' '}
              <Text
                style={styles.photoHintLink}
                onPress={() => {
                  setShowPhotoTips(true);
                }}
              >
                See photo tips.
              </Text>
            </Text>
          </View>

          <View style={styles.sectionSeparator} />

          {/* Title */}
          <View style={[styles.fieldGroup, { marginTop: 24 }]}>
            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. White cos sweater"
              placeholderTextColor={theme.colors.textSecondary}
              value={title}
              onChangeText={(text) => {
                setTitle(text);
                if (errors.title) {
                  setErrors((prev) => ({ ...prev, title: undefined }));
                }
              }}
              maxLength={TITLE_MAX}
            />
            <View style={styles.fieldFooterRow}>
              {errors.title ? (
                <Text style={styles.error}>{errors.title}</Text>
              ) : (
                <View />
              )}
              <Text style={styles.counterText}>
                {`${TITLE_MAX - title.length} character left`}
              </Text>
            </View>
          </View>

          <View style={styles.sectionSeparator} />

          {/* Description */}
          <View style={[styles.fieldGroup, { marginTop: 20 }]}>
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[
                styles.textInput,
                styles.descriptionInput
              ]}
              placeholder="e.g. Only worn a few times, true to size"
              placeholderTextColor={theme.colors.textSecondary}
              value={description}
              onChangeText={(text) => {
                setDescription(text);
              }}
              multiline
              maxLength={DESCRIPTION_MAX}
            />
            <View style={styles.fieldFooterRow}>
              <Text style={styles.counterText}>
                {`${DESCRIPTION_MAX - description.length} character left`}
              </Text>
            </View>
          </View>

          {/* List fields */}
          <View style={styles.listSection}>
            {/*
              Rendu conditionnel:
              - Toujours: Category + Price
              - Après Category: Brand -> Condition -> Size -> Color (progressif)
            */}
            {(() => {
              const hasCategory = !!sellValues.category;
              const showBrand = hasCategory;
              const showCondition = showBrand && !!sellValues.brand;
              const showSize = showCondition && !!sellValues.condition;
              const showColor = showSize && !!sellValues.size;

              return (
                <>
            <TouchableOpacity
              style={[styles.listRow, styles.listRowFirst]}
              activeOpacity={0.7}
              onPress={() => {
                router.push('/tabs/sell/category');
              }}
            >
              <Text style={styles.listRowLabel}>Category</Text>
              <View style={styles.listRowRight}>
                {sellValues.category ? (
                  <Text style={styles.listRowValue}>{sellValues.category.name}</Text>
                ) : null}
                <Feather name="chevron-right" size={18} color={theme.colors.textSecondary} />
              </View>
            </TouchableOpacity>

            {showBrand ? (
            <TouchableOpacity
              style={styles.listRow}
              activeOpacity={0.7}
              onPress={() => {
                if (sellValues.category) {
                  router.push('/tabs/sell/brand');
                } else {
                  router.push('/tabs/sell/brand-gender');
                }
              }}
            >
              <Text style={styles.listRowLabel}>Brand</Text>
              <View style={styles.listRowRight}>
                {sellValues.brand ? (
                  <Text style={styles.listRowValue}>{sellValues.brand.name}</Text>
                ) : null}
                <Feather name="chevron-right" size={18} color={theme.colors.textSecondary} />
              </View>
            </TouchableOpacity>
            ) : null}

            {showCondition ? (
            <TouchableOpacity
              style={styles.listRow}
              activeOpacity={0.7}
              onPress={() => {
                router.push('/tabs/sell/condition');
              }}
            >
              <Text style={styles.listRowLabel}>Condition</Text>
              <View style={styles.listRowRight}>
                {conditionLabel ? (
                  <Text style={styles.listRowValue}>{conditionLabel}</Text>
                ) : null}
                <Feather name="chevron-right" size={18} color={theme.colors.textSecondary} />
              </View>
            </TouchableOpacity>
            ) : null}

            {showSize ? (
            <TouchableOpacity
              style={styles.listRow}
              activeOpacity={0.7}
              onPress={() => {
                router.push('/tabs/sell/size');
              }}
            >
              <Text style={styles.listRowLabel}>Size</Text>
              <View style={styles.listRowRight}>
                {sellValues.size ? (
                  <Text style={styles.listRowValue}>{sellValues.size.label}</Text>
                ) : null}
                <Feather name="chevron-right" size={18} color={theme.colors.textSecondary} />
              </View>
            </TouchableOpacity>
            ) : null}

            {showColor ? (
            <TouchableOpacity
              style={styles.listRow}
              activeOpacity={0.7}
              onPress={() => {
                router.push('/tabs/sell/color');
              }}
            >
              <Text style={styles.listRowLabel}>Color</Text>
              <View style={styles.listRowRight}>
                {colorLabel ? (
                  <Text style={styles.listRowValue}>{colorLabel}</Text>
                ) : null}
                <Feather name="chevron-right" size={18} color={theme.colors.textSecondary} />
              </View>
            </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.listRow}
              activeOpacity={0.7}
              onPress={() => {
                router.push('/tabs/sell/price');
              }}
            >
              <Text style={styles.listRowLabel}>Price</Text>
              <View style={styles.listRowRight}>
                {typeof sellValues.price === 'number' && Number.isFinite(sellValues.price) ? (
                  <Text style={styles.listRowValue}>{sellValues.price} CHF</Text>
                ) : null}
                <Feather name="chevron-right" size={18} color={theme.colors.textSecondary} />
              </View>
            </TouchableOpacity>
                </>
              );
            })()}
          </View>
        </ScrollView>

        {/* Bouton Publish */}
        <View
          style={[
            styles.footer,
            { paddingBottom: insets.bottom + 16 }
          ]}
        >
          <Button
            title={loading ? 'Publication...' : "Publier l'annonce"}
            onPress={handlePublish}
            variant="primary"
            disabled={loading}
            loading={loading}
          />
        </View>
      </SafeAreaView>

      {/* Bottom sheet Photo tips */}
      <Modal
        visible={showPhotoTips}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPhotoTips(false)}
      >
        <View style={styles.photoTipsOverlay}>
          <TouchableOpacity
            style={styles.photoTipsOverlay}
            activeOpacity={1}
            onPress={() => setShowPhotoTips(false)}
          />
          <View style={styles.photoTipsSheet}>
            <View style={styles.photoTipsHandle} />
            <TouchableOpacity
              style={styles.photoTipsCloseButton}
              onPress={() => setShowPhotoTips(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.photoTipsCloseButtonText}>×</Text>
            </TouchableOpacity>
            <Text style={styles.photoTipsTitle}>Photo tips</Text>

            <Text style={styles.photoTipsSectionTitle}>Choose natural light</Text>

            <View style={styles.photoTipsImagesRow}>
              <View style={styles.photoTipsImagePlaceholder}>
                <View
                  style={[
                    styles.photoTipsBadge,
                    { backgroundColor: '#22C55E' }
                  ]}
                >
                  <Text style={styles.photoTipsBadgeText}>✓</Text>
                </View>
              </View>
              <View style={styles.photoTipsImagePlaceholder}>
                <View
                  style={[
                    styles.photoTipsBadge,
                    { backgroundColor: '#EF4444' }
                  ]}
                >
                  <Text style={styles.photoTipsBadgeText}>✗</Text>
                </View>
              </View>
            </View>

            <Text style={styles.photoTipsText}>
              Take photos in a well-lit area. Bright daylight is best.
            </Text>
          </View>
        </View>
      </Modal>

      {/* Bottom sheet après publication */}
      <Modal
        visible={showPublishSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPublishSheet(false)}
      >
        <View style={styles.sheetOverlay}>
          <TouchableOpacity
            style={styles.sheetOverlayTouchable}
            activeOpacity={1}
            onPress={() => setShowPublishSheet(false)}
          />
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Mise en ligne du produit</Text>

            <TouchableOpacity
              style={styles.sheetCard}
              activeOpacity={0.8}
              onPress={() => console.log('coming soon')}
            >
              <View style={styles.sheetCardHeader}>
                <View style={styles.sheetIconCircle}>
                  <AppIcon name="userOutline" size={18} color={theme.colors.textPrimary} />
                </View>
                <Text style={styles.sheetCardTitle}>Mise en avant du produit</Text>
                <Text style={styles.sheetPrice}>5.99CHF</Text>
              </View>
              <Text style={styles.sheetCardSubtitle}>
                Payer pour mettre en avant cet article lors de sa publication.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetCard}
              activeOpacity={0.8}
              onPress={() => console.log('coming soon')}
            >
              <View style={styles.sheetCardHeader}>
                <View style={styles.sheetIconCircle}>
                  <AppIcon name="userOutline" size={18} color={theme.colors.textPrimary} />
                </View>
                <Text style={styles.sheetCardTitle}>Mise en avant du dressing</Text>
                <Text style={styles.sheetPrice}>12.99CHF</Text>
              </View>
              <Text style={styles.sheetCardSubtitle}>
                Payer pour mettre en avant l&apos;intégralité des produits de votre dressing.
              </Text>
            </TouchableOpacity>

            <Text style={styles.sheetNote}>
              Ces mises en avant s&apos;appliqueront pendant une durée de 15 jours.
            </Text>

            <Button
              title="Passer cette étape"
              onPress={() => {
                setShowPublishSheet(false);
                router.replace('/tabs/feed');
              }}
              variant="primary"
              style={styles.sheetSkipButton}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgroundWhite
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5'
  },
  headerTitle: {
    ...theme.typography.body,
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.textPrimary
  },
  headerRightPlaceholder: {
    width: 32
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120
  },
  photosSection: {
    marginBottom: 24
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
    gap: 12,
    paddingRight: 4
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
  photoUploadButton: {
    alignSelf: 'center',
    width: 167,
    height: 56,
    marginTop: 8,
    borderWidth: 1.5,
    borderColor: '#C3EA4F',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.backgroundWhite,
    gap: 8
  },
  photoUploadIcon: {
    marginRight: 8
  },
  photoUploadText: {
    ...theme.typography.button,
    color: theme.colors.textPrimary
  },
  photoAddTile: {
    width: 100,
    height: 100,
    borderRadius: theme.radius.cardRadius,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundWhite
  },
  photoHint: {
    ...theme.typography.captionSm,
    color: theme.colors.textSecondary,
    marginTop: 50,
    textAlign: 'center'
  },
  photoHintLink: {
    textDecorationLine: 'underline'
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
  error: {
    ...theme.typography.caption,
    color: theme.colors.danger,
    marginTop: 4
  },
  fieldGroup: {
    paddingVertical: 16,
    marginBottom: 0
  },
  fieldLabel: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    marginBottom: 8
  },
  textInput: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    paddingVertical: 0,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5'
  },
  descriptionInput: {
    textAlignVertical: 'top'
  },
  fieldFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 7
  },
  counterText: {
    ...theme.typography.captionSm,
    color: theme.colors.textSecondary
  },
  fieldSeparator: {
    height: 0
  },
  sectionSeparator: {
    height: 1,
    backgroundColor: '#E5E5E5',
    marginHorizontal: -16
  },
  listSection: {
    marginTop: 20,
    marginBottom: 16
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginHorizontal: -16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5'
  },
  listRowFirst: {
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5'
  },
  listRowLabel: {
    ...theme.typography.body,
    color: theme.colors.textPrimary
  },
  listRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8
  },
  listRowValue: {
    ...theme.typography.body,
    color: theme.colors.textSecondary
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: theme.spacing.horizontalPadding,
    paddingTop: 16,
    backgroundColor: theme.colors.backgroundWhite,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end'
  },
  sheetOverlayTouchable: {
    flex: 1
  },
  sheetContainer: {
    backgroundColor: theme.colors.backgroundWhite,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: theme.spacing.horizontalPadding,
    paddingTop: 12,
    paddingBottom: 24
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginBottom: 16
  },
  sheetTitle: {
    ...theme.typography.h3,
    textAlign: 'center',
    marginBottom: 16
  },
  sheetCard: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: '#F9FFE8',
    borderRadius: theme.radius.cardRadius,
    padding: 12,
    marginBottom: 12
  },
  sheetCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  sheetIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8
  },
  sheetCardTitle: {
    ...theme.typography.body,
    flex: 1,
    marginHorizontal: 8,
    color: theme.colors.textPrimary
  },
  sheetPrice: {
    ...theme.typography.body,
    fontFamily: theme.fontFamily.semiBold,
    color: theme.colors.textPrimary
  },
  sheetCardSubtitle: {
    ...theme.typography.captionSm,
    color: theme.colors.textSecondary
  },
  sheetNote: {
    ...theme.typography.captionSm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16
  },
  sheetSkipButton: {
    marginTop: 4
  },
  photoTipsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end'
  },
  photoTipsSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24
  },
  photoTipsHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    backgroundColor: '#E5E5E5',
    borderRadius: 2,
    marginBottom: 16
  },
  photoTipsCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center'
  },
  photoTipsCloseButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827'
  },
  photoTipsTitle: {
    ...theme.typography.body,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
    color: theme.colors.textPrimary
  },
  photoTipsSectionTitle: {
    ...theme.typography.body,
    fontWeight: '600',
    marginBottom: 12,
    color: theme.colors.textPrimary
  },
  photoTipsImagesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  photoTipsImagePlaceholder: {
    width: 150,
    height: 150,
    borderRadius: 16,
    backgroundColor: '#E5E5E5',
    overflow: 'hidden'
  },
  photoTipsBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999
  },
  photoTipsBadgeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700'
  },
  photoTipsText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary
  }
});
