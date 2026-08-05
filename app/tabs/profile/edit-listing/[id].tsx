import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { Button } from '../../../../components/ui/Button';
import { AppIcon } from '../../../../components/ui/AppIcon';
import { HeaderBackButton } from '../../../../components/ui/HeaderBackButton';
import {
  navigateBackFromEditListing,
  pickListingReturnParams,
  type ListingReturnParams
} from '../../../../lib/navigation/listingDetailNav';
import { theme } from '../../../../lib/theme';
import {
  addListingPhoto,
  cloneListingDetail,
  deleteListingPhoto,
  getListingById,
  reorderListingPhotos,
  updateListing,
  uploadListingPhoto,
  type ListingDetail
} from '../../../../lib/api';
import {
  assetsToListingPhotos,
  buildListingStorageFilename,
  MAX_LISTING_PHOTOS,
  temporaryListingPhotoOrderIndex
} from '../../../../lib/listingPhotoUtils';
import { useEditListingFormStore } from '../../../../lib/store/editListingForm';
import { getCategoryFilterContext } from '../../../../lib/api/filters';
import type { ParcelSizeValue, SellCategoryType } from '../../../../lib/store/sellForm';
import {
  normalizeEditBrand,
  normalizeEditCategory,
  normalizeEditSize,
  parseListingColorField,
  resolveListingId,
  serializeListingColors
} from '../../../../lib/edit-listing/normalize';
import { useAuthStore } from '../../../../stores/authStore';
import { useTranslation } from 'react-i18next';
import { useStripe } from '@stripe/stripe-react-native';
import { translateConditionLabel } from '../../../../lib/conditionI18n';
import { translateCategoryLabel } from '../../../../lib/categoryI18n';
import { translateColorName } from '../../../../lib/colorI18n';
import { translateSizeLabel } from '../../../../lib/sizeI18n';
import { formatBrandDisplayLabel, isBlockedBrandName } from '../../../../lib/brandConstants';
import { ParcelSizeSelector } from '../../../../components/listing/ParcelSizeSelector';
import { DeliveryModeSelector } from '../../../../components/listing/DeliveryModeSelector';
import { PickupAddressesSection } from '../../../../components/listing/PickupAddressesSection';
import {
  deliveryModeIncludesShipping as listingIncludesShipping,
  deliveryModeIncludesPickup as listingIncludesPickup,
  normalizeDeliveryMode,
  type ListingDeliveryMode
} from '../../../../lib/deliveryMode';
import {
  fetchProfilePickupAddresses,
  listingPickupSnapshotFromProfile
} from '../../../../lib/profilePickupAddresses';
import { supabase } from '../../../../lib/supabase';
import { BoostDurationSheet } from '../../../../components/listing/BoostDurationSheet';
import { BoostPaymentCancelledError, runBoostPayment } from '../../../../lib/runBoostPayment';

const TITLE_MAX = 60;
const DESCRIPTION_MAX = 300;

function deliveryModeIncludesShipping(mode: string | undefined): boolean {
  return listingIncludesShipping(mode);
}

type Photo = {
  uri: string;
  type?: string;
  name?: string;
  width?: number;
  height?: number;
  isNew?: boolean;
  id?: string;
  orderIndex?: number;
};

function photosFromListing(data: ListingDetail): Photo[] {
  return (
    data.photos?.map((photo) => ({
      uri: photo.url,
      isNew: false,
      id: photo.id,
      orderIndex: photo.order_index
    })) ?? []
  );
}

function resolveDisplayPrice(
  priceText: string,
  storePrice: number | undefined,
  listingPrice: unknown
): number | null {
  const fromText = Number(priceText.replace(/[^0-9.]/g, ''));
  if (Number.isFinite(fromText) && fromText > 0) return fromText;
  if (typeof storePrice === 'number' && Number.isFinite(storePrice) && storePrice > 0) {
    return storePrice;
  }
  const fromListing = Number(String(listingPrice ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(fromListing) && fromListing > 0 ? fromListing : null;
}

function normalizeParcelSize(
  value: unknown
): ParcelSizeValue | undefined {
  const normalized = String(value ?? '').toLowerCase();
  if (
    normalized === 'letter_aplus' ||
    normalized === 'small' ||
    normalized === 'large' ||
    normalized === 'xlarge'
  ) {
    return normalized;
  }
  return undefined;
}

function resolveEditPriceNumber(
  price: number | undefined,
  draftPriceText: string
): number {
  if (typeof price === 'number' && Number.isFinite(price) && price > 0) {
    return price;
  }
  return Number(draftPriceText.replace(/[^0-9.]/g, ''));
}

export default function EditListingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const routeParams = useLocalSearchParams<{
    id: string | string[];
    return_to?: string;
    return_user_id?: string;
    return_listing_id?: string;
  }>();
  const { id: idParam } = routeParams;
  const editReturnParams = pickListingReturnParams(routeParams);
  const editReturnParamsRef = useRef<ListingReturnParams>(editReturnParams);
  const listingId = resolveListingId(idParam);
  const { user } = useAuthStore();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { values: formValues, setField, resetForm, hydrateFromListing } =
    useEditListingFormStore();
  const listingSnapshotRef = useRef<ListingDetail | null>(null);
  const removedPhotoIdsRef = useRef<string[]>([]);

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [title, setTitle] = useState(formValues.draftTitle ?? '');
  const [description, setDescription] = useState(formValues.draftDescription ?? '');
  const [city, setCity] = useState(formValues.draftCity ?? '');
  const [priceText, setPriceText] = useState(
    formValues.draftPriceText ||
      (typeof formValues.price === 'number' ? String(formValues.price) : '')
  );
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [parcelSizeError, setParcelSizeError] = useState<string | undefined>();
  const [pickupPrimaryError, setPickupPrimaryError] = useState<string | undefined>();
  const [pickupPrimaryComplete, setPickupPrimaryComplete] = useState(false);
  const [postSaveBoostOffer, setPostSaveBoostOffer] = useState(false);
  const [boostPaying, setBoostPaying] = useState(false);

  const selectedCategoryLabel = useMemo(() => {
    const raw = formValues.category?.name || listing?.category || null;
    if (!raw) return null;
    return translateCategoryLabel(
      {
        name: raw,
        slug: formValues.category?.slug ?? listing?.category_slug
      },
      t
    );
  }, [formValues.category, listing?.category, listing?.category_slug, t]);
  const selectedBrandLabel = formValues.brand?.name || listing?.brand || null;
  const selectedSizeLabel = formValues.size?.label || listing?.size || null;
  const displaySizeLabel = selectedSizeLabel
    ? translateSizeLabel(selectedSizeLabel, t)
    : null;
  const selectedConditionLabel = formValues.condition
    ? translateConditionLabel(formValues.condition, t)
    : null;
  const selectedColorLabel =
    formValues.color.length > 0
      ? formValues.color.map((c) => translateColorName(c.name, t)).join(', ')
      : listing?.color
        ? listing.color
            .split(',')
            .map((part) => translateColorName(part.trim(), t))
            .join(', ')
        : null;
  const displayPrice = resolveDisplayPrice(
    priceText,
    formValues.price,
    listing?.price
  );
  const activeParcelSize =
    formValues.parcel_size ?? normalizeParcelSize(listing?.parcel_size);
  const deliveryMode = normalizeDeliveryMode(
    formValues.delivery_mode ?? String(listing?.delivery_mode ?? 'both')
  );
  const showParcelSizeSection = deliveryModeIncludesShipping(deliveryMode);
  const showPickupAddressesSection = listingIncludesPickup(deliveryMode);

  useEffect(() => {
    const next = pickListingReturnParams(routeParams);
    if (next.return_listing_id || next.return_to) {
      editReturnParamsRef.current = { ...editReturnParamsRef.current, ...next };
    }
  }, [routeParams]);

  useEffect(() => {
    setField('draftTitle', title);
  }, [setField, title]);
  useEffect(() => {
    setField('draftDescription', description);
  }, [setField, description]);
  useEffect(() => {
    setField('draftCity', city);
  }, [setField, city]);
  useEffect(() => {
    setField('draftPriceText', priceText);
    const numeric = Number(priceText.replace(/[^0-9.]/g, ''));
    setField(
      'price',
      Number.isFinite(numeric) && numeric > 0 ? numeric : undefined
    );
  }, [setField, priceText]);
  useEffect(() => {
    setField('draftPhotos', photos);
  }, [setField, photos]);

  useFocusEffect(
    useCallback(() => {
      if (!listingId) return;
      const state = useEditListingFormStore.getState().values;
      if (state.listingId !== listingId) return;

      const nextPrice =
        state.draftPriceText ||
        (typeof state.price === 'number' ? String(state.price) : '');
      if (nextPrice) {
        setPriceText(nextPrice);
      }

      const parcel = state.parcel_size ?? normalizeParcelSize(listing?.parcel_size);
      if (parcel && formValues.parcel_size !== parcel) {
        setField('parcel_size', parcel);
      }
    }, [formValues.parcel_size, listing?.parcel_size, listingId, setField])
  );

  useEffect(() => {
    if (!listingId) {
      setError(new Error(t('common.error')));
      setLoading(false);
      return;
    }

    const restoreFromDrafts = () => {
      const snapshot = listingSnapshotRef.current;
      const state = useEditListingFormStore.getState().values;
      if (snapshot) {
        setListing(snapshot);
      }
      setTitle(state.draftTitle ?? snapshot?.title ?? '');
      setDescription(state.draftDescription ?? snapshot?.description ?? '');
      setCity(state.draftCity ?? snapshot?.city ?? '');
      setPriceText(
        state.draftPriceText ??
          (typeof state.price === 'number'
            ? String(state.price)
            : snapshot
              ? String(snapshot.price)
              : '')
      );
      if (state.draftPhotos.length > 0) {
        const serverPhotos = snapshot ? photosFromListing(snapshot) : [];
        const localNewPhotos = state.draftPhotos.filter(
          (p) =>
            p.isNew ??
            (!p.uri.startsWith('http://') && !p.uri.startsWith('https://'))
        );
        setPhotos(
          localNewPhotos.length > 0
            ? [...serverPhotos, ...localNewPhotos]
            : serverPhotos.length > 0
              ? serverPhotos
              : state.draftPhotos.map((p) => ({
                  uri: p.uri,
                  type: p.type,
                  name: p.name,
                  id: p.id,
                  orderIndex: p.orderIndex,
                  isNew:
                    p.isNew ??
                    (!p.uri.startsWith('http://') && !p.uri.startsWith('https://'))
                }))
        );
      } else if (snapshot) {
        setPhotos(photosFromListing(snapshot));
      }
      setLoading(false);
      setError(null);
    };

    if (
      useEditListingFormStore.getState().values.listingId === listingId &&
      listingSnapshotRef.current
    ) {
      restoreFromDrafts();
      return;
    }

    const fetchListing = async () => {
      try {
        setLoading(true);
        setError(null);
        removedPhotoIdsRef.current = [];
        const { data, error: apiError } = await getListingById(listingId);

        if (apiError) {
          setError(apiError);
          setListing(null);
          return;
        }

        if (!data) {
          setError(new Error(t('feed.listingDetail.notFound')));
          setListing(null);
          return;
        }

        if (user?.id && data.seller_id !== user.id) {
          setError(new Error(t('profile.editListing.notOwner')));
          setListing(null);
          return;
        }

        const listingCopy = cloneListingDetail(data);
        listingSnapshotRef.current = listingCopy;
        setListing(listingCopy);
        setTitle(data.title);
        setDescription(data.description ?? '');
        setCity(data.city ?? '');

        const initialPhotos = photosFromListing(data);
        setPhotos(initialPhotos);

        const categoryCtx =
          data.category_id != null
            ? await getCategoryFilterContext(String(data.category_id))
            : null;

        const categoryGender = categoryCtx?.gender ?? '';
        const categoryType = (categoryCtx?.type ?? undefined) as SellCategoryType | undefined;
        const dm = String(data.delivery_mode ?? 'both').toLowerCase() as
          | 'pickup'
          | 'shipping'
          | 'both';
        const ps = normalizeParcelSize(data.parcel_size);

        hydrateFromListing({
          listingId,
          title: data.title,
          description: data.description,
          price: data.price,
          city: data.city,
          photos: initialPhotos,
          category:
            data.category_id != null
              ? {
                  id: Number(data.category_id),
                  name: data.category ?? '',
                  gender: categoryGender,
                  slug: categoryCtx?.slugs?.[0] ?? null
                }
              : null,
          categoryGender: categoryGender || undefined,
          categoryType,
          brand: data.brand ? { id: 0, name: data.brand } : null,
          condition: data.condition ?? undefined,
          size: data.size ? { id: 0, label: data.size } : null,
          color: parseListingColorField(data.color),
          delivery_mode: dm,
          parcel_size: ps
        });
        setPriceText(
          useEditListingFormStore.getState().values.draftPriceText ||
            String(data.price ?? '')
        );
      } catch (err) {
        setError(err instanceof Error ? err : new Error(t('common.error')));
        setListing(null);
      } finally {
        setLoading(false);
      }
    };

    void fetchListing();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-fetch uniquement si l'ID change
  }, [listingId, user?.id]);

  const requestPermissions = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        t('common.permissionRequired'),
        t('profile.editListing.permissionPhotos')
      );
      return false;
    }
    return true;
  };

  const appendPickedAssets = (assets: ImagePicker.ImagePickerAsset[]) => {
    const slotsLeft = MAX_LISTING_PHOTOS - photos.length;
    if (slotsLeft <= 0) {
      Alert.alert(t('common.error'), t('profile.editListing.maxPhotos'));
      return;
    }

    const limitedAssets = assets.slice(0, slotsLeft);
    if (limitedAssets.length < assets.length) {
      Alert.alert(t('common.error'), t('profile.editListing.maxPhotos'));
    }

    const newPhotos = assetsToListingPhotos(limitedAssets).map((photo) => ({
      ...photo,
      isNew: true as const
    }));
    setPhotos((prev) => [...prev, ...newPhotos]);
  };

  const pickImage = async () => {
    if (photos.length >= MAX_LISTING_PHOTOS) {
      Alert.alert(t('common.error'), t('profile.editListing.maxPhotos'));
      return;
    }

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
    if (photos.length >= MAX_LISTING_PHOTOS) {
      Alert.alert(t('common.error'), t('profile.editListing.maxPhotos'));
      return;
    }

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
    setPhotos((prev) => {
      const target = prev[index];
      if (target?.id && !target.isNew) {
        removedPhotoIdsRef.current = [...removedPhotoIdsRef.current, target.id];
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleEditBack = () => {
    const fromRoute = pickListingReturnParams(routeParams);
    const ctx: ListingReturnParams = { ...editReturnParamsRef.current, ...fromRoute };
    navigateBackFromEditListing(router, ctx);
  };

  const finishSaveFlow = (messageKey: 'profile.editListing.updatedSuccess' | 'profile.editListing.updatedAndBoostedSuccess') => {
    setPostSaveBoostOffer(false);
    handleEditBack();
    Alert.alert(t('common.success'), t(messageKey));
  };

  const handlePostSaveBoost = async (durationDays: 3 | 7) => {
    if (!listingId || !user?.id || boostPaying) return;

    setBoostPaying(true);
    try {
      await runBoostPayment({
        listingId,
        sellerId: user.id,
        sponsorType: 'listing',
        durationDays,
        initPaymentSheet,
        presentPaymentSheet
      });
      finishSaveFlow('profile.editListing.updatedAndBoostedSuccess');
    } catch (e) {
      if (e instanceof BoostPaymentCancelledError) return;
      Alert.alert(
        t('feed.checkout.paymentFailed'),
        e instanceof Error ? e.message : t('auth.signUp.somethingWrong')
      );
    } finally {
      setBoostPaying(false);
    }
  };

  const handleSave = async () => {
    if (!listingId) return;

    const listingBase = listing ?? listingSnapshotRef.current;
    if (!listingBase) {
      Alert.alert(t('common.error'), t('feed.listingDetail.notFound'));
      return;
    }

    if (!title.trim()) {
      Alert.alert(t('sell.incompleteForm'), t('profile.editListing.titleRequired'));
      return;
    }

    if (photos.length === 0) {
      Alert.alert(t('sell.incompleteForm'), t('profile.editListing.photosRequired'));
      return;
    }

    const priceNumber = resolveEditPriceNumber(formValues.price, priceText);
    if (Number.isNaN(priceNumber) || priceNumber <= 0) {
      Alert.alert(t('common.error'), t('sell.invalidPrice'));
      return;
    }

    if (formValues.brand?.name && isBlockedBrandName(formValues.brand.name)) {
      Alert.alert(t('common.error'), t('sell.blockedBrand'));
      return;
    }

    const deliveryModeForSave =
      formValues.delivery_mode ?? String(listingBase.delivery_mode ?? 'both').toLowerCase();
    const includesShipping =
      deliveryModeForSave === 'shipping' || deliveryModeForSave === 'both';
    const existingParcelSize = normalizeParcelSize(listingBase.parcel_size);

    if (includesShipping && !activeParcelSize && !existingParcelSize) {
      setParcelSizeError(t('sell.parcelSize.required'));
      Alert.alert(t('sell.incompleteForm'), t('sell.parcelSize.required'));
      return;
    }

    const includesPickup = listingIncludesPickup(deliveryModeForSave);
    if (includesPickup && !pickupPrimaryComplete) {
      setPickupPrimaryError(t('sell.pickupAddresses.primaryRequired'));
      Alert.alert(t('sell.incompleteForm'), t('sell.pickupAddresses.primaryRequired'));
      return;
    }

    if (!user?.id) {
      Alert.alert(t('common.error'), t('common.error'));
      return;
    }

    setParcelSizeError(undefined);
    setPickupPrimaryError(undefined);
    setSaving(true);
    setError(null);

    try {
      for (const photoId of removedPhotoIdsRef.current) {
        const { error: deleteError } = await deleteListingPhoto(photoId, listingId);
        if (deleteError) {
          throw new Error(
            typeof deleteError === 'string' ? deleteError : t('common.error')
          );
        }
      }

      const orderedPhotoIds: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i]!;
        if (photo.isNew) {
          const filename = buildListingStorageFilename(i, photo.name);
          const { data: photoUrl, error: uploadError } = await uploadListingPhoto(
            photo,
            user.id,
            listingId,
            filename
          );
          if (uploadError || !photoUrl) {
            throw uploadError ?? new Error(t('common.error'));
          }
          const { data: row, error: addError } = await addListingPhoto(
            listingId,
            photoUrl,
            temporaryListingPhotoOrderIndex(orderedPhotoIds.length)
          );
          if (addError || !row) {
            throw new Error(
              typeof addError === 'string' ? addError : t('common.error')
            );
          }
          orderedPhotoIds.push(row.id);
        } else if (photo.id) {
          orderedPhotoIds.push(photo.id);
        }
      }

      if (orderedPhotoIds.length > 0) {
        const { error: reorderError } = await reorderListingPhotos(
          listingId,
          orderedPhotoIds
        );
        if (reorderError) {
          throw new Error(
            typeof reorderError === 'string' ? reorderError : t('common.error')
          );
        }
      }

      const selectedCategory = normalizeEditCategory(formValues.category);
      const nextCategoryLabel =
        selectedCategory?.name ?? listingBase.category ?? null;
      const nextBrand = normalizeEditBrand(formValues.brand) ?? listingBase.brand ?? null;
      const nextSize = normalizeEditSize(formValues.size) ?? listingBase.size ?? null;
      const nextColor =
        serializeListingColors(formValues.color) ?? listingBase.color ?? null;

      let pickupSnapshot = listingPickupSnapshotFromProfile({ primary: null, work: null });
      if (includesPickup) {
        const pickupAddresses = await fetchProfilePickupAddresses(supabase, user.id);
        if (!pickupAddresses.primary) {
          setPickupPrimaryError(t('sell.pickupAddresses.primaryRequired'));
          Alert.alert(t('sell.incompleteForm'), t('sell.pickupAddresses.primaryRequired'));
          return;
        }
        pickupSnapshot = listingPickupSnapshotFromProfile(pickupAddresses);
      }

      const { data, error: apiError } = await updateListing(listingId, {
        title: title.trim(),
        description: description.trim() || null,
        price: priceNumber,
        city: city.trim() || null,
        category: nextCategoryLabel,
        category_id: selectedCategory?.id ?? undefined,
        brand: nextBrand,
        condition: formValues.condition ?? listingBase.condition ?? null,
        size: nextSize,
        color: nextColor,
        parcel_size: includesShipping
          ? activeParcelSize ?? existingParcelSize ?? null
          : null,
        delivery_mode: deliveryModeForSave as ListingDeliveryMode,
        ...pickupSnapshot
      });

      if (apiError) {
        setError(apiError);
        Alert.alert(t('common.error'), apiError.message);
        return;
      }

      if (!data) {
        Alert.alert(t('common.error'), t('sell.unablePublish'));
        return;
      }

      removedPhotoIdsRef.current = [];
      listingSnapshotRef.current = { ...listingBase, ...data, title: title.trim() };
      setListing((prev) => (prev ? { ...prev, ...data } : prev));

      resetForm();

      const isPublished =
        String(data.status ?? listingBase.status ?? '').toLowerCase() === 'published';
      if (isPublished) {
        setPostSaveBoostOffer(true);
      } else {
        finishSaveFlow('profile.editListing.updatedSuccess');
      }
    } catch (err) {
      const finalError = err instanceof Error ? err : new Error(t('common.error'));
      setError(finalError);
      Alert.alert(t('common.error'), finalError.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <StatusBar style="dark" />
        <SafeAreaView style={styles.container}>
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>{t('profile.editListing.loading')}</Text>
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
              {error?.message || t('feed.listingDetail.notFound')}
            </Text>
            <Button
              title={t('common.back')}
              onPress={handleEditBack}
              variant="primary-green"
              style={styles.backButton}
            />
          </View>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container} edges={['top']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.header}>
            <HeaderBackButton onPress={handleEditBack} />
            <Text style={styles.headerTitle}>{t('profile.editListing.screenTitle')}</Text>
            <View style={styles.headerRightPlaceholder} />
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.photosSection}>
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
                    <View key={`${photo.id ?? photo.uri}-${index}`} style={styles.photoItem}>
                      <Image source={{ uri: photo.uri }} style={styles.photo} />
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => removePhoto(index)}
                      >
                        <Text style={styles.removeButtonText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}

                  {photos.length < MAX_LISTING_PHOTOS ? (
                    <>
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
                    </>
                  ) : null}
                </ScrollView>
              )}

              <Text style={[styles.photoHint, { textAlign: 'center' }]}>
                {t('profile.editListing.addUpToPhotos')}
              </Text>
            </View>

            <View style={styles.sectionSeparator} />

            <View style={[styles.fieldGroup, { marginTop: 8 }]}>
              <Text style={styles.fieldLabel}>{t('sell.title')}</Text>
              <TextInput
                style={styles.textInput}
                placeholder={t('sell.titlePlaceholder')}
                placeholderTextColor={theme.colors.textSecondary}
                value={title}
                onChangeText={setTitle}
                maxLength={TITLE_MAX}
              />
              <View style={styles.fieldFooterRow}>
                <Text style={styles.counterText}>
                  {t('sell.characterLeft', { count: TITLE_MAX - title.length })}
                </Text>
              </View>
            </View>

            <View style={styles.sectionSeparator} />

            <View style={[styles.fieldGroup, { marginTop: 20 }]}>
              <Text style={styles.fieldLabel}>{t('sell.description')}</Text>
              <TextInput
                style={[styles.textInput, styles.descriptionInput]}
                placeholder={t('sell.descriptionPlaceholder')}
                placeholderTextColor={theme.colors.textSecondary}
                value={description}
                onChangeText={setDescription}
                multiline
                maxLength={DESCRIPTION_MAX}
              />
              <View style={styles.fieldFooterRow}>
                <Text style={styles.counterText}>
                  {t('sell.characterLeft', { count: DESCRIPTION_MAX - description.length })}
                </Text>
              </View>
            </View>

            <View style={styles.sectionSeparator} />

            <View style={[styles.fieldGroup, { marginTop: 20 }]}>
              <Text style={styles.fieldLabel}>{t('sell.priceChf')}</Text>
              <TextInput
                style={styles.textInput}
                placeholder="0"
                placeholderTextColor={theme.colors.textSecondary}
                value={priceText}
                onChangeText={(text) => setPriceText(text.replace(/[^0-9.]/g, ''))}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.sectionSeparator} />

            <View style={[styles.fieldGroup, { marginTop: 20 }]}>
              <Text style={styles.fieldLabel}>{t('sell.city')}</Text>
              <TextInput
                style={styles.textInput}
                placeholder={t('profile.myAddress.cityExample')}
                placeholderTextColor={theme.colors.textSecondary}
                value={city}
                onChangeText={setCity}
                maxLength={50}
              />
            </View>

            {error && <Text style={styles.inlineError}>{error.message}</Text>}

            <View style={styles.listSection}>
              <TouchableOpacity
                style={[styles.listRow, styles.listRowFirst]}
                activeOpacity={0.7}
                onPress={() => router.push('/tabs/profile/edit-listing/category')}
              >
                <Text style={styles.listRowLabel}>{t('sell.category')}</Text>
                <View style={styles.listRowRight}>
                  {selectedCategoryLabel ? (
                    <Text style={styles.listRowValue}>{selectedCategoryLabel}</Text>
                  ) : null}
                  <Feather name="chevron-right" size={18} color={theme.colors.textSecondary} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.listRow}
                activeOpacity={0.7}
                onPress={() => router.push('/tabs/profile/edit-listing/brand')}
              >
                <Text style={styles.listRowLabel}>{t('sell.brand')}</Text>
                <View style={styles.listRowRight}>
                  {selectedBrandLabel ? (
                    <Text style={styles.listRowValue}>
                      {formatBrandDisplayLabel(formValues.brand, t('filters.other')) ??
                        selectedBrandLabel}
                    </Text>
                  ) : null}
                  <Feather name="chevron-right" size={18} color={theme.colors.textSecondary} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.listRow}
                activeOpacity={0.7}
                onPress={() => router.push('/tabs/profile/edit-listing/condition')}
              >
                <Text style={styles.listRowLabel}>{t('sell.condition')}</Text>
                <View style={styles.listRowRight}>
                  {selectedConditionLabel ? (
                    <Text style={styles.listRowValue}>{selectedConditionLabel}</Text>
                  ) : null}
                  <Feather name="chevron-right" size={18} color={theme.colors.textSecondary} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.listRow}
                activeOpacity={0.7}
                onPress={() => router.push('/tabs/profile/edit-listing/size')}
              >
                <Text style={styles.listRowLabel}>{t('sell.size')}</Text>
                <View style={styles.listRowRight}>
                  {displaySizeLabel ? (
                    <Text style={styles.listRowValue}>{displaySizeLabel}</Text>
                  ) : null}
                  <Feather name="chevron-right" size={18} color={theme.colors.textSecondary} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.listRow}
                activeOpacity={0.7}
                onPress={() => router.push('/tabs/profile/edit-listing/color')}
              >
                <Text style={styles.listRowLabel}>{t('sell.color')}</Text>
                <View style={styles.listRowRight}>
                  {selectedColorLabel ? (
                    <Text style={styles.listRowValue}>{selectedColorLabel}</Text>
                  ) : null}
                  <Feather name="chevron-right" size={18} color={theme.colors.textSecondary} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.listRow}
                activeOpacity={0.7}
                onPress={() => router.push('/tabs/profile/edit-listing/price')}
              >
                <Text style={styles.listRowLabel}>{t('sell.price')}</Text>
                <View style={styles.listRowRight}>
                  {displayPrice != null ? (
                    <Text style={styles.listRowValue}>{displayPrice} CHF</Text>
                  ) : null}
                  <Feather name="chevron-right" size={18} color={theme.colors.textSecondary} />
                </View>
              </TouchableOpacity>
            </View>

            <DeliveryModeSelector
              selected={deliveryMode}
              onSelect={(value: ListingDeliveryMode) => {
                setField('delivery_mode', value);
                if (!listingIncludesShipping(value)) {
                  setField('parcel_size', undefined);
                  setParcelSizeError(undefined);
                }
                if (!listingIncludesPickup(value)) {
                  setPickupPrimaryError(undefined);
                }
              }}
            />

            {showPickupAddressesSection ? (
              <PickupAddressesSection
                onPrimaryCompleteChange={(complete) => {
                  setPickupPrimaryComplete(complete);
                  if (complete) {
                    setPickupPrimaryError(undefined);
                  }
                }}
                error={pickupPrimaryError}
              />
            ) : null}

            {showParcelSizeSection ? (
              <ParcelSizeSelector
                selected={activeParcelSize}
                onSelect={(value) => {
                  setField('parcel_size', value);
                  if (parcelSizeError) {
                    setParcelSizeError(undefined);
                  }
                }}
                error={parcelSizeError}
              />
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <Button
              title={saving ? t('common.loading') : t('profile.editListing.saveChanges')}
              onPress={handleSave}
              variant="primary-green"
              loading={saving}
              disabled={saving}
              style={styles.saveButton}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <BoostDurationSheet
        visible={postSaveBoostOffer}
        sponsorType="listing"
        paying={boostPaying}
        titleKey="profile.editListing.reboostTitle"
        onClose={() => {
          if (!boostPaying) {
            finishSaveFlow('profile.editListing.updatedSuccess');
          }
        }}
        onConfirm={handlePostSaveBoost}
      />
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
    marginBottom: 8,
    textAlign: 'center'
  },
  backButton: {
    marginTop: 16,
    alignSelf: 'center',
    minWidth: 160
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
  sectionSeparator: {
    height: 1,
    backgroundColor: '#E5E5E5',
    marginHorizontal: -16
  },
  inlineError: {
    ...theme.typography.caption,
    color: '#EF4444',
    marginTop: 4,
    marginBottom: 8
  },
  footer: {
    paddingHorizontal: theme.spacing.horizontalPadding,
    paddingTop: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.backgroundWhite
  },
  saveButton: {
    marginTop: 0
  },
  photosSection: {
    marginBottom: 24
  },
  photoActionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8
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
    width: 167,
    height: 56,
    borderWidth: 1.5,
    borderColor: '#C3EA4F',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.backgroundWhite,
    gap: 8
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
    marginTop: 16,
    textAlign: 'center'
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
  }
});
