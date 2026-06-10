import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
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
import { useTranslation } from 'react-i18next';
import { theme } from '../../../lib/theme';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../stores/authStore';
import { AppIcon } from '../../../components/ui/AppIcon';
import { getFixedTabBarHeight } from '../../../components/navigation/FloatingTabBar';
import { InfluencerBadge } from '../../../components/InfluencerBadge';
import CoeurIcon from '../../../assets/icons/heart2.svg';
import BellIcon from '../../../assets/icons/bell2.svg';

type ProfileRow = {
  id: string;
  avatar_url: string | null;
  display_name: string | null;
  is_influencer?: boolean | null;
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
  useFeedHeartIcon?: boolean;
  useFeedBellIcon?: boolean;
};

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut, isLoading } = useAuthStore();

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [vacationMode, setVacationMode] = useState<boolean>(false);
  const [updatingVacation, setUpdatingVacation] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [signOutModalOpen, setSignOutModalOpen] = useState(false);

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
        .select(
          'id, avatar_url, display_name, is_influencer, vacation_mode, location, city, country, location_visible'
        )
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
      setError('Unable to load profile.');
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
      setError('Unable to update vacation mode.');
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
          <View style={styles.headerNameRow}>
            <Text style={styles.headerName}>{displayName}</Text>
            {profile?.is_influencer ? <InfluencerBadge size={20} style={styles.headerInfluencerBadge} /> : null}
          </View>
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
          <Text style={styles.editProfileText}>{t('profile.editProfile')}</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#000" />
          <Text style={styles.loadingText}>{t('profile.loadingProfile')}</Text>
        </View>
      )}
      {error && !loading && <Text style={styles.errorText}>{error}</Text>}

      {/* Rows liste */}
      <ProfileItem
        label={t('profile.favoriteItems')}
        icon="likeHeartOutline"
        useFeedHeartIcon
        onPress={() => router.push('/tabs/profile/favorites')}
      />
      {user?.id ? (
        <ProfileItem
          label={t('profile.viewCloset')}
          icon="bookmarkOutline"
          onPress={() =>
            router.push({
              pathname: '/tabs/public-profile' as const,
              params: { user_id: user.id }
            } as any)
          }
        />
      ) : null}
      <ProfileItem
        label={t('profile.settingsScreen.payment')}
        icon="walletOutline"
        onPress={() => router.push('/tabs/profile/wallet')}
      />
      <ProfileItem
        label={t('profile.myOrders')}
        icon="billListOutline"
        onPress={() => router.push('/tabs/profile/orders')}
      />
      <ProfileItem
        label={t('profile.notifications')}
        icon="notificationsBellOutline"
        useFeedBellIcon
        onPress={() =>
          router.push({
            pathname: '/tabs/profile/notifications',
            params: { from: 'profile' }
          } as any)
        }
      />
      <ProfileItem
        label={t('sell.activateAccount')}
        icon="walletOutline"
        onPress={() => router.push('/tabs/profile/activate-seller-account' as any)}
      />
      <ProfileItem
        label={t('profile.settings')}
        icon="settingsOutline"
        onPress={() => router.push('/tabs/profile/settings')}
      />
      <ProfileItem
        label={t('profile.legalInfo')}
        icon="documentTextOutline"
        onPress={() => router.push('/tabs/profile/legal')}
      />
      <ProfileItem
        label={t('profile.helpCenter')}
        icon="questionCircleOutline"
        onPress={() => router.push('/tabs/profile/help')}
      />
      {/* Mode vacance dans la même liste */}
      <View style={styles.row}>
        <View style={styles.rowLeft}>
          <AppIcon name="eyeClosedOutline" size={20} color="#000000" />
          <Text style={styles.rowLabel}>{t('profile.vacationMode')}</Text>
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
        label={t('profile.signOut')}
        icon="exitOutline"
        onPress={() => {
          setSignOutModalOpen(true);
        }}
      />

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/tabs/profile/legal')}>
          <Text style={styles.footerLink}>{t('common.privacyPolicy')}</Text>
        </TouchableOpacity>
        <Text style={styles.footerSeparator}>·</Text>
        <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/tabs/profile/legal')}>
          <Text style={styles.footerLink}>{t('common.termsAndConditions')}</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={signOutModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSignOutModalOpen(false)}
      >
        <Pressable style={styles.confirmOverlay} onPress={() => setSignOutModalOpen(false)}>
          <Pressable style={styles.confirmCard} onPress={() => null}>
            <Text style={styles.confirmTitle}>{t('profile.signOut')}</Text>
            <Text style={styles.confirmMessage}>{t('profile.signOutConfirm')}</Text>
            <View style={styles.confirmSeparator} />
            <View style={styles.confirmActionsRow}>
              <Pressable style={styles.confirmCancelBtn} onPress={() => setSignOutModalOpen(false)}>
                <Text style={styles.confirmCancelText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                style={styles.confirmSignOutBtn}
                onPress={() => {
                  setSignOutModalOpen(false);
                  if (!isLoading) {
                    signOut();
                  }
                }}
              >
                <Text style={styles.confirmSignOutText}>{t('profile.signOut')}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );

  // Espace pour éviter que le contenu soit masqué par la tab bar fixe.
  const scrollPaddingBottom = getFixedTabBarHeight(insets.bottom) + 8;

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

function ProfileItem({ label, icon, onPress, useFeedHeartIcon, useFeedBellIcon }: ProfileItemProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View style={styles.row}>
        <View style={styles.rowLeft}>
          {useFeedHeartIcon ? (
            <View style={styles.favoriteHeartWrap}>
              <CoeurIcon width={20} height={20} stroke="#000000" fill="none" strokeWidth={1.7} />
            </View>
          ) : useFeedBellIcon ? (
            <View style={styles.feedBellWrap}>
              <BellIcon width={30} height={30} color="#000000" />
            </View>
          ) : (
            <AppIcon name={icon} size={20} color="#000000" />
          )}
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
    color: '#000000',
    flexShrink: 1
  },
  headerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0
  },
  headerInfluencerBadge: {
    flexShrink: 0
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
  favoriteHeartWrap: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  feedBellWrap: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center'
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
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24
  },
  confirmCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24
  },
  confirmTitle: {
    fontFamily: theme.fontFamily.bold,
    fontSize: 18,
    color: '#000000',
    textAlign: 'center'
  },
  confirmMessage: {
    marginTop: 12,
    fontFamily: theme.fontFamily.regular,
    fontSize: 14,
    color: '#666666',
    textAlign: 'center'
  },
  confirmSeparator: {
    marginTop: 16,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5E5'
  },
  confirmActionsRow: {
    marginTop: 16,
    flexDirection: 'row',
    columnGap: 10
  },
  confirmCancelBtn: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  confirmCancelText: {
    fontFamily: theme.fontFamily.semiBold,
    color: '#000000'
  },
  confirmSignOutBtn: {
    flex: 1,
    backgroundColor: '#C3EA4F',
    borderRadius: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  confirmSignOutText: {
    fontFamily: theme.fontFamily.semiBold,
    color: '#000000'
  }
});

