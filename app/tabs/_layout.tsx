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
        name="sell/index"
        options={{ title: 'Vendre' }}
      />
      <Tabs.Screen
        name="messages/index"
        options={{ title: 'Messages' }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profil' }}
      />
      <Tabs.Screen
        name="test/index"
        options={{ title: 'Test' }}
      />
    </Tabs>
  );
}

