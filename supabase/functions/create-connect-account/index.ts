// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const ONBOARDING_RETURN_URL = "https://bloomi.ch/onboarding-return";
const ONBOARDING_REFRESH_URL = "https://bloomi.ch/onboarding-refresh";

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

function trimId(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

type ProfileStripeRow = {
  stripe_account_id?: string | null;
  stripe_seller_account_id?: string | null;
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
      { error: "Missing server configuration" },
      { status: 500 },
    );
  }

  const raw = await req.text();
  if (raw.trim()) {
    try {
      JSON.parse(raw);
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, { status: 400 });
    }
  }

  const authHeader = normalizeAuthHeader(req);
  console.log('authHeader present:', !!authHeader);
  if (!authHeader) {
    return jsonResponse({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.slice("Bearer ".length);
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  console.log(
    'authError:',
    authError?.message,
    'user:',
    authData?.user?.id
  );
  if (authError || !authData?.user) {
    return jsonResponse({ error: "Invalid Supabase JWT" }, { status: 401 });
  }

  const userId = authData.user.id;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("stripe_account_id, stripe_seller_account_id")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    return jsonResponse(
      { error: "Could not load profile", details: profileError.message },
      { status: 500 },
    );
  }

  const row = profile as ProfileStripeRow | null;
  let connectAccountId =
    trimId(row?.stripe_account_id) ?? trimId(row?.stripe_seller_account_id);

  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });

  try {
    if (!connectAccountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "CH",
        capabilities: {
          transfers: { requested: true },
        },
      } as Stripe.AccountCreateParams);

      connectAccountId = account.id;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          stripe_account_id: connectAccountId,
          stripe_seller_account_id: connectAccountId,
        })
        .eq("id", userId);

      if (updateError) {
        return jsonResponse(
          {
            error: "Stripe account created but profile update failed",
            details: updateError.message,
            stripe_account_id: connectAccountId,
          },
          { status: 500 },
        );
      }
    }

    const accountLink = await stripe.accountLinks.create({
      account: connectAccountId,
      refresh_url: ONBOARDING_REFRESH_URL,
      return_url: ONBOARDING_RETURN_URL,
      type: "account_onboarding",
    });

    return jsonResponse({ url: accountLink.url });
  } catch (e) {
    console.log('Stripe error:', e instanceof Error ? e.message : String(e));
    return jsonResponse(
      {
        error: 'Stripe error',
        details: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
});

// To invoke locally (example):
// curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/create-connect-account' \
//   --header 'Authorization: Bearer <USER_JWT>' \
//   --header 'Content-Type: application/json'
