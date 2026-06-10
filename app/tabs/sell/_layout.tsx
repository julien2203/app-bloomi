import React from 'react';
import { Stack } from 'expo-router';

export default function SellStackLayout() {
  return (
    <Stack
      screenOptions={{
        animation: 'slide_from_right'
      }}
    >
      <Stack.Screen
        name="index"
        options={{ headerShown: false, gestureEnabled: true }}
      />
      <Stack.Screen
        name="category"
        options={{ headerShown: false, gestureEnabled: true }}
      />
      <Stack.Screen
        name="category-gender"
        options={{ headerShown: false, gestureEnabled: true }}
      />
      <Stack.Screen
        name="category-detail"
        options={{ headerShown: false, gestureEnabled: true }}
      />
      <Stack.Screen
        name="brand-gender"
        options={{ headerShown: false, gestureEnabled: true }}
      />
      <Stack.Screen
        name="brand-segment"
        options={{ headerShown: false, gestureEnabled: true }}
      />
      <Stack.Screen
        name="brand"
        options={{ headerShown: false, gestureEnabled: true }}
      />
      <Stack.Screen
        name="condition"
        options={{ headerShown: false, gestureEnabled: true }}
      />
      <Stack.Screen
        name="size"
        options={{ headerShown: false, gestureEnabled: true }}
      />
      <Stack.Screen
        name="price"
        options={{ headerShown: false, gestureEnabled: true }}
      />
      <Stack.Screen
        name="color"
        options={{ headerShown: false, gestureEnabled: true }}
      />
    </Stack>
  );
}

