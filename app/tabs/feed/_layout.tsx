import React from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';

export default function FeedStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerTitleAlign: 'center',
        headerBackTitleVisible: false,
        headerShown: false,
        animation: Platform.OS === 'android' ? 'fade' : 'slide_from_right',
        animationTypeForReplace: 'pop'
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
      <Stack.Screen name="favorites" options={{ headerShown: false, gestureEnabled: true }} />
      <Stack.Screen name="notifications" options={{ headerShown: false, gestureEnabled: true }} />
      <Stack.Screen name="orders" options={{ headerShown: false, gestureEnabled: true }} />
    </Stack>
  );
}

