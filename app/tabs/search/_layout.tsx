import React from 'react';
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
        animation: 'slide_from_right'
      }}
    />
  );
}
