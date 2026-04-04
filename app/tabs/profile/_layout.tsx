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
      <Stack.Screen name="index" options={{ title: 'Profil' }} />
      <Stack.Screen name="my-listings" options={{ title: 'Mes annonces' }} />
      <Stack.Screen
        name="edit-listing/[id]"
        options={{ title: 'Modifier l’annonce', headerShown: false }}
      />
      <Stack.Screen name="edit-profile" options={{ title: 'Edit profile' }} />
      <Stack.Screen name="favorites" options={{ title: 'Favorite items' }} />
      <Stack.Screen name="personalization" options={{ title: 'Personalization' }} />
      <Stack.Screen name="wallet" options={{ title: 'Wallet' }} />
      <Stack.Screen name="orders" options={{ title: 'My orders' }} />
      <Stack.Screen
        name="activate-seller-account"
        options={{ title: 'Activer mon compte vendeur', headerShown: false }}
      />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      <Stack.Screen name="legal" options={{ title: 'Legal information' }} />
      <Stack.Screen name="help" options={{ title: 'Help center' }} />
      <Stack.Screen name="feedback" options={{ title: 'Send your feedback' }} />
    </Stack>
  );
}

