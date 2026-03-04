import React from 'react';
import { Stack } from 'expo-router';

export default function ProfileStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerTitleAlign: 'center',
        headerBackTitleVisible: false
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: 'Profil' }}
      />
      <Stack.Screen
        name="my-listings"
        options={{ title: 'Mes annonces' }}
      />
      <Stack.Screen
        name="edit-listing/[id]"
        options={{ title: 'Modifier l’annonce' }}
      />
    </Stack>
  );
}

