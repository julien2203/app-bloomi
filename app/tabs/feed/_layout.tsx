import React from 'react';
import { Stack } from 'expo-router';

export default function FeedStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerTitleAlign: 'center',
        headerBackTitleVisible: false,
        headerShown: false
      }}
    >
      <Stack.Screen
        name="index"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="[id]"
        options={{ title: 'Détail de l’annonce', headerShown: true }}
      />
    </Stack>
  );
}

