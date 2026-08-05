import React from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';

/** Dressing vendeur → fiche article dans la même pile (retour = dressing, pas l’ancienne fiche). */
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
    </Stack>
  );
}
