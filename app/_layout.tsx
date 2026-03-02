import React, { useEffect, useMemo } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { ensureProfileExists } from '../lib/profile';
import { useInterFonts } from '../lib/ui/fonts';

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();

  const { session, isLoading, initialized, setAuthFromSession, restoreSession } =
    useAuthStore();

  // Initialisation de la session + abonnement aux changements Supabase
  useEffect(() => {
    restoreSession();
    const { data } = supabase.auth.onAuthStateChange((_event, sess) => {
      setAuthFromSession(sess);
      if (sess) {
        ensureProfileExists(sess);
      }
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, [restoreSession, setAuthFromSession]);

  const isInAuthGroup = useMemo(
    () => segments[0] === 'auth' || segments[0] === 'onboarding',
    [segments]
  );

  // Redirections en fonction de l'état d'auth
  useEffect(() => {
    if (!initialized || isLoading) return;

    // Permettre l'accès aux écrans auth/onboarding sans session
    const isPublicRoute = segments[0] === 'auth' || segments[0] === 'onboarding';
    
    if (!session && !isPublicRoute) {
      router.replace('/onboarding/splash');
      return;
    }

    // Si connecté et sur un écran auth/onboarding, rediriger vers feed
    if (session && isPublicRoute) {
      router.replace('/tabs/feed');
    }
  }, [initialized, isLoading, isInAuthGroup, session, router, segments]);

  if (!initialized) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        <ActivityIndicator />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const { fontsLoaded, fontError } = useInterFonts();

  // Bloquer le rendu tant que les polices ne sont pas chargées
  if (!fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#FFFFFF'
        }}
      >
        <ActivityIndicator size="large" color="#111827" />
      </View>
    );
  }

  // Si erreur de chargement des polices, continuer quand même (fallback sur système)
  if (fontError) {
    console.warn('Erreur chargement polices Inter:', fontError);
  }

  return (
    <SafeAreaProvider>
      <AuthGate>
        <Slot />
      </AuthGate>
    </SafeAreaProvider>
  );
}

