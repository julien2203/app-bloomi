import Constants from 'expo-constants';
import { Platform } from 'react-native';

const FORCE =
  typeof process.env.EXPO_PUBLIC_AUTH_DEBUG === 'string' &&
  process.env.EXPO_PUBLIC_AUTH_DEBUG === '1';

/**
 * Actif en Expo Go / dev, ou si EXPO_PUBLIC_AUTH_DEBUG=1 dans l'environnement.
 * Couvre auth, navigation vers le feed et chargement du feed — filtre Metro : `[AuthDebug`
 */
export const AUTH_DEBUG_ENABLED = __DEV__ || FORCE;

function runtimeContext() {
  return {
    platform: Platform.OS,
    dev: __DEV__,
    appOwnership: Constants.appOwnership ?? 'unknown',
    executionEnvironment: Constants.executionEnvironment ?? 'unknown'
  };
}

export function authDebug(step: string, detail?: Record<string, unknown>) {
  if (!AUTH_DEBUG_ENABLED) return;
  const ts = new Date().toISOString().slice(11, 23);
  const extra = detail ? ` ${JSON.stringify(detail)}` : '';
  // eslint-disable-next-line no-console
  console.log(`[AuthDebug ${ts}] ${step}${extra}`);
}

export function authDebugError(step: string, error: unknown, detail?: Record<string, unknown>) {
  if (!AUTH_DEBUG_ENABLED) return;
  const ts = new Date().toISOString().slice(11, 23);
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  const authApiCode =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : undefined;
  // eslint-disable-next-line no-console
  console.error(`[AuthDebug ${ts}] ${step} ERROR`, {
    message,
    authApiCode: authApiCode || undefined,
    stack,
    ...runtimeContext(),
    ...detail
  });
}

export function authDebugContext(step: string) {
  authDebug(step, runtimeContext());
}
