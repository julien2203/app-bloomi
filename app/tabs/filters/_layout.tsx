import React from 'react';
import { Stack } from 'expo-router';

/**
 * Pile filtres au niveau onglets (depuis Feed, Results, etc.).
 * Même pattern que `sell/_layout` : navigation slide_from_right, pas de modal Search.
 */
export default function FiltersStackLayout() {
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
