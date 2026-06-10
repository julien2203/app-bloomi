import React from 'react';
import { Stack } from 'expo-router';

export default function EditListingStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right'
      }}
    >
      <Stack.Screen name="[id]" />
      <Stack.Screen name="category" />
      <Stack.Screen name="category-gender" />
      <Stack.Screen name="category-detail" />
      <Stack.Screen name="brand" />
      <Stack.Screen name="condition" />
      <Stack.Screen name="size" />
      <Stack.Screen name="price" />
    </Stack>
  );
}
