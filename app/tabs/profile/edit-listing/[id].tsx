import React, { useEffect, useRef, useState } from 'react';
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
  Image,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { Button } from '../../../../components/ui/Button';
import { AppIcon } from '../../../../components/ui/AppIcon';
import { HeaderBackButton } from '../../../../components/ui/HeaderBackButton';
import { theme } from '../../../../lib/theme';
import {
  addListingPhoto,
  cloneListingDetail,
  getListingById,
  updateListing,
  uploadListingPhoto,
  type ListingDetail
} from '../../../../lib/api';
import { useEditListingFormStore } from '../../../../lib/store/editListingForm';
import { getCategoryFilterContext } from '../../../../lib/api/filters';
import type { ParcelSizeValue, SellCategoryType } from '../../../../lib/store/sellForm';
import {
  normalizeEditBrand,
  normalizeEditCategory,
  normalizeEditSize,
  resolveListingId
} from '../../../../lib/edit-listing/normalize';
import { useAuthStore } from '../../../../stores/authStore';
import { useTranslation } from 'react-i18next';
import { translateConditionLabel } from '../../../../lib/conditionI18n';

const TITLE_MAX = 60;
const DESCRIPTION_MAX = 300;

const PARCEL_SIZE_OPTIONS: { value: ParcelSizeValue; labelKey: string }[] = [
  { value: 'small', labelKey: 'sell.parcelSize.small' },
  { value: 'large', labelKey: 'sell.parcelSize.large' },
  { value: 'xlarge', labelKey: 'sell.parcelSize.xlarge' }
];

function deliveryModeIncludesShipping(mode: string | undefined): boolean {
  const dm = String(mode ?? 'both').toLowerCase();
  return dm === 'shipping' || dm === 'both';
}

type Photo = {
  uri: string;
  type?: string;
  name?: string;
  isNew?: boolean;
};

export default function EditListingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id: idParam } = useLocalSearchParams<{ id: string | string[] }>();
  const listingId = resolveListingId(idParam);
  const { user } = useAuthStore();
  const { values: formValues, setField, resetForm } = useEditListingFormStore();
  const listingSnapshotRef = useRef<ListingDetail | null>(null);

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [title, setTitle] = useState(formValues.draftTitle ?? '');
  const [description, setDescription] = useState(formValues.draftDescription ?? '');
  const [price, setPrice] = useState(formValues.draftPriceText ?? '');
  const [city, setCity] = useState(formValues.draftCity ?? '');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [parcelSizeError, setParcelSizeError] = useState<string | undefined>();
  const selectedCategoryLabel =
    formValues.category?.name || listing?.category || null;
  const selectedBrandLabel = formValues.brand?.name || listing?.brand || null;
  const selectedSizeLabel = formValues.size?.label || listing?.size || null;
  const selectedConditionLabel = formValues.condition
    ? translateConditionLabel(formValues.condition, t)
    : null;
  const deliveryMode =
    formValues.delivery_mode ?? String(listing?.delivery_mode ?? 'both').toLowerCase();
  const showParcelSizeSection = deliveryModeIncludesShipping(deliveryMode);

  useEffect(() => {
    if (typeof formValues.price === 'number' && Number.isFinite(formValues.price)) {
      setPrice(String(formValues.price));
    }
  }, [formValues.price]);

  useEffect(() => {
    setField('draftTitle', title);
  }, [setField, title]);
  useEffect(() => {
    setField('draftDescription', description);
  }, [setField, description]);
  useEffect(() => {
    setField('draftPriceText', price);
  }, [setField, price]);
  useEffect(() => {
    setField('draftCity', city);
  }, [setField, city]);
  useEffect(() => {
    setField('draftPhotos', photos);
  }, [setField, photos]);

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
      setPrice(
        state.draftPriceText ??
          (typeof state.price === 'number'
            ? String(state.price)
            : snapshot
              ? String(snapshot.price)
              : '')
      );
      setCity(state.draftCity ?? snapshot?.city ?? '');
      if (state.draftPhotos.length > 0) {
        setPhotos(
          state.draftPhotos.map((p) => ({
            uri: p.uri,
            type: p.type,
            name: p.name,
            isNew:
              p.isNew ??
              (!p.uri.startsWith('http://') && !p.uri.startsWith('https://'))
          }))
        );
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

        const listingCopy = cloneListingDetail(data);
        listingSnapshotRef.current = listingCopy;
        setListing(listingCopy);
        setTitle(data.title);
        setDescription(data.description ?? '');
        setPrice(String(data.price));
        setCity(data.city ?? '');

        const initialPhotos: Photo[] =
          data.photos?.map((photo) => ({
            uri: photo.url,
            isNew: false
          })) ?? [];
        setPhotos(initialPhotos);
        setField('draftTitle', data.title);
        setField('draftDescription', data.description ?? '');
        setField('draftPriceText', String(data.price));
        setField('draftCity', data.city ?? '');
        setField('draftPhotos', initialPhotos);

        resetForm();
        setField('listingId', listingId);

        const categoryCtx =
          data.category_id != null
            ? await getCategoryFilterContext(String(data.category_id))
            : null;

        const categoryGender = categoryCtx?.gender ?? '';
        const categoryType = (categoryCtx?.type ?? undefined) as SellCategoryType | undefined;

        setField(
          'category',
          data.category_id != null
            ? {
                id: Number(data.category_id),
                name: data.category ?? '',
                gender: categoryGender
              }
            : null
        );
        if (categoryGender) setField('categoryGender', categoryGender);
        if (categoryType) setField('categoryType', categoryType);

        setField(
          'brand',
          data.brand ? { id: 0, name: data.brand } : null
        );
        setField('condition', data.condition ?? undefined);
        setField(
          'size',
          data.size ? { id: 0, label: data.size } : null
        );
        setField('price', data.price);
        const dm = String(data.delivery_mode ?? 'both').toLowerCase();
        setField('delivery_mode', dm as 'pickup' | 'shipping' | 'both');
        const ps = data.parcel_size;
        if (ps === 'small' || ps === 'large' || ps === 'xlarge') {
          setField('parcel_size', ps);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error(t('common.error')));
        setListing(null);
      } finally {
        setLoading(false);
      }
    };

    void fetchListing();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-fetch uniquement si l’ID change
  }, [listingId]);

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
      const newPhotos = result.assets.map((asset, index) => ({
        uri: asset.uri,
        type: asset.type || 'image/jpeg',
        name: asset.fileName || `photo-${Date.now()}-${index}.jpg`,
        isNew: true as const
      }));
      setPhotos((prev) => [...prev, ...newPhotos]);
    }
  };

  const handleSave = async () => {
    if (!listingId) {
      return;
    }

    const listingBase = listing ?? listingSnapshotRef.current;
    if (!listingBase) {
      Alert.alert(t('common.error'), t('feed.listingDetail.notFound'));
      return;
    }

    const rawPriceNumber = Number(price.replace(/[^0-9.]/g, ''));
    const priceNumber = rawPriceNumber;

    if (Number.isNaN(priceNumber) || priceNumber <= 0) {
      Alert.alert(t('common.error'), t('sell.invalidPrice'));
      return;
    }

    const deliveryModeForSave =
      formValues.delivery_mode ?? String(listingBase.delivery_mode ?? 'both').toLowerCase();
    const includesShipping =
      deliveryModeForSave === 'shipping' || deliveryModeForSave === 'both';
    const existingParcelSize =
      listingBase.parcel_size === 'small' ||
      listingBase.parcel_size === 'large' ||
      listingBase.parcel_size === 'xlarge'
        ? listingBase.parcel_size
        : null;

    if (includesShipping && !formValues.parcel_size && !existingParcelSize) {
      setParcelSizeError(t('sell.parcelSize.required'));
      Alert.alert(t('sell.incompleteForm'), t('sell.parcelSize.required'));
      return;
    }

    setParcelSizeError(undefined);
    setSaving(true);
    setError(null);

    try {
      const selectedCategory = normalizeEditCategory(formValues.category);
      const nextCategoryLabel =
        selectedCategory?.name ?? listingBase.category ?? null;
      const nextBrand = normalizeEditBrand(formValues.brand) ?? listingBase.brand ?? null;
      const nextSize = normalizeEditSize(formValues.size) ?? listingBase.size ?? null;

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
        parcel_size: includesShipping
          ? formValues.parcel_size ?? existingParcelSize
          : null
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

      const newPhotos = photos.filter((p) => p.isNew);
      if (newPhotos.length > 0) {
        if (!user?.id) {
          Alert.alert(t('common.error'), t('common.error'));
          return;
        }

        const existingCount =
          photos.filter((p) => !p.isNew).length;
        for (let i = 0; i < newPhotos.length; i++) {
          const photo = newPhotos[i];
          const filename =
            photo.name ?? `photo-${Date.now()}-${i}.jpg`;
          const { data: photoUrl, error: uploadError } = await uploadListingPhoto(
            photo,
            user.id,
            listingId,
            filename
          );
          if (uploadError || !photoUrl) {
            throw uploadError ?? new Error(t('common.error'));
          }
          await addListingPhoto(listingId, photoUrl, existingCount + i);
        }
      }

      listingSnapshotRef.current = { ...listingBase, ...data, title: title.trim() };
      setListing((prev) => (prev ? { ...prev, ...data } : prev));

      Alert.alert(t('common.success'), t('profile.editListing.updatedSuccess'), [
        {
          text: t('common.ok'),
          onPress: () => {
            resetForm();
            router.back();
          }
        }
      ]);
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
              onPress={() => router.back()}
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
            <HeaderBackButton onPress={() => router.back()} />
            <Text style={styles.headerTitle}>{t('profile.editListing.title')}</Text>
            <View style={styles.headerRightPlaceholder} />
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Photos (lecture/ajout comme sur Sell) */}
            <View style={styles.photosSection}>
              {photos.length === 0 ? (
                <TouchableOpacity
                  style={styles.photoUploadButton}
                  onPress={pickImage}
                  activeOpacity={0.85}
                >
                  <AppIcon name="addSquareOutline" size={20} color="#121212" />
                  <Text style={styles.photoUploadText}>{t('profile.editListing.uploadPhotos')}</Text>
                </TouchableOpacity>
              ) : (
                <ScrollView
                  horizontal
                  style={styles.photosContainer}
                  contentContainerStyle={styles.photosContent}
                  showsHorizontalScrollIndicator={false}
                >
                  {photos.map((photo, index) => (
                    <View key={`${photo.uri}-${index}`} style={styles.photoItem}>
                      <Image source={{ uri: photo.uri }} style={styles.photo} />
                      {photo.isNew && (
                        <TouchableOpacity
                          style={styles.removeButton}
                          onPress={() =>
                            setPhotos((prev) => prev.filter((_, i) => i !== index))
                          }
                        >
                          <Text style={styles.removeButtonText}>×</Text>
                        </TouchableOpacity>
                      )}
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
                {t('profile.editListing.addUpToPhotos')}
              </Text>
            </View>

            <View style={styles.sectionSeparator} />

            {/* Title */}
            <View style={[styles.fieldGroup, { marginTop: 8 }]}>
              <Text style={styles.fieldLabel}>{t('sell.title')}</Text>
              <TextInput
                style={styles.textInput}
                placeholder={t('sell.titlePlaceholder')}
                placeholderTextColor={theme.colors.textSecondary}
                value={title}
                onChangeText={(text) => setTitle(text)}
                maxLength={TITLE_MAX}
              />
              <View style={styles.fieldFooterRow}>
                <Text style={styles.counterText}>
                  {t('sell.characterLeft', { count: TITLE_MAX - title.length })}
                </Text>
              </View>
            </View>

            <View style={styles.sectionSeparator} />

            {/* Description */}
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

            {/* Price */}
            <View style={[styles.fieldGroup, { marginTop: 20 }]}>
              <Text style={styles.fieldLabel}>{t('sell.priceChf')}</Text>
              <TextInput
                style={styles.textInput}
                placeholder="0"
                placeholderTextColor={theme.colors.textSecondary}
                value={price}
                onChangeText={(text) => setPrice(text.replace(/[^0-9.]/g, ''))}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.sectionSeparator} />

            {/* City */}
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

            {error && (
              <Text style={styles.inlineError}>
                {error.message}
              </Text>
            )}

            {/* List fields (Category / Brand / Condition / Size / Price) */}
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
                    <Text style={styles.listRowValue}>{selectedBrandLabel}</Text>
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
                  {selectedSizeLabel ? (
                    <Text style={styles.listRowValue}>{selectedSizeLabel}</Text>
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
                  {typeof formValues.price === 'number' &&
                  Number.isFinite(formValues.price) ? (
                    <Text style={styles.listRowValue}>{formValues.price} CHF</Text>
                  ) : null}
                  <Feather name="chevron-right" size={18} color={theme.colors.textSecondary} />
                </View>
              </TouchableOpacity>
            </View>

            {showParcelSizeSection ? (
              <View style={styles.parcelSection}>
                <Text style={styles.parcelSectionTitle}>{t('sell.parcelSize.title')}</Text>
                {PARCEL_SIZE_OPTIONS.map((option, index) => {
                  const isSelected = formValues.parcel_size === option.value;
                  return (
                    <React.Fragment key={option.value}>
                      {index > 0 ? <View style={styles.parcelSeparator} /> : null}
                      <TouchableOpacity
                        style={[
                          styles.parcelOptionRow,
                          isSelected && styles.parcelOptionRowSelected
                        ]}
                        onPress={() => {
                          setField('parcel_size', option.value);
                          if (parcelSizeError) {
                            setParcelSizeError(undefined);
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
                        <View
                          style={[
                            styles.parcelRadioOuter,
                            isSelected && styles.parcelRadioOuterSelected
                          ]}
                        >
                          {isSelected ? <View style={styles.parcelRadioInner} /> : null}
                        </View>
                      </TouchableOpacity>
                    </React.Fragment>
                  );
                })}
                {parcelSizeError ? (
                  <Text style={styles.inlineError}>{parcelSizeError}</Text>
                ) : null}
              </View>
            ) : null}
          </ScrollView>

          {/* Footer button */}
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
  }
});

