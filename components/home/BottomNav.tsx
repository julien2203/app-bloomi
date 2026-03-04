import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { theme } from '../../lib/theme';

const ICON_SIZE = 22;

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  const go = (path: string) => {
    if (pathname === path) return;
    router.push(path);
  };

  const isActive = (pathPrefix: string) => pathname.startsWith(pathPrefix);

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        <NavIcon
          name="home"
          active={isActive('/tabs/feed')}
          onPress={() => go('/tabs/feed')}
        />
        <NavIcon
          name="search"
          active={false}
          onPress={() => {}}
        />
        <NavIcon
          name="add-circle"
          active={false}
          onPress={() => go('/tabs/sell/index')}
        />
        <NavIcon
          name="chatbubble-ellipses"
          active={isActive('/tabs/messages')}
          onPress={() => go('/tabs/messages/index')}
        />
        <NavIcon
          name="person"
          active={isActive('/tabs/profile')}
          onPress={() => go('/tabs/profile/index')}
        />
      </View>
    </View>
  );
}

interface NavIconProps {
  name: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}

function NavIcon({ name, active, onPress }: NavIconProps) {
  return (
    <TouchableOpacity
      style={styles.iconButton}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Ionicons
        name={(`${name}${active ? '' : '-outline'}` as keyof typeof Ionicons.glyphMap)}
        size={ICON_SIZE}
        color={active ? theme.colors.primary : theme.colors.textSecondary}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 20,
    alignItems: 'center'
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.googleWhite,
    paddingHorizontal: theme.spacing.gapLg,
    paddingVertical: theme.spacing.gapSm,
    borderRadius: 28,
    height: 64,
    width: '90%',
    ...theme.shadows.card
  },
  iconButton: {
    paddingHorizontal: theme.spacing.gapSm,
    paddingVertical: theme.spacing.gapSm / 2
  }
});

