import React from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import NotificationIcon from '../../assets/icons/bell2.svg';
import SearchIcon from '../../assets/icons/search2.svg';
import { IconBox } from '../ui/IconBox';
import { theme } from '../../lib/theme';
import { HIT_SLOP_EXTRA, HEADER_ICON_TOUCH_CONTAINER } from '../../lib/touchTargets';
import { useAuthStore } from '../../stores/authStore';
import { openGuestAuthPrompt } from '../../lib/guestAuthPrompt';
import { openProfileShortcutFromFeed } from '../../lib/navigation/feedShortcutNav';
import { useNotificationsBadgeStore } from '../../stores/notificationsBadgeStore';

type Props = {
  onPressSearch?: () => void;
};

/** Header onglet Search : logo bloomi + loupe + notifications (maquette). */
export function SearchTabHeader({ onPressSearch }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useAuthStore((s) => s.session);
  const unread = useNotificationsBadgeStore((s) => s.unreadCount);

  const requireAccount = (go: () => void) => {
    if (!session?.user) {
      openGuestAuthPrompt();
      return;
    }
    go();
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
      <View style={styles.row}>
        <Image
          source={require('../../assets/brand/logo-bloomi-black.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={onPressSearch}
            activeOpacity={0.7}
            style={styles.iconHit}
            hitSlop={HIT_SLOP_EXTRA}
            accessibilityRole="button"
            accessibilityLabel={t('navigation.search')}
          >
            <IconBox Svg={SearchIcon} boxSize={28} color={theme.colors.appleBlack} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              requireAccount(() => {
                openProfileShortcutFromFeed(router, '/tabs/profile/notifications');
              })
            }
            activeOpacity={0.7}
            style={styles.iconHit}
            hitSlop={HIT_SLOP_EXTRA}
            accessibilityRole="button"
            accessibilityLabel={t('feed.header.notifications')}
          >
            <View style={styles.bellWrap}>
              <IconBox Svg={NotificationIcon} boxSize={36} color="#000000" />
              {unread > 0 ? <View style={styles.badge} /> : null}
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingBottom: theme.spacing.gapSm
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  logo: {
    width: 110,
    height: 28
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.gapSm
  },
  iconHit: {
    ...HEADER_ICON_TOUCH_CONTAINER
  },
  bellWrap: {
    position: 'relative',
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  badge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#C3EA4F',
    position: 'absolute',
    top: 4,
    right: 4
  }
});
