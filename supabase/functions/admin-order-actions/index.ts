import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  captureAndTransferOrder,
  type ConfirmOrderRow,
} from "../_shared/confirmOrderPayment.ts";
import {
  cancelUncapturedPaymentIntent,
  logAdminOrderAction,
  markOrderCancelled,
  refreshStripeSnapshot,
  refundPaymentIntent,
  reverseStripeTransfer,
  type AdminOrderMoneyRow,
} from "../_shared/adminOrderMoney.ts";

type Action =
  | "refresh_stripe"
  | "release_payment"
  | "retry_transfer"
  | "cancel_no_capture"
  | "reverse_and_refund"
  | "refund_buyer";

const ACTIONS = new Set<Action>([
  "refresh_stripe",
  "release_payment",
  "retry_transfer",
  "cancel_no_capture",
  "reverse_and_refund",
  "refund_buyer",
]);

function jsonResponse(payload: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

function extractBearer(raw: string | null): string {
  if (!raw) return "";
  return raw.replace(/^Bearer\s+/i, "").trim();
}

function isServiceRole(req: Request, serviceRoleKey: string): boolean {
  const expected = serviceRoleKey.trim();
  if (!expected) return false;
  const candidates = [
    extractBearer(req.headers.get("Authorization")),
    extractBearer(req.headers.get("apikey")),
  ];
  return candidates.some((t) => t === expected);
}

const ORDER_SELECT =
  "id, listing_id, buyer_id, seller_id, stripe_payment_intent_id, seller_amount, seller_commission_chf, seller_fee_rate, seller_profile_type, listing_price, stripe_seller_account_id, stripe_transfer_id, status, payment_status, confirmed_at, listing:listings(price)";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

  if (!supabaseUrl || !supabaseServiceRoleKey || !stripeSecretKey) {
    return jsonResponse({ error: "Configuration manquante côté serveur" }, { status: 500 });
  }

  if (!isServiceRole(req, supabaseServiceRoleKey)) {
    return jsonResponse(
      { error: "Non autorisé — appeler avec la clé service_role (server admin uniquement)" },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "Body JSON invalide" }, { status: 400 });
  }

  const orderId = typeof body.order_id === "string" ? body.order_id : "";
  const action = typeof body.action === "string" ? (body.action as Action) : null;
  const adminEmail =
    typeof body.admin_email === "string" ? body.admin_email.trim().slice(0, 200) : null;
  const reason =
    typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : undefined;

  if (!orderId) return jsonResponse({ error: "order_id est requis" }, { status: 400 });
  if (!action || !ACTIONS.has(action)) {
    return jsonResponse(
      { error: `action invalide. Attendu: ${Array.from(ACTIONS).join(", ")}` },
      { status: 400 },
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    return jsonResponse(
      { error: "Impossible de charger la commande", details: orderError.message },
      { status: 500 },
    );
  }
  if (!order) return jsonResponse({ error: "Commande introuvable" }, { status: 404 });

  const row = order as ConfirmOrderRow & AdminOrderMoneyRow;
  const pay = String(row.payment_status ?? "").toLowerCase();
  const status = String(row.status ?? "").toLowerCase();

  const log = async (
    success: boolean,
    message: string,
    details?: Record<string, unknown>,
  ) => {
    await logAdminOrderAction(supabaseAdmin, {
      order_id: orderId,
      admin_email: adminEmail,
      action,
      success,
      message,
      stripe_payment_intent_id: row.stripe_payment_intent_id,
      stripe_transfer_id: row.stripe_transfer_id,
      details: details ?? null,
    });
  };

  try {
    // ——— Refresh Stripe ———
    if (action === "refresh_stripe") {
      const snapshot = await refreshStripeSnapshot(stripeSecretKey, row);

      // Alignement best-effort payment_status si PI clairement canceled
      if (
        snapshot.payment_intent_status === "canceled" &&
        pay === "pending" &&
        !row.stripe_transfer_id
      ) {
        await supabaseAdmin
          .from("orders")
          .update({ payment_status: "cancelled" })
          .eq("id", orderId);
      }

      await log(true, "Snapshot Stripe récupéré", snapshot as unknown as Record<string, unknown>);
      return jsonResponse({ success: true, action, snapshot });
    }

    // ——— Release / retry transfer (même logique captureAndTransfer) ———
    if (action === "release_payment" || action === "retry_transfer") {
      if (pay === "refunded" || pay === "cancelled") {
        await log(false, `Impossible : payment_status=${pay}`);
        return jsonResponse(
          { error: `Paiement déjà ${pay} — impossible de libérer / transférer.` },
          { status: 409 },
        );
      }
      if (pay === "transferred" && row.stripe_transfer_id) {
        await log(true, "Déjà transferred (idempotent)");
        return jsonResponse({
          success: true,
          action,
          already_done: true,
          stripe_transfer_id: row.stripe_transfer_id,
        });
      }

      const outcome = await captureAndTransferOrder({
        supabaseAdmin,
        stripeSecretKey,
        order: row,
        supabaseUrl,
        supabaseServiceRoleKey,
        sendNotifications: action === "release_payment",
      });

      if (!outcome.success) {
        await log(false, outcome.error, { details: outcome.details });
        return jsonResponse(
          { error: outcome.error, details: outcome.details },
          { status: outcome.httpStatus ?? 500 },
        );
      }

      await log(true, "Capture + transfer OK", {
        stripe_transfer_id: outcome.stripe_transfer_id,
      });
      return jsonResponse({
        success: true,
        action,
        stripe_transfer_id: outcome.stripe_transfer_id,
      });
    }

    // ——— Annuler sans encaissement ———
    if (action === "cancel_no_capture") {
      if (pay === "transferred" || row.stripe_transfer_id) {
        await log(false, "Transfer déjà effectué — utiliser reverse_and_refund");
        return jsonResponse(
          {
            error:
              "Un transfert vendeur existe déjà. Utilisez « Annuler après transfert » (reverse + refund).",
          },
          { status: 409 },
        );
      }
      if (pay === "refunded") {
        await log(true, "Déjà refunded (idempotent)");
        return jsonResponse({ success: true, action, already_done: true });
      }

      if (row.stripe_payment_intent_id) {
        const { pi_status } = await cancelUncapturedPaymentIntent(
          stripeSecretKey,
          row.stripe_payment_intent_id,
        );
        await markOrderCancelled(supabaseAdmin, row, "cancelled");
        await log(true, `Annulation sans encaissement (PI ${pi_status})`);
        return jsonResponse({ success: true, action, payment_intent_status: pi_status });
      }

      await markOrderCancelled(supabaseAdmin, row, "cancelled");
      await log(true, "Annulation sans PaymentIntent");
      return jsonResponse({ success: true, action });
    }

    // ——— Reverse transfer + refund acheteur ———
    if (action === "reverse_and_refund") {
      if (!row.stripe_payment_intent_id) {
        await log(false, "Pas de PaymentIntent");
        return jsonResponse({ error: "Commande sans PaymentIntent" }, { status: 400 });
      }

      let reverseId: string | null = null;
      if (row.stripe_transfer_id) {
        try {
          const rev = await reverseStripeTransfer(stripeSecretKey, row.stripe_transfer_id);
          reverseId = rev.reverse_id;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await log(false, `Reverse impossible : ${msg}`);
          return jsonResponse(
            {
              error:
                "Impossible d’inverser le transfert (solde Connect insuffisant ou déjà viré en banque). Contactez le vendeur ou remboursez depuis Bloomi sans reverse.",
              details: msg,
              reverse_failed: true,
            },
            { status: 409 },
          );
        }
      }

      let refundId: string | null = null;
      try {
        const rf = await refundPaymentIntent(
          stripeSecretKey,
          row.stripe_payment_intent_id,
          orderId,
          reason,
        );
        refundId = rf.refund_id;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // Si reverse OK mais refund échoue — signaler clairement
        await log(false, `Refund échoué après reverse : ${msg}`, { reverse_id: reverseId });
        return jsonResponse(
          {
            error: "Transfer inversé mais remboursement acheteur échoué",
            details: msg,
            reverse_id: reverseId,
          },
          { status: 500 },
        );
      }

      await markOrderCancelled(supabaseAdmin, row, "refunded");
      await log(true, "Reverse + refund OK", { reverse_id: reverseId, refund_id: refundId });
      return jsonResponse({
        success: true,
        action,
        reverse_id: reverseId,
        refund_id: refundId,
      });
    }

    // ——— Refund acheteur seul (PI succeeded, avec ou sans transfer déjà reversed) ———
    if (action === "refund_buyer") {
      if (!row.stripe_payment_intent_id) {
        await log(false, "Pas de PaymentIntent");
        return jsonResponse({ error: "Commande sans PaymentIntent" }, { status: 400 });
      }
      if (pay === "transferred" && row.stripe_transfer_id) {
        // Vérifier si déjà reversed
        const snap = await refreshStripeSnapshot(stripeSecretKey, row);
        if (!snap.transfer_reversed) {
          await log(false, "Transfer non reversed — utiliser reverse_and_refund");
          return jsonResponse(
            {
              error:
                "Le transfert vendeur n’est pas inversé. Utilisez « Annuler après transfert » pour reverse + refund.",
            },
            { status: 409 },
          );
        }
      }

      const rf = await refundPaymentIntent(
        stripeSecretKey,
        row.stripe_payment_intent_id,
        orderId,
        reason,
      );
      await supabaseAdmin
        .from("orders")
        .update({
          payment_status: "refunded",
          status: status === "cancelled" ? "cancelled" : "cancelled",
          cancelled_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      await log(true, "Refund acheteur OK", { refund_id: rf.refund_id });
      return jsonResponse({ success: true, action, refund_id: rf.refund_id });
    }

    return jsonResponse({ error: "Action non gérée" }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await log(false, message);
    return jsonResponse({ error: message }, { status: 500 });
  }
});
