import React from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';

/** Dressing vendeur → fiche → checkout / offre (même pile, retour cohérent). */
export default function PublicProfileStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: Platform.OS === 'android' ? 'fade' : 'slide_from_right',
        animationTypeForReplace: 'pop'
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
      <Stack.Screen
        name="make-offer"
        options={{
          headerShown: false,
          presentation: 'modal',
          animation: 'slide_from_bottom'
        }}
      />
      <Stack.Screen name="listing/checkout" options={{ headerShown: false }} />
      <Stack.Screen name="listing/order-confirmation" options={{ headerShown: false }} />
    </Stack>
  );
}
