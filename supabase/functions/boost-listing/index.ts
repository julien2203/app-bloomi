// @ts-nocheck
import "@supabase/functions-js/edge-runtime.d.ts";

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getBoostPriceCents, type BoostSponsorType } from "../_shared/fees.ts";

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

function parseDurationDays(raw: unknown): 3 | 7 | null {
  const n = typeof raw === "number" ? raw : Number(String(raw ?? "").trim());
  if (n === 3 || n === 7) return n;
  return null;
}

function parseSponsorType(raw: unknown): BoostSponsorType | null {
  const value = String(raw ?? "").trim();
  if (value === "listing" || value === "dressing") return value;
  return null;
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

  if (action === "create") {
    const listing_id = String(parsed.listing_id ?? "").trim();
    const seller_id = String(parsed.seller_id ?? "").trim();
    const sponsor_type = parseSponsorType(parsed.sponsor_type);
    const duration_days = parseDurationDays(parsed.duration_days);

    if (!listing_id || !seller_id || !sponsor_type) {
      return jsonResponse(
        { error: "listing_id, seller_id, sponsor_type ('listing'|'dressing') sont requis" },
        { status: 400 },
      );
    }
    if (!duration_days) {
      return jsonResponse({ error: "duration_days doit être 3 ou 7" }, { status: 400 });
    }

    if (seller_id !== authenticatedUserId) {
      return jsonResponse({ error: "seller_id ne correspond pas à l'utilisateur authentifié" }, { status: 403 });
    }

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

    let amount: number;
    try {
      amount = getBoostPriceCents(sponsor_type, duration_days);
    } catch (e) {
      return jsonResponse(
        {
          error: "Option boost invalide",
          details: e instanceof Error ? e.message : String(e),
        },
        { status: 400 },
      );
    }

    const title = String((listingRow as any).title ?? "Listing boost");

    try {
      const pi = await stripe.paymentIntents.create({
        amount,
        currency: "chf",
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: "never",
        },
        metadata: {
          purpose: "boost",
          listing_id,
          seller_id,
          sponsor_type,
          duration_days: String(duration_days),
        },
        description:
          sponsor_type === "listing"
            ? `Boost listing ${duration_days}d: ${title}`
            : `Boost dressing ${duration_days}d: ${title}`,
      });

      return jsonResponse({ client_secret: pi.client_secret });
    } catch (e) {
      return jsonResponse(
        { error: "Impossible de créer le PaymentIntent", details: e instanceof Error ? e.message : String(e) },
        { status: 500 },
      );
    }
  }

  if (action === "confirm") {
    const payment_intent_id = String(parsed.payment_intent_id ?? "").trim();
    if (!payment_intent_id) {
      return jsonResponse({ error: "payment_intent_id est requis" }, { status: 400 });
    }

    try {
      const pi = await stripe.paymentIntents.retrieve(payment_intent_id);

      const seller_id = String(pi.metadata?.seller_id ?? "").trim();
      const listing_id = String(pi.metadata?.listing_id ?? "").trim();
      const sponsor_type = parseSponsorType(pi.metadata?.sponsor_type);
      const duration_days = parseDurationDays(pi.metadata?.duration_days);

      if (!seller_id || !listing_id || !sponsor_type) {
        return jsonResponse(
          { error: "PaymentIntent metadata incomplet (seller_id/listing_id/sponsor_type)" },
          { status: 400 },
        );
      }
      if (!duration_days) {
        return jsonResponse(
          { error: "PaymentIntent metadata incomplet (duration_days doit être 3 ou 7)" },
          { status: 400 },
        );
      }
      if (seller_id !== authenticatedUserId) {
        return jsonResponse({ error: "Vous n'êtes pas le vendeur de ce paiement" }, { status: 403 });
      }

      if (pi.status !== "succeeded") {
        return jsonResponse(
          { error: "Paiement non finalisé", details: `payment_intent.status=${pi.status}` },
          { status: 409 },
        );
      }

      const sponsored_until = addDaysIso(duration_days);
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

      if (updated_count === 0) {
        return jsonResponse(
          {
            error:
              sponsor_type === "dressing"
                ? "Aucune annonce publiée à mettre en avant"
                : "Annonce introuvable pour le boost",
            details:
              sponsor_type === "dressing"
                ? "Publiez au moins une annonce avant d'appliquer le boost dressing."
                : `listing_id=${listing_id}`,
          },
          { status: 409 },
        );
      }

      const amountCents = typeof pi.amount === "number" ? pi.amount : getBoostPriceCents(sponsor_type, duration_days);
      const paidAt = pi.created
        ? new Date(pi.created * 1000).toISOString()
        : new Date().toISOString();

      const { error: boostPaymentErr } = await supabaseAdmin.from("boost_payments").upsert(
        {
          stripe_payment_intent_id: payment_intent_id,
          seller_id,
          listing_id,
          sponsor_type,
          duration_days,
          amount_cents: amountCents,
          currency: String(pi.currency ?? "chf").toLowerCase(),
          updated_count,
          paid_at: paidAt,
        },
        { onConflict: "stripe_payment_intent_id" },
      );

      if (boostPaymentErr) {
        console.error("boost_payments upsert failed", boostPaymentErr);
      }

      return jsonResponse({ success: true, updated_count, sponsored_until, duration_days });
    } catch (e) {
      return jsonResponse(
        { error: "Impossible de confirmer le paiement", details: e instanceof Error ? e.message : String(e) },
        { status: 500 },
      );
    }
  }

  return jsonResponse({ error: "action invalide (create|confirm)" }, { status: 400 });
});
