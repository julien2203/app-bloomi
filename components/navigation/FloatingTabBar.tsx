import React, { useEffect, useMemo, useRef } from 'react';
import { AppState, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useSegments } from 'expo-router';
import { theme } from '../../lib/theme';
import { IconBox } from '../ui/IconBox';
import HomeIcon from '../../assets/icons/home2.svg';
import SearchIcon from '../../assets/icons/search2.svg';
import SellIcon from '../../assets/icons/sell2.svg';
import InboxIcon from '../../assets/icons/inbox2.svg';
import ProfileIcon from '../../assets/icons/profile2.svg';
import { supabase } from '../../lib/supabase';
import { refreshNotificationsBadge } from '../../lib/notificationsBadge';
import { refreshUnreadThreadsBadge } from '../../lib/unreadMessagesBadge';
import { useAuthStore } from '../../stores/authStore';
import { openGuestAuthPrompt } from '../../lib/guestAuthPrompt';
import { switchMainTab } from '../../lib/navigation/navigateInTabs';
import { navigateToProfileTabRoot } from '../../lib/navigation/feedShortcutNav';
import { useNotificationsBadgeStore } from '../../stores/notificationsBadgeStore';
import { useUnreadMessagesStore } from '../../stores/unreadMessagesStore';
import { useTranslation } from 'react-i18next';
import { authDebug } from '../../lib/authDebugLog';
import { getSafeBottomInset } from '../../lib/safeArea';

export const TAB_BAR_BASE_HEIGHT = 64;
export function getFixedTabBarHeight(bottomInset: number) {
  return TAB_BAR_BASE_HEIGHT + getSafeBottomInset(bottomInset);
}
/** Tailles de cadre (px) : ajuster par onglet pour compenser le blanc interne des SVG */
const TAB_BOX = {
  home: 28,
  search: 28,
  sell: 31,
  inbox: 28,
  profile: 28
} as const;
const TAB_ICON_ACTIVE = '#171918';
const TAB_ICON_INACTIVE = '#8E8E93';
const TAB_BAR_HORIZONTAL_PADDING = theme.spacing.gapSm;

/** Même taille pour tous les onglets, réduite uniquement si le libellé le plus long ne tient pas. */
function getUniformTabLabelStyle(
  labels: string[],
  tabSlotWidth: number
): { fontSize: number; lineHeight: number } {
  const baseFontSize = 11;
  const charWidthFactor = 0.52;
  const maxLabelLen = Math.max(1, ...labels.map((label) => label.length));
  const requiredWidth = maxLabelLen * baseFontSize * charWidthFactor;
  const availableWidth = Math.max(40, tabSlotWidth - 4);

  if (requiredWidth <= availableWidth) {
    return { fontSize: baseFontSize, lineHeight: baseFontSize + 2 };
  }

  const fontSize = Math.max(9, availableWidth / (maxLabelLen * charWidthFactor));
  const rounded = Math.round(fontSize * 10) / 10;
  return { fontSize: rounded, lineHeight: rounded + 2 };
}

const TAB_ROUTE_DEFS = [
  { href: '/tabs/feed', key: 'home' as const, labelKey: 'navigation.home' },
  { href: '/tabs/search', key: 'search' as const, labelKey: 'navigation.search' },
  { href: '/tabs/sell', key: 'sell' as const, labelKey: 'navigation.sell' },
  { href: '/tabs/messages', key: 'inbox' as const, labelKey: 'navigation.inbox' },
  { href: '/tabs/profile', key: 'profile' as const, labelKey: 'navigation.profile' }
] as const;

export function FloatingTabBar(_: BottomTabBarProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const safeBottomInset = getSafeBottomInset(insets.bottom);
  const user = useAuthStore((s) => s.user);
  const session = useAuthStore((s) => s.session);
  const isGuest = useAuthStore((s) => s.isGuest);
  const unreadThreadsCount = useUnreadMessagesStore((s) => s.unreadThreadsCount);
  const messagesBadgeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notificationsBadgeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Normaliser le pathname pour éviter les variations type "/tabs/feed/" vs "/tabs/feed"
  const rawPathname = usePathname();
  const pathname = rawPathname.replace(/\/+$/, '');
  const segments = useSegments();
  const inTabsGroup = segments[0] === 'tabs';

  useEffect(() => {
    authDebug('tabBar:route', { pathname, inTabsGroup, hasSession: Boolean(session?.user) });
  }, [pathname, inTabsGroup, session?.user]);

  useEffect(() => {
    if (!user?.id) {
      useUnreadMessagesStore.getState().setUnreadThreadsCount(0);
      return;
    }
    void refreshUnreadThreadsBadge(user.id);

    const scheduleRefresh = () => {
      if (messagesBadgeDebounceRef.current) {
        clearTimeout(messagesBadgeDebounceRef.current);
      }
      messagesBadgeDebounceRef.current = setTimeout(() => {
        messagesBadgeDebounceRef.current = null;
        void refreshUnreadThreadsBadge(user.id);
      }, 400);
    };

    const ch = supabase
      .channel(`messages:unread-badge:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        scheduleRefresh
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        scheduleRefresh
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
      if (messagesBadgeDebounceRef.current) {
        clearTimeout(messagesBadgeDebounceRef.current);
        messagesBadgeDebounceRef.current = null;
      }
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      useNotificationsBadgeStore.getState().setUnreadCount(0);
      return;
    }
    void refreshNotificationsBadge(user.id);

    const scheduleNotificationsRefresh = () => {
      if (notificationsBadgeDebounceRef.current) {
        clearTimeout(notificationsBadgeDebounceRef.current);
      }
      notificationsBadgeDebounceRef.current = setTimeout(() => {
        notificationsBadgeDebounceRef.current = null;
        void refreshNotificationsBadge(user.id);
      }, 450);
    };

    const ch = supabase
      .channel(`notifications:unread-badge:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        scheduleNotificationsRefresh
      )
      .subscribe();

    const appStateSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void refreshNotificationsBadge(user.id);
      }
    });

    return () => {
      void supabase.removeChannel(ch);
      appStateSub.remove();
      if (notificationsBadgeDebounceRef.current) {
        clearTimeout(notificationsBadgeDebounceRef.current);
        notificationsBadgeDebounceRef.current = null;
      }
    };
  }, [user?.id]);

  const tabLabels = useMemo(
    () => TAB_ROUTE_DEFS.map((tab) => t(tab.labelKey)),
    [t]
  );

  const tabLabelStyle = useMemo(() => {
    const tabSlotWidth =
      (windowWidth - TAB_BAR_HORIZONTAL_PADDING * 2) / TAB_ROUTE_DEFS.length;
    return getUniformTabLabelStyle(tabLabels, tabSlotWidth);
  }, [tabLabels, windowWidth]);

  // On n'affiche la barre flottante UNIQUEMENT sur les écrans racine des tabs
  // (pas sur les pages de détail, ni sur le flow Sell, ni sur les sous-pages profile, etc.)

  // 1) En dehors de /tabs -> jamais de barre (segments en secours si pathname en retard après auth)
  if (!pathname.startsWith('/tabs') && !inTabsGroup) {
    return null;
  }

  // 2) Jamais de barre sur le flow Sell
  if (pathname.startsWith('/tabs/sell')) {
    return null;
  }

  const isRoot = (base: string) => {
    return (
      pathname === base ||
      pathname === `${base}/` ||
      pathname === `${base}/index` ||
      pathname.startsWith(`${base}?`)
    );
  };

  const isTabStackRoot = (tab: string) => {
    if (!inTabsGroup || segments[1] !== tab) return false;
    if (segments.length <= 2) return true;
    return segments.length === 3 && segments[2] === 'index';
  };

  const isProfileTabRoot =
    isRoot('/tabs/profile') || isTabStackRoot('profile');

  const showOnThisRoute =
    isRoot('/tabs/feed') ||
    isTabStackRoot('feed') ||
    isRoot('/tabs/search') ||
    isTabStackRoot('search') ||
    pathname.startsWith('/tabs/results') ||
    pathname.startsWith('/tabs/filters') ||
    isRoot('/tabs/messages') ||
    isTabStackRoot('messages') ||
    isRoot('/tabs/profile') ||
    isTabStackRoot('profile');

  if (!showOnThisRoute) {
    return null;
  }

  return (
    <View
      style={[
        styles.wrapper,
        {
          width: windowWidth
        }
      ]}
      pointerEvents="box-none"
      collapsable={false}
    >
      <View
        style={[
          styles.container,
          {
            height: TAB_BAR_BASE_HEIGHT + safeBottomInset,
            paddingBottom: safeBottomInset
          }
        ]}
        collapsable={false}
      >
        {TAB_ROUTE_DEFS.map((tab) => {
          const isFocused =
            pathname.startsWith(tab.href) ||
            (tab.key === 'search' &&
              (pathname.startsWith('/tabs/results') || pathname.startsWith('/tabs/filters')));

          const onPress = () => {
            const guestBrowsing = !session?.user && isGuest;
            if (guestBrowsing && tab.key !== 'home' && tab.key !== 'search') {
              openGuestAuthPrompt();
              return;
            }
            // Profil : re-tap sur l’icône = retour à la racine (comme Instagram / Vinted).
            if (tab.key === 'profile' && pathname.startsWith('/tabs/profile') && !isProfileTabRoot) {
              navigateToProfileTabRoot();
              return;
            }
            if (tab.key === 'profile' && !isFocused) {
              navigateToProfileTabRoot();
              return;
            }
            if (!isFocused) {
              switchMainTab(tab.href);
            }
          };

          return (
            <TouchableOpacity
              key={tab.href}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={onPress}
              activeOpacity={0.7}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              style={styles.item}
            >
              <View style={styles.iconSlot}>
                {tab.key === 'home' ? (
                  <IconBox
                    Svg={HomeIcon}
                    boxSize={TAB_BOX.home}
                    color={isFocused ? TAB_ICON_ACTIVE : TAB_ICON_INACTIVE}
                  />
                ) : tab.key === 'search' ? (
                  <IconBox
                    Svg={SearchIcon}
                    boxSize={TAB_BOX.search}
                    color={isFocused ? TAB_ICON_ACTIVE : TAB_ICON_INACTIVE}
                  />
                ) : tab.key === 'sell' ? (
                  <View style={styles.sellIconWrap}>
                    <IconBox Svg={SellIcon} boxSize={TAB_BOX.sell} />
                  </View>
                ) : tab.key === 'inbox' ? (
                  <View style={styles.inboxIconWrap}>
                    <IconBox
                      Svg={InboxIcon}
                      boxSize={TAB_BOX.inbox}
                      color={isFocused ? TAB_ICON_ACTIVE : TAB_ICON_INACTIVE}
                    />
                    {unreadThreadsCount > 0 ? (
                      <View style={styles.messagesBadge} />
                    ) : null}
                  </View>
                ) : (
                  <IconBox
                    Svg={ProfileIcon}
                    boxSize={TAB_BOX.profile}
                    color={isFocused ? TAB_ICON_ACTIVE : TAB_ICON_INACTIVE}
                  />
                )}
              </View>
              <Text
                style={[
                  styles.label,
                  tabLabelStyle,
                  isFocused ? styles.labelActive : styles.labelInactive
                ]}
                numberOfLines={1}
                allowFontScaling={false}
              >
                {t(tab.labelKey)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'stretch',
    zIndex: 99999,
    elevation: 999,
    overflow: 'visible'
  },
  container: {
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    backgroundColor: theme.colors.googleWhite,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: TAB_BAR_HORIZONTAL_PADDING,
    paddingTop: 8,
    overflow: 'visible'
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: 56,
    paddingTop: 1,
    paddingHorizontal: 2,
    overflow: 'visible'
  },
  iconSlot: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2
  },
  sellIconWrap: {
    marginTop: 0,
    marginBottom: 0,
    overflow: 'visible'
  },
  inboxIconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible'
  },
  messagesBadge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
    position: 'absolute',
    top: -2,
    right: -4
  },
  label: {
    width: '100%',
    maxWidth: '100%',
    textAlign: 'center',
    fontWeight: '500',
    includeFontPadding: false
  },
  labelActive: {
    color: TAB_ICON_ACTIVE
  },
  labelInactive: {
    color: '#AAAAAA'
  }
});

