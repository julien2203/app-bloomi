import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { notifyUser } from "../_shared/notifyUser.ts";
import { wasTransactionalEmailSent } from "../_shared/transactionalEmailLog.ts";

/** Délai avant rappel d'expédition (heures). */
const SHIP_REMINDER_AFTER_HOURS = 48;
/** Délai avant e-mail message non lu (heures). */
const UNREAD_MESSAGE_AFTER_HOURS = 8;

function jsonResponse(payload: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

function isAuthorizedCronOrServiceRole(req: Request, serviceRoleKey: string): boolean {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader === `Bearer ${serviceRoleKey}`) return true;
  const cronSecret = Deno.env.get("CRON_SECRET");
  const cronHeader = req.headers.get("x-cron-secret");
  if (cronSecret && cronHeader === cronSecret) return true;
  return false;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse({ error: "Configuration manquante" }, { status: 500 });
  }

  if (!isAuthorizedCronOrServiceRole(req, supabaseServiceRoleKey)) {
    return jsonResponse({ error: "Non autorisé" }, { status: 403 });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
  const shipCutoff = new Date(Date.now() - SHIP_REMINDER_AFTER_HOURS * 60 * 60 * 1000)
    .toISOString();
  const messageCutoff = new Date(Date.now() - UNREAD_MESSAGE_AFTER_HOURS * 60 * 60 * 1000)
    .toISOString();

  let shipEmailsSent = 0;
  let messageEmailsSent = 0;

  // --- Rappels d'expédition ---
  const { data: pendingShipOrders, error: shipErr } = await supabaseAdmin
    .from("orders")
    .select("id, seller_id, listing_title, delivery_mode, status, shipped_at, created_at")
    .eq("status", "pending")
    .is("shipped_at", null)
    .lt("created_at", shipCutoff)
    .limit(100);

  if (shipErr) {
    return jsonResponse(
      { error: "Impossible de charger les commandes", details: shipErr.message },
      { status: 500 },
    );
  }

  for (const row of pendingShipOrders ?? []) {
    const order = row as {
      id: string;
      seller_id: string;
      listing_title?: string | null;
      delivery_mode?: string | null;
    };
    const dm = String(order.delivery_mode ?? "").toLowerCase();
    if (dm === "pickup") continue;

    const sellerId = String(order.seller_id ?? "").trim();
    if (!sellerId) continue;

    const alreadySent = await wasTransactionalEmailSent(supabaseAdmin, {
      userId: sellerId,
      templateKey: "ship_reminder",
      entityId: order.id,
    });
    if (alreadySent) continue;

    try {
      const result = await notifyUser({
        supabaseAdmin,
        supabaseUrl,
        supabaseServiceRoleKey,
        userId: sellerId,
        templateKey: "ship_reminder",
        entityId: order.id,
        variables: {
          listingTitle: String(order.listing_title ?? ""),
          orderId: order.id,
        },
        skipPush: true,
      });
      if (result.emailSent) shipEmailsSent += 1;
    } catch (e) {
      console.warn("ship_reminder failed:", order.id, e);
    }
  }

  // --- Messages non lus ---
  const { data: unreadMessages, error: msgErr } = await supabaseAdmin
    .from("messages")
    .select("id, thread_id, sender_id, body, created_at, type, is_system")
    .is("read_at", null)
    .eq("is_system", false)
    .neq("type", "offer")
    .lt("created_at", messageCutoff)
    .order("created_at", { ascending: true })
    .limit(100);

  if (msgErr) {
    return jsonResponse(
      { error: "Impossible de charger les messages", details: msgErr.message },
      { status: 500 },
    );
  }

  for (const row of unreadMessages ?? []) {
    const msg = row as {
      id: string;
      thread_id: string;
      sender_id: string;
      body: string;
    };

    const { data: thread, error: threadError } = await supabaseAdmin
      .from("threads")
      .select("buyer_id, seller_id")
      .eq("id", msg.thread_id)
      .maybeSingle();

    if (threadError || !thread) continue;

    const buyerId = String((thread as { buyer_id?: string }).buyer_id ?? "");
    const sellerId = String((thread as { seller_id?: string }).seller_id ?? "");
    const senderId = String(msg.sender_id ?? "");
    const recipientId =
      senderId === buyerId ? sellerId : senderId === sellerId ? buyerId : "";
    if (!recipientId || recipientId === senderId) continue;

    const { data: freshMsg } = await supabaseAdmin
      .from("messages")
      .select("read_at")
      .eq("id", msg.id)
      .maybeSingle();
    if ((freshMsg as { read_at?: string | null } | null)?.read_at) continue;

    const alreadyEmailed = await wasTransactionalEmailSent(supabaseAdmin, {
      userId: recipientId,
      templateKey: "unread_message",
      entityId: msg.id,
    });
    if (alreadyEmailed) continue;

    const { data: senderProfile } = await supabaseAdmin
      .from("profiles")
      .select("display_name")
      .eq("id", senderId)
      .maybeSingle();
    const senderName = String(
      (senderProfile as { display_name?: string | null } | null)?.display_name ?? "",
    );

    const preview = msg.body.trim().replace(/\s+/g, " ").slice(0, 200);

    try {
      const result = await notifyUser({
        supabaseAdmin,
        supabaseUrl,
        supabaseServiceRoleKey,
        userId: recipientId,
        templateKey: "unread_message",
        entityId: msg.id,
        variables: {
          senderName,
          preview,
          threadId: msg.thread_id,
        },
        skipPush: true,
      });
      if (result.emailSent) messageEmailsSent += 1;
    } catch (e) {
      console.warn("unread_message email failed:", msg.id, e);
    }
  }

  return jsonResponse({
    success: true,
    ship_reminders_processed: (pendingShipOrders ?? []).length,
    ship_emails_sent: shipEmailsSent,
    unread_messages_processed: (unreadMessages ?? []).length,
    unread_message_emails_sent: messageEmailsSent,
    ship_cutoff: shipCutoff,
    message_cutoff: messageCutoff,
  });
});
