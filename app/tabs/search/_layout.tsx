import React from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';

/**
 * Pile dédiée à la recherche : les filtres poussés depuis Search s’empilent ici,
 * pour que router.back() revienne sur Search et non sur un autre onglet.
 */
export default function SearchStackLayout() {
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
      <Stack.Screen name="filters" options={{ headerShown: false }} />
    </Stack>
  );
}
