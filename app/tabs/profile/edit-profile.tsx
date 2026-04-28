import React, { useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuthStore } from '../../../stores/authStore';
import { supabase } from '../../../lib/supabase';
import { theme } from '../../../lib/theme';

type ProfileRow = {
  id: string;
  avatar_url: string | null;
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

export default function EditProfileScreen() {
  const navigation = useNavigation();
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

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingLocationVisible, setUpdatingLocationVisible] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const loadProfile = async () => {
      setLoading(true);
      try {
        let data: any = null;
        // 1) Query complète (inclut les champs GPS)
        const full = await supabase
          .from('profiles')
          .select(
            'id, avatar_url, display_name, bio, about, location, location_visible, city, country, latitude, longitude'
          )
          .eq('id', user.id)
          .maybeSingle();

        if (!full.error) {
          data = full.data;
        } else {
          // 2) Fallback: schéma pas à jour (colonnes manquantes) ou policy restrictive
          const minimal = await supabase
            .from('profiles')
            .select('id, avatar_url, display_name, bio, about, location, location_visible')
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
          setGpsLat(typeof row.latitude === 'number' ? row.latitude : row.latitude != null ? Number(row.latitude as any) : null);
          setGpsLng(typeof row.longitude === 'number' ? row.longitude : row.longitude != null ? Number(row.longitude as any) : null);
          setGpsPermissionDenied(false);
          setAvatarUrl(row.avatar_url ?? null);
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

  const requestPhotoPermissions = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission required',
        'We need access to your photos to change your avatar.'
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

    // Optimistic update
    setAvatarUrl(asset.uri);
    setUploadingAvatar(true);

    try {
      const file = {
        uri: asset.uri,
        type: asset.type || 'image/jpeg',
        name: asset.fileName || `avatar-${Date.now()}.jpg`
      };

      const base64 = await FileSystem.readAsStringAsync(file.uri, {
        // Certaines versions d'Expo n'exposent pas EncodingType, on fallback sur la string 'base64'
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
          error instanceof Error
            ? error.message
            : 'Unable to update profile photo.'
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleToggleLocationVisible = async (value: boolean) => {
    if (!user?.id) return;

    // OFF: persist immediately + clear coords
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
          message: 'Unable to turn off location.'
        });
      } finally {
        setUpdatingLocationVisible(false);
      }
      return;
    }

    // ON: request GPS + reverse geocode, do not persist until Save
    setDetectingLocation(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setGpsPermissionDenied(true);
        setToast({ type: 'error', message: 'Location permission denied.' });
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
      const countryCode = ((place as any)?.isoCountryCode || (place as any)?.countryCode || '').toString().toUpperCase();

      const allowed = ['CH', 'FR', 'DE', 'IT'] as const;
      if (!allowed.includes(countryCode as any)) {
        Alert.alert(
          'Zone non disponible',
          'Bloomi est disponible uniquement en Suisse, France, Allemagne et Italie'
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
        message: 'Unable to get your location.'
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
          country: locationVisible ? (gpsCountry ?? null) : null,
          latitude: locationVisible ? (gpsLat ?? null) : null,
          longitude: locationVisible ? (gpsLng ?? null) : null
        })
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      // Mettre à jour également le username côté Auth (user_metadata)
      await supabase.auth.updateUser({
        data: {
          username: displayNameValue || null
        }
      });

      setToast({
        type: 'success',
        message: 'Profile updated.'
      });

      navigation.goBack();
    } catch (error) {
      setToast({
        type: 'error',
        message:
          error instanceof Error ? error.message : 'Une erreur est survenue lors de la sauvegarde.'
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
            <Text style={styles.modalTitle}>Choose a canton</Text>
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

  // Configurer le bouton "Save" dans le header natif
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: 'Edit profile',
      headerRight: () => (
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaveDisabled}
          activeOpacity={isSaveDisabled ? 1 : 0.7}
          style={{ paddingHorizontal: 8 }}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#000000" />
          ) : (
            <Text
              style={{
                fontSize: 16,
                fontWeight: '600',
                color: '#C3EA4F',
                opacity: isSaveDisabled ? 0.4 : 1
              }}
            >
              Save
            </Text>
          )}
        </TouchableOpacity>
      )
    });
  }, [navigation, isSaveDisabled, saving, handleSave]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          <View style={styles.avatarWrapper}>
            {loading ? (
              <View style={styles.avatarSkeleton}>
                <ActivityIndicator size="small" color="#AAAAAA" />
              </View>
            ) : avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitials}>{getInitials()}</Text>
              </View>
            )}

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handlePickAvatar}
              style={styles.cameraButton}
            >
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color="#4B5563" />
              ) : (
                <Feather name="camera" size={14} color="#4B5563" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Username / display name */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Username</Text>
          {loading ? (
            <View style={styles.textSkeleton} />
          ) : (
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your username"
              placeholderTextColor="#9CA3AF"
              style={styles.displayNameInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}
          <View style={styles.sectionSeparator} />
        </View>

        {/* About me */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>About me</Text>
          {loading ? (
            <View style={styles.textSkeleton} />
          ) : (
            <TextInput
              value={about}
              onChangeText={setAbout}
              placeholder="Tell others a bit about you"
              placeholderTextColor="#9CA3AF"
              multiline
              textAlignVertical="top"
              style={styles.aboutInput}
            />
          )}
          <View style={styles.sectionSeparator} />
        </View>

        {/* Location: GPS par défaut, fallback manuel si permission refusée */}
        {!gpsPermissionDenied ? (
          <>
            {/* My location - toggle visibilité (GPS) */}
            <View style={styles.row}>
              <Text style={styles.rowLabel}>My location</Text>
              <Switch
                value={locationVisible}
                onValueChange={handleToggleLocationVisible}
                trackColor={{ false: '#CCCCCC', true: '#C3EA4F' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#CCCCCC"
                disabled={updatingLocationVisible || loading || detectingLocation}
              />
            </View>

            {locationVisible && gpsCity ? (
              <View style={styles.locationDetectedRow}>
                <Text style={styles.locationDetectedText}>
                  {`📍 ${gpsCity}${gpsCountry ? `, ${gpsCountry}` : ''}`}
                </Text>
              </View>
            ) : null}
          </>
        ) : (
          <>
            {/* Fallback manuel: visible uniquement si permission GPS refusée */}
            <TouchableOpacity activeOpacity={0.7} onPress={() => setLocationModalVisible(true)}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>My location</Text>
                <View style={styles.rowRight}>
                  {loading ? (
                    <View style={styles.locationSkeleton} />
                  ) : (
                    <Text style={styles.rowValue}>{location || 'Select your location'}</Text>
                  )}
                  <Text style={styles.chevron}>{'›'}</Text>
                </View>
              </View>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {renderLocationModal()}
      {renderToast()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: 32
  },
  avatarContainer: {
    marginTop: 24,
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40
  },
  avatarSkeleton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarInitials: {
    fontSize: 28,
    fontWeight: '600',
    color: '#111827'
  },
  cameraButton: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center'
  },
  section: {
    paddingHorizontal: 20
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '400',
    color: '#000000',
    marginBottom: 8
  },
  displayNameInput: {
    fontSize: 16,
    color: '#000000',
    paddingVertical: 8
  },
  aboutInput: {
    minHeight: 72,
    fontSize: 16,
    color: '#000000',
    paddingVertical: 8
  },
  sectionSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5E5'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
    backgroundColor: '#FFFFFF'
  },
  rowLabel: {
    fontSize: 16,
    color: '#000000'
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  rowValue: {
    fontSize: 16,
    color: '#AAAAAA'
  },
  chevron: {
    marginLeft: 6,
    fontSize: 18,
    color: '#AAAAAA'
  },
  textSkeleton: {
    height: 72,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
    marginBottom: 4
  },
  locationSkeleton: {
    width: 120,
    height: 14,
    borderRadius: 4,
    backgroundColor: '#F3F4F6'
  },
  locationDetectedRow: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
    backgroundColor: '#FFFFFF'
  },
  locationDetectedText: {
    fontSize: 14,
    color: '#111827'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end'
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
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000'
  },
  cantonRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5'
  },
  cantonText: {
    fontSize: 16,
    color: '#111827'
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
    textAlign: 'center'
  },
  toastError: {
    backgroundColor: '#EF4444'
  },
  toastSuccess: {
    backgroundColor: '#16A34A'
  }
});

