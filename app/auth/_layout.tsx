import React from 'react';
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right'
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="verify-email-illustration" />
      <Stack.Screen name="verify-email-simple" />
      <Stack.Screen name="verify-phone-info" />
      <Stack.Screen name="verify-phone-code" />
      <Stack.Screen name="verify" />
    </Stack>
  );
}

