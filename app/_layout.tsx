import React, { useEffect, useMemo, useRef } from 'react';
import { Slot, usePathname, useRouter, useSegments } from 'expo-router';
import { ActivityIndicator, View, Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { ensureProfileExists } from '../lib/profile';
import { useInterFonts } from '../lib/ui/fonts';
import { ensureNotificationsConfigured, notifyNewMessage } from '../lib/notifications';
import { StripeProvider } from '@stripe/stripe-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();

  const { session, user, isLoading, initialized, setAuthFromSession, restoreSession } =
    useAuthStore();

  // Initialisation de la session + abonnement aux changements Supabase
  useEffect(() => {
    restoreSession();
    const { data } = supabase.auth.onAuthStateChange((_event, sess) => {
      setAuthFromSession(sess);
      if (sess) {
        void (async () => {
          const userId = sess.user?.id;
          if (!userId) {
            return;
          }

          const markerKey = `profile_ensured_after_login:${userId}`;
          const rawTs = await AsyncStorage.getItem(markerKey);
          const ts = rawTs ? Number(rawTs) : 0;
          const isRecent = Number.isFinite(ts) && Date.now() - ts < 60_000;

          // Juste après `signInWithPassword`, `login.tsx` a déjà fait l'upsert profil.
          // On saute ici pour garantir qu'on n'a pas 2 appels séquentiels identiques.
          if (isRecent) {
            await AsyncStorage.removeItem(markerKey);
            return;
          }

          await ensureProfileExists(sess);
        })();
      }
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, [restoreSession, setAuthFromSession]);

  // Redirections en fonction de l'état d'auth
  useEffect(() => {
    if (!initialized || isLoading) return;

    // Permettre l'accès aux écrans auth/onboarding sans session
    const isPublicRoute = segments[0] === 'auth' || segments[0] === 'onboarding';
    const isVerificationRoute =
      segments[0] === 'auth' &&
      (segments[1] === 'verify-email' ||
        segments[1] === 'callback' ||
        segments[1] === 'verify-phone' ||
        segments[1] === 'verify-phone-info' ||
        segments[1] === 'verify-phone-code');
    const needsPhoneVerification = !!session && !user?.phone;
    
    if (!session && !isPublicRoute) {
      router.replace('/onboarding/splash');
      return;
    }

    // Si connecté mais que le numéro de téléphone n'est pas encore vérifié,
    // forcer le passage par le flow de vérification téléphone.
    if (session && needsPhoneVerification && !isVerificationRoute) {
      router.replace('/auth/verify-phone');
      return;
    }

    // Si connecté (et profil complet) et sur un écran auth/onboarding,
    // rediriger vers le feed sauf pour les écrans de vérification (email / téléphone)
    if (session && !needsPhoneVerification && isPublicRoute && !isVerificationRoute) {
      router.replace('/tabs/feed');
    }
  }, [initialized, isLoading, session, user, router, segments]);

  // Notifications locales : nouveaux messages (hors écran de thread)
  const notifiedIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!session || !user?.id) return;

    void ensureNotificationsConfigured();

    // const channel = supabase // TODO: réactiver le realtime
    //   .channel(`messages:notify:${user.id}`) // TODO: réactiver le realtime
    //   .on( // TODO: réactiver le realtime
    //     'postgres_changes', // TODO: réactiver le realtime
    //     { event: 'INSERT', schema: 'public', table: 'messages' }, // TODO: réactiver le realtime
    //     (payload) => { // TODO: réactiver le realtime
    //       const msg = payload.new as any;
    //       if (!msg?.id || !msg?.thread_id) return;
    //       if (msg.sender_id === user.id) return;
    //       if (notifiedIdsRef.current.has(msg.id)) return;
    //       notifiedIdsRef.current.add(msg.id);
    //
    //       // Si l'utilisateur est déjà dans le thread, ne pas notifier
    //       const isOnThread =
    //         pathname?.startsWith('/tabs/messages/') && pathname.endsWith(`/${msg.thread_id}`);
    //       if (isOnThread) return;
    //
    //       const body = typeof msg.body === 'string' && msg.body.length > 0 ? msg.body : 'New message';
    //       void notifyNewMessage({ title: 'Messages', body });
    //     } // TODO: réactiver le realtime
    //   ) // TODO: réactiver le realtime
    //   .subscribe(); // TODO: réactiver le realtime

    // return () => { // TODO: réactiver le realtime
    //   void supabase.removeChannel(channel); // TODO: réactiver le realtime
    // }; // TODO: réactiver le realtime
  }, [session, user?.id, pathname]);

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
  const router = useRouter();

  // Gestion des deep links (bloomi://auth/callback...)
  useEffect(() => {
    const handleUrl = (event: { url: string }) => {
      const { url } = event;
      if (!url || !url.startsWith('bloomi://')) return;

      try {
        const parsed = new URL(url);
        const host = parsed.host; // ex: "auth"
        const pathname = parsed.pathname; // ex: "/callback"

        if (host === 'profile') {
          router.replace('/tabs/profile/activate-seller-account');
          return;
        }

        if (host === 'auth' && pathname === '/callback') {
          const searchParams = parsed.searchParams;
          const token = searchParams.get('token') ?? undefined;
          const type = searchParams.get('type') ?? undefined;
          const email = searchParams.get('email') ?? undefined;

          router.replace({
            pathname: '/auth/callback',
            params: {
              rawUrl: url,
              ...(token ? { token } : {}),
              ...(type ? { type } : {}),
              ...(email ? { email } : {})
            }
          });
        }
      } catch (e) {
        console.warn('Erreur parsing deep link:', e);
      }
    };

    // Quand l’app est déjà ouverte
    const subscription = Linking.addEventListener('url', handleUrl);

    // Quand l’app est lancée via un lien (cold start)
    (async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        handleUrl({ url: initialUrl });
      }
    })();

    return () => {
      subscription.remove();
    };
  }, [router]);

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
    <StripeProvider
      publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''}
      merchantIdentifier="merchant.com.jupouch.bloomiapp"
    >
      <SafeAreaProvider>
        <AuthGate>
          <Slot />
        </AuthGate>
      </SafeAreaProvider>
    </StripeProvider>
  );
}

