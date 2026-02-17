import React, { useEffect, useMemo } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { ensureProfileExists } from '../lib/profile';

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
    () => segments[0] === 'auth',
    [segments]
  );

  // Redirections en fonction de l'état d'auth
  useEffect(() => {
    if (!initialized || isLoading) return;

    if (!session && !isInAuthGroup) {
      router.replace('/auth/sign-in');
      return;
    }

    if (session && isInAuthGroup) {
      router.replace('/tabs/feed');
    }
  }, [initialized, isLoading, isInAuthGroup, session, router]);

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
  return (
    <SafeAreaProvider>
      <AuthGate>
        <Slot />
      </AuthGate>
    </SafeAreaProvider>
  );
}

