import React from 'react';
import { Stack } from 'expo-router';

/** Tous les écrans profil utilisent un header custom (HeaderBackButton) — jamais la barre native iOS. */
export default function ProfileStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animationTypeForReplace: 'pop' }}>
      <Stack.Screen
        name="leave-review"
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom'
        }}
      />
    </Stack>
  );
}
