/**
 * Écran Sell - Création d'annonce
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  Keyboard,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { useStripe } from '@stripe/stripe-react-native';
import { Button } from '../../../components/ui/Button';
import { AppIcon } from '../../../components/ui/AppIcon';
import { HeaderBackButton } from '../../../components/ui/HeaderBackButton';
import { theme } from '../../../lib/theme';
import { useAuthStore } from '../../../stores/authStore';
import { createListing, uploadListingPhoto, addListingPhoto } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../../../lib/env';
import { ensureProfileExists } from '../../../lib/profile';
import type { ListingInsert } from '../../../lib/types';
import { useSellFormStore, type ParcelSizeValue } from '../../../lib/store/sellForm';
import * as Location from 'expo-location';
import { translateColorName } from '../../../lib/colorI18n';
import { translateConditionLabel } from '../../../lib/conditionI18n';
import { BOOST_OPTIONS, type BoostSponsorType } from '../../../lib/fees';

type Photo = {
  uri: string;
  type?: string;
  name?: string;
};

const TITLE_MAX = 60;
const DESCRIPTION_MAX = 300;

const ALLOWED_COUNTRIES = ['CH', 'FR', 'DE', 'IT'] as const;
type AllowedCountry = (typeof ALLOWED_COUNTRIES)[number];

const PARCEL_SIZE_OPTIONS: { value: ParcelSizeValue; labelKey: string }[] = [
  { value: 'small', labelKey: 'sell.parcelSize.small' },
  { value: 'large', labelKey: 'sell.parcelSize.large' },
  { value: 'xlarge', labelKey: 'sell.parcelSize.xlarge' }
];

function deliveryModeIncludesShipping(mode: string | undefined): boolean {
  const dm = String(mode ?? 'both').toLowerCase();
  return dm === 'shipping' || dm === 'both';
}

export default function SellScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { values: sellValues, resetForm, setField } = useSellFormStore();
  const [title, setTitle] = useState(sellValues.draftTitle ?? '');
  const titleRef = useRef(sellValues.draftTitle ?? '');
  const [description, setDescription] = useState(sellValues.draftDescription ?? '');
  const [price, setPrice] = useState(sellValues.draftPriceText ?? '');
  const [city, setCity] = useState(sellValues.draftCity ?? '');
  const [photos, setPhotos] = useState<Photo[]>([...((sellValues.draftPhotos as any) ?? [])]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    title?: string;
    price?: string;
    photos?: string;
    parcel_size?: string;
  }>({});
  const [showPublishSheet, setShowPublishSheet] = useState(false);
  const [showPhotoTips, setShowPhotoTips] = useState(false);
  const [lastPublishedListingId, setLastPublishedListingId] = useState<string | null>(null);
  const [selectedBoost, setSelectedBoost] = useState<{
    sponsorType: BoostSponsorType;
    durationDays: 3 | 7;
  } | null>(null);
  const [boostPaying, setBoostPaying] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const listSectionY = useRef(0);

  const scrollToListSection = () => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, listSectionY.current - 24),
        animated: true
      });
    }, Platform.OS === 'ios' ? 250 : 100);
  };

  const navigateSellField = (path: string) => {
    Keyboard.dismiss();
    router.push(path as never);
  };

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

  // Garder le store en sync pour éviter de perdre le draft en naviguant vers Condition/Brand/etc.
  React.useEffect(() => {
    setField('draftTitle', title);
  }, [setField, title]);
  React.useEffect(() => {
    // Assurer que la validation voit toujours la dernière valeur (même si le titre
    // provient du store au remount, sans déclencher onChangeText).
    titleRef.current = title;
  }, [title]);
  React.useEffect(() => {
    setField('draftDescription', description);
  }, [setField, description]);
  React.useEffect(() => {
    setField('draftPriceText', price);
  }, [setField, price]);
  React.useEffect(() => {
    setField('draftCity', city);
  }, [setField, city]);
  React.useEffect(() => {
    setField('draftPhotos', photos as any);
  }, [setField, photos]);

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
        t('common.error'),
        t('sell.permissionPhotos')
      );
      return false;
    }
    return true;
  };

  const appendPickedAssets = (assets: ImagePicker.ImagePickerAsset[]) => {
    const newPhotos = assets.map((asset) => ({
      uri: asset.uri,
      type: asset.type || 'image/jpeg',
      name: asset.fileName || `photo-${Date.now()}.jpg`
    }));
    setPhotos((prev) => [...prev, ...newPhotos]);
    if (errors.photos) {
      setErrors((prev) => ({ ...prev, photos: undefined }));
    }
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
      appendPickedAssets(result.assets);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('common.error'), t('sell.allowCamera'));
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.8,
      allowsEditing: false
    });

    if (!result.canceled && result.assets) {
      appendPickedAssets(result.assets);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    const latestTitle = titleRef.current;
    if (!latestTitle.trim()) {
      newErrors.title = t('sell.incompleteForm');
    }

    const priceFromStore =
      typeof sellValues.price === 'number' && Number.isFinite(sellValues.price)
        ? sellValues.price
        : undefined;
    const priceNum = priceFromStore ?? parseFloat(price);
    if (!priceNum || Number.isNaN(priceNum) || priceNum <= 0) {
      newErrors.price = t('profile.editListing.validPrice');
    }

    if (photos.length === 0) {
      newErrors.photos = t('sell.addPhotos');
    }

    const deliveryMode = sellValues.delivery_mode ?? 'both';
    if (deliveryModeIncludesShipping(deliveryMode) && !sellValues.parcel_size) {
      newErrors.parcel_size = t('sell.parcelSize.required');
    }

    setErrors(newErrors);
    const hasErrors = Object.keys(newErrors).length > 0;

    if (hasErrors) {
      const firstError =
        newErrors.title ||
        newErrors.price ||
        newErrors.photos ||
        newErrors.parcel_size ||
        t('sell.incompleteForm');

      Alert.alert(t('sell.incompleteForm'), firstError);
    }

    return !hasErrors;
  };

  const conditionLabel =
    sellValues.condition != null
      ? translateConditionLabel(sellValues.condition, t)
      : null;

  const colorLabel =
    sellValues.color && sellValues.color.length > 0
      ? sellValues.color.map((c) => translateColorName(c.name, t)).join(', ')
      : null;

  const handlePublish = async () => {
    if (!user) {
      Alert.alert(t('common.error'), t('sell.mustSignInCreate'));
      return;
    }

    // S'assurer que la dernière saisie (IME/composition) est prise en compte avant validation
    Keyboard.dismiss();
    titleRef.current = title;

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
          t('sell.activateSeller'),
          t('sell.activateBeforePublish'),
          [
            { text: t('common.notNow'), style: 'cancel' },
            {
              text: t('sell.activateAccount'),
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
      const deliveryMode = sellValues.delivery_mode ?? 'both';
      const requiresParcelSize = deliveryModeIncludesShipping(deliveryMode);

      const listingData: ListingInsert = {
        seller_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        price: priceNum,
        // Ne pas publier immédiatement : on publie après l'étape "mise en avant" (payer ou passer)
        status: 'draft',
        category: sellValues.category?.name ?? null,
        category_id: sellValues.category?.id ?? null,
        condition: sellValues.condition ?? null,
        brand: sellValues.brand?.name ?? null,
        size: sellValues.size?.label ?? null,
        color:
          sellValues.color && sellValues.color.length > 0
            ? sellValues.color.map((c) => c.name).join(', ')
            : null,
        delivery_mode: deliveryMode,
        parcel_size: requiresParcelSize ? (sellValues.parcel_size ?? null) : null,
        city: geo.city ?? (city.trim() ? city.trim() : null),
        country_code: geo.country_code ?? 'CH',
        latitude: geo.latitude,
        longitude: geo.longitude
      };

      const listingResult = await createListing(listingData);

      if (listingResult.error || !listingResult.data) {
        throw new Error(listingResult.error || 'Error while creating the listing');
      }

      const listing = listingResult.data;
      setLastPublishedListingId(listing.id);
      setSelectedBoost(null);

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

      // Afficher la bottom sheet de mise en avant (la publication se fera après)
      setShowPublishSheet(true);
    } catch (error) {
      Alert.alert(
        t('common.error'),
        error instanceof Error ? error.message : t('auth.signUp.somethingWrong')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container} edges={['top']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoid}
        >
          <View style={styles.header}>
            <HeaderBackButton onPress={() => router.back()} />
            <Text style={styles.headerTitle}>{t('sell.sellingHeader')}</Text>
            <View style={styles.headerRightPlaceholder} />
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + 24 }
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
          {/* Photos */}
          <View style={styles.photosSection}>
            {errors.photos && <Text style={styles.error}>{errors.photos}</Text>}

            {photos.length === 0 ? (
              <View style={styles.photoActionsRow}>
                <TouchableOpacity
                  style={styles.photoUploadButton}
                  onPress={pickImage}
                  activeOpacity={0.85}
                >
                  <AppIcon name="addSquareOutline" size={20} color="#121212" />
                  <Text style={styles.photoUploadText}>{t('sell.gallery')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.photoUploadButton}
                  onPress={takePhoto}
                  activeOpacity={0.85}
                >
                  <Feather name="camera" size={20} color="#121212" />
                  <Text style={styles.photoUploadText}>{t('sell.cameraFr')}</Text>
                </TouchableOpacity>
              </View>
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

                <TouchableOpacity
                  style={styles.photoAddTile}
                  onPress={takePhoto}
                  activeOpacity={0.85}
                >
                  <Feather name="camera" size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </ScrollView>
            )}

            <Text style={[styles.photoHint, { textAlign: 'center' }]}>
              {`${t('sell.addPhotos')} `}
              <Text
                style={styles.photoHintLink}
                onPress={() => {
                  setShowPhotoTips(true);
                }}
              >
                {t('sell.seePhotoTips')}
              </Text>
            </Text>
          </View>

          <View style={styles.sectionSeparator} />

          {/* Title */}
          <View style={[styles.fieldGroup, { marginTop: 24 }]}>
            <Text style={styles.fieldLabel}>{t('sell.title')}</Text>
            <TextInput
              style={styles.textInput}
              placeholder={t('sell.titlePlaceholder')}
              placeholderTextColor={theme.colors.textSecondary}
              value={title}
              onChangeText={(text) => {
                setTitle(text);
                titleRef.current = text;
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
                {t('sell.characterLeft', { count: TITLE_MAX - title.length })}
              </Text>
            </View>
          </View>

          <View style={styles.sectionSeparator} />

          {/* Description */}
          <View style={[styles.fieldGroup, { marginTop: 20 }]}>
            <Text style={styles.fieldLabel}>{t('profile.editProfileScreen.aboutMe')}</Text>
            <TextInput
              style={[
                styles.textInput,
                styles.descriptionInput
              ]}
              placeholder={t('sell.descriptionPlaceholder')}
              placeholderTextColor={theme.colors.textSecondary}
              value={description}
              onChangeText={(text) => {
                setDescription(text);
              }}
              onFocus={scrollToListSection}
              multiline
              blurOnSubmit
              maxLength={DESCRIPTION_MAX}
            />
            <View style={styles.fieldFooterRow}>
              <Text style={styles.counterText}>
                {t('sell.characterLeft', { count: DESCRIPTION_MAX - description.length })}
              </Text>
            </View>
          </View>

          <View
            onLayout={(event) => {
              listSectionY.current = event.nativeEvent.layout.y;
            }}
          />

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
              const showCondition = hasCategory;
              const showSize = hasCategory;
              const showColor = hasCategory;

              return (
                <>
            <TouchableOpacity
              style={[styles.listRow, styles.listRowFirst]}
              activeOpacity={0.7}
              onPress={() => navigateSellField('/tabs/sell/category')}
            >
              <Text style={styles.listRowLabel}>{t('sell.category')}</Text>
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
                  navigateSellField('/tabs/sell/brand');
                } else {
                  navigateSellField('/tabs/sell/brand-gender');
                }
              }}
            >
              <Text style={styles.listRowLabel}>{t('filters.searchBrands')}</Text>
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
              onPress={() => navigateSellField('/tabs/sell/condition')}
            >
              <Text style={styles.listRowLabel}>{t('filters.condition')}</Text>
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
              onPress={() => navigateSellField('/tabs/sell/size')}
            >
              <Text style={styles.listRowLabel}>{t('sell.size')}</Text>
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
              onPress={() => navigateSellField('/tabs/sell/color')}
            >
              <Text style={styles.listRowLabel}>{t('sell.color')}</Text>
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
              onPress={() => navigateSellField('/tabs/sell/price')}
            >
              <Text style={styles.listRowLabel}>{t('sell.price')}</Text>
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

          {deliveryModeIncludesShipping(sellValues.delivery_mode ?? 'both') ? (
            <View style={styles.parcelSection}>
              <Text style={styles.parcelSectionTitle}>{t('sell.parcelSize.title')}</Text>
              {PARCEL_SIZE_OPTIONS.map((option, index) => {
                const isSelected = sellValues.parcel_size === option.value;
                return (
                  <React.Fragment key={option.value}>
                    {index > 0 ? <View style={styles.parcelSeparator} /> : null}
                    <TouchableOpacity
                      style={[styles.parcelOptionRow, isSelected && styles.parcelOptionRowSelected]}
                      onPress={() => {
                        setField('parcel_size', option.value);
                        if (errors.parcel_size) {
                          setErrors((prev) => ({ ...prev, parcel_size: undefined }));
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.parcelOptionLabel,
                          isSelected && styles.parcelOptionLabelSelected
                        ]}
                      >
                        {t(option.labelKey)}
                      </Text>
                      <View style={[styles.parcelRadioOuter, isSelected && styles.parcelRadioOuterSelected]}>
                        {isSelected ? <View style={styles.parcelRadioInner} /> : null}
                      </View>
                    </TouchableOpacity>
                  </React.Fragment>
                );
              })}
              {errors.parcel_size ? (
                <Text style={styles.error}>{errors.parcel_size}</Text>
              ) : null}
            </View>
          ) : null}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
            <Button
              title={loading ? t('common.loading') : t('sell.publishListing')}
              onPress={handlePublish}
              variant="primary"
              disabled={loading}
              loading={loading}
            />
          </View>
        </KeyboardAvoidingView>
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
            <Text style={styles.photoTipsTitle}>{t('sell.photoTips')}</Text>

            <Text style={styles.photoTipsSectionTitle}>{t('sell.chooseNaturalLight')}</Text>

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
              {t('sell.photoTipsBody')}
            </Text>
          </View>
        </View>
      </Modal>

      {/* Bottom sheet après publication */}
      <Modal
        visible={showPublishSheet}
        transparent
        animationType="slide"
        onRequestClose={() => {
          // Ne pas fermer via bouton Android back sans choix explicite
        }}
      >
        <View style={styles.sheetOverlay}>
          <TouchableOpacity
            style={styles.sheetOverlayTouchable}
            activeOpacity={1}
            onPress={() => {
              // Ne rien faire : l'utilisateur doit payer ou passer
            }}
          />
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t('sell.productGoingLive')}</Text>

            {BOOST_OPTIONS.map((option) => {
              const isSelected =
                selectedBoost?.sponsorType === option.sponsorType &&
                selectedBoost?.durationDays === option.durationDays;
              const labelKey =
                option.sponsorType === 'listing'
                  ? option.durationDays === 3
                    ? 'sell.boostListing3d'
                    : 'sell.boostListing7d'
                  : option.durationDays === 3
                  ? 'sell.boostDressing3d'
                  : 'sell.boostDressing7d';

              return (
                <TouchableOpacity
                  key={`${option.sponsorType}-${option.durationDays}`}
                  style={[styles.sheetCard, isSelected && styles.sheetCardSelected]}
                  activeOpacity={0.8}
                  onPress={() =>
                    setSelectedBoost({
                      sponsorType: option.sponsorType,
                      durationDays: option.durationDays
                    })
                  }
                >
                  <View style={styles.sheetCardHeader}>
                    <View style={styles.sheetIconCircle}>
                      <AppIcon name="userOutline" size={18} color="#171918" />
                    </View>
                    <Text style={styles.sheetCardTitle}>{t(labelKey)}</Text>
                    <Text style={styles.sheetPrice}>{option.priceChf.toFixed(2)} CHF</Text>
                  </View>
                  <Text style={styles.sheetCardSubtitle}>
                    {option.sponsorType === 'listing'
                      ? t('sell.payToFeatureItem')
                      : t('sell.payToFeatureCloset')}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <Text style={styles.sheetNote}>
              {t('sell.boostDuration')}
            </Text>

            <Button
              title={
                boostPaying
                  ? t('common.loading')
                  : selectedBoost
                  ? `${t('feed.checkout.pay')} ${BOOST_OPTIONS.find(
                      (option) =>
                        option.sponsorType === selectedBoost.sponsorType &&
                        option.durationDays === selectedBoost.durationDays
                    )?.priceChf.toFixed(2)} CHF`
                  : t('sell.chooseOption')
              }
              onPress={async () => {
                if (boostPaying) return;
                if (!user?.id) {
                  Alert.alert(t('common.error'), t('sell.mustSignInPay'));
                  setShowPublishSheet(false);
                  router.push('/auth/login');
                  return;
                }
                if (!selectedBoost) return;
                if (!lastPublishedListingId) {
                  Alert.alert(t('common.error'), t('sell.listingNotFoundBoost'));
                  return;
                }

                setBoostPaying(true);
                try {
                  const { data: sessionData } = await supabase.auth.getSession();
                  const accessToken = sessionData.session?.access_token;
                  if (!accessToken) {
                    throw new Error('Session expired. Please sign in again.');
                  }

                  const createRes = await fetch(`${SUPABASE_URL}/functions/v1/boost-listing`, {
                    method: 'POST',
                    headers: {
                      Authorization: `Bearer ${accessToken}`,
                      apikey: SUPABASE_ANON_KEY,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      action: 'create',
                      listing_id: lastPublishedListingId,
                      seller_id: user.id,
                      sponsor_type: selectedBoost.sponsorType,
                      duration_days: selectedBoost.durationDays
                    })
                  });

                  const createJson = (await createRes.json()) as {
                    client_secret?: string;
                    error?: string;
                    details?: string;
                  };

                  if (!createRes.ok) {
                    throw new Error(
                      createJson.error && createJson.details
                        ? `${createJson.error} (${createJson.details})`
                        : createJson.error || createJson.details || 'boost-listing create failed'
                    );
                  }

                  const clientSecret = createJson.client_secret;
                  if (!clientSecret) throw new Error('Missing client_secret');

                  const initRes = await initPaymentSheet({
                    merchantDisplayName: 'Bloomi',
                    paymentIntentClientSecret: clientSecret,
                    defaultBillingDetails: {
                      address: { country: 'CH' }
                    }
                  });
                  if (initRes.error) throw new Error(initRes.error.message);

                  const presentRes = await presentPaymentSheet();
                  if (presentRes.error) throw new Error(presentRes.error.message);

                  const paymentIntentId = clientSecret.split('_secret')[0];
                  if (!paymentIntentId) throw new Error('Invalid payment_intent_id');

                  const confirmRes = await fetch(`${SUPABASE_URL}/functions/v1/boost-listing`, {
                    method: 'POST',
                    headers: {
                      Authorization: `Bearer ${accessToken}`,
                      apikey: SUPABASE_ANON_KEY,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      action: 'confirm',
                      payment_intent_id: paymentIntentId
                    })
                  });

                  const confirmJson = (await confirmRes.json()) as {
                    success?: boolean;
                    updated_count?: number;
                    error?: string;
                    details?: string;
                  };

                  if (!confirmRes.ok || confirmJson.success !== true) {
                    throw new Error(
                      confirmJson.error && confirmJson.details
                        ? `${confirmJson.error} (${confirmJson.details})`
                        : confirmJson.error || confirmJson.details || 'boost-listing confirm failed'
                    );
                  }

                  // Publier l'annonce maintenant (après paiement réussi)
                  const { error: publishErr } = await supabase
                    .from('listings')
                    .update({
                      status: 'published',
                      published_at: new Date().toISOString()
                    })
                    .eq('id', lastPublishedListingId)
                    .eq('seller_id', user.id);

                  if (publishErr) {
                    throw new Error(publishErr.message);
                  }

                  // Réinitialiser le formulaire (store + état local) uniquement après publication
                  resetForm();
                  setTitle('');
                  titleRef.current = '';
                  setDescription('');
                  setPrice('');
                  setCity('');
                  setPhotos([]);
                  setErrors({});
                  setField('draftTitle', '');
                  setField('draftDescription', '');
                  setField('draftPriceText', '');
                  setField('draftCity', '');
                  setField('draftPhotos', [] as any);

                  setShowPublishSheet(false);
                  router.replace('/tabs/feed');
                } catch (e) {
                  Alert.alert(
                    t('feed.checkout.paymentFailed'),
                    e instanceof Error ? e.message : 'Unknown error'
                  );
                } finally {
                  setBoostPaying(false);
                }
              }}
              variant="primary"
              disabled={boostPaying}
              loading={boostPaying}
              style={styles.sheetPayButton}
            />

            <Button
              title={t('sell.skipStep')}
              onPress={async () => {
                if (!user?.id || !lastPublishedListingId) {
                  setShowPublishSheet(false);
                  router.replace('/tabs/feed');
                  return;
                }

                try {
                  // Publier sans boost
                  const { error: publishErr } = await supabase
                    .from('listings')
                    .update({
                      status: 'published',
                      published_at: new Date().toISOString()
                    })
                    .eq('id', lastPublishedListingId)
                    .eq('seller_id', user.id);

                  if (publishErr) {
                    throw new Error(publishErr.message);
                  }

                  resetForm();
                  setTitle('');
                  titleRef.current = '';
                  setDescription('');
                  setPrice('');
                  setCity('');
                  setPhotos([]);
                  setErrors({});
                  setField('draftTitle', '');
                  setField('draftDescription', '');
                  setField('draftPriceText', '');
                  setField('draftCity', '');
                  setField('draftPhotos', [] as any);
                } catch (e) {
                  Alert.alert(
                    t('common.error'),
                    e instanceof Error ? e.message : t('auth.signUp.somethingWrong')
                  );
                  return;
                }

                setShowPublishSheet(false);
                router.replace('/tabs/feed');
              }}
              variant="secondary"
              style={styles.sheetSkipButton}
              textStyle={styles.sheetSkipButtonText}
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
  keyboardAvoid: {
    flex: 1
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5'
  },
  headerTitle: {
    ...theme.typography.body,
    fontFamily: theme.fontFamily.semiBold,
    color: theme.colors.textPrimary
  },
  headerRightPlaceholder: {
    width: 28
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
    width: 220,
    height: 56,
    alignSelf: 'center',
    borderWidth: 0,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F0F0',
    gap: 8
  },
  photoActionsRow: {
    marginTop: 8,
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    gap: 12
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
  parcelSection: {
    marginTop: 8,
    marginBottom: 16
  },
  parcelSectionTitle: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    fontFamily: theme.fontFamily.semiBold,
    marginBottom: 8
  },
  parcelOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8
  },
  parcelOptionRowSelected: {
    borderRadius: theme.radius.cardRadius,
    backgroundColor: '#C3EA4F'
  },
  parcelOptionLabel: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    flex: 1,
    marginRight: 12
  },
  parcelOptionLabelSelected: {
    fontFamily: theme.fontFamily.semiBold
  },
  parcelRadioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#CCCCCC',
    alignItems: 'center',
    justifyContent: 'center'
  },
  parcelRadioOuterSelected: {
    borderColor: theme.colors.textPrimary
  },
  parcelRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.textPrimary
  },
  parcelSeparator: {
    height: 1,
    backgroundColor: theme.colors.border
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
    borderColor: theme.colors.border,
    backgroundColor: '#F8F8F6',
    borderRadius: theme.radius.cardRadius,
    padding: 12,
    marginBottom: 12
  },
  sheetCardSelected: {
    borderColor: '#171918',
    backgroundColor: '#F8F8F6'
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
    color: '#171918'
  },
  sheetPrice: {
    ...theme.typography.body,
    fontFamily: theme.fontFamily.semiBold,
    color: '#171918'
  },
  sheetCardSubtitle: {
    ...theme.typography.captionSm,
    color: '#171918'
  },
  sheetNote: {
    ...theme.typography.captionSm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16
  },
  sheetPayButton: {
    marginBottom: 10
  },
  sheetSkipButton: {
    marginTop: 4,
    backgroundColor: '#F8F8F6',
    borderWidth: 0
  },
  sheetSkipButtonText: {
    color: '#171918'
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
