import React from 'react';
import { Tabs } from 'expo-router';
import { FloatingTabBar } from '../../components/navigation/FloatingTabBar';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{ title: 'Feed' }}
      />
      <Tabs.Screen
        name="search"
        options={{ title: 'Recherche' }}
      />
      <Tabs.Screen
        name="sell"
        options={{ title: 'Vendre' }}
      />
      <Tabs.Screen
        name="messages"
        options={{ title: 'Messages' }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profil' }}
      />
    </Tabs>
  );
}

