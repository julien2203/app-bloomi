/**
 * Actions argent admin (service_role) — reverse transfer, refund, cancel PI, refresh Stripe.
 * Factorisé pour admin-order-actions ; ne remplace pas refund-order (app mobile).
 */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type AdminOrderMoneyRow = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  status: string | null;
  payment_status: string | null;
  stripe_payment_intent_id: string | null;
  stripe_transfer_id: string | null;
  stripe_seller_account_id?: string | null;
  seller_amount?: number | string | null;
};

export type StripeRefreshSnapshot = {
  payment_intent_id: string | null;
  payment_intent_status: string | null;
  latest_charge: string | null;
  amount_received: number | null;
  currency: string | null;
  transfer_id: string | null;
  transfer_amount: number | null;
  transfer_reversed: boolean | null;
  transfer_amount_reversed: number | null;
  destination: string | null;
  retrieved_at: string;
};

async function stripeGet(path: string, secret: string) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${secret}` },
  });
  const json = (await res.json()) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, json };
}

async function stripePost(path: string, secret: string, body?: URLSearchParams) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body?.toString() ?? undefined,
  });
  const json = (await res.json()) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, json };
}

export async function refreshStripeSnapshot(
  secret: string,
  order: AdminOrderMoneyRow,
): Promise<StripeRefreshSnapshot> {
  const piId = order.stripe_payment_intent_id?.trim() || null;
  const trId = order.stripe_transfer_id?.trim() || null;
  const now = new Date().toISOString();

  let payment_intent_status: string | null = null;
  let latest_charge: string | null = null;
  let amount_received: number | null = null;
  let currency: string | null = null;

  if (piId) {
    const pi = await stripeGet(`payment_intents/${encodeURIComponent(piId)}`, secret);
    if (pi.ok) {
      payment_intent_status = typeof pi.json.status === "string" ? pi.json.status : null;
      latest_charge =
        typeof pi.json.latest_charge === "string" ? pi.json.latest_charge : null;
      amount_received =
        typeof pi.json.amount_received === "number" ? pi.json.amount_received : null;
      currency = typeof pi.json.currency === "string" ? pi.json.currency : null;
    } else {
      const err = (pi.json.error as { message?: string } | undefined)?.message;
      throw new Error(err ?? `Impossible de lire le PaymentIntent (${pi.status})`);
    }
  }

  let transfer_amount: number | null = null;
  let transfer_reversed: boolean | null = null;
  let transfer_amount_reversed: number | null = null;
  let destination: string | null = null;

  if (trId) {
    const tr = await stripeGet(`transfers/${encodeURIComponent(trId)}`, secret);
    if (tr.ok) {
      transfer_amount = typeof tr.json.amount === "number" ? tr.json.amount : null;
      transfer_reversed = Boolean(tr.json.reversed);
      transfer_amount_reversed =
        typeof tr.json.amount_reversed === "number" ? tr.json.amount_reversed : null;
      destination = typeof tr.json.destination === "string" ? tr.json.destination : null;
    } else {
      const err = (tr.json.error as { message?: string } | undefined)?.message;
      throw new Error(err ?? `Impossible de lire le Transfer (${tr.status})`);
    }
  }

  return {
    payment_intent_id: piId,
    payment_intent_status,
    latest_charge,
    amount_received,
    currency,
    transfer_id: trId,
    transfer_amount,
    transfer_reversed,
    transfer_amount_reversed,
    destination,
    retrieved_at: now,
  };
}

/** Annule le PI s'il n'est pas capturé, sinon no-op si déjà canceled. */
export async function cancelUncapturedPaymentIntent(
  secret: string,
  paymentIntentId: string,
): Promise<{ pi_status: string }> {
  const pi = await stripeGet(`payment_intents/${encodeURIComponent(paymentIntentId)}`, secret);
  if (!pi.ok) {
    throw new Error(
      (pi.json.error as { message?: string } | undefined)?.message ??
        "Lecture PaymentIntent échouée",
    );
  }
  const status = String(pi.json.status ?? "");
  if (status === "canceled") return { pi_status: status };
  if (status === "succeeded") {
    throw new Error(
      "Le paiement est déjà capturé (succeeded). Utilisez « Annuler après transfert » ou « Rembourser ».",
    );
  }
  if (
    status === "requires_capture" ||
    status === "requires_payment_method" ||
    status === "requires_confirmation" ||
    status === "requires_action" ||
    status === "processing"
  ) {
    const cancel = await stripePost(
      `payment_intents/${encodeURIComponent(paymentIntentId)}/cancel`,
      secret,
    );
    if (!cancel.ok) {
      throw new Error(
        (cancel.json.error as { message?: string } | undefined)?.message ??
          "Annulation PaymentIntent échouée",
      );
    }
    return { pi_status: String(cancel.json.status ?? "canceled") };
  }
  throw new Error(`Statut PaymentIntent incompatible avec annulation sans encaissement : ${status}`);
}

export async function reverseStripeTransfer(
  secret: string,
  transferId: string,
): Promise<{ reverse_id: string; fully_reversed: boolean }> {
  const existing = await stripeGet(`transfers/${encodeURIComponent(transferId)}`, secret);
  if (!existing.ok) {
    throw new Error(
      (existing.json.error as { message?: string } | undefined)?.message ??
        "Transfer introuvable",
    );
  }
  if (existing.json.reversed === true) {
    return { reverse_id: transferId, fully_reversed: true };
  }

  const rev = await stripePost(
    `transfers/${encodeURIComponent(transferId)}/reversals`,
    secret,
    new URLSearchParams(),
  );
  if (!rev.ok) {
    const msg =
      (rev.json.error as { message?: string } | undefined)?.message ??
      "Inversion du transfert échouée";
    // Solde Connect insuffisant (déjà payout banque)
    throw new Error(msg);
  }
  const reverseId = typeof rev.json.id === "string" ? rev.json.id : transferId;
  return { reverse_id: reverseId, fully_reversed: true };
}

export async function refundPaymentIntent(
  secret: string,
  paymentIntentId: string,
  orderId: string,
  reason?: string,
): Promise<{ refund_id: string }> {
  const pi = await stripeGet(`payment_intents/${encodeURIComponent(paymentIntentId)}`, secret);
  if (!pi.ok) {
    throw new Error(
      (pi.json.error as { message?: string } | undefined)?.message ??
        "Lecture PaymentIntent échouée",
    );
  }
  const status = String(pi.json.status ?? "");
  if (status === "canceled") {
    throw new Error("PaymentIntent déjà canceled — rien à rembourser.");
  }
  if (status !== "succeeded") {
    throw new Error(
      `Remboursement impossible : PaymentIntent en statut « ${status} » (attendu succeeded).`,
    );
  }

  const body = new URLSearchParams({
    payment_intent: paymentIntentId,
    "metadata[order_id]": orderId,
    "metadata[source]": "admin-order-actions",
  });
  if (reason?.trim()) body.set("metadata[reason]", reason.trim().slice(0, 500));

  const refund = await stripePost("refunds", secret, body);
  if (!refund.ok) {
    throw new Error(
      (refund.json.error as { message?: string } | undefined)?.message ??
        "Refund Stripe échoué",
    );
  }
  const refundId = typeof refund.json.id === "string" ? refund.json.id : "";
  if (!refundId) throw new Error("Refund créé sans id");
  return { refund_id: refundId };
}

export async function markOrderCancelled(
  supabaseAdmin: SupabaseClient,
  order: AdminOrderMoneyRow,
  paymentStatus: "cancelled" | "refunded",
) {
  const nowIso = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("orders")
    .update({
      status: "cancelled",
      payment_status: paymentStatus,
      cancelled_at: nowIso,
    })
    .eq("id", order.id);
  if (error) throw new Error(error.message);

  await supabaseAdmin
    .from("listings")
    .update({ status: "published" })
    .eq("id", order.listing_id)
    .in("status", ["reserved", "sold"]);
}

export async function logAdminOrderAction(
  supabaseAdmin: SupabaseClient,
  row: {
    order_id: string;
    admin_email: string | null;
    action: string;
    success: boolean;
    message?: string | null;
    stripe_payment_intent_id?: string | null;
    stripe_transfer_id?: string | null;
    details?: Record<string, unknown> | null;
  },
) {
  try {
    await supabaseAdmin.from("order_admin_actions").insert({
      order_id: row.order_id,
      admin_email: row.admin_email,
      action: row.action,
      success: row.success,
      message: row.message ?? null,
      stripe_payment_intent_id: row.stripe_payment_intent_id ?? null,
      stripe_transfer_id: row.stripe_transfer_id ?? null,
      details: row.details ?? null,
    });
  } catch {
    // Table absente : best-effort append admin_notes
    try {
      const stamp = new Date().toISOString();
      const line = `[${stamp}] ${row.admin_email ?? "admin"} · ${row.action} · ${
        row.success ? "OK" : "ECHEC"
      }${row.message ? ` · ${row.message}` : ""}`;
      const { data } = await supabaseAdmin
        .from("orders")
        .select("admin_notes")
        .eq("id", row.order_id)
        .maybeSingle();
      const prev = (data as { admin_notes?: string | null } | null)?.admin_notes ?? "";
      await supabaseAdmin
        .from("orders")
        .update({
          admin_notes: prev ? `${prev}\n${line}` : line,
        })
        .eq("id", row.order_id);
    } catch {
      // ignore
    }
  }
}
