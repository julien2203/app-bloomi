import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  findOrCreateThreadForOrderChat,
  insertThreadSystemMessage,
} from "../_shared/orderChatSystemMessage.ts";

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

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceRoleKey) {
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

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
  const token = authHeader.slice("Bearer ".length);
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) {
    return jsonResponse({ error: "JWT Supabase invalide" }, { status: 401 });
  }
  const uid = authData.user.id;

  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("id, listing_id, buyer_id, seller_id, status, tracking_number")
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

  const row = order as {
    listing_id: string;
    buyer_id: string;
    seller_id: string;
    status?: string | null;
    tracking_number?: string | null;
  };

  if (row.seller_id !== uid) {
    return jsonResponse({ error: "Seul le vendeur peut enregistrer ce message" }, { status: 403 });
  }

  const st = String(row.status ?? "").toLowerCase();
  if (st !== "shipped") {
    return jsonResponse({ error: "La commande doit être au statut expédié" }, { status: 400 });
  }

  const tn = String(row.tracking_number ?? "").trim();
  const messageBody = tn
    ? `📦 Colis expédié ! [${tn}] — Ton colis est en route.`
    : `📦 Colis expédié ! — Ton colis est en route.`;

  try {
    const threadId = await findOrCreateThreadForOrderChat(supabaseAdmin, {
      listingId: row.listing_id,
      buyerId: row.buyer_id,
      sellerId: row.seller_id,
    });
    if (threadId) {
      await insertThreadSystemMessage(supabaseAdmin, threadId, messageBody);
    }
  } catch (e) {
    console.warn("insert-order-shipped-chat-message thread/message:", e);
  }

  return jsonResponse({ success: true });
});
