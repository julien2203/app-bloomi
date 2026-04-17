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
      <Stack.Screen name="index" options={{ title: 'Profile' }} />
      <Stack.Screen
        name="edit-listing/[id]"
        options={{ title: 'Edit listing', headerShown: false }}
      />
      <Stack.Screen name="edit-profile" options={{ title: 'Edit profile' }} />
      <Stack.Screen name="my-address" options={{ title: 'My address' }} />
      <Stack.Screen name="favorites" options={{ title: 'Favorite items' }} />
      <Stack.Screen name="personalization" options={{ title: 'Personalization' }} />
      <Stack.Screen name="wallet" options={{ title: 'Wallet' }} />
      <Stack.Screen name="orders" options={{ title: 'My orders' }} />
      <Stack.Screen
        name="leave-review"
        options={{ title: 'Leave a review', headerShown: false }}
      />
      <Stack.Screen
        name="activate-seller-account"
        options={{ title: 'Activate seller account', headerShown: false }}
      />
      <Stack.Screen
        name="notifications"
        options={{ title: 'Notifications', headerShown: false }}
      />
      <Stack.Screen name="notification-settings" options={{ title: 'Push notifications' }} />
      <Stack.Screen name="account-settings" options={{ title: 'Account settings' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      <Stack.Screen name="shipping" options={{ title: 'Shipping' }} />
      <Stack.Screen name="legal" options={{ title: 'Legal information' }} />
      <Stack.Screen name="help" options={{ title: 'Help center' }} />
      <Stack.Screen name="feedback" options={{ title: 'Send your feedback' }} />
    </Stack>
  );
}

