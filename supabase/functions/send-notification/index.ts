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

type RequestBody = {
  user_id?: unknown;
  title?: unknown;
  body?: unknown;
  data?: unknown;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse({ error: "Configuration manquante côté serveur" }, { status: 500 });
  }

  let parsed: RequestBody;
  try {
    parsed = (await req.json()) as RequestBody;
  } catch {
    return jsonResponse({ error: "Body JSON invalide" }, { status: 400 });
  }

  const user_id = typeof parsed.user_id === "string" ? parsed.user_id.trim() : "";
  const title = typeof parsed.title === "string" ? parsed.title : "";
  const body = typeof parsed.body === "string" ? parsed.body : "";
  const data = parsed.data as unknown;

  if (!user_id) {
    return jsonResponse({ error: "user_id est requis" }, { status: 400 });
  }
  if (!title) {
    return jsonResponse({ error: "title est requis" }, { status: 400 });
  }
  if (!body) {
    return jsonResponse({ error: "body est requis" }, { status: 400 });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("expo_push_token")
    .eq("id", user_id)
    .maybeSingle();

  if (profileError) {
    return jsonResponse(
      { error: "Impossible de charger le profil", details: profileError.message },
      { status: 500 },
    );
  }

  const token =
    profile && typeof (profile as any).expo_push_token === "string"
      ? String((profile as any).expo_push_token).trim()
      : "";

  if (token) {
    try {
      const expoResp = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: token,
          title,
          body,
          data: data ?? undefined,
          sound: "default",
        }),
      });

      const expoText = await expoResp.text().catch(() => "");
      if (!expoResp.ok) {
        return jsonResponse(
          { error: "Erreur API Expo", details: expoText || `${expoResp.status} ${expoResp.statusText}` },
          { status: 502 },
        );
      }

      // Expo peut répondre 200 avec un payload "error" (ex: InvalidCredentials, DeviceNotRegistered).
      try {
        const expoJson = expoText ? JSON.parse(expoText) : null;
        const first = (expoJson as any)?.data?.[0] ?? null;
        if (first && (first.status === "error" || first.message || first.details)) {
          return jsonResponse(
            { error: "Erreur push Expo", details: first.details ?? first.message ?? first },
            { status: 502 },
          );
        }
      } catch {
        // si non-JSON, on ignore
      }
    } catch (e) {
      return jsonResponse(
        { error: "Erreur appel API Expo", details: e instanceof Error ? e.message : String(e) },
        { status: 502 },
      );
    }
  }

  const { error: insertError } = await supabaseAdmin.from("notifications").insert({
    user_id,
    title,
    body,
    data: data ?? null,
  });

  if (insertError) {
    return jsonResponse(
      { error: "Impossible d'insérer la notification", details: insertError.message },
      { status: 500 },
    );
  }

  return jsonResponse({ success: true });
});

