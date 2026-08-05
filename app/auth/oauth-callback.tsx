/**
 * Retour OAuth Google/Apple uniquement (bloomi://auth/oauth-callback).
 * L'échange PKCE chaud se fait dans socialAuth.ts via openAuthSessionAsync.
 * Cold start : un seul échange ici.
 */

import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { theme } from '../../lib/theme';
import { mergeAuthCallback } from '../../lib/auth/authCallbackUrl';
import { authDebug, authDebugError } from '../../lib/authDebugLog';
import { ensureProfileExists } from '../../lib/profile';
import { applyPendingSellerProfile } from '../../lib/pendingSellerProfile';
import { postAuthDestination } from '../../lib/auth/needsPhoneVerification';
import {
  buildOAuthPkceCallbackUrl,
  exchangePkceCallbackOnce,
  isAuthCodeAlreadyExchanged,
  isOAuthBrowserSessionActive,
  isRecentOAuthFlow,
  waitForSessionAfterOAuth
} from '../../lib/auth/oauthExchangeGuard';

function paramString(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string' && value.trim()) return value;
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) return value[0];
  return undefined;
}

export default function OAuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string;
    rawUrl?: string;
  }>();
  const handledKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const handleKey = [paramString(params.rawUrl) ?? '', paramString(params.code) ?? ''].join('|');
    if (handledKeyRef.current === handleKey) return;
    handledKeyRef.current = handleKey;

    let cancelled = false;
    const safetyTimer = setTimeout(() => {
      if (cancelled) return;
      authDebugError('oauthCallback:timeout');
      router.replace('/auth/login');
    }, 25000);

    const finish = (path: '/auth/login' | '/auth/verify-phone' | '/tabs/feed') => {
      if (cancelled) return;
      clearTimeout(safetyTimer);
      router.replace(path);
    };

    const goAfterSession = async (session: Session) => {
      await ensureProfileExists(session);
      await applyPendingSellerProfile(session.user.id, {
        email: session.user.email ?? null
      });
      authDebug('oauthCallback:goAfterSession', { userId: session.user.id });
      finish(postAuthDestination(session.user));
    };

    const handleOAuthCallback = async () => {
      authDebug('oauthCallback:start');
      const rawUrlParam = paramString(params.rawUrl);
      const initialUrl = rawUrlParam || (await Linking.getInitialURL());
      const parsed = mergeAuthCallback(initialUrl, {
        code: paramString(params.code)
      });

      if (parsed.errorCode) {
        authDebugError('oauthCallback:errorCode', { code: parsed.errorCode });
        finish('/auth/login');
        return;
      }

      if (!parsed.code) {
        authDebugError('oauthCallback:missingCode');
        finish('/auth/login');
        return;
      }

      // Flux chaud : socialAuth.ts a déjà fait (ou fait) l'échange — ne pas réappeler /token.
      if (isOAuthBrowserSessionActive() || isRecentOAuthFlow()) {
        authDebug('oauthCallback:waitInline', {
          browserActive: isOAuthBrowserSessionActive(),
          recentOAuth: isRecentOAuthFlow()
        });
        const session = await waitForSessionAfterOAuth();
        if (session) {
          await goAfterSession(session);
          return;
        }
        authDebugError('oauthCallback:noSessionAfterWait');
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

      // Cold start : un seul échange PKCE.
      const urlForExchange =
        initialUrl && initialUrl.includes('code=')
          ? initialUrl
          : buildOAuthPkceCallbackUrl(parsed.code);
      authDebug('oauthCallback:coldStartExchange', { urlPrefix: urlForExchange.slice(0, 100) });
      const { session, error } = await exchangePkceCallbackOnce(urlForExchange);
      if (!error && session) {
        await goAfterSession(session);
        return;
      }
      if (error) {
        authDebugError('oauthCallback:exchangeFailed', error);
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          await goAfterSession(data.session);
          return;
        }
      }
      finish('/auth/login');
    };

    void handleOAuthCallback();

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
    };
  }, [router, params.code, params.rawUrl]);

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
