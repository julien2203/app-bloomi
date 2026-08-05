import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  findOrCreateThreadForOrderChat,
  insertThreadEventMessage,
} from "./orderChatSystemMessage.ts";
import { chfToCents, computeSellerFees, roundChf } from "./fees.ts";
import {
  fetchRecipientLanguage,
  paymentReceivedPushText,
  paymentReleasedBuyerPushText,
  transactionCompleteBuyerPushText,
} from "./pushNotificationI18n.ts";

export type ConfirmOrderRow = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  stripe_payment_intent_id: string | null;
  seller_amount: number | string | null;
  seller_commission_chf?: number | string | null;
  seller_fee_rate?: number | string | null;
  seller_profile_type?: string | null;
  listing_price?: number | string | null;
  stripe_seller_account_id?: string | null;
  status?: string | null;
  payment_status?: string | null;
  confirmed_at?: string | null;
  listing?: { price: number | string | null } | null;
};

function toPositiveCents(value: unknown, label: string): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${label} doit être un nombre CHF > 0`);
  }
  return chfToCents(n);
}

async function sendNotification(params: {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  user_id: string;
  title: string;
  body: string;
  data?: unknown;
}) {
  const url = `${params.supabaseUrl.replace(/\/+$/, "")}/functions/v1/send-notification`;
  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: params.user_id,
      title: params.title,
      body: params.body,
      data: params.data ?? undefined,
    }),
  });
}

async function resolveSellerDestination(
  supabase: SupabaseClient,
  row: ConfirmOrderRow,
): Promise<string | null> {
  let destination =
    row.stripe_seller_account_id && String(row.stripe_seller_account_id).trim() !== ""
      ? String(row.stripe_seller_account_id).trim()
      : null;

  if (!destination) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_seller_account_id")
      .eq("id", row.seller_id)
      .maybeSingle();

    if (profileError) {
      throw new Error(`Impossible de charger le profil vendeur: ${profileError.message}`);
    }

    const profileAccountId = (profile as { stripe_seller_account_id?: string | null } | null)
      ?.stripe_seller_account_id;
    if (profileAccountId && String(profileAccountId).trim() !== "") {
      destination = String(profileAccountId).trim();
    }
  }

  return destination;
}

function resolveSellerAmountCents(row: ConfirmOrderRow): number {
  if (row.seller_amount != null) {
    return toPositiveCents(row.seller_amount, "seller_amount");
  }

  const listingPriceRaw = row.listing_price ?? row.listing?.price ?? null;
  const listingPrice =
    typeof listingPriceRaw === "number"
      ? listingPriceRaw
      : typeof listingPriceRaw === "string"
      ? Number(listingPriceRaw)
      : NaN;

  if (!Number.isFinite(listingPrice) || listingPrice <= 0) {
    throw new Error("seller_amount manquant et listing.price invalide");
  }

  const storedCommissionRaw = row.seller_commission_chf ?? null;
  const storedCommission =
    typeof storedCommissionRaw === "number"
      ? storedCommissionRaw
      : typeof storedCommissionRaw === "string"
      ? Number(storedCommissionRaw)
      : null;

  if (storedCommission != null && Number.isFinite(storedCommission) && storedCommission >= 0) {
    const payout = roundChf(listingPrice - storedCommission);
    return toPositiveCents(payout, "seller_amount recalculé");
  }

  const profileType = row.seller_profile_type;
  if (
    profileType === "individual" ||
    profileType === "influencer" ||
    profileType === "pro"
  ) {
    const payout = computeSellerFees(listingPrice, profileType).netPayoutChf;
    return toPositiveCents(payout, "seller_amount recalculé");
  }

  throw new Error("seller_amount manquant pour cette commande");
}

export type CaptureAndTransferResult =
  | { success: true; stripe_transfer_id: string }
  | { success: false; error: string; details?: string; httpStatus?: number };

/**
 * Capture le PaymentIntent et transfère le montant vendeur (Connect).
 * Met à jour la commande en completed + payment_status transferred.
 */
export async function captureAndTransferOrder(params: {
  supabaseAdmin: SupabaseClient;
  stripeSecretKey: string;
  order: ConfirmOrderRow;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  sendNotifications?: boolean;
  systemMessage?: string;
}): Promise<CaptureAndTransferResult> {
  const row = params.order;

  if (row.status === "completed" && row.payment_status === "transferred") {
    return { success: true, stripe_transfer_id: "" };
  }

  if (!row.stripe_payment_intent_id) {
    return { success: false, error: "Commande sans stripe_payment_intent_id", httpStatus: 400 };
  }

  let destination: string | null;
  let sellerAmountCents: number;

  try {
    destination = await resolveSellerDestination(params.supabaseAdmin, row);
    if (!destination) {
      return {
        success: false,
        error: "stripe_seller_account_id manquant (commande ou profil vendeur)",
        httpStatus: 400,
      };
    }
    sellerAmountCents = resolveSellerAmountCents(row);
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "seller_amount invalide",
      httpStatus: 400,
    };
  }

  const paymentIntentResp = await fetch(
    `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(row.stripe_payment_intent_id)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${params.stripeSecretKey}`,
      },
    },
  );
  const paymentIntentJson = (await paymentIntentResp.json()) as {
    status?: string;
    latest_charge?: string | null;
    error?: { message?: string };
  };

  if (!paymentIntentResp.ok) {
    return {
      success: false,
      error: "Erreur Stripe lors de la récupération du paiement",
      details: paymentIntentJson?.error?.message ?? "payment_intent retrieve failed",
      httpStatus: 500,
    };
  }
  let latestCharge = paymentIntentJson.latest_charge ?? null;
  const paymentStatus = paymentIntentJson.status ?? null;

  if (paymentStatus === "requires_capture") {
    const captureResp = await fetch(
      `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(row.stripe_payment_intent_id)}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${params.stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    const captureJson = (await captureResp.json()) as {
      latest_charge?: string | null;
      error?: { message?: string };
    };

    if (!captureResp.ok) {
      return {
        success: false,
        error: "Erreur Stripe lors de la capture du paiement",
        details: captureJson?.error?.message ?? "capture failed",
        httpStatus: 500,
      };
    }
    latestCharge = captureJson.latest_charge ?? latestCharge;
  } else if (paymentStatus !== "succeeded") {
    return {
      success: false,
      error: "Paiement non capturable pour cette commande",
      details: `payment_intent.status=${paymentStatus ?? "unknown"}`,
      httpStatus: 409,
    };
  }

  const transferBody = new URLSearchParams({
    amount: String(sellerAmountCents),
    currency: "chf",
    destination,
    "metadata[order_id]": row.id,
    "metadata[buyer_id]": row.buyer_id,
    "metadata[seller_id]": row.seller_id,
  });
  if (latestCharge) {
    transferBody.set("source_transaction", latestCharge);
  }

  const transferResp = await fetch("https://api.stripe.com/v1/transfers", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: transferBody.toString(),
  });

  const transferJson = (await transferResp.json()) as {
    id?: string;
    error?: { message?: string };
  };

  if (!transferResp.ok || !transferJson.id) {
    return {
      success: false,
      error: "Erreur Stripe lors de la création du transfert",
      details: transferJson?.error?.message ?? "transfer failed",
      httpStatus: 500,
    };
  }

  const nowIso = new Date().toISOString();
  const { error: updateError } = await params.supabaseAdmin
    .from("orders")
    .update({
      status: "completed",
      payment_status: "transferred",
      stripe_transfer_id: transferJson.id,
      delivered_at: nowIso,
      confirmed_at: row.confirmed_at ?? nowIso,
    })
    .eq("id", row.id);

  if (updateError) {
    return {
      success: false,
      error: "Paiement capturé et transfert effectué, mais mise à jour de la commande échouée",
      details: updateError.message,
      httpStatus: 500,
    };
  }

  const { error: listingUpdateError } = await params.supabaseAdmin
    .from("listings")
    .update({ status: "sold", sold_at: nowIso })
    .eq("id", row.listing_id)
    .in("status", ["reserved", "published"]);

  if (listingUpdateError) {
    return {
      success: false,
      error: "Commande complétée mais impossible de mettre à jour l'annonce (sold)",
      details: listingUpdateError.message,
      httpStatus: 500,
    };
  }

  try {
    const threadId = await findOrCreateThreadForOrderChat(params.supabaseAdmin, {
      listingId: row.listing_id,
      buyerId: row.buyer_id,
      sellerId: row.seller_id,
    });
    if (threadId) {
      await insertThreadEventMessage(params.supabaseAdmin, threadId, {
        kind: "payment_released",
        order_id: row.id,
      });
      await insertThreadEventMessage(params.supabaseAdmin, threadId, {
        kind: "transaction_complete",
        order_id: row.id,
      });
    }
  } catch {
    // silent
  }

  if (params.sendNotifications !== false) {
    try {
      const buyerLang = await fetchRecipientLanguage(params.supabaseAdmin, row.buyer_id);
      const releasedCopy = paymentReleasedBuyerPushText(buyerLang);
      await sendNotification({
        supabaseUrl: params.supabaseUrl,
        supabaseServiceRoleKey: params.supabaseServiceRoleKey,
        user_id: row.buyer_id,
        title: releasedCopy.title,
        body: releasedCopy.body,
        data: { order_id: row.id, notification_type: "new_items" },
      });
    } catch {
      // silent
    }
    try {
      const buyerLang = await fetchRecipientLanguage(params.supabaseAdmin, row.buyer_id);
      const completeCopy = transactionCompleteBuyerPushText(buyerLang);
      await sendNotification({
        supabaseUrl: params.supabaseUrl,
        supabaseServiceRoleKey: params.supabaseServiceRoleKey,
        user_id: row.buyer_id,
        title: completeCopy.title,
        body: completeCopy.body,
        data: { order_id: row.id, notification_type: "new_items" },
      });
    } catch {
      // silent
    }
    try {
      const sellerLang = await fetchRecipientLanguage(params.supabaseAdmin, row.seller_id);
      const sellerCopy = paymentReceivedPushText(sellerLang);
      await sendNotification({
        supabaseUrl: params.supabaseUrl,
        supabaseServiceRoleKey: params.supabaseServiceRoleKey,
        user_id: row.seller_id,
        title: sellerCopy.title,
        body: sellerCopy.body,
        data: { order_id: row.id, notification_type: "new_items" },
      });
    } catch {
      // silent
    }
  }

  return { success: true, stripe_transfer_id: transferJson.id };
}
