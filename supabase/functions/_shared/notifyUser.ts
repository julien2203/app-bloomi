import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { sendResendEmail } from "./sendResendEmail.ts";
import { fetchProfileDisplayName, fetchUserEmail } from "./fetchUserEmail.ts";
import {
  itemSoldEmailContent,
  newOfferEmailContent,
  normalizeEmailLang,
  orderActionRequiredEmailContent,
  orderCancelledEmailContent,
  sellerOrderCancelledEmailContent,
  shipReminderEmailContent,
  stripeOnboardingEmailContent,
  unreadMessageEmailContent,
  welcomeEmailContent,
  type EmailLang,
  type TransactionalEmailContent,
} from "./transactionalEmailI18n.ts";
import {
  logTransactionalEmailSent,
  wasTransactionalEmailSent,
} from "./transactionalEmailLog.ts";

const DEFAULT_RESEND_FROM = "Bloomi <contact@bloomi.ch>";

export type EmailTemplateKey =
  | "welcome"
  | "item_sold"
  | "new_offer"
  | "ship_reminder"
  | "unread_message"
  | "order_cancelled"
  | "order_action_required"
  | "seller_order_cancelled"
  | "stripe_onboarding";

export type NotifyUserPush = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export type NotifyUserParams = {
  supabaseAdmin: SupabaseClient;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  userId: string;
  templateKey: EmailTemplateKey;
  entityId: string;
  push?: NotifyUserPush;
  skipEmail?: boolean;
  skipPush?: boolean;
  variables?: Record<string, string | boolean | number>;
};

async function fetchUserLang(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<EmailLang> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("language")
    .eq("id", userId)
    .maybeSingle();
  const raw = (data as { language?: string | null } | null)?.language ?? null;
  return normalizeEmailLang(raw);
}

function buildEmailContent(
  templateKey: EmailTemplateKey,
  lang: EmailLang,
  displayName: string,
  variables: Record<string, string | boolean | number>,
): TransactionalEmailContent | null {
  switch (templateKey) {
    case "welcome":
      return welcomeEmailContent(lang, displayName);
    case "item_sold":
      return itemSoldEmailContent(lang, {
        displayName,
        listingTitle: String(variables.listingTitle ?? ""),
        orderId: String(variables.orderId ?? ""),
        pickup: Boolean(variables.pickup),
      });
    case "new_offer":
      return newOfferEmailContent(lang, {
        displayName,
        listingTitle: String(variables.listingTitle ?? ""),
        amount: String(variables.amount ?? ""),
        threadId: String(variables.threadId ?? ""),
      });
    case "ship_reminder":
      return shipReminderEmailContent(lang, {
        displayName,
        listingTitle: String(variables.listingTitle ?? ""),
        orderId: String(variables.orderId ?? ""),
      });
    case "unread_message":
      return unreadMessageEmailContent(lang, {
        displayName,
        senderName: String(variables.senderName ?? ""),
        preview: String(variables.preview ?? ""),
        threadId: String(variables.threadId ?? ""),
      });
    case "order_cancelled":
      return orderCancelledEmailContent(lang, {
        displayName,
        orderId: String(variables.orderId ?? ""),
        refunded: Boolean(variables.refunded),
      });
    case "order_action_required":
      return orderActionRequiredEmailContent(lang, {
        displayName,
        headline: String(variables.headline ?? ""),
        body: String(variables.body ?? ""),
        ctaLabel: String(variables.ctaLabel ?? "Open Bloomi"),
        ctaUrl: String(variables.ctaUrl ?? "bloomi://tabs/profile"),
      });
    case "seller_order_cancelled":
      return sellerOrderCancelledEmailContent(lang, {
        displayName,
        orderId: String(variables.orderId ?? ""),
      });
    case "stripe_onboarding":
      return stripeOnboardingEmailContent(lang, displayName);
    default:
      return null;
  }
}

async function sendPushNotification(params: {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  userId: string;
  push: NotifyUserPush;
}): Promise<void> {
  const url = `${params.supabaseUrl.replace(/\/+$/, "")}/functions/v1/send-notification`;
  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: params.userId,
      title: params.push.title,
      body: params.push.body,
      data: params.push.data ?? undefined,
    }),
  });
}

export type NotifyUserResult = {
  emailSent: boolean;
  emailSkippedReason?: string;
  pushSent: boolean;
};

/**
 * Envoie un e-mail transactionnel (Resend) idempotent + push/in-app optionnels.
 */
export async function notifyUser(params: NotifyUserParams): Promise<NotifyUserResult> {
  const result: NotifyUserResult = { emailSent: false, pushSent: false };
  const variables = params.variables ?? {};

  if (!params.skipPush && params.push) {
    try {
      await sendPushNotification({
        supabaseUrl: params.supabaseUrl,
        supabaseServiceRoleKey: params.supabaseServiceRoleKey,
        userId: params.userId,
        push: params.push,
      });
      result.pushSent = true;
    } catch (e) {
      console.warn("notifyUser push failed:", e instanceof Error ? e.message : String(e));
    }
  }

  if (params.skipEmail) {
    result.emailSkippedReason = "skipEmail";
    return result;
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY")?.trim() ?? "";
  if (!resendApiKey) {
    result.emailSkippedReason = "no_resend_key";
    return result;
  }

  const alreadySent = await wasTransactionalEmailSent(params.supabaseAdmin, {
    userId: params.userId,
    templateKey: params.templateKey,
    entityId: params.entityId,
  });
  if (alreadySent) {
    result.emailSkippedReason = "already_sent";
    return result;
  }

  const email = await fetchUserEmail(params.supabaseAdmin, params.userId);
  if (!email) {
    result.emailSkippedReason = "no_email";
    return result;
  }

  const lang = await fetchUserLang(params.supabaseAdmin, params.userId);
  const displayName = await fetchProfileDisplayName(params.supabaseAdmin, params.userId);
  const content = buildEmailContent(params.templateKey, lang, displayName, variables);
  if (!content) {
    result.emailSkippedReason = "unknown_template";
    return result;
  }

  const resendFrom = Deno.env.get("RESEND_FROM_EMAIL")?.trim() || DEFAULT_RESEND_FROM;
  const emailResult = await sendResendEmail({
    apiKey: resendApiKey,
    from: resendFrom,
    to: email,
    subject: content.subject,
    html: content.html,
  });

  if (!emailResult.ok) {
    console.warn("notifyUser email failed:", emailResult.error);
    result.emailSkippedReason = "resend_error";
    return result;
  }

  await logTransactionalEmailSent(params.supabaseAdmin, {
    userId: params.userId,
    templateKey: params.templateKey,
    entityId: params.entityId,
    resendId: emailResult.id,
  });

  result.emailSent = true;
  return result;
}
