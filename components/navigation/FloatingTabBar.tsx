import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../lib/theme';
import { AppIcon } from '../ui/AppIcon';
import type { IconName } from '../../lib/assets';

const BAR_WIDTH = 347;
const BAR_HEIGHT = 56;
const BAR_RADIUS = 15;

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  const getIconName = (routeName: string, focused: boolean): IconName => {
    let base: string;

    // Ordre attendu : Home, Search, Plus, Mail, User
    if (routeName === 'feed') base = 'home';
    else if (routeName === 'test/index') base = 'search';
    else if (routeName === 'sell/index') base = 'addCircle';
    else if (routeName === 'messages/index') base = 'messagesLetter';
    else if (routeName === 'profile') base = 'user';
    else base = 'search';

    const suffix = focused ? 'Bold' : 'Outline';
    return `${base}${suffix}` as IconName;
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
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const icon = getIconName(route.name, isFocused);

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={onPress}
              activeOpacity={0.8}
              style={styles.item}
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
    alignItems: 'center'
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
    // Shadow approximation Figma: blur 108, opacity 0.04
    shadowColor: 'rgba(0,0,0,1)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 54,
    elevation: 4
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  }
});

