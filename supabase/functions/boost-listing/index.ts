// @ts-nocheck
import "@supabase/functions-js/edge-runtime.d.ts";

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "npm:@supabase/supabase-js@2";

type SponsorType = "listing" | "dressing";

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

function sponsorAmountCents(type: SponsorType): number {
  return type === "listing" ? 599 : 1299;
}

function addDaysIso(days: number): string {
  const ms = days * 24 * 60 * 60 * 1000;
  return new Date(Date.now() + ms).toISOString();
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
    return jsonResponse({ error: "Configuration manquante côté serveur" }, { status: 500 });
  }

  const authHeader = normalizeAuthHeader(req);
  if (!authHeader) {
    return jsonResponse({ error: "Non authentifié", details: "Authorization: Bearer <token> manquant" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Body JSON invalide" }, { status: 400 });
  }

  const parsed = (body ?? {}) as Record<string, unknown>;
  const action = String(parsed.action ?? "create");

  // Client Supabase avec JWT utilisateur (plus robuste que authAdmin.getUser dans certains environnements)
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user?.id) {
    return jsonResponse(
      { error: "JWT Supabase invalide", details: userErr?.message ?? "auth.getUser() a échoué" },
      { status: 401 },
    );
  }
  const authenticatedUserId = userData.user.id;

  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });

  // ---------------------------
  // CREATE: crée un PaymentIntent
  // ---------------------------
  if (action === "create") {
    const listing_id = String(parsed.listing_id ?? "").trim();
    const seller_id = String(parsed.seller_id ?? "").trim();
    const sponsor_type = String(parsed.sponsor_type ?? "").trim() as SponsorType;

    if (!listing_id || !seller_id || (sponsor_type !== "listing" && sponsor_type !== "dressing")) {
      return jsonResponse(
        { error: "listing_id, seller_id, sponsor_type ('listing'|'dressing') sont requis" },
        { status: 400 },
      );
    }

    // Seul le vendeur peut booster
    if (seller_id !== authenticatedUserId) {
      return jsonResponse({ error: "seller_id ne correspond pas à l'utilisateur authentifié" }, { status: 403 });
    }

    // Vérifier propriété + statut
    const { data: listingRow, error: listingErr } = await supabaseAdmin
      .from("listings")
      .select("id, seller_id, status, title")
      .eq("id", listing_id)
      .maybeSingle();

    if (listingErr) {
      return jsonResponse({ error: "Impossible de vérifier l'annonce", details: listingErr.message }, { status: 500 });
    }
    if (!listingRow) {
      return jsonResponse({ error: "Annonce introuvable" }, { status: 404 });
    }
    if (String((listingRow as any).seller_id) !== seller_id) {
      return jsonResponse({ error: "Annonce non détenue par ce vendeur" }, { status: 403 });
    }

    const status = String((listingRow as any).status ?? "").toLowerCase();
    if (status !== "published" && status !== "draft") {
      return jsonResponse(
        { error: "Annonce indisponible", details: `listing.status=${status || "unknown"}` },
        { status: 409 },
      );
    }

    const amount = sponsorAmountCents(sponsor_type);
    const title = String((listingRow as any).title ?? "Listing boost");

    try {
      const pi = await stripe.paymentIntents.create({
        amount,
        currency: "chf",
        payment_method_types: ["card"],
        metadata: {
          purpose: "boost",
          listing_id,
          seller_id,
          sponsor_type,
        },
        description: sponsor_type === "listing" ? `Boost listing: ${title}` : `Boost dressing: ${title}`,
      });

      return jsonResponse({ client_secret: pi.client_secret });
    } catch (e) {
      return jsonResponse(
        { error: "Impossible de créer le PaymentIntent", details: e instanceof Error ? e.message : String(e) },
        { status: 500 },
      );
    }
  }

  // ---------------------------
  // CONFIRM: vérifie paiement puis applique la mise en avant
  // ---------------------------
  if (action === "confirm") {
    const payment_intent_id = String(parsed.payment_intent_id ?? "").trim();
    if (!payment_intent_id) {
      return jsonResponse({ error: "payment_intent_id est requis" }, { status: 400 });
    }

    try {
      const pi = await stripe.paymentIntents.retrieve(payment_intent_id);

      const seller_id = String(pi.metadata?.seller_id ?? "").trim();
      const listing_id = String(pi.metadata?.listing_id ?? "").trim();
      const sponsor_type = String(pi.metadata?.sponsor_type ?? "").trim() as SponsorType;

      if (!seller_id || !listing_id || (sponsor_type !== "listing" && sponsor_type !== "dressing")) {
        return jsonResponse({ error: "PaymentIntent metadata incomplet (seller_id/listing_id/sponsor_type)" }, { status: 400 });
      }
      if (seller_id !== authenticatedUserId) {
        return jsonResponse({ error: "Vous n'êtes pas le vendeur de ce paiement" }, { status: 403 });
      }

      // On considère paiement OK uniquement si succeeded
      if (pi.status !== "succeeded") {
        return jsonResponse(
          { error: "Paiement non finalisé", details: `payment_intent.status=${pi.status}` },
          { status: 409 },
        );
      }

      const sponsored_until = addDaysIso(15);
      const patch = {
        is_sponsored: true,
        sponsored_until,
        sponsor_type,
      } as Record<string, unknown>;

      let updated_count = 0;

      if (sponsor_type === "listing") {
        const { data, error } = await supabaseAdmin
          .from("listings")
          .update(patch)
          .eq("id", listing_id)
          .eq("seller_id", seller_id)
          .select("id");
        if (error) {
          return jsonResponse({ error: "Impossible de mettre à jour l'annonce", details: error.message }, { status: 500 });
        }
        updated_count = (data ?? []).length;
      } else {
        const { data, error } = await supabaseAdmin
          .from("listings")
          .update(patch)
          .eq("seller_id", seller_id)
          .eq("status", "published")
          .select("id");
        if (error) {
          return jsonResponse({ error: "Impossible de mettre à jour le dressing", details: error.message }, { status: 500 });
        }
        updated_count = (data ?? []).length;
      }

      return jsonResponse({ success: true, updated_count });
    } catch (e) {
      return jsonResponse(
        { error: "Impossible de confirmer le paiement", details: e instanceof Error ? e.message : String(e) },
        { status: 500 },
      );
    }
  }

  return jsonResponse({ error: "action invalide (create|confirm)" }, { status: 400 });
});

