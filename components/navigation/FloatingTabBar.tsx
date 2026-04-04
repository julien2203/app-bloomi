import React from 'react';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, usePathname } from 'expo-router';
import { theme } from '../../lib/theme';
import { HIT_SLOP_COMFORTABLE } from '../../lib/touchTargets';
import { AppIcon } from '../ui/AppIcon';
import type { IconName } from '../../lib/assets';

/** Largeur cible ; réduite automatiquement sur très petits écrans */
const BAR_WIDTH_IDEAL = 400;
const HORIZONTAL_SCREEN_GUTTER = 24;
const BAR_HEIGHT = 68;
const BAR_RADIUS = 18;
const ICON_SIZE = 28;

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
      collapsable={false}
    >
      <View style={[styles.container, { width: barWidth }]} collapsable={false}>
        {TAB_ROUTES.map((tab) => {
          const isFocused = pathname.startsWith(tab.href);
          const icon = getIconName(tab.icon, isFocused);

          const onPress = () => {
            if (!isFocused) {
              router.push(tab.href);
            }
          };

          return (
            <Pressable
              key={tab.href}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={onPress}
              delayPressIn={0}
              hitSlop={HIT_SLOP_COMFORTABLE}
              android_disableSound
              style={({ pressed }) => [
                styles.item,
                Platform.OS === 'ios' && pressed && styles.itemPressed
              ]}
            >
              <AppIcon
                name={icon}
                size={ICON_SIZE}
                color={isFocused ? theme.colors.primary : theme.colors.textSecondary}
              />
            </Pressable>
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
    elevation: 999
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
    elevation: 12
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48
  },
  itemPressed: {
    opacity: 0.75
  }
});

