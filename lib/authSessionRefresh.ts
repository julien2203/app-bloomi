import { AppState, type AppStateStatus } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { authDebug, authDebugError } from './authDebugLog';

let lifecycleInstalled = false;
let refreshInFlight: Promise<Session | null> | null = null;
let bootRestoreInProgress = false;

export function isAuthBootRestoreInProgress(): boolean {
  return bootRestoreInProgress;
}

function isStaleRefreshTokenError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return (
    message.includes('Invalid Refresh Token') || message.includes('Refresh Token Not Found')
  );
}

async function clearStaleLocalSession(reason: string): Promise<null> {
  authDebug('auth:restore:clearStaleSession', { reason });
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch (signOutError) {
    authDebugError('auth:restore:clearStaleSessionFailed', signOutError, { reason });
  }
  return null;
}

/**
 * Restaure la session persistée (AsyncStorage) sans appeler le réseau.
 * À utiliser au cold start : un refresh forcé peut invalider le refresh token
 * (rotation concurrente avec autoRefresh / reprise au premier plan).
 */
export async function restoreAuthSession(reason: string): Promise<Session | null> {
  bootRestoreInProgress = true;
  // Évite une course au boot entre autoRefresh Supabase et la restauration locale.
  supabase.auth.stopAutoRefresh();

  try {
    const { data: stored, error: getError } = await supabase.auth.getSession();
    if (getError) {
      authDebugError('auth:restore:getSessionFailed', getError, { reason });
      if (isStaleRefreshTokenError(getError)) {
        return clearStaleLocalSession(reason);
      }
    }
    if (!stored.session) {
      authDebug('auth:restore:noSession', { reason });
      return null;
    }

    authDebug('auth:restore:ok', { reason, userId: stored.session.user.id });
    return stored.session;
  } finally {
    bootRestoreInProgress = false;
  }
}

/**
 * Rafraîchit le JWT Supabase (utile après plusieurs heures en arrière-plan).
 * En cas d'échec réseau, conserve la session locale si elle existe encore.
 */
export async function refreshAuthSession(reason: string): Promise<Session | null> {
  if (refreshInFlight) {
    authDebug('auth:refresh:dedupe', { reason });
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const { data: stored, error: getError } = await supabase.auth.getSession();
    if (getError) {
      authDebugError('auth:refresh:getSessionFailed', getError, { reason });
    }
    if (!stored.session) {
      authDebug('auth:refresh:noSession', { reason });
      return null;
    }

    authDebug('auth:refresh:start', { reason, userId: stored.session.user.id });
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      authDebugError('auth:refresh:failed', error, { reason });
      if (isStaleRefreshTokenError(error)) {
        return clearStaleLocalSession(reason);
      }
      const { data: fallback } = await supabase.auth.getSession();
      return fallback.session;
    }

    authDebug('auth:refresh:ok', { reason, userId: data.session?.user.id ?? null });
    return data.session;
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

/** Pattern recommandé Supabase pour React Native (pause/reprise du refresh JWT). */
export function setupAuthSessionRefresh() {
  if (lifecycleInstalled) return;
  lifecycleInstalled = true;

  const onAppStateChange = (state: AppStateStatus) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  };

  if (AppState.currentState === 'active') {
    supabase.auth.startAutoRefresh();
  }

  AppState.addEventListener('change', onAppStateChange);
}
