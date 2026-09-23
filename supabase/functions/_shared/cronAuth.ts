/** Auth commune pour les Edge Functions appelées par pg_cron / service role. */

export function extractBearerOrKey(raw: string | null): string {
  if (!raw) return "";
  return raw.replace(/^Bearer\s+/i, "").trim();
}

/**
 * Accepte :
 * - Bearer / apikey égal à SUPABASE_SERVICE_ROLE_KEY
 * - JWT service_role du projet (même si la chaîne exacte a divergé après rotation)
 * - header x-cron-secret === CRON_SECRET
 */
export function isAuthorizedCronOrServiceRole(
  req: Request,
  serviceRoleKey: string,
  supabaseUrl?: string,
): boolean {
  const expected = serviceRoleKey.trim();
  const candidates = [
    extractBearerOrKey(req.headers.get("Authorization")),
    extractBearerOrKey(req.headers.get("apikey")),
    (req.headers.get("x-service-role-key") ?? "").trim(),
  ].filter(Boolean);

  if (expected) {
    if (candidates.some((token) => token === expected)) return true;
  }

  const url = (supabaseUrl ?? Deno.env.get("SUPABASE_URL") ?? "").trim();
  if (url) {
    for (const token of candidates) {
      if (isServiceRoleJwt(token, url)) return true;
    }
  }

  const cronSecret = Deno.env.get("CRON_SECRET")?.trim();
  const cronHeader = (req.headers.get("x-cron-secret") ?? "").trim();
  if (cronSecret && cronHeader && cronHeader === cronSecret) return true;

  return false;
}

function isServiceRoleJwt(token: string, supabaseUrl: string): boolean {
  try {
    const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
    const payloadPart = token.split(".")[1] ?? "";
    if (!payloadPart) return false;
    const padded = payloadPart + "=".repeat((4 - (payloadPart.length % 4)) % 4);
    const payload = JSON.parse(atob(padded.replace(/-/g, "+").replace(/_/g, "/")));
    return payload?.role === "service_role" && payload?.ref === projectRef;
  } catch {
    return false;
  }
}
