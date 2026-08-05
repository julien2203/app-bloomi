import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { ensureProfileExists } from './profile';
import { authDebug, authDebugError } from './authDebugLog';
import {
  exchangePkceCallbackOnce,
  getOAuthRedirectUri,
  markOAuthFlowStarted,
  noteOAuthRedirectTo,
  runWithOAuthBrowserSession
} from './auth/oauthExchangeGuard';

export {
  getEmailAuthCallbackRedirectUri,
  getOAuthRedirectUri,
  isOAuthBrowserSessionActive,
  shouldSkipOAuthDeepLinkNavigation
} from './auth/oauthExchangeGuard';

/**
 * Termine une session Safari/Chrome Custom Tabs lancée pour OAuth (iOS).
 * @see https://docs.expo.dev/guides/authentication/#implementing-webbrowser-based-authentication-on-ios
 */
WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = 'google' | 'apple';

let oauthSignInInFlight: Promise<{ error: Error | null }> | null = null;

function extractFragmentParams(callbackUrl: string): URLSearchParams {
  const hashIdx = callbackUrl.indexOf('#');
  if (hashIdx === -1) return new URLSearchParams();
  return new URLSearchParams(callbackUrl.slice(hashIdx + 1));
}

function parseQueryParams(url: string): URLSearchParams {
  try {
    const noHash = url.split('#')[0];
    const qIdx = noHash.indexOf('?');
    if (qIdx === -1) return new URLSearchParams();
    return new URLSearchParams(noHash.slice(qIdx + 1));
  } catch {
    return new URLSearchParams();
  }
}

/** Échange code PKCE ou applique les tokens présents dans le fragment (#access_token=…). */
export async function completeOAuthFromCallbackUrl(callbackUrl: string): Promise<{ error: Error | null }> {
  authDebug('oauth:callbackUrl', {
    hasCode: callbackUrl.includes('code='),
    hasFragmentTokens: callbackUrl.includes('access_token='),
    urlPrefix: callbackUrl.slice(0, 80)
  });
  const lower = callbackUrl.toLowerCase();
  if (lower.includes('error=')) {
    const q = parseQueryParams(callbackUrl);
    const desc =
      q.get('error_description')?.replace(/\+/g, ' ') || q.get('error') || 'OAuth error';
    return { error: new Error(desc) };
  }

  if (callbackUrl.includes('code=')) {
    const { error } = await exchangePkceCallbackOnce(callbackUrl);
    return { error };
  }

  const params = extractFragmentParams(callbackUrl);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) {
    return { error: new Error('Missing OAuth tokens in redirect URL') };
  }

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  return { error: error ?? null };
}

export async function signInWithOAuthProvider(provider: OAuthProvider): Promise<{ error: Error | null }> {
  if (oauthSignInInFlight) {
    authDebug('oauth:dedupeInFlight', { provider });
    return oauthSignInInFlight;
  }

  const redirectTo = getOAuthRedirectUri();
  markOAuthFlowStarted();
  noteOAuthRedirectTo(redirectTo);
  authDebug('oauth:start', { provider, redirectTo });

  oauthSignInInFlight = runWithOAuthBrowserSession(async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true
      }
    });

    if (error) return { error };
    if (!data?.url) return { error: new Error('No OAuth URL returned') };

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    authDebug('oauth:browserResult', { provider, type: result.type });

    if (result.type !== 'success') {
      if (result.type === 'cancel' || result.type === 'dismiss') {
        return { error: new Error('cancelled') };
      }
      return { error: new Error('OAuth session ended without success') };
    }

    const callbackUrl = 'url' in result && result.url ? result.url : null;
    if (!callbackUrl) {
      return { error: new Error('No callback URL from browser') };
    }

    const completed = await completeOAuthFromCallbackUrl(callbackUrl);
    if (completed.error) {
      authDebugError('oauth:completeFailed', completed.error, { provider });
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        authDebug('oauth:recoveredSessionDespiteError', { provider });
        return { error: null };
      }
    } else {
      authDebug('oauth:completeOk', { provider });
    }
    return completed;
  });

  try {
    return await oauthSignInInFlight;
  } finally {
    oauthSignInInFlight = null;
  }
}

/** Même logique que après `signInWithPassword` dans `login.tsx` (profil + marqueur AuthGate). */
export async function ensureProfileAfterOAuthLogin(session: Session | null): Promise<void> {
  if (!session?.user) return;
  const userId = session.user.id;
  const markerKey = `profile_ensured_after_login:${userId}`;
  authDebug('oauth:ensureProfile:start', { userId });
  await AsyncStorage.setItem(markerKey, String(Date.now()));
  await ensureProfileExists(session, {
    phone: (session.user.phone as string | null | undefined) ?? '+41791234567',
    country: 'CH'
  });
}

export function isOAuthCancelled(err: Error | null | undefined): boolean {
  return err?.message === 'cancelled';
}
