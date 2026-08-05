import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { notifyUser } from "../_shared/notifyUser.ts";
import { newOfferPushText, fetchRecipientLanguage } from "../_shared/pushNotificationI18n.ts";

function jsonResponse(payload: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

type RequestBody = {
  thread_id?: unknown;
  listing_id?: unknown;
  message_id?: unknown;
  amount?: unknown;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse({ error: "Configuration manquante" }, { status: 500 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    return jsonResponse({ error: "Non authentifié" }, { status: 401 });
  }

  let parsed: RequestBody;
  try {
    parsed = (await req.json()) as RequestBody;
  } catch {
    return jsonResponse({ error: "Body JSON invalide" }, { status: 400 });
  }

  const thread_id = typeof parsed.thread_id === "string" ? parsed.thread_id.trim() : "";
  const listing_id = typeof parsed.listing_id === "string" ? parsed.listing_id.trim() : "";
  const message_id = typeof parsed.message_id === "string" ? parsed.message_id.trim() : "";
  const amountRaw = parsed.amount;
  const amount =
    typeof amountRaw === "number"
      ? amountRaw
      : typeof amountRaw === "string"
      ? Number(amountRaw)
      : NaN;

  if (!thread_id || !listing_id || !message_id || !Number.isFinite(amount)) {
    return jsonResponse({ error: "Paramètres manquants" }, { status: 400 });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
  const token = authHeader.slice("Bearer ".length);
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user?.id) {
    return jsonResponse({ error: "JWT invalide" }, { status: 401 });
  }
  const buyerId = authData.user.id;

  const { data: listing, error: listingError } = await supabaseAdmin
    .from("listings")
    .select("seller_id, title")
    .eq("id", listing_id)
    .maybeSingle();

  if (listingError || !listing) {
    return jsonResponse({ error: "Annonce introuvable" }, { status: 404 });
  }

  const sellerId = String((listing as { seller_id?: string }).seller_id ?? "").trim();
  if (!sellerId || sellerId === buyerId) {
    return jsonResponse({ success: true, skipped: "no_seller" });
  }

  const amountFormatted = amount.toFixed(2);
  const listingTitle = String((listing as { title?: string }).title ?? "");
  const sellerLang = await fetchRecipientLanguage(supabaseAdmin, sellerId);
  const pushCopy = newOfferPushText(sellerLang, amountFormatted);

  const result = await notifyUser({
    supabaseAdmin,
    supabaseUrl,
    supabaseServiceRoleKey,
    userId: sellerId,
    templateKey: "new_offer",
    entityId: message_id,
    variables: {
      listingTitle,
      amount: amountFormatted,
      threadId: thread_id,
    },
    push: {
      title: pushCopy.title,
      body: pushCopy.body,
      data: {
        thread_id,
        listing_id,
        offer_amount: amount,
        notification_type: "new_message",
      },
    },
  });

  return jsonResponse({ success: true, ...result });
});
