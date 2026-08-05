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

  let parsed: { thread_id?: unknown };
  try {
    parsed = (await req.json()) as { thread_id?: unknown };
  } catch {
    return jsonResponse({ error: "Body JSON invalide" }, { status: 400 });
  }

  const threadId = typeof parsed.thread_id === "string" ? parsed.thread_id.trim() : "";
  if (!threadId) {
    return jsonResponse({ error: "thread_id est requis" }, { status: 400 });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

  const token = authHeader.slice("Bearer ".length);
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  const userId = authData?.user?.id ?? null;
  if (authError || !userId) {
    return jsonResponse({ error: "JWT Supabase invalide" }, { status: 401 });
  }

  const { data: thread, error: threadError } = await supabaseAdmin
    .from("threads")
    .select("id, buyer_id, seller_id")
    .eq("id", threadId)
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
  if (userId !== buyerId && userId !== sellerId) {
    return jsonResponse({ error: "Accès refusé" }, { status: 403 });
  }

  const now = new Date().toISOString();
  const hidePatch =
    userId === buyerId
      ? { buyer_hidden_at: now }
      : { seller_hidden_at: now };

  const { error: hideError } = await supabaseAdmin
    .from("threads")
    .update(hidePatch)
    .eq("id", threadId);

  if (hideError) {
    return jsonResponse(
      { error: "Impossible de masquer la conversation", details: hideError.message },
      { status: 500 },
    );
  }

  return jsonResponse({ success: true, hidden_for: userId });
});
