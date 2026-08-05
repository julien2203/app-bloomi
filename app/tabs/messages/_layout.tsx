import React from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';

/** Inbox → conversation → checkout offre acceptée (même pile). */
export default function MessagesStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: Platform.OS === 'android' ? 'fade' : 'slide_from_right',
        // replace « retour » (fallback) anime comme un pop, pas comme un push
        animationTypeForReplace: 'pop'
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
      <Stack.Screen name="listing/checkout" options={{ headerShown: false }} />
      <Stack.Screen name="listing/order-confirmation" options={{ headerShown: false }} />
    </Stack>
  );
}
