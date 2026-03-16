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
        options={{ headerShown: false, gestureEnabled: true }}
      />
      <Stack.Screen
        name="[id]"
        options={{ headerShown: false, gestureEnabled: true }}
      />
    </Stack>
  );
}

