import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { notifyUser } from "../_shared/notifyUser.ts";

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
  template?: unknown;
};

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

  const template = typeof parsed.template === "string" ? parsed.template.trim() : "";
  if (template !== "welcome") {
    return jsonResponse({ error: "template non supporté" }, { status: 400 });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
  const token = authHeader.slice("Bearer ".length);
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user?.id) {
    return jsonResponse({ error: "JWT invalide" }, { status: 401 });
  }

  const userId = authData.user.id;

  const result = await notifyUser({
    supabaseAdmin,
    supabaseUrl,
    supabaseServiceRoleKey,
    userId,
    templateKey: "welcome",
    entityId: userId,
    skipPush: true,
  });

  return jsonResponse({ success: true, ...result });
});
