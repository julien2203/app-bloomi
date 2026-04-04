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

function trimId(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function sumCurrencyCents(items: unknown, currency: string): number {
  if (!Array.isArray(items)) return 0;
  const target = currency.toLowerCase();
  let sum = 0;
  for (const it of items) {
    const row = it as { amount?: unknown; currency?: unknown };
    const c = String(row?.currency ?? "").toLowerCase();
    if (c !== target) continue;
    const amt = row?.amount;
    if (typeof amt === "number" && Number.isFinite(amt)) sum += amt;
  }
  return sum;
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
    return jsonResponse({ error: "Missing server configuration" }, { status: 500 });
  }

  const authHeader = normalizeAuthHeader(req);
  if (!authHeader) {
    return jsonResponse({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.slice("Bearer ".length);
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) {
    return jsonResponse({ error: "Invalid Supabase JWT" }, { status: 401 });
  }

  const userId = authData.user.id;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

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

  const stripeAccountId =
    trimId((profile as any)?.stripe_account_id) ?? trimId((profile as any)?.stripe_seller_account_id);

  if (!stripeAccountId) {
    return jsonResponse({ error: "No Stripe Connect account configured" }, { status: 400 });
  }

  const balanceResp = await fetch("https://api.stripe.com/v1/balance", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Stripe-Account": stripeAccountId,
    },
  });

  const balanceJson = (await balanceResp.json()) as any;
  if (!balanceResp.ok) {
    return jsonResponse(
      { error: "Stripe error", details: balanceJson?.error?.message ?? "balance fetch failed" },
      { status: 500 },
    );
  }

  const availableCents = sumCurrencyCents(balanceJson?.available, "chf");
  if (!Number.isFinite(availableCents) || availableCents <= 0) {
    return jsonResponse({ error: "Solde insuffisant" }, { status: 400 });
  }

  const payoutResp = await fetch("https://api.stripe.com/v1/payouts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Stripe-Account": stripeAccountId,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      amount: String(availableCents),
      currency: "chf",
    }).toString(),
  });

  const payoutJson = (await payoutResp.json()) as any;
  if (!payoutResp.ok) {
    return jsonResponse(
      { error: "Stripe error", details: payoutJson?.error?.message ?? "payout failed" },
      { status: 500 },
    );
  }

  return jsonResponse({
    success: true,
    amount_chf: availableCents / 100,
    arrival_date: payoutJson?.arrival_date ?? null,
  });
});

