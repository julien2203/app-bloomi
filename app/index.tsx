import React, { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useAuthStore } from '../stores/authStore';
import { isAuthCallbackUrl, isOAuthCallbackUrl } from '../lib/auth/authCallbackUrl';
import {
  consumeStripeConnectReturnPending,
  isStripeConnectReturnUrl,
  navigateAfterStripeConnectReturn,
  navigateInTabs
} from '../lib/navigation/navigateInTabs';
import {
  isDressingDeepLinkUrl,
  navigateToSharedDressingFromUrl
} from '../lib/navigation/dressingDeepLinkNav';
import { authDebug } from '../lib/authDebugLog';
import { shouldSkipOAuthDeepLinkNavigation } from '../lib/auth/oauthExchangeGuard';

/** Route de boot : redirection sans second écran spinner (AuthGate gère déjà le chargement). */
export default function IndexScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { session, initialized, isLoading, isGuest } = useAuthStore();
  const didRedirectRef = useRef(false);

  useEffect(() => {
    if (!initialized || isLoading || didRedirectRef.current) {
      return;
    }

    const normalizedPath = (pathname ?? '').replace(/\/+$/, '') || '/';
    if (
      normalizedPath.startsWith('/dressing') ||
      normalizedPath.startsWith('/tabs/public-profile')
    ) {
      didRedirectRef.current = true;
      return;
    }

    void (async () => {
      const initialUrl = await Linking.getInitialURL();
      const pendingStripeReturn = await consumeStripeConnectReturnPending();
      if (isStripeConnectReturnUrl(initialUrl) || pendingStripeReturn) {
        didRedirectRef.current = true;
        navigateAfterStripeConnectReturn();
        return;
      }

      if (isOAuthCallbackUrl(initialUrl)) {
        if (shouldSkipOAuthDeepLinkNavigation(initialUrl)) {
          authDebug('index:oauthCallback:skipped', { reason: 'inlineOrRecentOAuth' });
          didRedirectRef.current = true;
          return;
        }
        didRedirectRef.current = true;
        router.replace({
          pathname: '/auth/oauth-callback',
          params: { rawUrl: initialUrl ?? '' }
        });
        return;
      }

      if (isAuthCallbackUrl(initialUrl)) {
        if (shouldSkipOAuthDeepLinkNavigation(initialUrl)) {
          authDebug('index:authCallback:skipped', { reason: 'inlineOrRecentOAuth' });
          didRedirectRef.current = true;
          return;
        }
        didRedirectRef.current = true;
        router.replace({
          pathname: '/auth/callback',
          params: { rawUrl: initialUrl ?? '' }
        });
        return;
      }

      if (isDressingDeepLinkUrl(initialUrl)) {
        didRedirectRef.current = true;
        authDebug('index:redirect', { target: 'dressing', reason: 'deepLink' });
        navigateToSharedDressingFromUrl(initialUrl!);
        return;
      }

      didRedirectRef.current = true;
      if (session) {
        authDebug('index:redirect', { target: 'feed', reason: 'session' });
        navigateInTabs('/tabs/feed');
      } else if (isGuest) {
        authDebug('index:redirect', { target: 'feed', reason: 'guest' });
        navigateInTabs('/tabs/feed');
      } else {
        authDebug('index:redirect', { target: 'onboarding/step-1', reason: 'noSession' });
        router.replace('/onboarding/step-1');
      }
    })();
  }, [initialized, isLoading, session, isGuest, router, pathname]);

  return null;
}
