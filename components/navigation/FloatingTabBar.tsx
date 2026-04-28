import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, usePathname } from 'expo-router';
import { theme } from '../../lib/theme';
import { IconBox } from '../ui/IconBox';
import HomeIcon from '../../assets/icons/home2.svg';
import SearchIcon from '../../assets/icons/search2.svg';
import SellIcon from '../../assets/icons/sell2.svg';
import InboxIcon from '../../assets/icons/inbox2.svg';
import ProfileIcon from '../../assets/icons/profile2.svg';
import { supabase } from '../../lib/supabase';
import { refreshUnreadThreadsBadge } from '../../lib/unreadMessagesBadge';
import { useAuthStore } from '../../stores/authStore';
import { useUnreadMessagesStore } from '../../stores/unreadMessagesStore';

/** Largeur cible ; réduite automatiquement sur très petits écrans */
const BAR_WIDTH_IDEAL = 400;
const HORIZONTAL_SCREEN_GUTTER = 24;
const BAR_HEIGHT = 84;
const BAR_RADIUS = 18;
/** Tailles de cadre (px) : ajuster par onglet pour compenser le blanc interne des SVG */
const TAB_BOX = {
  home: 30,
  search: 30,
  sell: 33,
  inbox: 30,
  profile: 30
} as const;

// Ordre visuel fixe : Home, Search, Sell (+), Messages, Profile
const TAB_ROUTES = [
  { href: '/tabs/feed', key: 'home' as const, label: 'Home' },
  { href: '/tabs/search', key: 'search' as const, label: 'Search' },
  { href: '/tabs/sell', key: 'sell' as const, label: 'Sell' },
  { href: '/tabs/messages', key: 'inbox' as const, label: 'Inbox' },
  { href: '/tabs/profile', key: 'profile' as const, label: 'Profile' }
] as const;

export function FloatingTabBar(_: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const barWidth = Math.min(BAR_WIDTH_IDEAL, windowWidth - HORIZONTAL_SCREEN_GUTTER);
  const user = useAuthStore((s) => s.user);
  const unreadThreadsCount = useUnreadMessagesStore((s) => s.unreadThreadsCount);
  const messagesBadgeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Normaliser le pathname pour éviter les variations type "/tabs/feed/" vs "/tabs/feed"
  const rawPathname = usePathname();
  const pathname = rawPathname.replace(/\/+$/, '');

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
        { event: '*', schema: 'public', table: 'messages' },
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

  // On n'affiche la barre flottante UNIQUEMENT sur les écrans racine des tabs
  // (pas sur les pages de détail, ni sur le flow Sell, ni sur les sous-pages profile, etc.)

  // 1) En dehors de /tabs -> jamais de barre
  if (!pathname.startsWith('/tabs')) {
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

  const showOnThisRoute =
    isRoot('/tabs/feed') ||
    isRoot('/tabs/search') ||
    pathname.startsWith('/tabs/results') ||
    pathname.startsWith('/tabs/filters') ||
    isRoot('/tabs/messages') ||
    isRoot('/tabs/profile');

  if (!showOnThisRoute) {
    return null;
  }

  return (
    <View
      style={[
        styles.wrapper,
        {
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8
        }
      ]}
      pointerEvents="box-none"
      collapsable={false}
    >
      <View style={[styles.container, { width: barWidth }]} collapsable={false}>
        {TAB_ROUTES.map((tab) => {
          const isFocused =
            pathname.startsWith(tab.href) ||
            (tab.key === 'search' &&
              (pathname.startsWith('/tabs/results') || pathname.startsWith('/tabs/filters')));

          const onPress = () => {
            if (!isFocused) {
              router.push(tab.href);
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
                  <IconBox Svg={HomeIcon} boxSize={TAB_BOX.home} />
                ) : tab.key === 'search' ? (
                  <IconBox Svg={SearchIcon} boxSize={TAB_BOX.search} />
                ) : tab.key === 'sell' ? (
                  <View style={styles.sellIconWrap}>
                    <IconBox Svg={SellIcon} boxSize={TAB_BOX.sell} />
                  </View>
                ) : tab.key === 'inbox' ? (
                  <View style={styles.inboxIconWrap}>
                    <IconBox Svg={InboxIcon} boxSize={TAB_BOX.inbox} />
                    {unreadThreadsCount > 0 ? (
                      <View style={styles.messagesBadge} />
                    ) : null}
                  </View>
                ) : (
                  <IconBox Svg={ProfileIcon} boxSize={TAB_BOX.profile} />
                )}
              </View>
              <Text style={[styles.label, isFocused ? styles.labelActive : styles.labelInactive]}>
                {tab.label}
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
    bottom: 20,
    alignItems: 'center',
    zIndex: 99999,
    elevation: 999,
    overflow: 'visible'
  },
  container: {
    height: BAR_HEIGHT,
    borderRadius: BAR_RADIUS,
    borderWidth: 1,
    borderColor: 'rgba(242,241,241,1)',
    backgroundColor: theme.colors.googleWhite,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.gapLg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 12,
    overflow: 'visible'
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
    overflow: 'visible'
  },
  iconSlot: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center'
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
    backgroundColor: '#C3EA4F',
    position: 'absolute',
    top: -2,
    right: -4
  },
  label: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '500'
  },
  labelActive: {
    color: theme.colors.textPrimary
  },
  labelInactive: {
    color: '#AAAAAA'
  }
});

