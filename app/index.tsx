import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../stores/authStore';

export default function IndexScreen() {
  const router = useRouter();
  const { session, initialized, isLoading } = useAuthStore();

  useEffect(() => {
    // Attendre que l'initialisation soit terminée
    if (!initialized || isLoading) {
      return;
    }

    // Rediriger selon l'état d'authentification
    if (session) {
      router.replace('/tabs/feed');
    } else {
      router.replace('/auth/sign-in');
    }
  }, [initialized, isLoading, session, router]);

  // Afficher un écran de chargement pendant l'initialisation
  if (!initialized || isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#ffffff'
        }}
      >
        <ActivityIndicator size="large" color="#111827" />
      </View>
    );
  }

  // Ce code ne devrait jamais être atteint car la redirection se fait dans useEffect
  // Mais on le garde pour éviter un écran blanc
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#ffffff'
      }}
    >
      <ActivityIndicator size="large" color="#111827" />
    </View>
  );
}
