import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { theme } from '../../lib/theme';
import { navigateAfterStripeConnectReturn } from '../../lib/navigation/navigateInTabs';
import { mergeAuthCallback } from '../../lib/auth/authCallbackUrl';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    access_token?: string;
    refresh_token?: string;
    type?: string;
    token?: string;
    token_hash?: string;
    email?: string;
    rawUrl?: string;
  }>();

  useEffect(() => {
    const handleCallback = async () => {
      const rawUrlParam = typeof params.rawUrl === 'string' ? params.rawUrl : null;
      const initialUrl = rawUrlParam || (await Linking.getInitialURL());

      if (initialUrl?.toLowerCase().includes('profile')) {
        navigateAfterStripeConnectReturn();
        return;
      }

      const parsed = mergeAuthCallback(initialUrl, {
        type: typeof params.type === 'string' ? params.type : undefined,
        access_token: typeof params.access_token === 'string' ? params.access_token : undefined,
        refresh_token: typeof params.refresh_token === 'string' ? params.refresh_token : undefined,
        token: typeof params.token === 'string' ? params.token : undefined,
        token_hash: typeof params.token_hash === 'string' ? params.token_hash : undefined,
        email: typeof params.email === 'string' ? params.email : undefined
      });

      const isRecovery = parsed.intent === 'recovery';

      const goAfterSession = (hasPhone: boolean) => {
        if (isRecovery) {
          router.replace('/auth/reset-password');
          return;
        }
        if (!hasPhone) {
          router.replace('/auth/verify-phone');
          return;
        }
        router.replace('/auth/verify-phone');
      };

      try {
        if (parsed.errorCode) {
          console.warn('Auth callback error:', parsed.errorCode);
          router.replace(isRecovery ? '/auth/reset-password' : '/auth/login');
          return;
        }

        // PKCE / template : token_hash + type=recovery
        if (isRecovery && parsed.tokenHash) {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: parsed.tokenHash,
            type: 'recovery'
          });
          if (!error && data.session) {
            goAfterSession(Boolean(data.session.user.phone?.trim()));
            return;
          }
        }

        // Implicit : access_token + refresh_token (fragment ou query)
        if (parsed.accessToken && parsed.refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: parsed.accessToken,
            refresh_token: parsed.refreshToken
          });

          if (!error && data.session) {
            goAfterSession(Boolean(data.session.user.phone?.trim()));
            return;
          }
        }

        // Signup : token + email
        if (parsed.intent === 'signup' && parsed.email && parsed.token) {
          const { data, error } = await supabase.auth.verifyOtp({
            email: parsed.email,
            token: parsed.token,
            type: 'signup'
          });

          if (!error && data.session) {
            goAfterSession(Boolean(data.session.user.phone?.trim()));
            return;
          }
        }

        // Intent recovery explicite mais tokens absents (session peut déjà être en recovery)
        if (isRecovery) {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            router.replace('/auth/reset-password');
            return;
          }
          router.replace('/auth/login');
          return;
        }

        const { data } = await supabase.auth.getSession();
        if (data.session) {
          goAfterSession(Boolean(data.session.user.phone?.trim()));
          return;
        }

        router.replace('/auth/login');
      } catch {
        if (isRecovery) {
          router.replace('/auth/reset-password');
          return;
        }
        const { data } = await supabase.auth.getSession();
        if (data.session && !data.session.user.phone?.trim()) {
          router.replace('/auth/verify-phone');
          return;
        }
        router.replace('/auth/login');
      }
    };

    void handleCallback();
  }, [
    router,
    params.access_token,
    params.refresh_token,
    params.email,
    params.token,
    params.token_hash,
    params.type,
    params.rawUrl
  ]);

  return (
    <>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <ActivityIndicator size="large" color={theme.colors.textPrimary} />
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgroundWhite
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  }
});
