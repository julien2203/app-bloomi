import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  captureAndTransferOrder,
  type ConfirmOrderRow,
} from "../_shared/confirmOrderPayment.ts";

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
      "id, listing_id, buyer_id, seller_id, stripe_payment_intent_id, seller_amount, seller_commission_chf, seller_fee_rate, seller_profile_type, listing_price, stripe_seller_account_id, status, payment_status, confirmed_at, listing:listings(price)",
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

  const row = order as ConfirmOrderRow;
  if (row.buyer_id !== authenticatedUserId) {
    return jsonResponse({ error: "Seul l'acheteur peut confirmer la réception" }, { status: 403 });
  }

  if (row.status === "completed" && row.payment_status === "transferred") {
    return jsonResponse({ success: true });
  }

  const outcome = await captureAndTransferOrder({
    supabaseAdmin,
    stripeSecretKey,
    order: row,
    supabaseUrl,
    supabaseServiceRoleKey,
    sendNotifications: true,
  });

  if (!outcome.success) {
    return jsonResponse(
      { error: outcome.error, details: outcome.details },
      { status: outcome.httpStatus ?? 500 },
    );
  }

  return jsonResponse({ success: true });
});
