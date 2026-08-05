// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts"

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildPaymentIntentFeeBreakdown,
  paymentIntentFeeMetadataToStrings,
} from "../_shared/fees.ts";
import { isCompleteShippingAddress } from "../_shared/shippingAddress.ts";

type DeliveryMode = "pickup" | "shipping" | "both";
type CheckoutPaymentMethod = "card" | "twint";

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
    parcel_size: body_parcel_size,
    shipping_address,
    shipping_city: body_shipping_city,
    shipping_postal_code: body_shipping_postal_code,
    shipping_country: body_shipping_country,
    shipping_first_name: body_shipping_first_name,
    shipping_last_name: body_shipping_last_name,
    offer_message_id: body_offer_message_id,
    payment_method: body_payment_method,
  } = (body ?? {}) as Record<string, unknown>;

  const parcelSize =
    typeof body_parcel_size === "string" && body_parcel_size.trim() !== ""
      ? body_parcel_size.trim()
      : null;

  const offerMessageId =
    typeof body_offer_message_id === "string" && body_offer_message_id.trim() !== ""
      ? body_offer_message_id.trim()
      : null;

  const paymentMethod: CheckoutPaymentMethod =
    body_payment_method === "twint" ? "twint" : "card";

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
  if (body_payment_method != null && body_payment_method !== "card" && body_payment_method !== "twint") {
    return jsonResponse({ error: "payment_method invalide" }, { status: 400 });
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

  let itemAmountCents: number;
  try {
    itemAmountCents = toCents(amount);
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "amount invalide" }, { status: 400 });
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });

  // Champs livraison pour orders (body plat + rétrocompat objet shipping_address).
  let shipping_line: string | null = null;
  let shipping_city: string | null = null;
  let shipping_postal_code: string | null = null;
  let shipping_country: string | null = null;
  let shipping_first_name: string | null = null;
  let shipping_last_name: string | null = null;

  if (typeof shipping_address === "string" && shipping_address.trim()) {
    shipping_line = shipping_address.trim();
  } else if (shipping_address && typeof shipping_address === "object" && !Array.isArray(shipping_address)) {
    const sa = shipping_address as Record<string, unknown>;
    shipping_line = String(sa.street ?? sa.rue ?? sa.line1 ?? "").trim() || null;
    shipping_city = (sa.city ?? sa.shipping_city ?? null) as string | null;
    shipping_postal_code = (sa.postal_code ?? sa.postal ?? sa.zip ?? sa.shipping_postal_code ?? null) as string | null;
    shipping_country = (sa.country ?? sa.shipping_country ?? null) as string | null;
    shipping_first_name = String(sa.first_name ?? sa.shipping_first_name ?? "").trim() || null;
    shipping_last_name = String(sa.last_name ?? sa.shipping_last_name ?? "").trim() || null;
  }

  if (typeof body_shipping_city === "string" && body_shipping_city.trim()) {
    shipping_city = body_shipping_city.trim();
  }
  if (typeof body_shipping_postal_code === "string" && body_shipping_postal_code.trim()) {
    shipping_postal_code = body_shipping_postal_code.trim();
  }
  if (typeof body_shipping_country === "string" && body_shipping_country.trim()) {
    shipping_country = body_shipping_country.trim().toUpperCase();
  }
  if (typeof body_shipping_first_name === "string" && body_shipping_first_name.trim()) {
    shipping_first_name = body_shipping_first_name.trim();
  }
  if (typeof body_shipping_last_name === "string" && body_shipping_last_name.trim()) {
    shipping_last_name = body_shipping_last_name.trim();
  }

  if (dm === "shipping") {
    const shipCountry = (shipping_country ?? "CH").trim().toUpperCase();
    if (shipCountry !== "CH") {
      return jsonResponse(
        { error: "L'expédition n'est disponible qu'en Suisse" },
        { status: 400 },
      );
    }
    shipping_country = "CH";

    if (
      !isCompleteShippingAddress({
        street: shipping_line,
        city: shipping_city,
        postalCode: shipping_postal_code,
        country: shipping_country,
      }) ||
      !shipping_first_name ||
      !shipping_last_name
    ) {
      return jsonResponse(
        {
          error: "Adresse de livraison incomplète",
          details:
            "Prénom, nom, rue, code postal, ville et pays (CH) sont requis pour l'expédition",
        },
        { status: 400 },
      );
    }
  }

  const metaShippingAddress = shipping_line ?? "";
  const metaShippingCity = shipping_city ?? "";
  const metaShippingPostal = shipping_postal_code ?? "";
  const metaShippingCountry = shipping_country ?? "";
  const metaShippingFirstName = shipping_first_name ?? "";
  const metaShippingLastName = shipping_last_name ?? "";

  try {
    // Vérifie que le listing est achetable (published)
    const { data: listingRow, error: listingErr } = await supabaseAdmin
      .from("listings")
      .select("id, status, title, price, delivery_mode, parcel_size")
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

    const listingDeliveryMode = String((listingRow as { delivery_mode?: string } | null)?.delivery_mode ?? "both")
      .toLowerCase();
    const listingAllowsPickup = listingDeliveryMode === "pickup" || listingDeliveryMode === "both";
    const listingAllowsShipping = listingDeliveryMode === "shipping" || listingDeliveryMode === "both";

    if (dm === "pickup" && !listingAllowsPickup) {
      return jsonResponse(
        { error: "Cette annonce n'accepte pas la remise en main propre" },
        { status: 400 },
      );
    }
    if (dm === "shipping" && !listingAllowsShipping) {
      return jsonResponse(
        { error: "Cette annonce n'accepte pas l'expédition" },
        { status: 400 },
      );
    }

    const listingParcelSize = String((listingRow as { parcel_size?: string | null } | null)?.parcel_size ?? "")
      .trim() || null;
    const effectiveParcelSize =
      (typeof parcelSize === "string" && parcelSize.trim() ? parcelSize.trim() : null) ??
      listingParcelSize;

    if (dm === "shipping" && !effectiveParcelSize) {
      return jsonResponse(
        { error: "Taille de colis requise pour l'expédition" },
        { status: 400 },
      );
    }

    if (offerMessageId) {
      const { data: offerMsg, error: offerMsgErr } = await supabaseAdmin
        .from("messages")
        .select("id, thread_id, listing_id, offer_amount, offer_status, type")
        .eq("id", offerMessageId)
        .maybeSingle();

      if (offerMsgErr || !offerMsg) {
        return jsonResponse(
          { error: "Offre invalide ou introuvable", details: offerMsgErr?.message ?? "no row" },
          { status: 400 },
        );
      }

      const om = offerMsg as Record<string, unknown>;
      if (String(om.type ?? "") !== "offer") {
        return jsonResponse({ error: "Le message indiqué n'est pas une offre" }, { status: 400 });
      }
      if (String(om.offer_status ?? "").toLowerCase() !== "accepted") {
        return jsonResponse({ error: "Offre non acceptée" }, { status: 400 });
      }

      const rawAmt = om.offer_amount;
      const offerAmtNum =
        typeof rawAmt === "number" ? rawAmt : typeof rawAmt === "string" ? Number(rawAmt) : NaN;
      if (!Number.isFinite(offerAmtNum) || Math.round(offerAmtNum * 100) !== itemAmountCents) {
        return jsonResponse(
          { error: "Le montant ne correspond pas à l'offre acceptée" },
          { status: 400 },
        );
      }

      const { data: th, error: thErr } = await supabaseAdmin
        .from("threads")
        .select("id, listing_id, buyer_id, seller_id")
        .eq("id", String(om.thread_id ?? ""))
        .maybeSingle();

      if (thErr || !th) {
        return jsonResponse(
          { error: "Thread de l'offre introuvable", details: thErr?.message ?? "no row" },
          { status: 400 },
        );
      }

      const t = th as Record<string, unknown>;
      if (String(t.listing_id ?? "") !== String(listing_id)) {
        return jsonResponse({ error: "listing_id incohérent avec l'offre" }, { status: 400 });
      }
      if (String(t.buyer_id ?? "") !== String(buyer_id)) {
        return jsonResponse({ error: "buyer_id incohérent avec l'offre" }, { status: 400 });
      }
      if (String(t.seller_id ?? "") !== String(seller_id)) {
        return jsonResponse({ error: "seller_id incohérent avec l'offre" }, { status: 400 });
      }

      const msgListingId = om.listing_id;
      if (msgListingId != null && String(msgListingId) !== "" && String(msgListingId) !== String(listing_id)) {
        return jsonResponse({ error: "listing_id du message d'offre incorrect" }, { status: 400 });
      }
    }

    const { data: sellerProfileRow } = await supabaseAdmin
      .from("profiles")
      .select("is_influencer, company_name, ide_number, seller_type")
      .eq("id", String(seller_id))
      .maybeSingle();

    let shippingFeeCents = 0;
    let isPromoShipping = false;

    if (dm === "shipping" && effectiveParcelSize) {
      const { data: feeData, error: feeErr } = await supabaseAdmin.rpc("get_shipping_fee", {
        p_parcel_size: effectiveParcelSize,
      });
      if (feeErr) {
        return jsonResponse(
          { error: "Impossible de calculer les frais de port", details: feeErr.message },
          { status: 500 },
        );
      }
      const fee = feeData as { fee_cents?: number; is_promo?: boolean } | null;
      shippingFeeCents = typeof fee?.fee_cents === "number" ? fee.fee_cents : 0;
      isPromoShipping = Boolean(fee?.is_promo);
    }

    const feeBreakdown = buildPaymentIntentFeeBreakdown({
      itemAmountCents,
      sellerProfile: (sellerProfileRow ?? {}) as {
        is_influencer?: boolean | null;
        company_name?: string | null;
        ide_number?: string | null;
        seller_type?: 'individual' | 'pro' | 'sole_proprietorship' | null;
      },
      shippingFeeCents,
    });

    const TWINT_MAX_TOTAL_CENTS = 10000; // 100 CHF
    const isTwintPayment = paymentMethod === "twint";
    const requiresImmediateCapture = isTwintPayment;
    if (isTwintPayment && feeBreakdown.totalCents > TWINT_MAX_TOTAL_CENTS) {
      return jsonResponse(
        { error: "TWINT est disponible uniquement jusqu'à 100 CHF" },
        { status: 400 },
      );
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: feeBreakdown.totalCents,
      currency: "chf",
      capture_method: requiresImmediateCapture ? "automatic" : "manual",
      ...(isTwintPayment
        ? { payment_method_types: ["twint"] as const }
        : {
          automatic_payment_methods: {
            enabled: true,
            allow_redirects: "never",
          },
        }),
      metadata: {
        ...paymentIntentFeeMetadataToStrings(feeBreakdown),
        is_promo_shipping: String(isPromoShipping),
        parcel_size: effectiveParcelSize ?? "",
        delivery_mode: dm,
        listing_id: String(listing_id),
        seller_id: String(seller_id),
        buyer_id: String(buyer_id),
        payment_method: paymentMethod,
        payment_flow: requiresImmediateCapture ? "instant_capture" : "escrow_manual_capture",
        ...(offerMessageId ? { offer_message_id: offerMessageId } : {}),
        ...(dm === "shipping"
          ? {
            shipping_address: metaShippingAddress.slice(0, 500),
            shipping_city: metaShippingCity.slice(0, 500),
            shipping_postal_code: metaShippingPostal.slice(0, 500),
            shipping_country: metaShippingCountry.slice(0, 500),
            shipping_first_name: metaShippingFirstName.slice(0, 100),
            shipping_last_name: metaShippingLastName.slice(0, 100),
          }
          : {}),
      },
    });

    return jsonResponse({
      client_secret: paymentIntent.client_secret,
      payment_method: paymentMethod,
      payment_flow: requiresImmediateCapture ? "instant_capture" : "escrow_manual_capture",
      total_cents: feeBreakdown.totalCents,
      item_amount_cents: feeBreakdown.itemAmountCents,
      buyer_protection_cents: feeBreakdown.buyerProtectionCents,
      buyer_banking_fee_cents: feeBreakdown.buyerBankingFeeCents,
      seller_commission_cents: feeBreakdown.sellerCommissionCents,
      seller_payout_cents: feeBreakdown.sellerPayoutCents,
      seller_fee_rate: feeBreakdown.sellerFeeRate,
      seller_profile_type: feeBreakdown.sellerProfileType,
      shipping_fee_cents: feeBreakdown.shippingFeeCents,
      is_promo_shipping: isPromoShipping,
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
