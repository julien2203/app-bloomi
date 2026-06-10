import React from 'react';
import { Stack } from 'expo-router';

export default function FeedStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerTitleAlign: 'center',
        headerBackTitleVisible: false,
        headerShown: false,
        animation: 'slide_from_right'
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
      <Stack.Screen
        name="make-offer"
        options={{
          headerShown: false,
          gestureEnabled: true,
          presentation: 'modal',
          animation: 'slide_from_bottom'
        }}
      />
    </Stack>
  );
}

