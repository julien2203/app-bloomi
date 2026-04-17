import React from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FloatingTabBar } from '../../components/navigation/FloatingTabBar';

/**
 * Hauteur du slot tab bar React Navigation : si elle est trop faible ou rognée (overflow),
 * la barre flottante peut s’afficher mais ne recevoir les touches de façon fiable sur iOS.
 */
function tabBarSlotHeightPx(bottomInset: number) {
  const bottomPad = bottomInset > 0 ? bottomInset : 8;
  return 20 + 68 + bottomPad + 28;
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const tabBarSlotH = tabBarSlotHeightPx(insets.bottom);

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: tabBarSlotH,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          borderTopColor: 'transparent',
          elevation: 0,
          shadowOpacity: 0,
          overflow: 'visible',
          ...Platform.select({ android: { elevation: 0 } })
        }
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{ title: 'Feed' }}
      />
      <Tabs.Screen
        name="search/index"
        options={{ title: 'Search' }}
      />
      <Tabs.Screen
        name="results/index"
        options={{
          title: 'Results',
          href: null
        }}
      />
      <Tabs.Screen
        name="filters/index"
        options={{
          title: 'Filters',
          href: null
        }}
      />
      <Tabs.Screen
        name="public-profile/index"
        options={{
          title: 'Profile',
          href: null
        }}
      />
      <Tabs.Screen
        name="sell"
        options={{ title: 'Sell' }}
      />
      <Tabs.Screen
        name="messages/index"
        options={{ title: 'Messages' }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile' }}
      />
    </Tabs>
  );
}

