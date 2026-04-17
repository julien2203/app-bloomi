import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, usePathname } from 'expo-router';
import { theme } from '../../lib/theme';
import HomeIcon from '../../assets/icons/icon_home_simple_outline.svg';
import SearchIcon from '../../assets/icons/icon_search_short_handle.svg';
import SellIcon from '../../assets/icons/icon_plus_shadow_C3EA4F.svg';
import InboxIcon from '../../assets/icons/icon_message_envelope_clean.svg';
import ProfileIcon from '../../assets/icons/icon_user_outline_premium.svg';

/** Largeur cible ; réduite automatiquement sur très petits écrans */
const BAR_WIDTH_IDEAL = 400;
const HORIZONTAL_SCREEN_GUTTER = 24;
const BAR_HEIGHT = 84;
const BAR_RADIUS = 18;
const ICON_SIZE = 40;
const SELL_ICON_SIZE = 40;

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
  // Normaliser le pathname pour éviter les variations type "/tabs/feed/" vs "/tabs/feed"
  const rawPathname = usePathname();
  const pathname = rawPathname.replace(/\/+$/, '');

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
          const isFocused = pathname.startsWith(tab.href);

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
              {tab.key === 'home' ? (
                <HomeIcon width={ICON_SIZE} height={ICON_SIZE} pointerEvents="none" />
              ) : tab.key === 'search' ? (
                <SearchIcon width={ICON_SIZE} height={ICON_SIZE} pointerEvents="none" />
              ) : tab.key === 'sell' ? (
                <View style={styles.sellIconWrap}>
                  <SellIcon width={SELL_ICON_SIZE} height={SELL_ICON_SIZE} pointerEvents="none" />
                </View>
              ) : tab.key === 'inbox' ? (
                <InboxIcon width={ICON_SIZE} height={ICON_SIZE} pointerEvents="none" />
              ) : (
                <ProfileIcon width={ICON_SIZE} height={ICON_SIZE} pointerEvents="none" />
              )}
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
  sellIconWrap: {
    marginTop: 0,
    marginBottom: 0,
    overflow: 'visible'
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

