import React, { useEffect, useState } from 'react';
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
import { theme } from '../../../../lib/theme';
import { getListingById, updateListing, type ListingDetail } from '../../../../lib/api';
import { useSellFormStore } from '../../../../lib/store/sellForm';

const TITLE_MAX = 60;
const DESCRIPTION_MAX = 300;

type Photo = {
  uri: string;
  type?: string;
  name?: string;
  isNew?: boolean;
};

export default function EditListingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { values: sellValues, setField, resetForm } = useSellFormStore();

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [city, setCity] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
        const { data, error: apiError } = await getListingById(id);

        if (apiError) {
          setError(apiError);
          setListing(null);
          return;
        }

        if (!data) {
          setError(new Error('Annonce introuvable'));
          setListing(null);
          return;
        }

        setListing(data);
        setTitle(data.title);
        setDescription(data.description ?? '');
        setPrice(String(data.price));
        setCity(data.city ?? '');

        // Photos existantes (URLs déjà normalisées dans getListingById)
        const initialPhotos: Photo[] =
          data.photos?.map((photo) => ({
            uri: photo.url,
            isNew: false
          })) ?? [];
        setPhotos(initialPhotos);

        // Pré-remplir le store Sell avec les infos de l'annonce
        resetForm();
        setField('category', data.category ?? undefined);
        setField('brand', data.brand ?? undefined);
        setField('condition', data.condition ?? undefined);
        setField('size', data.size ?? undefined);
        setField('price', data.price);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Erreur inconnue'));
        setListing(null);
      } finally {
        setLoading(false);
      }
    };

    void fetchListing();
  }, [id]);

  const requestPermissions = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission requise',
        'Nous avons besoin de l\'accès à vos photos pour modifier une annonce.'
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
        name: asset.fileName || `photo-${Date.now()}.jpg`,
        isNew: true
      }));
      setPhotos((prev) => [...prev, ...newPhotos]);
    }
  };

  const handleSave = async () => {
    if (!id) {
      return;
    }

    const priceFromStore =
      typeof sellValues.price === 'number' && Number.isFinite(sellValues.price)
        ? sellValues.price
        : undefined;
    const rawPriceNumber = Number(price.replace(/[^0-9.]/g, ''));
    const priceNumber = priceFromStore ?? rawPriceNumber;

    if (Number.isNaN(priceNumber) || priceNumber <= 0) {
      Alert.alert('Erreur', 'Veuillez saisir un prix valide.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { data, error: apiError } = await updateListing(id, {
        title: title.trim(),
        description: description.trim() || null,
        price: priceNumber,
        city: city.trim() || null,
        category: sellValues.category ?? listing.category ?? null,
        brand: sellValues.brand ?? listing.brand ?? null,
        condition: sellValues.condition ?? listing.condition ?? null,
        size: sellValues.size ?? listing.size ?? null
      });

      if (apiError) {
        setError(apiError);
        Alert.alert('Erreur', apiError.message);
        return;
      }

      if (!data) {
        Alert.alert('Erreur', 'Impossible de mettre à jour l’annonce.');
        return;
      }

      Alert.alert('Succès', 'Annonce mise à jour avec succès.', [
        {
          text: 'OK',
          onPress: () => router.back()
        }
      ]);
    } catch (err) {
      const finalError = err instanceof Error ? err : new Error('Erreur inconnue');
      setError(finalError);
      Alert.alert('Erreur', finalError.message);
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
            <Text style={styles.loadingText}>Chargement de l&apos;annonce...</Text>
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

  return (
    <>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container} edges={['top']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={0.7}
              style={styles.backButtonHeader}
            >
              <AppIcon name="arrowLeftOutline" size={20} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit listing</Text>
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
                Add up to 5 photos.
              </Text>
            </View>

            <View style={styles.sectionSeparator} />

            {/* Title */}
            <View style={[styles.fieldGroup, { marginTop: 8 }]}>
              <Text style={styles.fieldLabel}>Title</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. White cos sweater"
                placeholderTextColor={theme.colors.textSecondary}
                value={title}
                onChangeText={(text) => setTitle(text)}
                maxLength={TITLE_MAX}
              />
              <View style={styles.fieldFooterRow}>
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
                style={[styles.textInput, styles.descriptionInput]}
                placeholder="e.g. Only worn a few times, true to size"
                placeholderTextColor={theme.colors.textSecondary}
                value={description}
                onChangeText={setDescription}
                multiline
                maxLength={DESCRIPTION_MAX}
              />
              <View style={styles.fieldFooterRow}>
                <Text style={styles.counterText}>
                  {`${DESCRIPTION_MAX - description.length} character left`}
                </Text>
              </View>
            </View>

            <View style={styles.sectionSeparator} />

            {/* Price */}
            <View style={[styles.fieldGroup, { marginTop: 20 }]}>
              <Text style={styles.fieldLabel}>Price (CHF)</Text>
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
              <Text style={styles.fieldLabel}>City</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ex: Genève"
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
                onPress={() => {
                  router.push('/tabs/sell/category');
                }}
              >
                <Text style={styles.listRowLabel}>Category</Text>
                <View style={styles.listRowRight}>
                  {sellValues.category ? (
                    <Text style={styles.listRowValue}>{sellValues.category}</Text>
                  ) : null}
                  <Feather name="chevron-right" size={18} color={theme.colors.textSecondary} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.listRow}
                activeOpacity={0.7}
                onPress={() => {
                  router.push('/tabs/sell/brand');
                }}
              >
                <Text style={styles.listRowLabel}>Brand</Text>
                <View style={styles.listRowRight}>
                  {sellValues.brand ? (
                    <Text style={styles.listRowValue}>{sellValues.brand}</Text>
                  ) : null}
                  <Feather name="chevron-right" size={18} color={theme.colors.textSecondary} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.listRow}
                activeOpacity={0.7}
                onPress={() => {
                  router.push('/tabs/sell/condition');
                }}
              >
                <Text style={styles.listRowLabel}>Condition</Text>
                <View style={styles.listRowRight}>
                  {sellValues.condition ? (
                    <Text style={styles.listRowValue}>{sellValues.condition}</Text>
                  ) : null}
                  <Feather name="chevron-right" size={18} color={theme.colors.textSecondary} />
                </View>
              </TouchableOpacity>

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
                    <Text style={styles.listRowValue}>{sellValues.size}</Text>
                  ) : null}
                  <Feather name="chevron-right" size={18} color={theme.colors.textSecondary} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.listRow}
                activeOpacity={0.7}
                onPress={() => {
                  router.push('/tabs/sell/price');
                }}
              >
                <Text style={styles.listRowLabel}>Price</Text>
                <View style={styles.listRowRight}>
                  {typeof sellValues.price === 'number' &&
                  Number.isFinite(sellValues.price) ? (
                    <Text style={styles.listRowValue}>{sellValues.price} CHF</Text>
                  ) : null}
                  <Feather name="chevron-right" size={18} color={theme.colors.textSecondary} />
                </View>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Footer button */}
          <View style={styles.footer}>
            <Button
              title={saving ? 'Enregistrement...' : 'Save changes'}
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
  backButtonHeader: {
    padding: 8
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
  }
});

