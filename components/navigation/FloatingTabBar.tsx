import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, usePathname } from 'expo-router';
import { theme } from '../../lib/theme';
import { AppIcon } from '../ui/AppIcon';
import type { IconName } from '../../lib/assets';

const BAR_WIDTH = 347;
const BAR_HEIGHT = 56;
const BAR_RADIUS = 15;

// Ordre visuel fixe : Home, Search, Sell (+), Messages, Profile
const TAB_ROUTES = [
  { href: '/tabs/feed', icon: 'home' as const },
  { href: '/tabs/search', icon: 'search' as const },
  { href: '/tabs/sell', icon: 'addCircle' as const },
  { href: '/tabs/messages', icon: 'messagesLetter' as const },
  { href: '/tabs/profile', icon: 'user' as const }
] as const;

type BaseIcon = (typeof TAB_ROUTES)[number]['icon'];

export function FloatingTabBar(_: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
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

  const getIconName = (icon: BaseIcon, focused: boolean): IconName => {
    const suffix = focused ? 'Bold' : 'Outline';
    return `${icon}${suffix}` as IconName;
  };

  return (
    <View
      style={[
        styles.wrapper,
        {
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8
        }
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.container}>
        {TAB_ROUTES.map((tab, index) => {
          const isFocused = pathname.startsWith(tab.href);
          const icon = getIconName(tab.icon, isFocused);

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
              activeOpacity={0.8}
              style={styles.item}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <AppIcon
                name={icon}
                size={20}
                color={isFocused ? theme.colors.primary : theme.colors.textSecondary}
              />
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
    zIndex: 100
  },
  container: {
    width: BAR_WIDTH,
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
    elevation: 8
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  }
});

