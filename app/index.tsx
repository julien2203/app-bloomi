import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useAuthStore } from '../stores/authStore';
import { theme } from '../lib/theme';
import { isAuthCallbackUrl } from '../lib/auth/authCallbackUrl';
import {
  consumeStripeConnectReturnPending,
  isStripeConnectReturnUrl,
  navigateAfterStripeConnectReturn,
  navigateInTabs
} from '../lib/navigation/navigateInTabs';

export default function IndexScreen() {
  const router = useRouter();
  const { session, initialized, isLoading, isGuest } = useAuthStore();
  const didRedirectRef = useRef(false);

  useEffect(() => {
    if (!initialized || isLoading || didRedirectRef.current) {
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

      if (isAuthCallbackUrl(initialUrl)) {
        didRedirectRef.current = true;
        router.replace({
          pathname: '/auth/callback',
          params: { rawUrl: initialUrl ?? '' }
        });
        return;
      }

      didRedirectRef.current = true;
      if (session) {
        navigateInTabs('/tabs/feed');
      } else if (isGuest) {
        navigateInTabs('/tabs/feed');
      } else {
        router.replace('/onboarding/splash');
      }
    })();
  }, [initialized, isLoading, session, isGuest, router]);

  if (!initialized || isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.colors.primary
        }}
      >
        <ActivityIndicator size="large" color={theme.colors.textPrimary} />
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.primary
      }}
    >
      <ActivityIndicator size="large" color={theme.colors.textPrimary} />
    </View>
  );
}
