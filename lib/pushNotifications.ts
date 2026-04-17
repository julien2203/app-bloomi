import { supabase } from './supabase';
import { SUPABASE_URL } from './env';

/**
 * Best-effort push via Edge Function `send-notification`, using the current user's JWT.
 * Does not throw; failures are ignored so the main flow is never blocked.
 */
export async function sendPushNotificationWithUserJwt(params: {
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;

    await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: params.user_id,
        title: params.title,
        body: params.body,
        data: params.data ?? undefined
      })
    });
  } catch {
    // silent
  }
}
