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

  // Profile lookup with user JWT (RLS-safe)
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

  const resp = await fetch(
    `https://api.stripe.com/v1/accounts/${encodeURIComponent(stripeAccountId)}/login_links`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({}).toString(),
    },
  );

  const json = (await resp.json()) as any;
  if (!resp.ok) {
    return jsonResponse(
      {
        error: "Stripe error",
        details: json?.error?.message ?? "login_links failed",
      },
      { status: 500 },
    );
  }

  const url = typeof json?.url === "string" ? json.url : null;
  if (!url) {
    return jsonResponse({ error: "Missing Stripe login link URL" }, { status: 500 });
  }

  return jsonResponse({ url });
});

