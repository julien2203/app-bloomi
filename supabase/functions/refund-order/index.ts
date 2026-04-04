import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

function jsonResponse(payload: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

function normalizeAuthHeader(req: Request): string | null {
  const h = req.headers.get("Authorization");
  if (!h) return null;
  if (!h.toLowerCase().startsWith("bearer ")) return null;
  return h;
}

type OrderRow = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  stripe_payment_intent_id: string | null;
  status?: string | null;
  payment_status?: string | null;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey || !stripeSecretKey) {
    return jsonResponse(
      { error: "Configuration manquante côté serveur" },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Body JSON invalide" }, { status: 400 });
  }

  const { order_id, reason } = (body ?? {}) as Record<string, unknown>;
  if (!order_id || typeof order_id !== "string") {
    return jsonResponse({ error: "order_id est requis" }, { status: 400 });
  }

  const reasonStr =
    reason === undefined || reason === null
      ? undefined
      : typeof reason === "string"
        ? reason
        : String(reason);

  const authHeader = normalizeAuthHeader(req);
  if (!authHeader) {
    return jsonResponse({ error: "Non authentifié" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.slice("Bearer ".length);
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) {
    return jsonResponse({ error: "JWT Supabase invalide" }, { status: 401 });
  }

  const uid = authData.user.id;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, listing_id, buyer_id, seller_id, stripe_payment_intent_id, status, payment_status")
    .eq("id", order_id)
    .maybeSingle();

  if (orderError) {
    return jsonResponse(
      { error: "Impossible de charger la commande", details: orderError.message },
      { status: 500 },
    );
  }
  if (!order) {
    return jsonResponse({ error: "Commande introuvable" }, { status: 404 });
  }

  const row = order as OrderRow;

  if (row.buyer_id !== uid && row.seller_id !== uid) {
    return jsonResponse(
      { error: "Seul l'acheteur ou le vendeur peut annuler / rembourser" },
      { status: 403 },
    );
  }

  const statusNorm = String(row.status ?? "").toLowerCase();

  if (statusNorm === "cancelled") {
    return jsonResponse({ success: true });
  }

  if (statusNorm === "completed") {
    return jsonResponse(
      { error: "Impossible d'annuler une commande déjà terminée (completed)" },
      { status: 409 },
    );
  }

  if (!row.stripe_payment_intent_id) {
    return jsonResponse({ error: "Commande sans stripe_payment_intent_id" }, { status: 400 });
  }

  let piStatus: string | null = null;
  try {
    const retrieveResp = await fetch(
      `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(row.stripe_payment_intent_id)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
        },
      },
    );
    const retrieveJson = (await retrieveResp.json()) as {
      status?: string;
      error?: { message?: string };
    };
    if (!retrieveResp.ok) {
      return jsonResponse(
        {
          error: "Impossible de récupérer le PaymentIntent Stripe",
          details: retrieveJson?.error?.message ?? "payment_intent retrieve failed",
        },
        { status: 500 },
      );
    }
    piStatus = retrieveJson.status ?? null;
  } catch (e) {
    return jsonResponse(
      {
        error: "Impossible de récupérer le PaymentIntent Stripe",
        details: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }

  const refundMetadata: Record<string, string> = {
    order_id: row.id,
  };
  if (reasonStr !== undefined) {
    refundMetadata.reason = reasonStr.slice(0, 500);
  }

  const shouldRefund = piStatus === "succeeded";
  const shouldCancel =
    piStatus === "requires_capture" ||
    piStatus === "requires_payment_method" ||
    piStatus === "requires_confirmation" ||
    piStatus === "requires_action" ||
    piStatus === "processing";

  try {
    if (shouldCancel) {
      const cancelResp = await fetch(
        `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(row.stripe_payment_intent_id)}/cancel`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${stripeSecretKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );
      const cancelJson = (await cancelResp.json()) as { error?: { message?: string } };
      if (!cancelResp.ok) {
        return jsonResponse(
          {
            error: "Erreur Stripe (cancel PaymentIntent)",
            details: cancelJson?.error?.message ?? "cancel failed",
            stripe_payment_intent_status: piStatus,
          },
          { status: 500 },
        );
      }
    } else if (shouldRefund) {
      const refundBody = new URLSearchParams({
        payment_intent: row.stripe_payment_intent_id,
        "metadata[order_id]": refundMetadata.order_id,
      });
      if (refundMetadata.reason) {
        refundBody.set("metadata[reason]", refundMetadata.reason);
      }
      const refundResp = await fetch("https://api.stripe.com/v1/refunds", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: refundBody.toString(),
      });
      const refundJson = (await refundResp.json()) as { error?: { message?: string } };
      if (!refundResp.ok) {
        return jsonResponse(
          {
            error: "Erreur Stripe (refund)",
            details: refundJson?.error?.message ?? "refund failed",
          },
          { status: 500 },
        );
      }
    } else if (piStatus === "canceled") {
      // Already canceled on Stripe; continue to update the order row.
    } else {
      return jsonResponse(
        {
          error: "Statut PaymentIntent incompatible avec annulation / remboursement",
          stripe_payment_intent_status: piStatus,
        },
        { status: 409 },
      );
    }
  } catch (e) {
    return jsonResponse(
      {
        error: "Erreur Stripe (cancel ou refund)",
        details: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }

  const nowIso = new Date().toISOString();
  // On applique la mise à jour avec service role pour éviter tout blocage RLS.
  // IMPORTANT: certaines colonnes (payment_status/cancelled_at) peuvent ne pas exister selon l'état du schéma;
  // on met donc à jour `status` de manière fiable puis on tente le reste en best-effort.
  const { error: statusUpdateError } = await supabaseAdmin
    .from("orders")
    .update({ status: "cancelled" })
    .eq("id", row.id);

  if (statusUpdateError) {
    const details = `${statusUpdateError.message}${
      (statusUpdateError as any)?.code ? ` (code=${(statusUpdateError as any).code})` : ""
    }${
      (statusUpdateError as any)?.details ? ` (details=${(statusUpdateError as any).details})` : ""
    }${
      (statusUpdateError as any)?.hint ? ` (hint=${(statusUpdateError as any).hint})` : ""
    }`;
    return jsonResponse(
      {
        error: `Annulation Stripe effectuée mais mise à jour de la commande échouée (${details})`,
      },
      { status: 500 },
    );
  }

  // Best-effort: infos de paiement / timestamp d'annulation
  try {
    await supabaseAdmin
      .from("orders")
      .update({
        payment_status: shouldRefund ? "refunded" : "cancelled",
        cancelled_at: nowIso,
      } as any)
      .eq("id", row.id);
  } catch {
    // ignore (schema peut ne pas avoir ces colonnes)
  }

  // Remet le listing en "published" (si il était "reserved") pour le rendre rachetable.
  // On utilise le service role pour éviter les soucis RLS si besoin.
  const { error: listingUpdateError } = await supabaseAdmin
    .from("listings")
    .update({ status: "published" })
    .eq("id", row.listing_id)
    .eq("status", "reserved");

  if (listingUpdateError) {
    return jsonResponse(
      {
        error: "Commande annulée mais impossible de republier l'annonce",
        details: listingUpdateError.message,
      },
      { status: 500 },
    );
  }

  // Message automatique dans le chat (si un thread existe)
  try {
    const { data: thread } = await supabase
      .from("threads")
      .select("id")
      .eq("listing_id", row.listing_id)
      .eq("buyer_id", row.buyer_id)
      .maybeSingle();

    const threadId = (thread as any)?.id as string | undefined;
    if (threadId) {
      const body =
        uid === row.buyer_id
          ? "Order cancelled by the buyer."
          : "Order cancelled by the seller.";

      await supabase
        .from("messages")
        .insert({
          thread_id: threadId,
          sender_id: uid,
          body,
          type: "text",
        } as any);
    }
  } catch {
    // Best-effort only: cancellation must succeed even if messaging fails.
  }

  return jsonResponse({ success: true });
});

// To invoke locally (example):
// curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/refund-order' \
//   --header 'Authorization: Bearer <USER_JWT>' \
//   --header 'Content-Type: application/json' \
//   --data '{"order_id":"<uuid>","reason":"optional"}'
