/**
 * Évite le double échange PKCE OAuth (flow state consommé deux fois).
 * Cas typique : openAuthSessionAsync + Expo Router / Linking → /auth/callback.
 *
 * Erreur Supabase : flow_state_not_found (404 sur POST /token?grant_type=pkce)
 *
 * Important : `exchangeCodeForSession` attend le **code** PKCE seul, pas l'URL complète.
 * Passer `bloomi://…?code=…` envoie auth_code invalide → flow_state_not_found, et le
 * client GoTrue efface quand même le code_verifier (impossible de réessayer).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { authDebug } from '../authDebugLog';

const exchangedAuthCodes = new Set<string>();
const exchangeInFlight = new Map<string, Promise<PkceExchangeResult>>();
let oauthBrowserSessionActive = false;
let oauthFlowStartedAt = 0;
let lastOAuthRedirectTo: string | null = null;

const OAUTH_FLOW_WINDOW_MS = 120_000;
const OAUTH_FLOW_STARTED_KEY = 'bloomi:oauth-flow-started-at';
const EXCHANGED_CODES_KEY = 'bloomi:pkce-exchanged-codes';

void (async () => {
  try {
    const raw = await AsyncStorage.getItem(OAUTH_FLOW_STARTED_KEY);
    const ts = raw ? Number(raw) : 0;
    if (Number.isFinite(ts) && ts > oauthFlowStartedAt) {
      oauthFlowStartedAt = ts;
    }
    const codesRaw = await AsyncStorage.getItem(EXCHANGED_CODES_KEY);
    if (codesRaw) {
      const parsed = JSON.parse(codesRaw) as unknown;
      if (Array.isArray(parsed)) {
        for (const c of parsed) {
          if (typeof c === 'string' && c) exchangedAuthCodes.add(c);
        }
      }
    }
  } catch {
    // ignore bootstrap errors
  }
})();

export type PkceExchangeResult = {
  error: Error | null;
  session: Session | null;
};

export function isOAuthBrowserSessionActive(): boolean {
  return oauthBrowserSessionActive;
}

export function markOAuthFlowStarted(): void {
  oauthFlowStartedAt = Date.now();
  void AsyncStorage.setItem(OAUTH_FLOW_STARTED_KEY, String(oauthFlowStartedAt));
}

export function isRecentOAuthFlow(): boolean {
  return oauthFlowStartedAt > 0 && Date.now() - oauthFlowStartedAt < OAUTH_FLOW_WINDOW_MS;
}

/** Deep link OAuth pendant un flux chaud : ne pas remonter /auth/* (double échange). */
export function shouldSkipOAuthDeepLinkNavigation(url?: string | null): boolean {
  if (oauthBrowserSessionActive) return true;
  if (!isRecentOAuthFlow()) return false;
  if (!url) return true;

  const lower = url.toLowerCase();
  // Liens email (confirmation / reset) : ne jamais bloquer.
  if (
    lower.includes('token_hash=') ||
    lower.includes('type=recovery') ||
    lower.includes('type=signup') ||
    lower.includes('email=')
  ) {
    return false;
  }
  // Retour Google/Apple (y compris fallback Site URL → auth/callback?code=).
  if (lower.includes('oauth-callback')) return true;
  if (lower.includes('code=')) return true;
  return false;
}

/** Callback ?code= sans token_hash/email → Google/Apple (pas confirmation email). */
export function isLikelyOAuthPkceCallback(params: {
  code: string | null;
  tokenHash: string | null;
  email: string | null;
  token: string | null;
}): boolean {
  return Boolean(params.code) && !params.tokenHash && !params.email && !params.token;
}

export async function runWithOAuthBrowserSession<T>(fn: () => Promise<T>): Promise<T> {
  oauthBrowserSessionActive = true;
  try {
    return await fn();
  } finally {
    oauthBrowserSessionActive = false;
  }
}

/** Attend la fin du flux OAuth inline (openAuthSessionAsync). */
export async function waitForOAuthBrowserSessionEnd(maxMs = 20000): Promise<void> {
  const started = Date.now();
  while (oauthBrowserSessionActive && Date.now() - started < maxMs) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/** Attend qu'une session apparaisse après OAuth inline (socialAuth fait l'échange). */
export async function waitForSessionAfterOAuth(maxMs = 20000): Promise<Session | null> {
  await waitForOAuthBrowserSessionEnd(maxMs);
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    const { data } = await supabase.auth.getSession();
    if (data.session) return data.session;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return null;
}

/**
 * Google/Apple uniquement.
 * Toujours le scheme natif (jamais exp://) : sinon Supabase retombe sur le Site URL
 * (`bloomi://auth/callback`) et le deep link email rééchange le même code PKCE.
 * À allowlister dans Supabase → Auth → Redirect URLs.
 */
export function getOAuthRedirectUri(): string {
  return 'bloomi://auth/oauth-callback';
}

/** Liens email / inscription (PKCE) — distinct de Google/Apple. */
export function getEmailAuthCallbackRedirectUri(): string {
  return 'bloomi://auth/callback';
}

/** @deprecated Utiliser getEmailAuthCallbackRedirectUri ou getOAuthRedirectUri */
export function getAuthCallbackRedirectUri(): string {
  return getEmailAuthCallbackRedirectUri();
}

export function noteOAuthRedirectTo(redirectTo: string): void {
  lastOAuthRedirectTo = redirectTo;
}

export function getLastOAuthRedirectTo(): string | null {
  return lastOAuthRedirectTo;
}

export function extractAuthCallbackCode(url: string): string | null {
  const qIndex = url.indexOf('?');
  const hashIndex = url.indexOf('#');
  const queryPart =
    qIndex >= 0 ? url.slice(qIndex + 1, hashIndex >= 0 ? hashIndex : undefined) : '';
  const code = new URLSearchParams(queryPart).get('code');
  return code?.trim() || null;
}

export function buildOAuthPkceCallbackUrl(code: string): string {
  const base = getOAuthRedirectUri();
  const joiner = base.includes('?') ? '&' : '?';
  return `${base}${joiner}code=${encodeURIComponent(code)}`;
}

export function buildEmailPkceCallbackUrl(code: string): string {
  const base = getEmailAuthCallbackRedirectUri();
  const joiner = base.includes('?') ? '&' : '?';
  return `${base}${joiner}code=${encodeURIComponent(code)}`;
}

/** @deprecated */
export function buildPkceCallbackUrl(code: string): string {
  return buildEmailPkceCallbackUrl(code);
}

export function isAuthCodeAlreadyExchanged(code: string | null | undefined): boolean {
  if (!code) return false;
  return exchangedAuthCodes.has(code);
}

export function markAuthCodeExchanged(code: string | null | undefined): void {
  if (!code) return;
  exchangedAuthCodes.add(code);
  void AsyncStorage.setItem(
    EXCHANGED_CODES_KEY,
    JSON.stringify(Array.from(exchangedAuthCodes).slice(-20))
  );
}

function normalizeUrlForCompare(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    return url.split('?')[0]?.split('#')[0] ?? url;
  }
}

export function logOAuthUrlMismatch(redirectTo: string, callbackUrl: string): void {
  const redirectBase = normalizeUrlForCompare(redirectTo);
  const callbackBase = normalizeUrlForCompare(callbackUrl);
  if (redirectBase === callbackBase) return;
  authDebug('oauth:urlMismatch', {
    redirectTo,
    callbackUrl,
    redirectBase,
    callbackBase,
    hint: 'Ajouter les deux URLs dans Supabase → Auth → Redirect URLs'
  });
}

/**
 * Échange PKCE une seule fois par code (mutex en mémoire).
 * Réservé à socialAuth (OAuth) et aux liens email (callback cold start).
 */
export async function exchangePkceCallbackOnce(callbackUrl: string): Promise<PkceExchangeResult> {
  const code = extractAuthCallbackCode(callbackUrl);
  if (!code) {
    return { error: new Error('Missing PKCE auth code in callback URL'), session: null };
  }

  if (isAuthCodeAlreadyExchanged(code)) {
    const { data } = await supabase.auth.getSession();
    authDebug('oauth:exchange:dedupe', { codePrefix: code.slice(0, 8) });
    return {
      error: data.session ? null : new Error('OAuth session already consumed'),
      session: data.session
    };
  }

  const existing = exchangeInFlight.get(code);
  if (existing) {
    authDebug('oauth:exchange:awaitInFlight', { codePrefix: code.slice(0, 8) });
    return existing;
  }

  const promise = (async (): Promise<PkceExchangeResult> => {
    authDebug('oauth:exchange:start', {
      codePrefix: code.slice(0, 8),
      urlPrefix: callbackUrl.slice(0, 120),
      redirectTo: lastOAuthRedirectTo,
      redirectBase: lastOAuthRedirectTo ? normalizeUrlForCompare(lastOAuthRedirectTo) : null,
      callbackBase: normalizeUrlForCompare(callbackUrl)
    });
    if (lastOAuthRedirectTo) {
      logOAuthUrlMismatch(lastOAuthRedirectTo, callbackUrl);
    }
    // Uniquement le code — pas l'URL (sinon flow_state_not_found + verifier effacé).
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.session) {
      markAuthCodeExchanged(code);
      authDebug('oauth:exchange:ok', { userId: data.session.user.id });
      return { error: null, session: data.session };
    }

    // Double deep link : le code a déjà été consommé mais la session est là.
    const { data: existing } = await supabase.auth.getSession();
    if (existing.session) {
      markAuthCodeExchanged(code);
      authDebug('oauth:exchange:recoveredExistingSession', {
        message: error?.message ?? 'unknown'
      });
      return { error: null, session: existing.session };
    }

    authDebug('oauth:exchange:failed', {
      message: error?.message ?? 'unknown',
      code: error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code ?? '') : null
    });
    return { error: error ?? new Error('PKCE exchange failed'), session: data.session ?? null };
  })();

  exchangeInFlight.set(code, promise);
  try {
    return await promise;
  } finally {
    exchangeInFlight.delete(code);
  }
}
