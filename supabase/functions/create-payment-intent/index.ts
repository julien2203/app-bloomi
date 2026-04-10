// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts"

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "npm:@supabase/supabase-js@2";

type DeliveryMode = "pickup" | "shipping" | "both";

function jsonResponse(payload: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

function toCents(amount: unknown): number {
  const n = typeof amount === "number" ? amount : typeof amount === "string" ? Number(amount) : NaN;
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("amount doit être un nombre CHF > 0");
  }
  // CHF -> 2 décimales (cents). On arrondit pour Stripe.
  return Math.round(n * 100);
}

function normalizeAuthHeader(req: Request): string | null {
  const h = req.headers.get("Authorization");
  if (!h) return null;
  if (!h.toLowerCase().startsWith("bearer ")) return null;
  return h;
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

  const {
    listing_id,
    buyer_id,
    seller_id,
    amount,
    delivery_mode,
    shipping_address,
  } = (body ?? {}) as Record<string, unknown>;

  if (!listing_id || !buyer_id || !seller_id || amount == null || !delivery_mode) {
    return jsonResponse(
      { error: "listing_id, buyer_id, seller_id, amount, delivery_mode sont requis" },
      { status: 400 },
    );
  }

  const dm = delivery_mode as DeliveryMode;
  if (dm !== "pickup" && dm !== "shipping" && dm !== "both") {
    return jsonResponse({ error: "delivery_mode invalide" }, { status: 400 });
  }

  const authHeader = normalizeAuthHeader(req);
  if (!authHeader) {
    return jsonResponse({ error: "Non authentifié" }, { status: 401 });
  }

  // Client Supabase avec le JWT utilisateur: on s'appuie sur les policies RLS.
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  // Vérifie que le JWT est valide et récupère l'utilisateur.
  const token = authHeader.slice("Bearer ".length);
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) {
    return jsonResponse({ error: "JWT Supabase invalide" }, { status: 401 });
  }

  const authenticatedUserId = authData.user.id;
  // Le buyer de la commande doit être l'utilisateur authentifié (cohérent avec la policy RLS).
  if (buyer_id !== authenticatedUserId) {
    return jsonResponse({ error: "buyer_id ne correspond pas à l'utilisateur authentifié" }, { status: 403 });
  }

  let amountCents: number;
  let commissionCents: number;
  try {
    amountCents = toCents(amount);
    commissionCents = Math.round(amountCents * 0.10);
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "amount invalide" }, { status: 400 });
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });

  const shipping =
    shipping_address == null
      ? null
      : typeof shipping_address === "string"
        ? shipping_address
        : JSON.stringify(shipping_address);

  // Les tables MVP stockent éventuellement des champs séparés (city/postal/country).
  let shipping_city: string | null = null;
  let shipping_postal_code: string | null = null;
  let shipping_country: string | null = null;
  if (shipping_address && typeof shipping_address === "object" && !Array.isArray(shipping_address)) {
    const sa = shipping_address as Record<string, unknown>;
    shipping_city = (sa.city ?? sa.shipping_city ?? null) as string | null;
    shipping_postal_code = (sa.postal_code ?? sa.postal ?? sa.zip ?? sa.shipping_postal_code ?? null) as string | null;
    shipping_country = (sa.country ?? sa.shipping_country ?? null) as string | null;
  }

  try {
    // Vérifie que le listing est achetable (published)
    const { data: listingRow, error: listingErr } = await supabaseAdmin
      .from("listings")
      .select("id, status, title, price")
      .eq("id", String(listing_id))
      .maybeSingle();

    if (listingErr) {
      return jsonResponse(
        { error: "Impossible de vérifier l'annonce", details: listingErr.message },
        { status: 500 },
      );
    }
    const listingStatus = String((listingRow as any)?.status ?? "").toLowerCase();
    if (listingStatus !== "published") {
      return jsonResponse(
        { error: "Annonce indisponible", details: `listing.status=${listingStatus || "unknown"}` },
        { status: 409 },
      );
    }

    const listingTitle = String((listingRow as any)?.title ?? "");
    const listingPriceRaw = (listingRow as any)?.price as number | string | null | undefined;
    const listingPrice =
      typeof listingPriceRaw === "number"
        ? listingPriceRaw
        : typeof listingPriceRaw === "string"
        ? Number(listingPriceRaw)
        : null;

    const { data: photoRow } = await supabaseAdmin
      .from("listing_photos")
      .select("url, order_index")
      .eq("listing_id", String(listing_id))
      .order("order_index", { ascending: true })
      .limit(1)
      .maybeSingle();
    const coverPhotoUrl = (photoRow as any)?.url ? String((photoRow as any).url) : null;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "chf",
      capture_method: "manual",
      payment_method_types: ["card"],
      metadata: {
        listing_id: String(listing_id),
        buyer_id: String(buyer_id),
        seller_id: String(seller_id),
        commission_cents: String(commissionCents),
        delivery_mode: dm,
      },
    });

    // Best-effort: notifier le vendeur (ne doit pas casser le flow principal)
    try {
      await sendNotification({
        supabaseUrl,
        supabaseServiceRoleKey,
        user_id: String(seller_id),
        title: "🎉 Ton article est vendu !",
        body: "Quelqu'un vient d'acheter ton article. Pense à l'expédier !",
        data: { listing_id: String(listing_id), buyer_id: String(buyer_id) },
      });
    } catch (e) {
      console.warn("Erreur envoi notification vendeur:", e);
    }

    return jsonResponse({
      client_secret: paymentIntent.client_secret,
    });
  } catch (e) {
    return jsonResponse(
      { error: "Erreur lors de la création du PaymentIntent", details: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/create-payment-intent' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
