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
  const header = req.headers.get("Authorization");
  if (!header) return null;
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  return header;
}

function chfToCents(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("seller_amount doit être un nombre CHF > 0");
  }
  return Math.round(n * 100);
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

type OrderRow = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  stripe_payment_intent_id: string | null;
  seller_amount: number | string | null;
  stripe_seller_account_id?: string | null;
  status?: string | null;
  payment_status?: string | null;
  listing?: { price: number | string | null } | null;
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
    return jsonResponse({ error: "Configuration manquante côté serveur" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Body JSON invalide" }, { status: 400 });
  }

  const { order_id } = (body ?? {}) as Record<string, unknown>;
  if (!order_id || typeof order_id !== "string") {
    return jsonResponse({ error: "order_id est requis" }, { status: 400 });
  }

  const authHeader = normalizeAuthHeader(req);
  if (!authHeader) {
    return jsonResponse({ error: "Non authentifié" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

  const token = authHeader.slice("Bearer ".length);
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) {
    return jsonResponse({ error: "JWT Supabase invalide" }, { status: 401 });
  }

  const authenticatedUserId = authData.user.id;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      "id, listing_id, buyer_id, seller_id, stripe_payment_intent_id, seller_amount, stripe_seller_account_id, status, payment_status, listing:listings(price)",
    )
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
  if (row.buyer_id !== authenticatedUserId) {
    return jsonResponse({ error: "Seul l'acheteur peut confirmer la réception" }, { status: 403 });
  }

  if (row.status === "completed" && row.payment_status === "transferred") {
    return jsonResponse({ success: true });
  }

  if (!row.stripe_payment_intent_id) {
    return jsonResponse({ error: "Commande sans stripe_payment_intent_id" }, { status: 400 });
  }

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
      return jsonResponse(
        { error: "Impossible de charger le profil vendeur", details: profileError.message },
        { status: 500 },
      );
    }

    const profileAccountId = (profile as { stripe_seller_account_id?: string | null } | null)
      ?.stripe_seller_account_id;
    if (profileAccountId && String(profileAccountId).trim() !== "") {
      destination = String(profileAccountId).trim();
    }
  }

  if (!destination) {
    return jsonResponse(
      { error: "stripe_seller_account_id manquant (commande ou profil vendeur)" },
      { status: 400 },
    );
  }

  let sellerAmountCents: number;
  try {
    if (row.seller_amount != null) {
      sellerAmountCents = chfToCents(row.seller_amount);
    } else {
      const listingPriceRaw = row.listing?.price ?? null;
      const listingPrice =
        typeof listingPriceRaw === "number"
          ? listingPriceRaw
          : typeof listingPriceRaw === "string"
          ? Number(listingPriceRaw)
          : NaN;

      if (!Number.isFinite(listingPrice) || listingPrice <= 0) {
        throw new Error("seller_amount manquant et listing.price invalide");
      }

      // Fallback historique: commission 10% si seller_amount n'a pas été persisté.
      sellerAmountCents = Math.round(listingPrice * 100 * 0.9);
      if (!Number.isFinite(sellerAmountCents) || sellerAmountCents <= 0) {
        throw new Error("seller_amount calculé invalide");
      }
    }
  } catch (e) {
    return jsonResponse(
      { error: e instanceof Error ? e.message : "seller_amount invalide" },
      { status: 400 },
    );
  }

  try {
    const captureResp = await fetch(
      `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(row.stripe_payment_intent_id)}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    const captureJson = (await captureResp.json()) as {
      latest_charge?: string | null;
      error?: { message?: string };
    };
    if (!captureResp.ok) {
      return jsonResponse(
        {
          error: "Erreur Stripe lors de la capture du paiement",
          details: captureJson?.error?.message ?? "capture failed",
        },
        { status: 500 },
      );
    }

    const transferBody = new URLSearchParams({
      amount: String(sellerAmountCents),
      currency: "chf",
      destination,
      "metadata[order_id]": row.id,
      "metadata[buyer_id]": row.buyer_id,
      "metadata[seller_id]": row.seller_id,
    });
    if (captureJson.latest_charge) {
      transferBody.set("source_transaction", captureJson.latest_charge);
    }

    const transferResp = await fetch("https://api.stripe.com/v1/transfers", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: transferBody.toString(),
    });

    const transferJson = (await transferResp.json()) as {
      id?: string;
      error?: { message?: string };
    };

    if (!transferResp.ok || !transferJson.id) {
      return jsonResponse(
        {
          error: "Erreur Stripe lors de la création du transfert",
          details: transferJson?.error?.message ?? "transfer failed",
        },
        { status: 500 },
      );
    }

    const nowIso = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "completed",
        payment_status: "transferred",
        stripe_transfer_id: transferJson.id,
        delivered_at: nowIso,
      })
      .eq("id", row.id)
      .eq("buyer_id", authenticatedUserId);

    if (updateError) {
      return jsonResponse(
        {
          error: "Paiement capturé et transfert effectué, mais mise à jour de la commande échouée",
          details: updateError.message,
          stripe_transfer_id: transferJson.id,
        },
        { status: 500 },
      );
    }

    // Marque le listing comme "sold" (si il était "reserved")
    const { error: listingUpdateError } = await supabaseAdmin
      .from("listings")
      .update({ status: "sold", sold_at: nowIso })
      .eq("id", row.listing_id)
      .in("status", ["reserved", "published"]);

    if (listingUpdateError) {
      return jsonResponse(
        {
          error: "Commande complétée mais impossible de mettre à jour l'annonce (sold)",
          details: listingUpdateError.message,
        },
        { status: 500 },
      );
    }

    // Best-effort: notifier le vendeur (ne doit pas casser le flow principal)
    try {
      await sendNotification({
        supabaseUrl,
        supabaseServiceRoleKey,
        user_id: row.seller_id,
        title: "💰 Paiement reçu, bravo !",
        body: "La transaction est terminée, les fonds ont été transférés.",
        data: { order_id: row.id },
      });
    } catch (e) {
      console.warn("Erreur envoi notification vendeur:", e);
    }

    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse(
      { error: "Erreur Stripe", details: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
});