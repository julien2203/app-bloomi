import React from 'react';
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="sign-in"
        options={{
          title: 'Connexion'
        }}
      />
      <Stack.Screen
        name="verify"
        options={{
          title: 'Vérification'
        }}
      />
    </Stack>
  );
}

