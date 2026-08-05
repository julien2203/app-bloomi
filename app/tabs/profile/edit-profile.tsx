import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { getSafeBottomInset } from '../../../lib/safeArea';
import { useAuthStore } from '../../../stores/authStore';
import { supabase } from '../../../lib/supabase';
import { theme } from '../../../lib/theme';
import { BLOOMI_COUNTRY_CODE } from '../../../lib/bloomiRegion';
import { HeaderBackButton } from '../../../components/ui/HeaderBackButton';
import { Text as UiText } from '../../../components/ui/Text';

type ProfileRow = {
  id: string;
  avatar_url: string | null;
  cover_image?: string | null;
  display_name: string | null;
  bio?: string | null;
  about?: string | null;
  location?: string | null;
  location_visible?: boolean | null;
  city?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

const CANTONS = [
  'Zürich',
  'Bern',
  'Luzern',
  'Uri',
  'Schwyz',
  'Obwalden',
  'Nidwalden',
  'Glarus',
  'Zug',
  'Fribourg',
  'Solothurn',
  'Basel-Stadt',
  'Basel-Landschaft',
  'Schaffhausen',
  'Appenzell Ausserrhoden',
  'Appenzell Innerrhoden',
  'St. Gallen',
  'Graubünden',
  'Aargau',
  'Thurgau',
  'Ticino',
  'Vaud',
  'Valais',
  'Neuchâtel',
  'Genève',
  'Jura'
];

type ToastState = {
  message: string;
  type: 'error' | 'success';
} | null;

type EditFieldModal = 'username' | 'about' | null;

const PAGE_BG = theme.colors.backgroundWhite;
const ROW_DIVIDER = theme.colors.primary;
const MODAL_ROW_DIVIDER = '#E5E5E5';
const INPUT_BORDER = '#D1D5DB';
/** Espace supplémentaire entre la feuille d’édition et le clavier (iOS). */
const KEYBOARD_EXTRA_GAP = 40;
const LABEL_COLOR = '#A0A0A0';
const VALUE_COLOR = '#1A1A1A';
const ICON_BG = '#F0F0F0';
const ICON_COLOR = '#8E8E93';
const LOCATION_ICON_COLOR = '#6B6B6B';
const AVATAR_FALLBACK_BG = '#F0F0F0';
const COVER_FALLBACK_BG = '#F0F0F0';
const COVER_HEIGHT = 160;
const SWITCH_TRACK_OFF = '#D1D1D6';

function FieldIconCircle({
  name,
  filled
}: {
  name: React.ComponentProps<typeof Feather>['name'];
  filled?: boolean;
}) {
  return (
    <View style={styles.fieldIconCircle}>
      <Feather name={name} size={18} color={filled ? LOCATION_ICON_COLOR : ICON_COLOR} />
    </View>
  );
}

export default function EditProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [about, setAbout] = useState('');
  const [location, setLocation] = useState('');
  const [locationVisible, setLocationVisible] = useState(false);
  const [gpsCity, setGpsCity] = useState<string | null>(null);
  const [gpsCountry, setGpsCountry] = useState<string | null>(null);
  const [gpsLat, setGpsLat] = useState<number | null>(null);
  const [gpsLng, setGpsLng] = useState<number | null>(null);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [gpsPermissionDenied, setGpsPermissionDenied] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingLocationVisible, setUpdatingLocationVisible] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [editFieldModal, setEditFieldModal] = useState<EditFieldModal>(null);
  const [modalDraft, setModalDraft] = useState('');
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    if (!editFieldModal) {
      setKeyboardInset(0);
      return;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = Keyboard.addListener(showEvent, (event) => {
      const height = event.endCoordinates.height;
      setKeyboardInset(Math.max(0, height - insets.bottom) + KEYBOARD_EXTRA_GAP);
    });
    const onHide = Keyboard.addListener(hideEvent, () => {
      setKeyboardInset(0);
    });

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [editFieldModal, insets.bottom]);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const loadProfile = async () => {
      setLoading(true);
      try {
        let data: any = null;
        const full = await supabase
          .from('profiles')
          .select(
            'id, avatar_url, cover_image, display_name, bio, about, location, location_visible, city, country, latitude, longitude'
          )
          .eq('id', user.id)
          .maybeSingle();

        if (!full.error) {
          data = full.data;
        } else {
          const minimal = await supabase
            .from('profiles')
            .select('id, avatar_url, cover_image, display_name, bio, about, location, location_visible')
            .eq('id', user.id)
            .maybeSingle();

          if (minimal.error) {
            throw minimal.error;
          }
          data = minimal.data;
        }

        if (data) {
          const row = data as ProfileRow;
          setProfile(row);

          const authUsername =
            (user as any)?.user_metadata?.username ||
            (user as any)?.user_metadata?.full_name ||
            '';

          setDisplayName(row.display_name ?? authUsername ?? '');

          const aboutValue = (row.bio ?? row.about ?? '') || '';
          setAbout(aboutValue);
          setLocation(row.location ?? '');
          setLocationVisible(Boolean(row.location_visible));
          setGpsCity(row.city ?? null);
          setGpsCountry(row.country ?? null);
          setGpsLat(
            typeof row.latitude === 'number'
              ? row.latitude
              : row.latitude != null
                ? Number(row.latitude as any)
                : null
          );
          setGpsLng(
            typeof row.longitude === 'number'
              ? row.longitude
              : row.longitude != null
                ? Number(row.longitude as any)
                : null
          );
          setGpsPermissionDenied(false);
          setAvatarUrl(row.avatar_url ?? null);
          const coverRaw = String(row.cover_image ?? '').trim();
          setCoverImageUrl(coverRaw.length > 0 ? coverRaw : null);
        } else {
          setProfile(null);
          const authUsername =
            (user as any)?.user_metadata?.username ||
            (user as any)?.user_metadata?.full_name ||
            '';
          setDisplayName(authUsername ?? '');
          setAbout('');
          setLocation('');
          setLocationVisible(false);
          setGpsCity(null);
          setGpsCountry(null);
          setGpsLat(null);
          setGpsLng(null);
          setGpsPermissionDenied(false);
          setAvatarUrl(null);
          setCoverImageUrl(null);
        }
      } catch (e) {
        setToast({
          type: 'error',
          message:
            e instanceof Error && e.message
              ? `Unable to load your profile: ${e.message}`
              : 'Unable to load your profile.'
        });
      } finally {
        setLoading(false);
      }
    };

    void loadProfile();
  }, [user?.id]);

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => {
      setToast(null);
    }, 3000);

    return () => clearTimeout(timer);
  }, [toast]);

  const getInitials = () => {
    const name = displayName || (profile?.display_name ?? '');
    if (!name.trim()) return 'B';
    const parts = name.trim().split(' ');
    const first = parts[0]?.[0] ?? '';
    const second = parts[1]?.[0] ?? '';
    return (first + second).toUpperCase();
  };

  const openEditModal = (field: EditFieldModal) => {
    if (!field) return;
    setModalDraft(field === 'username' ? displayName : about);
    setEditFieldModal(field);
  };

  const confirmEditModal = () => {
    if (editFieldModal === 'username') {
      setDisplayName(modalDraft);
    } else if (editFieldModal === 'about') {
      setAbout(modalDraft);
    }
    setEditFieldModal(null);
  };

  const requestPhotoPermissions = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        t('common.error'),
        t('profile.editProfileScreen.permissionPhotos')
      );
      return false;
    }
    return true;
  };

  const handlePickAvatar = async () => {
    if (!user?.id || uploadingAvatar) return;

    const hasPermission = await requestPhotoPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return;
    }

    const asset = result.assets[0];
    const previousAvatar = avatarUrl;

    setAvatarUrl(asset.uri);
    setUploadingAvatar(true);

    try {
      const file = {
        uri: asset.uri,
        type: asset.type || 'image/jpeg',
        name: asset.fileName || `avatar-${Date.now()}.jpg`
      };

      const base64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: (FileSystem as any).EncodingType?.Base64 ?? 'base64'
      });
      const arrayBuffer = decodeBase64(base64);
      const binary = new Uint8Array(arrayBuffer);
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const filePath = `${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, binary, {
          contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
          upsert: true
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        throw new Error('Unable to get the public URL for the avatar.');
      }

      setAvatarUrl(urlData.publicUrl);

      await supabase
        .from('profiles')
        .update({ avatar_url: urlData.publicUrl })
        .eq('id', user.id);
    } catch (error) {
      setAvatarUrl(previousAvatar);
      setToast({
        type: 'error',
        message:
          error instanceof Error ? error.message : 'Unable to update profile photo.'
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handlePickCoverImage = async () => {
    if (!user?.id || uploadingCover) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        t('profile.publicProfile.permissionRequired'),
        t('profile.publicProfile.coverPermission')
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.85,
      aspect: [3, 1]
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;

    const picked = result.assets[0];
    const previousCover = coverImageUrl;
    const coverPath = `${user.id}/cover-${Date.now()}.jpg`;

    setCoverImageUrl(picked.uri);
    setUploadingCover(true);

    try {
      const base64 = await FileSystem.readAsStringAsync(picked.uri, {
        encoding: FileSystem.EncodingType.Base64
      });
      const fileBuffer = decodeBase64(base64);

      const { error: uploadErr } = await supabase.storage.from('cover').upload(coverPath, fileBuffer, {
        upsert: true,
        contentType: picked.mimeType || 'image/jpeg'
      });
      if (uploadErr) throw uploadErr;

      const { data: publicData } = supabase.storage.from('cover').getPublicUrl(coverPath);
      const publicUrl = publicData?.publicUrl ?? '';
      if (!publicUrl) throw new Error(t('profile.publicProfile.unableUpdateCover'));

      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ cover_image: publicUrl })
        .eq('id', user.id);
      if (updateErr) throw updateErr;

      setCoverImageUrl(publicUrl);
    } catch (error) {
      setCoverImageUrl(previousCover);
      setToast({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : t('profile.publicProfile.unableUpdateCover')
      });
    } finally {
      setUploadingCover(false);
    }
  };

  const handleToggleLocationVisible = async (value: boolean) => {
    if (!user?.id) return;

    if (!value) {
      setLocationVisible(false);
      setGpsCity(null);
      setGpsCountry(null);
      setGpsLat(null);
      setGpsLng(null);
      setUpdatingLocationVisible(true);
      try {
        const { error } = await supabase
          .from('profiles')
          .update({
            location_visible: false,
            latitude: null,
            longitude: null
          })
          .eq('id', user.id);

        if (error) throw error;
      } catch {
        setToast({
          type: 'error',
          message: t('profile.editProfileScreen.unableLocationOff')
        });
      } finally {
        setUpdatingLocationVisible(false);
      }
      return;
    }

    setDetectingLocation(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setGpsPermissionDenied(true);
        setToast({ type: 'error', message: t('profile.editProfileScreen.locationDenied') });
        setLocationVisible(false);
        return;
      }
      setGpsPermissionDenied(false);

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
      const countryCode = ((place as any)?.isoCountryCode || (place as any)?.countryCode || '')
        .toString()
        .toUpperCase();

      if (countryCode !== BLOOMI_COUNTRY_CODE) {
        Alert.alert(
          t('profile.editProfileScreen.areaUnavailable'),
          t('profile.editProfileScreen.countriesOnly')
        );
        setLocationVisible(false);
        setGpsCity(null);
        setGpsCountry(null);
        setGpsLat(null);
        setGpsLng(null);
        return;
      }

      setLocationVisible(true);
      setGpsCity(cityDetected);
      setGpsCountry(countryCode);
      setGpsLat(lat);
      setGpsLng(lng);
    } catch {
      setToast({
        type: 'error',
        message: t('profile.editProfileScreen.unableLocation')
      });
      setLocationVisible(false);
    } finally {
      setDetectingLocation(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id || saving) return;

    const aboutValue = about.trim();
    const displayNameValue = displayName.trim();
    const locationValue = location.trim();

    setSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          avatar_url: avatarUrl,
          display_name: displayNameValue || null,
          bio: aboutValue || null,
          about: aboutValue || null,
          location: locationValue || null,
          location_visible: locationVisible,
          city: locationVisible ? (gpsCity ?? null) : null,
          country: locationVisible ? BLOOMI_COUNTRY_CODE : null,
          latitude: locationVisible ? (gpsLat ?? null) : null,
          longitude: locationVisible ? (gpsLng ?? null) : null
        })
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      await supabase.auth.updateUser({
        data: {
          username: displayNameValue || null
        }
      });

      setToast({
        type: 'success',
        message: t('profile.editProfileScreen.profileUpdated')
      });

      router.back();
    } catch (error) {
      setToast({
        type: 'error',
        message:
          error instanceof Error ? error.message : 'Something went wrong while saving.'
      });
    } finally {
      setSaving(false);
    }
  };

  const renderLocationModal = () => (
    <Modal
      visible={locationModalVisible}
      animationType="slide"
      transparent
      onRequestClose={() => setLocationModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('profile.editProfileScreen.chooseCanton')}</Text>
            <TouchableOpacity
              onPress={() => setLocationModalVisible(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather name="x" size={20} color="#111827" />
            </TouchableOpacity>
          </View>
          <ScrollView>
            {CANTONS.map((canton) => (
              <TouchableOpacity
                key={canton}
                style={styles.cantonRow}
                onPress={() => {
                  setLocation(canton);
                  setLocationModalVisible(false);
                }}
              >
                <Text style={styles.cantonText}>{canton}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderEditFieldModal = () => {
    if (!editFieldModal) return null;
    const title =
      editFieldModal === 'username'
        ? t('profile.editProfileScreen.username')
        : t('profile.editProfileScreen.aboutMe');
    const isAbout = editFieldModal === 'about';

    return (
      <Modal
        visible
        animationType="slide"
        transparent
        onRequestClose={() => setEditFieldModal(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setEditFieldModal(null)}>
            <Pressable
              style={[
                styles.editModalSheet,
                {
                  marginBottom: keyboardInset,
                  paddingBottom: Math.max(getSafeBottomInset(insets.bottom), 20)
                }
              ]}
              onPress={() => {}}
            >
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setEditFieldModal(null)} hitSlop={12}>
                  <Text style={styles.editModalCancel}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>{title}</Text>
                <TouchableOpacity onPress={confirmEditModal} hitSlop={12}>
                  <Text style={styles.editModalDone}>{t('common.confirm')}</Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
                keyboardDismissMode="interactive"
                contentContainerStyle={styles.editModalScrollContent}
              >
                <TextInput
                  value={modalDraft}
                  onChangeText={setModalDraft}
                  placeholder={
                    isAbout
                      ? t('profile.editProfileScreen.aboutMe')
                      : t('profile.editProfileScreen.username')
                  }
                  placeholderTextColor={LABEL_COLOR}
                  style={[styles.editModalInput, isAbout && styles.editModalInputMultiline]}
                  autoCapitalize={isAbout ? 'sentences' : 'none'}
                  autoCorrect={isAbout}
                  multiline={isAbout}
                  textAlignVertical={isAbout ? 'top' : 'center'}
                  autoFocus
                />
              </ScrollView>
            </Pressable>
        </Pressable>
      </Modal>
    );
  };

  const renderToast = () => {
    if (!toast) return null;

    return (
      <View
        style={[
          styles.toastContainer,
          toast.type === 'error' ? styles.toastError : styles.toastSuccess
        ]}
      >
        <Text style={styles.toastText}>{toast.message}</Text>
      </View>
    );
  };

  const isSaveDisabled = saving || loading;
  const usernameDisplay = displayName.trim() || t('profile.editProfileScreen.username');
  const aboutDisplay = about.trim() || t('profile.editProfileScreen.aboutMe');

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="dark" />

      <View style={styles.header}>
        <HeaderBackButton onPress={() => router.back()} />
        <UiText variant="body" style={styles.headerTitle}>
          {t('profile.editProfileScreen.title')}
        </UiText>
        <Pressable
          onPress={handleSave}
          disabled={isSaveDisabled}
          style={({ pressed }) => [
            styles.saveButton,
            isSaveDisabled && styles.saveButtonDisabled,
            pressed && !isSaveDisabled && styles.saveButtonPressed
          ]}
          hitSlop={10}
        >
          {saving ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <UiText variant="body" style={styles.saveText}>
              {t('common.save')}
            </UiText>
          )}
        </Pressable>
      </View>
      <View style={styles.headerSeparator} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Cover photo */}
        <View style={styles.coverWrap}>
          {loading ? (
            <View style={styles.coverPlaceholder}>
              <ActivityIndicator size="small" color={ICON_COLOR} />
            </View>
          ) : coverImageUrl ? (
            <Image source={{ uri: coverImageUrl }} style={styles.coverImage} />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Text style={styles.coverPlaceholderText}>
                {t('profile.publicProfile.addCover')}
              </Text>
            </View>
          )}
          <Pressable
            onPress={() => {
              void handlePickCoverImage();
            }}
            style={({ pressed }) => [
              styles.coverEditButton,
              pressed && styles.coverEditButtonPressed
            ]}
            disabled={uploadingCover || loading}
            accessibilityRole="button"
            accessibilityLabel={
              coverImageUrl
                ? t('common.edit')
                : t('profile.publicProfile.addCover')
            }
          >
            {uploadingCover ? (
              <ActivityIndicator size="small" color={VALUE_COLOR} />
            ) : (
              <Text style={styles.coverEditButtonText}>{t('common.edit')}</Text>
            )}
          </Pressable>
        </View>

        {/* Profile photo */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrapper}>
            {loading ? (
              <View style={styles.avatarSkeleton}>
                <ActivityIndicator size="small" color={ICON_COLOR} />
              </View>
            ) : avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitials}>{getInitials()}</Text>
              </View>
            )}

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handlePickAvatar}
              style={styles.cameraButton}
              disabled={uploadingAvatar}
            >
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color={ICON_COLOR} />
              ) : (
                <Feather name="camera" size={16} color={ICON_COLOR} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Fields card */}
        <View style={styles.fieldsCard}>
          {/* Row 1 — Username */}
          <TouchableOpacity
            style={styles.fieldRow}
            activeOpacity={0.7}
            onPress={() => openEditModal('username')}
            disabled={loading}
          >
            <FieldIconCircle name="user" />
            <View style={styles.fieldTextCol}>
              <Text style={styles.fieldLabel}>{t('profile.editProfileScreen.username')}</Text>
              {loading ? (
                <View style={styles.valueSkeleton} />
              ) : (
                <Text style={styles.fieldValue} numberOfLines={1}>
                  {usernameDisplay}
                </Text>
              )}
            </View>
            <Feather name="chevron-right" size={16} color={LABEL_COLOR} />
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          {/* Row 2 — About me */}
          <TouchableOpacity
            style={styles.fieldRow}
            activeOpacity={0.7}
            onPress={() => openEditModal('about')}
            disabled={loading}
          >
            <FieldIconCircle name="edit-2" />
            <View style={styles.fieldTextCol}>
              <Text style={styles.fieldLabel}>{t('profile.editProfileScreen.aboutMe')}</Text>
              {loading ? (
                <View style={styles.valueSkeleton} />
              ) : (
                <Text style={styles.fieldValue} numberOfLines={2}>
                  {aboutDisplay}
                </Text>
              )}
            </View>
            <Feather name="chevron-right" size={16} color={LABEL_COLOR} />
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          {/* Row 3 — Location */}
          {gpsPermissionDenied ? (
            <TouchableOpacity
              style={styles.fieldRow}
              activeOpacity={0.7}
              onPress={() => setLocationModalVisible(true)}
              disabled={loading}
            >
              <FieldIconCircle name="map-pin" filled />
              <View style={styles.fieldTextCol}>
                <Text style={styles.fieldValueSingle}>{t('profile.editProfileScreen.myLocation')}</Text>
                {loading ? (
                  <View style={[styles.valueSkeleton, { marginTop: 6 }]} />
                ) : (
                  <Text style={styles.fieldSubValue} numberOfLines={1}>
                    {location || t('profile.editProfileScreen.selectLocation')}
                  </Text>
                )}
              </View>
              <Feather name="chevron-right" size={16} color={LABEL_COLOR} />
            </TouchableOpacity>
          ) : (
            <View style={styles.fieldRow}>
              <FieldIconCircle name="map-pin" filled />
              <View style={styles.fieldTextCol}>
                <Text style={styles.fieldValueSingle}>{t('profile.editProfileScreen.myLocation')}</Text>
                {locationVisible && gpsCity ? (
                  <Text style={styles.fieldSubValue} numberOfLines={1}>
                    {`📍 ${gpsCity}${gpsCountry ? `, ${gpsCountry}` : ''}`}
                  </Text>
                ) : null}
              </View>
              {detectingLocation ? (
                <ActivityIndicator size="small" color={ICON_COLOR} />
              ) : (
                <Switch
                  value={locationVisible}
                  onValueChange={handleToggleLocationVisible}
                  trackColor={{ false: SWITCH_TRACK_OFF, true: theme.colors.primary }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={SWITCH_TRACK_OFF}
                  disabled={updatingLocationVisible || loading}
                  style={styles.locationSwitch}
                />
              )}
            </View>
          )}
        </View>

        {!gpsPermissionDenied ? (
          <Text style={styles.locationHelp}>
            {t('profile.editProfileScreen.locationHelp')}
          </Text>
        ) : null}

      </ScrollView>

      {renderLocationModal()}
      {renderEditFieldModal()}
      {renderToast()}
    </SafeAreaView>
  );
}

const AVATAR_SIZE = 112;
const CAMERA_SIZE = 32;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAGE_BG
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.settingsPaddingX,
    paddingVertical: theme.spacing.settingsHeaderPaddingY
  },
  headerTitle: {
    ...theme.typography.settingsHeaderTitle,
    color: theme.colors.appleBlack,
    textAlign: 'center',
    flex: 1
  },
  headerSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.separator
  },
  saveButton: {
    minWidth: theme.spacing.settingsHeaderSideWidth,
    alignItems: 'flex-end',
    justifyContent: 'center'
  },
  saveButtonPressed: {
    opacity: 0.7
  },
  saveButtonDisabled: {
    opacity: 0.35
  },
  saveText: {
    ...theme.typography.settingsHeaderTitle,
    color: theme.colors.primary
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: 40
  },
  coverWrap: {
    height: COVER_HEIGHT,
    width: '100%',
    backgroundColor: COVER_FALLBACK_BG
  },
  coverImage: {
    width: '100%',
    height: COVER_HEIGHT,
    resizeMode: 'cover'
  },
  coverPlaceholder: {
    width: '100%',
    height: COVER_HEIGHT,
    backgroundColor: COVER_FALLBACK_BG,
    alignItems: 'center',
    justifyContent: 'center'
  },
  coverPlaceholderText: {
    fontSize: 14,
    color: LABEL_COLOR,
    textAlign: 'center',
    paddingHorizontal: 24
  },
  coverEditButton: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    minWidth: 64,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5E5'
  },
  coverEditButtonPressed: {
    opacity: 0.75
  },
  coverEditButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: VALUE_COLOR
  },
  avatarSection: {
    marginTop: 16,
    marginBottom: 32,
    alignItems: 'center'
  },
  avatarWrapper: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: AVATAR_FALLBACK_BG,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2
  },
  avatarSkeleton: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: AVATAR_FALLBACK_BG,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: AVATAR_FALLBACK_BG,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarInitials: {
    fontSize: 38,
    fontFamily: theme.fontFamily.semiBold,
    color: VALUE_COLOR
  },
  cameraButton: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: CAMERA_SIZE,
    height: CAMERA_SIZE,
    borderRadius: CAMERA_SIZE / 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4
      },
      android: {
        elevation: 3
      },
      default: {}
    })
  },
  fieldsCard: {
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: INPUT_BORDER,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 6
      },
      android: {
        elevation: 2
      },
      default: {}
    })
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    gap: 12,
    backgroundColor: '#FFFFFF'
  },
  fieldIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ICON_BG,
    alignItems: 'center',
    justifyContent: 'center'
  },
  fieldTextCol: {
    flex: 1,
    minWidth: 0
  },
  fieldLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: theme.fontFamily.semiBold,
    color: LABEL_COLOR,
    marginBottom: 2
  },
  fieldValue: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: theme.fontFamily.regular,
    color: VALUE_COLOR
  },
  fieldValueSingle: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: theme.fontFamily.semiBold,
    color: VALUE_COLOR
  },
  fieldSubValue: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: theme.fontFamily.regular,
    color: LABEL_COLOR
  },
  rowDivider: {
    height: 1,
    backgroundColor: ROW_DIVIDER,
    marginHorizontal: 16
  },
  locationSwitch: {
    transform: Platform.OS === 'ios' ? [{ scaleX: 0.92 }, { scaleY: 0.92 }] : undefined
  },
  locationHelp: {
    marginTop: 8,
    marginHorizontal: 16,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: theme.fontFamily.regular,
    color: LABEL_COLOR
  },
  valueSkeleton: {
    height: 16,
    width: '70%',
    borderRadius: 4,
    backgroundColor: ICON_BG
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end'
  },
  editModalScrollContent: {
    flexGrow: 1
  },
  modalContent: {
    maxHeight: '70%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24
  },
  editModalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: theme.fontFamily.semiBold,
    color: VALUE_COLOR
  },
  editModalCancel: {
    fontSize: 16,
    fontFamily: theme.fontFamily.regular,
    color: LABEL_COLOR
  },
  editModalDone: {
    fontSize: 16,
    fontFamily: theme.fontFamily.semiBold,
    color: theme.colors.primary
  },
  editModalInput: {
    fontSize: 16,
    fontFamily: theme.fontFamily.regular,
    color: VALUE_COLOR,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: INPUT_BORDER,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48
  },
  editModalInputMultiline: {
    minHeight: 120,
    paddingTop: 12
  },
  cantonRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MODAL_ROW_DIVIDER
  },
  cantonText: {
    fontSize: 16,
    fontFamily: theme.fontFamily.regular,
    color: VALUE_COLOR
  },
  toastContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 32,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  toastText: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
    fontFamily: theme.fontFamily.regular
  },
  toastError: {
    backgroundColor: theme.colors.danger
  },
  toastSuccess: {
    backgroundColor: '#16A34A'
  }
});
