import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { EmailOtpType, Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { theme } from '../../lib/theme';
import { navigateAfterStripeConnectReturn } from '../../lib/navigation/navigateInTabs';
import { mergeAuthCallback } from '../../lib/auth/authCallbackUrl';
import { authDebug, authDebugError } from '../../lib/authDebugLog';
import { ensureProfileExists } from '../../lib/profile';
import { applyPendingSellerProfile } from '../../lib/pendingSellerProfile';
import {
  needsAuthPhoneVerification,
  postAuthDestination
} from '../../lib/auth/needsPhoneVerification';
import {
  buildEmailPkceCallbackUrl,
  exchangePkceCallbackOnce,
  isAuthCodeAlreadyExchanged,
  isLikelyOAuthPkceCallback,
  isOAuthBrowserSessionActive,
  isRecentOAuthFlow,
  waitForSessionAfterOAuth
} from '../../lib/auth/oauthExchangeGuard';

function paramString(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string' && value.trim()) return value;
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) return value[0];
  return undefined;
}

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    access_token?: string;
    refresh_token?: string;
    code?: string;
    type?: string;
    token?: string;
    token_hash?: string;
    email?: string;
    rawUrl?: string;
  }>();
  const handledKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const handleKey = [
      paramString(params.rawUrl) ?? '',
      paramString(params.code) ?? '',
      paramString(params.access_token) ?? '',
      paramString(params.token_hash) ?? '',
      paramString(params.token) ?? '',
      paramString(params.type) ?? ''
    ].join('|');
    if (handledKeyRef.current === handleKey) return;
    handledKeyRef.current = handleKey;

    let cancelled = false;
    const safetyTimer = setTimeout(() => {
      if (cancelled) return;
      authDebugError('callback:timeout');
      router.replace('/auth/login');
    }, 20000);

    const finish = (path: '/auth/login' | '/auth/reset-password' | '/auth/verify-phone' | '/tabs/feed') => {
      if (cancelled) return;
      clearTimeout(safetyTimer);
      router.replace(path);
    };

    const handleCallback = async () => {
      authDebug('callback:start', { hasRawUrlParam: Boolean(params.rawUrl) });
      const rawUrlParam = paramString(params.rawUrl);
      const initialUrl = rawUrlParam || (await Linking.getInitialURL());
      authDebug('callback:url', {
        hasInitialUrl: Boolean(initialUrl),
        hasCodeInUrl: Boolean(initialUrl?.includes('code=')),
        hasFragmentTokens: Boolean(initialUrl?.includes('access_token=')),
        urlPrefix: initialUrl?.slice(0, 100) ?? null
      });

      if (initialUrl?.toLowerCase().includes('profile')) {
        authDebug('callback:stripeReturn');
        clearTimeout(safetyTimer);
        navigateAfterStripeConnectReturn();
        return;
      }

      const parsed = mergeAuthCallback(initialUrl, {
        type: paramString(params.type),
        access_token: paramString(params.access_token),
        refresh_token: paramString(params.refresh_token),
        code: paramString(params.code),
        token: paramString(params.token),
        token_hash: paramString(params.token_hash),
        email: paramString(params.email)
      });

      const isRecovery = parsed.intent === 'recovery';
      authDebug('callback:parsed', {
        intent: parsed.intent,
        isRecovery,
        hasAccessToken: Boolean(parsed.accessToken),
        hasRefreshToken: Boolean(parsed.refreshToken),
        hasCode: Boolean(parsed.code),
        hasTokenHash: Boolean(parsed.tokenHash),
        hasToken: Boolean(parsed.token),
        hasEmail: Boolean(parsed.email),
        errorCode: parsed.errorCode ?? null
      });

      const goAfterSession = async (session: Session) => {
        await ensureProfileExists(session);
        if (!isRecovery) {
          await applyPendingSellerProfile(session.user.id, {
            email: session.user.email ?? parsed.email ?? null
          });
        }

        const phonePendingVerification = needsAuthPhoneVerification(session.user);
        authDebug('callback:goAfterSession', {
          phonePendingVerification,
          isRecovery
        });
        if (isRecovery) {
          finish('/auth/reset-password');
          return;
        }
        finish(postAuthDestination(session.user));
      };

      try {
        if (parsed.errorCode) {
          authDebugError('callback:errorCode', parsed.errorCode);
          finish(isRecovery ? '/auth/reset-password' : '/auth/login');
          return;
        }

        // 1) PKCE email (confirmation inscription).
        // Si un OAuth Google/Apple est en cours / récent, ne JAMAIS rééchanger ici
        // (sinon flow_state_not_found). L'échange est fait dans socialAuth.ts.
        if (parsed.code) {
          const likelyOAuth = isLikelyOAuthPkceCallback({
            code: parsed.code,
            tokenHash: parsed.tokenHash,
            email: parsed.email,
            token: parsed.token
          });

          if (likelyOAuth && (isOAuthBrowserSessionActive() || isRecentOAuthFlow())) {
            authDebug('callback:pkce:skipOAuthExchange', {
              browserActive: isOAuthBrowserSessionActive(),
              recentOAuth: isRecentOAuthFlow()
            });
            const session = await waitForSessionAfterOAuth();
            if (session) {
              await goAfterSession(session);
              return;
            }
            authDebugError('callback:pkce:oauthNoSessionAfterWait');
            finish('/auth/login');
            return;
          }

          if (isAuthCodeAlreadyExchanged(parsed.code)) {
            const { data } = await supabase.auth.getSession();
            if (data.session) {
              await goAfterSession(data.session);
              return;
            }
          }

          const urlForExchange =
            initialUrl && initialUrl.includes('code=')
              ? initialUrl
              : buildEmailPkceCallbackUrl(parsed.code);
          const { session, error } = await exchangePkceCallbackOnce(urlForExchange);
          if (!error && session) {
            await goAfterSession(session);
            return;
          }
          if (error) {
            authDebugError('callback:exchangeCodeFailed', error);
            const { data } = await supabase.auth.getSession();
            if (data.session) {
              await goAfterSession(data.session);
              return;
            }
          }
        }

        // 2) token_hash (templates email / recovery / signup)
        if (parsed.tokenHash) {
          const otpType: EmailOtpType =
            isRecovery
              ? 'recovery'
              : parsed.intent === 'signup'
                ? 'signup'
                : 'email';
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: parsed.tokenHash,
            type: otpType
          });
          if (!error && data.session) {
            await goAfterSession(data.session);
            return;
          }
          // Retry signup si type ambigu
          if (!isRecovery && otpType !== 'signup') {
            const retry = await supabase.auth.verifyOtp({
              token_hash: parsed.tokenHash,
              type: 'signup'
            });
            if (!retry.error && retry.data.session) {
              await goAfterSession(retry.data.session);
              return;
            }
          }
          authDebugError('callback:tokenHashFailed', error);
        }

        // 3) Implicit : access_token + refresh_token (fragment ou query)
        if (parsed.accessToken && parsed.refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: parsed.accessToken,
            refresh_token: parsed.refreshToken
          });
          if (!error && data.session) {
            await goAfterSession(data.session);
            return;
          }
          authDebugError('callback:setSessionFailed', error);
        }

        // 4) Signup legacy : token OTP + email
        if (parsed.email && parsed.token) {
          const { data, error } = await supabase.auth.verifyOtp({
            email: parsed.email,
            token: parsed.token,
            type: isRecovery ? 'recovery' : 'signup'
          });
          if (!error && data.session) {
            await goAfterSession(data.session);
            return;
          }
          authDebugError('callback:otpTokenFailed', error);
        }

        if (isRecovery) {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            finish('/auth/reset-password');
            return;
          }
          finish('/auth/login');
          return;
        }

        const { data } = await supabase.auth.getSession();
        if (data.session) {
          await goAfterSession(data.session);
          return;
        }

        // Email déjà confirmé côté serveur mais tokens absents (fragment Android droppé) :
        // sortir du spinner vers login plutôt que boucler.
        authDebug('callback:fallbackLogin', { email: parsed.email ?? null });
        finish('/auth/login');
      } catch (e) {
        authDebugError('callback:exception', e);
        if (isRecovery) {
          finish('/auth/reset-password');
          return;
        }
        const { data } = await supabase.auth.getSession();
        if (data.session && needsAuthPhoneVerification(data.session.user)) {
          finish('/auth/verify-phone');
          return;
        }
        finish('/auth/login');
      }
    };

    void handleCallback();

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
    };
  }, [
    router,
    params.access_token,
    params.refresh_token,
    params.code,
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
