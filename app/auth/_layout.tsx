import React from 'react';
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerBackTitleVisible: false,
        animation: 'slide_from_right'
      }}
    >
      <Stack.Screen
        name="login"
        options={{ headerShown: false, gestureEnabled: true }}
      />
      <Stack.Screen
        name="sign-up"
        options={{ headerShown: false, gestureEnabled: true }}
      />
      <Stack.Screen
        name="forgot-password"
        options={{ headerShown: false, gestureEnabled: true }}
      />
      <Stack.Screen
        name="verify-email"
        options={{ headerShown: false, gestureEnabled: true }}
      />
      <Stack.Screen
        name="callback"
        options={{ headerShown: false, gestureEnabled: true }}
      />
      <Stack.Screen
        name="verify-phone"
        options={{ headerShown: false, gestureEnabled: true }}
      />
      <Stack.Screen
        name="verify-phone-info"
        options={{ headerShown: false, gestureEnabled: true }}
      />
      <Stack.Screen
        name="verify-phone-code"
        options={{ headerShown: false, gestureEnabled: true }}
      />
      <Stack.Screen
        name="verify"
        options={{ headerShown: false, gestureEnabled: true }}
      />
    </Stack>
  );
}

