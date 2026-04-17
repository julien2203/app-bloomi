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
  const postClientId = Deno.env.get("POST_CH_CLIENT_ID");
  const postClientSecret = Deno.env.get("POST_CH_CLIENT_SECRET");

  if (!supabaseUrl || !supabaseServiceRoleKey || !postClientId || !postClientSecret) {
    return jsonResponse(
      { error: "Configuration manquante côté serveur" },
      { status: 500 },
    );
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

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: postClientId,
    client_secret: postClientSecret,
    scope: "DCAPI_ADDRESS_AUTOCOMPLETE DCAPI_ADDRESS_READ",
  });

  try {
    const resp = await fetch("https://api.post.ch/OAuth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const raw = await resp.text();
    let json: Record<string, unknown>;
    try {
      json = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      return jsonResponse(
        { error: "Réponse OAuth La Poste invalide", details: raw.substring(0, 200) },
        { status: 502 },
      );
    }

    if (!resp.ok || !json.access_token) {
      return jsonResponse(
        {
          error: "Impossible d'obtenir le token La Poste",
          details: json.error_description ?? json.error ?? raw,
        },
        { status: 500 },
      );
    }

    return jsonResponse({
      access_token: String(json.access_token),
      expires_in: typeof json.expires_in === "number" ? json.expires_in : null,
      token_type: json.token_type ?? "Bearer",
    });
  } catch (e) {
    return jsonResponse(
      {
        error: "Erreur get-post-token",
        details: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
});
