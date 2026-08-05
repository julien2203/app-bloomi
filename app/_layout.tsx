import React, { useEffect, useRef } from 'react';
import { Slot, usePathname, useRouter, useSegments } from 'expo-router';
import { GuestAuthPromptModal } from '../components/auth/GuestAuthPromptModal';
import { isGuestBrowseRoute } from '../lib/guestRoutes';
import { openGuestAuthPrompt } from '../lib/guestAuthPrompt';
import {
  View,
  Linking,
  AppState,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity
} from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { ensureProfileExists } from '../lib/profile';
import { applyPendingSellerProfile } from '../lib/pendingSellerProfile';
import { ensureNotificationsConfigured, notifyNewMessage } from '../lib/notifications';
import { StripeProvider } from '@stripe/stripe-react-native';
import { StripeDeepLinkHandler } from '../components/stripe/StripeDeepLinkHandler';
import {
  STRIPE_MERCHANT_IDENTIFIER,
  STRIPE_URL_SCHEME,
  isStripePaymentReturnUrl
} from '../lib/stripePaymentSheet';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { STRIPE_PUBLISHABLE_KEY, SUPABASE_URL } from '../lib/env';
import { isAuthCallbackUrl, authCallbackRouteParams } from '../lib/auth/authCallbackUrl';
import { shouldSkipOAuthDeepLinkNavigation } from '../lib/auth/oauthExchangeGuard';
import { needsAuthPhoneVerification } from '../lib/auth/needsPhoneVerification';
import {
  isStripeConnectReturnUrl,
  consumeStripeConnectReturnPending,
  navigateAfterStripeConnectReturn,
  navigateInTabs
} from '../lib/navigation/navigateInTabs';
import {
  useFonts,
  Poppins_300Light,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold
} from '@expo-google-fonts/poppins';
import { Inter_400Regular } from '@expo-google-fonts/inter';
import { Text } from '../components/ui/Text';
import { Button } from '../components/ui/Button';
import { theme } from '../lib/theme';
import * as SplashScreen from 'expo-splash-screen';
import '../lib/i18n';
import { initAppLanguage } from '../lib/i18n';
import { useTranslation } from 'react-i18next';
import { installGlobalCrashLogging } from '../lib/crashLogging';
import { authDebug, authDebugContext, authDebugError } from '../lib/authDebugLog';
import { setupAuthSessionRefresh, isAuthBootRestoreInProgress } from '../lib/authSessionRefresh';
import {
  isDressingDeepLinkUrl,
  navigateToSharedDressing,
  navigateToSharedDressingFromUrl
} from '../lib/navigation/dressingDeepLinkNav';
import {
  consumePendingSharedDressing,
  flushPendingSharedDressing,
  hasPendingSharedDressing
} from '../lib/navigation/pendingShareDeepLinkNav';
import { parseListingIdFromUrl } from '../lib/listingShare';
import { openPrivacyPolicy, openTermsOfUse } from '../lib/legalLinks';
import {
  flushPendingNotificationNav,
  hasPendingNotificationNav,
  queueNotificationNavFromResponse
} from '../lib/navigation/pendingNotificationNav';

installGlobalCrashLogging();
authDebugContext('app:boot');

SplashScreen.preventAutoHideAsync().catch(() => {});

const TERMS_ACCEPTED_KEY = 'terms_accepted_v1';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();

  const { session, user, isLoading, initialized, setAuthFromSession, restoreSession, isGuest } =
    useAuthStore();
  const [termsChecked, setTermsChecked] = React.useState(false);
  const [termsAccepted, setTermsAccepted] = React.useState(false);

  useEffect(() => {
    if (!initialized) return;
    void initAppLanguage(user?.id ?? null);
  }, [initialized, user?.id]);

  // Initialisation de la session + abonnement aux changements Supabase
  useEffect(() => {
    supabase.auth.stopAutoRefresh();

    const { data } = supabase.auth.onAuthStateChange((event, sess) => {
      if (event === 'SIGNED_OUT' && isAuthBootRestoreInProgress()) {
        authDebug('authGate:onAuthStateChange:ignored', { event, reason: 'bootRestore' });
        return;
      }
      authDebug('authGate:onAuthStateChange', {
        event,
        hasSession: Boolean(sess),
        userId: sess?.user?.id ?? null,
        hasPhone: Boolean(sess?.user?.phone)
      });
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
            authDebug('authGate:ensureProfile:skipped', { userId, reason: 'recentLoginMarker' });
            await AsyncStorage.removeItem(markerKey);
            return;
          }

          authDebug('authGate:ensureProfile:start', { userId, event });
          await ensureProfileExists(sess);
          await applyPendingSellerProfile(userId, {
            email: sess.user.email ?? null
          });
          authDebug('authGate:ensureProfile:done', { userId });
        })();
      }
    });

    void (async () => {
      await restoreSession();
      setupAuthSessionRefresh();
    })();

    return () => {
      data.subscription.unsubscribe();
    };
  }, [restoreSession, setAuthFromSession]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(TERMS_ACCEPTED_KEY);
        if (!mounted) return;
        setTermsAccepted(raw === 'true');
      } finally {
        if (mounted) setTermsChecked(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Redirections en fonction de l'état d'auth
  useEffect(() => {
    if (!initialized || isLoading) return;

    // Permettre l'accès aux écrans auth/onboarding sans session
    const isPublicRoute = segments[0] === 'auth' || segments[0] === 'onboarding';
    const isVerificationRoute =
      segments[0] === 'auth' &&
      (segments[1] === 'verify-email' ||
        segments[1] === 'seller-type' ||
        segments[1] === 'callback' ||
        segments[1] === 'oauth-callback' ||
        segments[1] === 'reset-password' ||
        segments[1] === 'verify-phone' ||
        segments[1] === 'verify-phone-info' ||
        segments[1] === 'verify-phone-code');
    // SMS obligatoire tant que auth.users.phone_confirmed_at est vide
    // (signup email sans numéro, ou OTP phone_change non validé).
    const needsPhoneVerification = !!session && needsAuthPhoneVerification(user);
    const normalizedPath = (pathname ?? '').replace(/\/+$/, '') || '/';

    // Lien dressing partagé : ne pas écraser par onboarding / verify-phone / feed.
    if (
      normalizedPath.startsWith('/dressing') ||
      normalizedPath.startsWith('/tabs/public-profile') ||
      hasPendingSharedDressing()
    ) {
      authDebug('authGate:redirect:stay', {
        reason: hasPendingSharedDressing() ? 'pendingDressingDeepLink' : 'dressingRoute',
        path: normalizedPath
      });
      return;
    }

    if (!session) {
      if (isPublicRoute) {
        authDebug('authGate:redirect:stay', { reason: 'publicRoute', path: normalizedPath });
      } else if (isGuest && isGuestBrowseRoute(normalizedPath)) {
        authDebug('authGate:redirect:stay', { reason: 'guestBrowse', path: normalizedPath });
      } else if (isGuest && !isGuestBrowseRoute(normalizedPath)) {
        authDebug('authGate:redirect:guestToFeed', { path: normalizedPath });
        navigateInTabs('/tabs/feed');
        setTimeout(() => openGuestAuthPrompt(), 0);
        return;
      } else if (
        (hasPendingNotificationNav() || hasPendingSharedDressing()) &&
        isAuthBootRestoreInProgress()
      ) {
        // Cold start depuis une push / deep link : attendre la restauration de session
        // avant de renvoyer vers l'onboarding (évite la boucle splash).
        authDebug('authGate:redirect:stay', {
          reason: 'pendingNavDuringBootRestore',
          path: normalizedPath
        });
        return;
      } else {
        authDebug('authGate:redirect:onboarding', { path: normalizedPath });
        router.replace('/onboarding/step-1');
        return;
      }
    }

    // Si connecté mais que le numéro de téléphone n'est pas encore vérifié,
    // forcer le passage par le flow de vérification téléphone.
    if (session && needsPhoneVerification && !isVerificationRoute) {
      authDebug('authGate:redirect:verifyPhone', {
        path: normalizedPath,
        userId: user?.id ?? null
      });
      router.replace('/auth/verify-phone');
      return;
    }

    // Si connecté (et profil complet) et sur un écran auth/onboarding,
    // rediriger vers le feed sauf pour les écrans de vérification (email / téléphone)
    if (session && !needsPhoneVerification && isPublicRoute && !isVerificationRoute) {
      authDebug('authGate:redirect:feed', { path: normalizedPath, userId: user?.id ?? null });
      navigateInTabs('/tabs/feed');
    }
  }, [initialized, isLoading, session, user, router, segments, pathname, isGuest]);

  // Après auth prête : appliquer la navigation push mise en file d'attente.
  useEffect(() => {
    if (!initialized || isLoading || !session || !termsAccepted) return;

    if (needsAuthPhoneVerification(user)) return;

    flushPendingNotificationNav(router);
  }, [
    initialized,
    isLoading,
    session,
    termsAccepted,
    user?.phone_confirmed_at,
    router
  ]);

  // Dressing partagé : flush dès que l'app est prête (session optionnelle — lien public).
  useEffect(() => {
    if (!initialized || isLoading || !termsAccepted) return;
    if (!hasPendingSharedDressing()) return;

    const normalizedPath = (pathname ?? '').replace(/\/+$/, '') || '/';

    // Destination déjà atteinte : juste vider la file.
    if (normalizedPath.startsWith('/tabs/public-profile')) {
      consumePendingSharedDressing();
      return;
    }

    // Laisser le Redirect de /dressing/[userId] agir, puis forcer si bloqué.
    if (normalizedPath.startsWith('/dressing/')) {
      const timer = setTimeout(() => {
        if (hasPendingSharedDressing()) {
          flushPendingSharedDressing(router);
        }
      }, 700);
      return () => clearTimeout(timer);
    }

    flushPendingSharedDressing(router);
  }, [initialized, isLoading, termsAccepted, pathname, router]);

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

  // Enregistrement du push token Expo au démarrage (si connecté)
  const didRegisterPushRef = useRef<string | null>(null);
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    if (didRegisterPushRef.current === userId) return;
    didRegisterPushRef.current = userId;

    void (async () => {
      try {
        authDebug('push:register:start', { userId });
        if (Platform.OS === 'web') {
          authDebug('push:register:skipped', { reason: 'web' });
          return;
        }
        if (Constants.appOwnership === 'expo') {
          authDebug('push:register:skipped', { reason: 'expoGo' });
          return;
        }

        // Import dynamique pour éviter le crash Expo Go (SDK 53+)
        const Notifications = await import('expo-notifications');

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.DEFAULT
          });
        }

        const permission = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true
          }
        });
        const granted =
          (permission as any).granted ||
          permission.status === Notifications.PermissionStatus.GRANTED;
        authDebug('push:permission', { granted, status: permission.status });
        if (!granted) return;

        const expoToken = await Notifications.getExpoPushTokenAsync({
          projectId: '6e1bb048-f2d6-4907-99b6-f8c631fe594e'
        });

        const token = (expoToken as any)?.data;
        authDebug('push:token', { hasToken: Boolean(token) });
        if (!token) return;

        // Associer le token à l'utilisateur courant + dédupliquer côté serveur (évite qu'un autre compte
        // sur le même device reçoive les notifications).
        const response = await fetch(`${SUPABASE_URL}/functions/v1/register-push-token`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token ?? ''}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ expo_push_token: token })
        });

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          authDebugError('push:register:apiFailed', text || `${response.status}`, { userId });
        } else {
          authDebug('push:register:done', { userId });
        }
      } catch (e) {
        authDebugError('push:register:exception', e, { userId });
      }
    })();
  }, [session]);

  // Masquer le splash natif (vert + logo) une fois l'app prête — pas d'écran de chargement JS intermédiaire.
  useEffect(() => {
    if (initialized && termsChecked) {
      void SplashScreen.hideAsync();
    }
  }, [initialized, termsChecked]);

  if (!initialized || !termsChecked) {
    return null;
  }

  if (!termsAccepted) {
    return (
      <View style={styles.termsOverlay}>
        <View style={styles.termsCard}>
          <Text variant="h2" style={styles.termsTitle}>
            {t('app.termsModal.title')}
          </Text>
          <ScrollView style={styles.termsScroll} contentContainerStyle={styles.termsScrollContent}>
            <Text variant="captionSm" color="textSecondary" style={styles.termsText}>
              {t('app.termsModal.body')}
            </Text>
            <View style={styles.termsLinks}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  openTermsOfUse(router);
                }}
              >
                <Text variant="captionSm" style={styles.termsLinkText}>
                  {t('app.termsModal.readFullTerms')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={openPrivacyPolicy}
              >
                <Text variant="captionSm" style={styles.termsLinkText}>
                  {t('app.termsModal.readPrivacy')}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
          <Button
            title={t('app.termsModal.accept')}
            onPress={() => {
              void (async () => {
                await AsyncStorage.setItem(TERMS_ACCEPTED_KEY, 'true');
                setTermsAccepted(true);
              })();
            }}
            variant="primary"
            style={styles.termsAcceptButton}
          />
        </View>
      </View>
    );
  }

  return (
    <>
      <GuestAuthPromptModal />
      {children}
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_300Light,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Inter_400Regular
  });
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  // Navigation au tap sur une notification (push/local) :
  // on met en file d'attente, AuthGate flush une fois la session prête.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (Constants.appOwnership === 'expo') return;

    let subscription: { remove: () => void } | null = null;
    let cancelled = false;

    const ingestResponse = async (response: any) => {
      const queued = queueNotificationNavFromResponse(response);
      if (!queued) return;

      try {
        const Notifications = await import('expo-notifications');
        await Notifications.clearLastNotificationResponseAsync();
      } catch {
        // silencieux
      }

      // Si la session est déjà prête (app chaude), naviguer tout de suite.
      const { session, initialized, isLoading, user } = useAuthStore.getState();
      if (
        initialized &&
        !isLoading &&
        session &&
        !needsAuthPhoneVerification(user)
      ) {
        flushPendingNotificationNav(routerRef.current);
      }
    };

    void (async () => {
      try {
        const Notifications = await import('expo-notifications');
        if (cancelled) return;

        const last = await Notifications.getLastNotificationResponseAsync();
        if (last && !cancelled) {
          await ingestResponse(last);
        }

        subscription = Notifications.addNotificationResponseReceivedListener((resp) => {
          void ingestResponse(resp);
        });
      } catch {
        // silencieux
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  // Retour Stripe : reprise à chaud (app déjà ouverte, sans repasser par index)
  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      const resumedFromBackground =
        (prev === 'background' || prev === 'inactive') && next === 'active';
      if (!resumedFromBackground) return;
      void (async () => {
        if (await consumeStripeConnectReturnPending()) {
          navigateAfterStripeConnectReturn();
        }
      })();
    });
    return () => sub.remove();
  }, []);

  // Gestion des deep links (bloomi://auth/callback...)
  useEffect(() => {
    const handleUrl = (event: { url: string }) => {
      const { url } = event;
      if (!url) return;

      if (isDressingDeepLinkUrl(url)) {
        authDebug('deepLink:dressing', { urlPrefix: url.slice(0, 80) });
        navigateToSharedDressingFromUrl(url);
        return;
      }

      const listingIdFromHttps = parseListingIdFromUrl(url);
      if (listingIdFromHttps) {
        router.push({ pathname: '/tabs/feed/[id]', params: { id: listingIdFromHttps } });
        return;
      }

      if (!url.startsWith('bloomi://')) return;

      try {
        const parsed = new URL(url);
        const host = parsed.host; // ex: "auth"
        const pathname = parsed.pathname; // ex: "/callback"

        if (host === 'profile' || isStripeConnectReturnUrl(url)) {
          navigateAfterStripeConnectReturn();
          return;
        }

        if (isStripePaymentReturnUrl(url)) {
          return;
        }

        if (host === 'listing') {
          const listingId = pathname.replace(/^\//, '').trim();
          if (listingId) {
            router.push({ pathname: '/tabs/feed/[id]', params: { id: listingId } });
          }
          return;
        }

        if (host === 'dressing') {
          const sellerId = pathname.replace(/^\//, '').trim();
          if (sellerId) {
            authDebug('deepLink:dressing', { sellerId });
            navigateToSharedDressing(sellerId);
          }
          return;
        }

        if (host === 'auth' && pathname === '/oauth-callback') {
          if (shouldSkipOAuthDeepLinkNavigation(url)) {
            authDebug('deepLink:oauthCallback:skipped', { reason: 'inlineOrRecentOAuth' });
            return;
          }
          authDebug('deepLink:oauthCallback', {
            urlPrefix: url.slice(0, 100),
            hasCode: url.includes('code=')
          });
          router.replace({
            pathname: '/auth/oauth-callback',
            params: authCallbackRouteParams(url)
          });
          return;
        }

        if (host === 'auth' && pathname === '/callback') {
          // Pendant Google/Apple, Supabase peut renvoyer vers Site URL (auth/callback).
          // Ne pas remonter l'écran email : socialAuth échange déjà le code.
          if (shouldSkipOAuthDeepLinkNavigation(url)) {
            authDebug('deepLink:authCallback:skipped', { reason: 'inlineOrRecentOAuth' });
            return;
          }
          authDebug('deepLink:authCallback', {
            urlPrefix: url.slice(0, 100),
            hasCode: url.includes('code='),
            hasFragmentTokens: url.includes('access_token=')
          });
          router.replace({
            pathname: '/auth/callback',
            params: authCallbackRouteParams(url)
          });
        }
      } catch (e) {
        console.warn('Erreur parsing deep link:', e);
      }
    };

    // Quand l’app est déjà ouverte
    const subscription = Linking.addEventListener('url', handleUrl);

    // Quand l'app est lancée via un lien (cold start)
    (async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        if (isStripePaymentReturnUrl(initialUrl)) {
          return;
        }
        if (isStripeConnectReturnUrl(initialUrl)) {
          navigateAfterStripeConnectReturn();
          return;
        }
        if (isAuthCallbackUrl(initialUrl)) {
          handleUrl({ url: initialUrl });
          return;
        }
        if (isDressingDeepLinkUrl(initialUrl)) {
          handleUrl({ url: initialUrl });
          return;
        }
        const listingIdFromInitialUrl = parseListingIdFromUrl(initialUrl);
        if (listingIdFromInitialUrl) {
          handleUrl({ url: initialUrl });
          return;
        }
        handleUrl({ url: initialUrl });
      }
    })();

    return () => {
      subscription.remove();
    };
  }, [router]);

  // Attendre les polices ; le splash natif (vert + logo) reste visible pendant ce temps.
  if (!fontsLoaded && !fontError) {
    return null;
  }

  // Si erreur de chargement des polices, continuer quand même (fallback sur système)
  if (fontError) {
    console.warn('Erreur chargement polices Poppins:', fontError);
  }

  return (
    <StripeProvider
      publishableKey={STRIPE_PUBLISHABLE_KEY ?? ''}
      merchantIdentifier={STRIPE_MERCHANT_IDENTIFIER}
      urlScheme={STRIPE_URL_SCHEME}
    >
      <StripeDeepLinkHandler />
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <AuthGate>
          <Slot />
        </AuthGate>
      </SafeAreaProvider>
    </StripeProvider>
  );
}

const styles = StyleSheet.create({
  termsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20
  },
  termsCard: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16
  },
  termsTitle: {
    textAlign: 'center',
    marginBottom: 10
  },
  termsScroll: {
    maxHeight: 260
  },
  termsScrollContent: {
    paddingBottom: 8
  },
  termsText: {
    lineHeight: 20
  },
  termsLinks: {
    marginTop: 14,
    gap: 10
  },
  termsLinkText: {
    lineHeight: 20,
    color: theme.colors.textPrimary,
    textDecorationLine: 'underline',
    fontFamily: theme.fontFamily.semiBold
  },
  termsAcceptButton: {
    marginTop: 14
  }
});

