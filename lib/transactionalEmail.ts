import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_URL } from './env';
import { supabase } from './supabase';

const WELCOME_EMAIL_REQUESTED_PREFIX = 'welcome_email_requested:';
const welcomeEmailInFlight = new Set<string>();

/** E-mail de bienvenue (idempotent côté serveur + garde client). */
export async function requestWelcomeEmail(): Promise<void> {
  try {
    const {
      data: { session }
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    const userId = session?.user?.id;
    if (!token || !userId) return;

    if (welcomeEmailInFlight.has(userId)) return;

    const markerKey = `${WELCOME_EMAIL_REQUESTED_PREFIX}${userId}`;
    const alreadyRequested = await AsyncStorage.getItem(markerKey);
    if (alreadyRequested === '1') return;

    welcomeEmailInFlight.add(userId);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/notify-user`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ template: 'welcome' })
      });

      if (response.ok) {
        await AsyncStorage.setItem(markerKey, '1');
      }
    } finally {
      welcomeEmailInFlight.delete(userId);
    }
  } catch {
    // silent — ne bloque pas l'onboarding
  }
}
