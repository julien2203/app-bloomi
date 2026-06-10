// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

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
  stripe_connect_onboarding_completed?: boolean | null;
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

  const authHeader = normalizeAuthHeader(req);
  if (!authHeader) {
    return jsonResponse({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.slice("Bearer ".length);
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) {
    return jsonResponse({ error: "Invalid Supabase JWT" }, { status: 401 });
  }

  const userId = authData.user.id;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("stripe_account_id, stripe_seller_account_id, stripe_connect_onboarding_completed")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    return jsonResponse(
      { error: "Could not load profile", details: profileError.message },
      { status: 500 },
    );
  }

  const row = profile as ProfileStripeRow | null;
  const connectAccountId =
    trimId(row?.stripe_account_id) ?? trimId(row?.stripe_seller_account_id);

  if (!connectAccountId) {
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ stripe_connect_onboarding_completed: false })
      .eq("id", userId);

    if (updateError) {
      return jsonResponse(
        {
          error: "Could not update profile onboarding status",
          details: updateError.message,
          completed: false,
        },
        { status: 500 },
      );
    }

    return jsonResponse({
      completed: false,
      charges_enabled: false,
      details_submitted: false,
      stripe_account_id: null,
    });
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });

  try {
    let account: Stripe.Account;
    try {
      account = await stripe.accounts.retrieve(connectAccountId);
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? e).toLowerCase();
      const stale =
        (e as { code?: string })?.code === "resource_missing" ||
        msg.includes("no such account") ||
        msg.includes("test mode") ||
        msg.includes("testmode") ||
        msg.includes("live mode");

      if (stale) {
        await supabase
          .from("profiles")
          .update({
            stripe_account_id: null,
            stripe_seller_account_id: null,
            stripe_connect_onboarding_completed: false,
          })
          .eq("id", userId);

        return jsonResponse({
          completed: false,
          charges_enabled: false,
          details_submitted: false,
          stripe_account_id: null,
          reset_stale_connect_account: true,
        });
      }
      throw e;
    }

    const chargesEnabled = Boolean(account.charges_enabled);
    const detailsSubmitted = Boolean(account.details_submitted);
    const completed = chargesEnabled && detailsSubmitted;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ stripe_connect_onboarding_completed: completed })
      .eq("id", userId);

    if (updateError) {
      return jsonResponse(
        {
          error: "Stripe status checked but profile update failed",
          details: updateError.message,
          completed,
          charges_enabled: chargesEnabled,
          details_submitted: detailsSubmitted,
        },
        { status: 500 },
      );
    }

    return jsonResponse({
      completed,
      charges_enabled: chargesEnabled,
      details_submitted: detailsSubmitted,
      stripe_account_id: connectAccountId,
    });
  } catch (e) {
    return jsonResponse(
      {
        error: "Stripe error",
        details: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
});

