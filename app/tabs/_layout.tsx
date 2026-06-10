import React from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { FloatingTabBar, getFixedTabBarHeight } from '../../components/navigation/FloatingTabBar';

export default function TabsLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const tabBarSlotH = getFixedTabBarHeight(insets.bottom);

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        animation: 'none',
        detachInactiveScreens: false,
        sceneStyle: {
          backgroundColor: '#FFFFFF'
        },
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
        options={{ title: t('navigation.home') }}
      />
      <Tabs.Screen name="search" options={{ title: t('navigation.search') }} />
      <Tabs.Screen
        name="results/index"
        options={{
          title: t('navigation.results'),
          href: null
        }}
      />
      <Tabs.Screen
        name="results/[id]"
        options={{
          title: t('navigation.resultDetail'),
          href: null
        }}
      />
      <Tabs.Screen
        name="filters/index"
        options={{
          title: t('navigation.filters'),
          href: null
        }}
      />
      <Tabs.Screen name="filters/category" options={{ href: null }} />
      <Tabs.Screen name="filters/category-gender" options={{ href: null }} />
      <Tabs.Screen name="filters/category-detail" options={{ href: null }} />
      <Tabs.Screen name="filters/brand-gender" options={{ href: null }} />
      <Tabs.Screen name="filters/brand-segment" options={{ href: null }} />
      <Tabs.Screen name="filters/brand" options={{ href: null }} />
      <Tabs.Screen name="filters/condition" options={{ href: null }} />
      <Tabs.Screen name="filters/size" options={{ href: null }} />
      <Tabs.Screen name="filters/color" options={{ href: null }} />
      <Tabs.Screen name="filters/price" options={{ href: null }} />
      <Tabs.Screen name="filters/sort" options={{ href: null }} />
      <Tabs.Screen
        name="public-profile/index"
        options={{
          title: t('navigation.profile'),
          href: null
        }}
      />
      <Tabs.Screen
        name="sell"
        options={{ title: t('navigation.sell') }}
      />
      <Tabs.Screen
        name="messages/index"
        options={{ title: t('navigation.inbox') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t('navigation.profile') }}
      />
    </Tabs>
  );
}

