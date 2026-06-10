import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_CRASH_KEY = 'bloomi:last_js_crash_v1';

export type CrashRecord = {
  message: string;
  stack?: string;
  isFatal: boolean;
  platform: string;
  at: string;
};

export async function getLastCrashRecord(): Promise<CrashRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_CRASH_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CrashRecord;
  } catch {
    return null;
  }
}

export async function clearLastCrashRecord(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LAST_CRASH_KEY);
  } catch {
    // ignore
  }
}

/** Enregistre les erreurs JS globales (dev + prod) dans la console et AsyncStorage. */
export function installGlobalCrashLogging(): void {
  const errorUtils = (global as any).ErrorUtils;
  if (!errorUtils?.getGlobalHandler || !errorUtils?.setGlobalHandler) {
    return;
  }

  const defaultHandler = errorUtils.getGlobalHandler();

  errorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    const record: CrashRecord = {
      message: error?.message ?? String(error),
      stack: error?.stack,
      isFatal: Boolean(isFatal),
      platform: Platform.OS,
      at: new Date().toISOString()
    };

  // eslint-disable-next-line no-console
    console.error('[BloomiCrash]', JSON.stringify(record));

    void AsyncStorage.setItem(LAST_CRASH_KEY, JSON.stringify(record)).catch(() => {});

    if (typeof defaultHandler === 'function') {
      defaultHandler(error, isFatal);
    }
  });
}
