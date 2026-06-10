import { supabase } from './supabase';
import { SUPABASE_URL } from './env';
import { translateForUser } from './i18n';

type PushType =
  | 'new_message'
  | 'new_feedback'
  | 'favorite_items'
  | 'new_followers'
  | 'new_items';

export type LocalizedPushParams = {
  user_id: string;
  notification_type?: PushType;
  data?: Record<string, unknown> | null;
} & (
  | { title: string; body: string }
  | {
      titleKey: string;
      bodyKey: string;
      titleParams?: Record<string, unknown>;
      bodyParams?: Record<string, unknown>;
    }
);

/**
 * Best-effort push via Edge Function `send-notification`, using the current user's JWT.
 * Title/body are resolved in the recipient's language when `titleKey`/`bodyKey` are used.
 */
export async function sendPushNotificationWithUserJwt(
  params: LocalizedPushParams
): Promise<void> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;

    let title: string;
    let body: string;
    if ('titleKey' in params) {
      title = await translateForUser(
        params.user_id,
        params.titleKey,
        params.titleParams
      );
      body = await translateForUser(
        params.user_id,
        params.bodyKey,
        params.bodyParams
      );
    } else {
      title = params.title;
      body = params.body;
    }

    await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: params.user_id,
        title,
        body,
        data: params.notification_type
          ? { ...(params.data ?? {}), notification_type: params.notification_type }
          : params.data ?? undefined
      })
    });
  } catch {
    // silent
  }
}
