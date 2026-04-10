import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../stores/authStore';
import { AppIcon } from '../../../components/ui/AppIcon';

type ProfileRow = {
  id: string;
  avatar_url: string | null;
  display_name: string | null;
  vacation_mode: boolean | null;
  location?: string | null;
  city?: string | null;
  country?: string | null;
  location_visible?: boolean | null;
};

type ProfileItemProps = {
  label: string;
  icon: import('../../../lib/assets').IconName;
  onPress: () => void;
};

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut, isLoading } = useAuthStore();

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [vacationMode, setVacationMode] = useState<boolean>(false);
  const [updatingVacation, setUpdatingVacation] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!user?.id) {
      setProfile(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('id, avatar_url, display_name, vacation_mode, location, city, country, location_visible')
        .eq('id', user.id)
        .maybeSingle();

      if (fetchError) {
        setError(fetchError.message);
        setProfile(null);
      } else if (data) {
        const casted = data as ProfileRow;
        setProfile(casted);
        setVacationMode(Boolean(casted.vacation_mode));
      } else {
        setProfile(null);
      }
    } catch {
      setError('Impossible de charger le profil.');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  // Recharger le profil à chaque retour sur l'onglet Profil
  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile])
  );

  const handleToggleVacation = async (value: boolean) => {
    if (!user?.id) return;

    setVacationMode(value);
    setUpdatingVacation(true);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ vacation_mode: value })
        .eq('id', user.id);

      if (updateError) {
        setError(updateError.message);
        setVacationMode((prev) => !prev);
      } else {
        setError(null);
      }
    } catch {
      setError('Impossible de mettre à jour le mode vacance.');
      setVacationMode((prev) => !prev);
    } finally {
      setUpdatingVacation(false);
    }
  };

  const userMeta = (user as any)?.user_metadata ?? {};
  const displayName =
    profile?.display_name ??
    (userMeta.username as string | undefined) ??
    (userMeta.full_name as string | undefined) ??
    'Bloomi user';

  const location = (() => {
    const isGpsVisible = Boolean(profile?.location_visible);
    const city = (profile?.city ?? '').trim();
    const country = (profile?.country ?? '').trim();
    if (isGpsVisible && (city || country)) {
      return [city, country].filter(Boolean).join(', ');
    }
    return profile?.location ?? '';
  })();

  const Content = (
    <View style={styles.inner}>
      {/* Header profil */}
      <View style={styles.header}>
        {profile?.avatar_url ? (
          <Image
            source={{ uri: profile.avatar_url }}
            style={styles.avatar}
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <AppIcon name="userOutline" size={22} color="#000000" />
          </View>
        )}
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerName}>{displayName}</Text>
          <View style={styles.headerLocationRow}>
            <AppIcon name="mapPointOutline" size={11} color="#888888" />
            <Text style={styles.headerLocationText}>{location}</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/tabs/profile/edit-profile')}
          style={styles.editProfileButton}
          activeOpacity={0.8}
        >
          <Text style={styles.editProfileText}>Edit profile</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#000" />
          <Text style={styles.loadingText}>Chargement du profil...</Text>
        </View>
      )}
      {error && !loading && <Text style={styles.errorText}>{error}</Text>}

      {/* Rows liste */}
      <ProfileItem
        label="Favorite items"
        icon="likeHeartOutline"
        onPress={() => router.push('/tabs/profile/favorites')}
      />
      <ProfileItem
        label="Wallet"
        icon="walletOutline"
        onPress={() => router.push('/tabs/profile/wallet')}
      />
      <ProfileItem
        label="My orders"
        icon="billListOutline"
        onPress={() => router.push('/tabs/profile/orders')}
      />
      <ProfileItem
        label="Notifications"
        icon="notificationsBellOutline"
        onPress={() => router.push('/tabs/profile/notifications')}
      />
      <ProfileItem
        label="Activer mon compte vendeur"
        icon="walletOutline"
        onPress={() => router.push('/tabs/profile/activate-seller-account' as any)}
      />
      <ProfileItem
        label="Settings"
        icon="settingsOutline"
        onPress={() => router.push('/tabs/profile/settings')}
      />
      <ProfileItem
        label="Legal information"
        icon="documentTextOutline"
        onPress={() => router.push('/tabs/profile/legal')}
      />
      <ProfileItem
        label="Help center"
        icon="questionCircleOutline"
        onPress={() => router.push('/tabs/profile/help')}
      />
      <ProfileItem
        label="Send your feedback"
        icon="smileCircleOutline"
        onPress={() => router.push('/tabs/profile/feedback')}
      />

      {/* Onglet test pour accéder à la gestion de ses annonces */}
      <ProfileItem
        label="Test – Manage my listings"
        icon="billListOutline"
        onPress={() => router.push('/tabs/profile/my-listings')}
      />

      {/* Mode vacance dans la même liste */}
      <View style={styles.row}>
        <View style={styles.rowLeft}>
          <AppIcon name="eyeClosedOutline" size={20} color="#000000" />
          <Text style={styles.rowLabel}>Mode vacance</Text>
        </View>
        <Switch
          value={vacationMode}
          onValueChange={handleToggleVacation}
          trackColor={{ false: '#E8E8E8', true: '#C3EA4F' }}
          thumbColor="#FFFFFF"
          ios_backgroundColor="#E8E8E8"
          disabled={updatingVacation}
        />
      </View>

      {/* Déconnexion */}
      <ProfileItem
        label="Se déconnecter"
        icon="exitOutline"
        onPress={() => {
          if (!isLoading) {
            signOut();
          }
        }}
      />

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerLink}>Privacy Policy</Text>
        <Text style={styles.footerSeparator}>·</Text>
        <Text style={styles.footerLink}>Terms &amp; Conditions</Text>
      </View>
    </View>
  );

  // Espace pour éviter que le contenu soit masqué par la barre d’onglets flottante
  // (aligné avec la logique dans `app/tabs/_layout.tsx` et `FloatingTabBar.tsx`).
  const bottomPad = insets.bottom > 0 ? insets.bottom : 8;
  const floatingTabBarReserveSpace = 20 + 68 + bottomPad + 28;
  const scrollPaddingBottom = floatingTabBarReserveSpace;

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: scrollPaddingBottom }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {Content}
      </ScrollView>
    </SafeAreaView>
  );
}

function ProfileItem({ label, icon, onPress }: ProfileItemProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View style={styles.row}>
        <View style={styles.rowLeft}>
          <AppIcon name={icon} size={20} color="#000000" />
          <Text style={styles.rowLabel}>{label}</Text>
        </View>
        <Feather name="chevron-right" size={18} color="#C0C0C0" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  scroll: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  scrollContent: {
    paddingBottom: 24
  },
  inner: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 10
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 10,
    backgroundColor: '#F2F2F2',
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerTextContainer: {
    flex: 1
  },
  headerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000'
  },
  headerLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2
  },
  headerLocationText: {
    fontSize: 12,
    color: '#888888',
    marginLeft: 3
  },
  editProfileButton: {
    backgroundColor: '#C3EA4F',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20
  },
  editProfileText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000'
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8
  },
  loadingText: {
    fontSize: 12,
    color: '#888888',
    marginLeft: 6
  },
  errorText: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    fontSize: 12,
    color: '#ff3333'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 50,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
    justifyContent: 'space-between'
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  rowLabel: {
    fontSize: 14,
    color: '#000000',
    marginLeft: 14
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: '#FFFFFF'
  },
  footerLink: {
    fontSize: 12,
    color: '#888888'
  },
  footerSeparator: {
    fontSize: 12,
    color: '#888888',
    marginHorizontal: 8
  }
});

