import "npm:@supabase/functions-js/edge-runtime.d.ts";
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
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse({ error: "Configuration manquante côté serveur" }, { status: 500 });
  }

  const authHeader = normalizeAuthHeader(req);
  if (!authHeader) {
    return jsonResponse({ error: "Non authentifié" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Body JSON invalide" }, { status: 400 });
  }

  const tokenRaw = (body as any)?.expo_push_token;
  const expo_push_token = typeof tokenRaw === "string" ? tokenRaw.trim() : "";
  if (!expo_push_token || !expo_push_token.startsWith("ExponentPushToken[")) {
    return jsonResponse({ error: "expo_push_token invalide" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const userId = userData?.user?.id ?? null;
  if (userErr || !userId) {
    return jsonResponse({ error: "JWT Supabase invalide", details: userErr?.message }, { status: 401 });
  }

  // 1) Associer le token à l'utilisateur courant
  const { error: updateErr } = await supabaseAdmin
    .from("profiles")
    .update({ expo_push_token })
    .eq("id", userId);
  if (updateErr) {
    return jsonResponse({ error: "Impossible de sauvegarder le token", details: updateErr.message }, { status: 500 });
  }

  // 2) Garantir l'unicité: retirer ce token des autres profils (si un user a switché de compte sur le même device)
  const { error: clearErr } = await supabaseAdmin
    .from("profiles")
    .update({ expo_push_token: null })
    .eq("expo_push_token", expo_push_token)
    .neq("id", userId);
  if (clearErr) {
    return jsonResponse({ error: "Impossible de dédupliquer le token", details: clearErr.message }, { status: 500 });
  }

  return jsonResponse({ success: true });
});

