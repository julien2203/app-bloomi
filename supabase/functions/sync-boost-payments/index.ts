// @ts-nocheck
import "@supabase/functions-js/edge-runtime.d.ts";

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
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

function parseDurationDays(raw: unknown): 3 | 7 | null {
  const n = typeof raw === "number" ? raw : Number(String(raw ?? "").trim());
  if (n === 3 || n === 7) return n;
  return null;
}

function parseSponsorType(raw: unknown): "listing" | "dressing" | null {
  const value = String(raw ?? "").trim();
  if (value === "listing" || value === "dressing") return value;
  return null;
}

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

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return jsonResponse({ error: "Non authentifié" }, { status: 401 });
  }

  let isServiceRole = token === supabaseServiceRoleKey;
  if (!isServiceRole) {
    try {
      const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
      const payloadPart = token.split(".")[1] ?? "";
      const padded = payloadPart + "=".repeat((4 - (payloadPart.length % 4)) % 4);
      const payload = JSON.parse(atob(padded.replace(/-/g, "+").replace(/_/g, "/")));
      isServiceRole = payload?.role === "service_role" && payload?.ref === projectRef;
    } catch {
      isServiceRole = false;
    }
  }
  if (!isServiceRole) {
    return jsonResponse({ error: "Accès réservé au service role" }, { status: 403 });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });

  let synced = 0;
  let skipped = 0;
  let page: Stripe.ApiSearchResult<Stripe.PaymentIntent> | Stripe.ApiList<Stripe.PaymentIntent>;
  let useSearch = true;

  try {
    // Search API (plus ciblé) ; fallback list si indisponible.
    try {
      page = await stripe.paymentIntents.search({
        query: "status:'succeeded' AND metadata['purpose']:'boost'",
        limit: 100,
      });
    } catch {
      useSearch = false;
      page = await stripe.paymentIntents.list({ limit: 100 });
    }

    while (true) {
      for (const pi of page.data) {
        if (pi.status !== "succeeded") {
          skipped += 1;
          continue;
        }
        if (String(pi.metadata?.purpose ?? "") !== "boost") {
          skipped += 1;
          continue;
        }

        const seller_id = String(pi.metadata?.seller_id ?? "").trim();
        const listing_id = String(pi.metadata?.listing_id ?? "").trim() || null;
        const sponsor_type = parseSponsorType(pi.metadata?.sponsor_type);
        const duration_days = parseDurationDays(pi.metadata?.duration_days);

        if (!seller_id || !sponsor_type || !duration_days || !pi.amount) {
          skipped += 1;
          continue;
        }

        const { error } = await supabaseAdmin.from("boost_payments").upsert(
          {
            stripe_payment_intent_id: pi.id,
            seller_id,
            listing_id,
            sponsor_type,
            duration_days,
            amount_cents: pi.amount,
            currency: String(pi.currency ?? "chf").toLowerCase(),
            updated_count: 0,
            paid_at: new Date(pi.created * 1000).toISOString(),
          },
          { onConflict: "stripe_payment_intent_id" },
        );

        if (error) {
          console.error("boost_payments upsert failed", pi.id, error);
          skipped += 1;
          continue;
        }
        synced += 1;
      }

      if (!page.has_more || page.data.length === 0) break;

      if (useSearch) {
        const searchPage = page as Stripe.ApiSearchResult<Stripe.PaymentIntent>;
        if (!searchPage.next_page) break;
        page = await stripe.paymentIntents.search({
          query: "status:'succeeded' AND metadata['purpose']:'boost'",
          limit: 100,
          page: searchPage.next_page,
        });
      } else {
        const listPage = page as Stripe.ApiList<Stripe.PaymentIntent>;
        const startingAfter = listPage.data[listPage.data.length - 1]?.id;
        if (!startingAfter) break;
        page = await stripe.paymentIntents.list({ limit: 100, starting_after: startingAfter });
      }
    }

    return jsonResponse({ success: true, synced, skipped });
  } catch (e) {
    return jsonResponse(
      {
        error: "Sync Stripe impossible",
        details: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
});
