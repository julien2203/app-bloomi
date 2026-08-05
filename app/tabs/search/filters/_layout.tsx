import React from 'react';
import { Stack } from 'expo-router';

/** Sous-pile filtres depuis l’onglet Search (modale ouverte par `search/_layout`). */
export default function SearchFiltersStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationTypeForReplace: 'pop'
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="category" />
      <Stack.Screen name="category-gender" />
      <Stack.Screen name="category-detail" />
      <Stack.Screen name="brand-gender" />
      <Stack.Screen name="brand-segment" />
      <Stack.Screen name="brand" />
      <Stack.Screen name="condition" />
      <Stack.Screen name="size" />
      <Stack.Screen name="color" />
      <Stack.Screen name="price" />
      <Stack.Screen name="sort" />
    </Stack>
  );
}
