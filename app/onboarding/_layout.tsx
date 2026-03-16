/**
 * Layout pour les écrans d'onboarding
 * Navigation en stack pour permettre les transitions
 */

import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right'
      }}
    >
      <Stack.Screen
        name="splash"
        options={{ headerShown: false, gestureEnabled: true }}
      />
      <Stack.Screen
        name="step-1"
        options={{ headerShown: false, gestureEnabled: true }}
      />
      <Stack.Screen
        name="step-2"
        options={{ headerShown: false, gestureEnabled: true }}
      />
      <Stack.Screen
        name="step-3"
        options={{ headerShown: false, gestureEnabled: true }}
      />
    </Stack>
  );
}
