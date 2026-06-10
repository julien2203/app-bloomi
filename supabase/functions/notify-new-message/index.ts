import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  fetchRecipientLanguage,
  newMessagePushText,
} from "../_shared/pushNotificationI18n.ts";

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
  sender_id?: unknown;
  message_body?: unknown;
};

function normalizeAuthHeader(req: Request): string | null {
  const h = req.headers.get("Authorization");
  if (!h) return null;
  if (!h.toLowerCase().startsWith("bearer ")) return null;
  return h;
}

function clipMessage(v: string, max = 100): string {
  const s = v.trim().replace(/\s+/g, " ");
  if (s.length <= max) return s;
  return s.slice(0, max).trimEnd();
}

async function sendNotification(params: {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  user_id: string;
  title: string;
  body: string;
  data?: unknown;
}) {
  const url = `${params.supabaseUrl.replace(/\/+$/, "")}/functions/v1/send-notification`;
  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: params.user_id,
      title: params.title,
      body: params.body,
      data: params.data ?? undefined,
    }),
  });
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

  const authHeader = normalizeAuthHeader(req);
  if (!authHeader) {
    return jsonResponse({ error: "Non authentifié" }, { status: 401 });
  }

  let parsed: RequestBody;
  try {
    parsed = (await req.json()) as RequestBody;
  } catch {
    return jsonResponse({ error: "Body JSON invalide" }, { status: 400 });
  }

  const thread_id = typeof parsed.thread_id === "string" ? parsed.thread_id.trim() : "";
  const sender_id = typeof parsed.sender_id === "string" ? parsed.sender_id.trim() : "";
  const message_body = typeof parsed.message_body === "string" ? parsed.message_body : "";

  if (!thread_id) return jsonResponse({ error: "thread_id est requis" }, { status: 400 });
  if (!sender_id) return jsonResponse({ error: "sender_id est requis" }, { status: 400 });
  if (!message_body) return jsonResponse({ error: "message_body est requis" }, { status: 400 });

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

  // Vérifier que le sender_id correspond bien au JWT (évite spoof + auto-notifs)
  const token = authHeader.slice("Bearer ".length);
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user?.id) {
    return jsonResponse({ error: "JWT Supabase invalide" }, { status: 401 });
  }
  if (authData.user.id !== sender_id) {
    return jsonResponse({ error: "sender_id ne correspond pas à l'utilisateur authentifié" }, { status: 403 });
  }

  const { data: thread, error: threadError } = await supabaseAdmin
    .from("threads")
    .select("id, buyer_id, seller_id")
    .eq("id", thread_id)
    .maybeSingle();

  if (threadError) {
    return jsonResponse(
      { error: "Impossible de charger le thread", details: threadError.message },
      { status: 500 },
    );
  }
  if (!thread) {
    return jsonResponse({ error: "Thread introuvable" }, { status: 404 });
  }

  const buyerId = String((thread as any).buyer_id ?? "").trim();
  const sellerId = String((thread as any).seller_id ?? "").trim();
  if (!buyerId || !sellerId) {
    return jsonResponse({ error: "Thread invalide (buyer_id/seller_id manquants)" }, { status: 500 });
  }

  const recipientId = sender_id === buyerId ? sellerId : buyerId;
  if (!recipientId) {
    return jsonResponse({ error: "Destinataire introuvable" }, { status: 500 });
  }

  // Ne jamais envoyer une notification à l'expéditeur lui-même
  if (recipientId === sender_id) {
    return jsonResponse({ success: true, skipped: "recipient_is_sender" });
  }

  const { data: senderProfile, error: senderProfileError } = await supabaseAdmin
    .from("profiles")
    .select("display_name")
    .eq("id", sender_id)
    .maybeSingle();

  if (senderProfileError) {
    return jsonResponse(
      { error: "Impossible de charger le profil expéditeur", details: senderProfileError.message },
      { status: 500 },
    );
  }

  const displayNameRaw = (senderProfile as any)?.display_name;
  const displayName =
    typeof displayNameRaw === "string" && displayNameRaw.trim() !== ""
      ? displayNameRaw.trim()
      : "";

  const clipped = clipMessage(message_body, 100);
  const recipientLang = await fetchRecipientLanguage(supabaseAdmin, recipientId);
  const { title, body } = newMessagePushText(recipientLang, displayName, clipped);

  try {
    await sendNotification({
      supabaseUrl,
      supabaseServiceRoleKey,
      user_id: recipientId,
      title,
      body,
      data: { thread_id, notification_type: "new_message" },
    });
  } catch (e) {
    return jsonResponse(
      { error: "Erreur envoi notification", details: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }

  return jsonResponse({ success: true });
});

