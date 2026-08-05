import { SUPABASE_URL } from './env';
import { supabase } from './supabase';

/** E-mail de bienvenue (idempotent côté serveur). */
export async function requestWelcomeEmail(): Promise<void> {
  try {
    const {
      data: { session }
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;

    await fetch(`${SUPABASE_URL}/functions/v1/notify-user`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ template: 'welcome' })
    });
  } catch {
    // silent — ne bloque pas l'onboarding
  }
}
