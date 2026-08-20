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
  priceDropEmailContent,
  followedSellerNewListingEmailContent,
  noPurchaseNudgeEmailContent,
  sellerNoSaleTipsEmailContent,
  type EmailLang,
  type TransactionalEmailContent,
} from "./transactionalEmailI18n.ts";
import {
  claimTransactionalEmailSend,
  logTransactionalEmailSent,
  releaseTransactionalEmailClaim,
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
  | "stripe_onboarding"
  | "price_drop"
  | "followed_seller_new_listing"
  | "no_purchase_nudge"
  | "seller_no_sale_tips";

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
  /** Si true : n'envoie l'e-mail que si profiles.marketing_opt_in = true */
  requireMarketingOptIn?: boolean;
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
        ctaUrl: String(variables.ctaUrl ?? "https://bloomi.ch/open/profile"),
      });
    case "seller_order_cancelled":
      return sellerOrderCancelledEmailContent(lang, {
        displayName,
        orderId: String(variables.orderId ?? ""),
      });
    case "stripe_onboarding":
      return stripeOnboardingEmailContent(lang, displayName);
    case "price_drop":
      return priceDropEmailContent(lang, {
        displayName,
        listingTitle: String(variables.listingTitle ?? ""),
        oldPrice: String(variables.oldPrice ?? ""),
        newPrice: String(variables.newPrice ?? ""),
        listingId: String(variables.listingId ?? ""),
      });
    case "followed_seller_new_listing":
      return followedSellerNewListingEmailContent(lang, {
        displayName,
        sellerName: String(variables.sellerName ?? ""),
        listingTitle: String(variables.listingTitle ?? ""),
        listingId: String(variables.listingId ?? ""),
      });
    case "no_purchase_nudge":
      return noPurchaseNudgeEmailContent(lang, displayName);
    case "seller_no_sale_tips":
      return sellerNoSaleTipsEmailContent(lang, {
        displayName,
        listingTitle: String(variables.listingTitle ?? ""),
        tip: String(variables.tip ?? ""),
        listingId: String(variables.listingId ?? ""),
      });
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

  if (params.requireMarketingOptIn) {
    const { data: optRow } = await params.supabaseAdmin
      .from("profiles")
      .select("marketing_opt_in")
      .eq("id", params.userId)
      .maybeSingle();
    if (!Boolean((optRow as { marketing_opt_in?: boolean } | null)?.marketing_opt_in)) {
      result.emailSkippedReason = "no_marketing_opt_in";
      return result;
    }
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY")?.trim() ?? "";
  if (!resendApiKey) {
    result.emailSkippedReason = "no_resend_key";
    return result;
  }

  const claim = await claimTransactionalEmailSend(params.supabaseAdmin, {
    userId: params.userId,
    templateKey: params.templateKey,
    entityId: params.entityId,
  });
  if (!claim.claimed) {
    result.emailSkippedReason = "already_sent";
    return result;
  }

  const email = await fetchUserEmail(params.supabaseAdmin, params.userId);
  if (!email) {
    if (claim.logId) {
      await releaseTransactionalEmailClaim(params.supabaseAdmin, claim.logId);
    }
    result.emailSkippedReason = "no_email";
    return result;
  }

  const lang = await fetchUserLang(params.supabaseAdmin, params.userId);
  const displayName = await fetchProfileDisplayName(params.supabaseAdmin, params.userId);
  const content = buildEmailContent(params.templateKey, lang, displayName, variables);
  if (!content) {
    if (claim.logId) {
      await releaseTransactionalEmailClaim(params.supabaseAdmin, claim.logId);
    }
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
    if (claim.logId) {
      await releaseTransactionalEmailClaim(params.supabaseAdmin, claim.logId);
    }
    console.warn("notifyUser email failed:", emailResult.error);
    result.emailSkippedReason = "resend_error";
    return result;
  }

  await logTransactionalEmailSent(params.supabaseAdmin, {
    userId: params.userId,
    templateKey: params.templateKey,
    entityId: params.entityId,
    resendId: emailResult.id,
    logId: claim.logId,
  });

  result.emailSent = true;
  return result;
}
