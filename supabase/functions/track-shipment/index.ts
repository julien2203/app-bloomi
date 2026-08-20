import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

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

function extractBearerOrKey(raw: string | null): string {
  if (!raw) return "";
  return raw.replace(/^Bearer\s+/i, "").trim();
}

function isAuthorizedCronOrServiceRole(req: Request, serviceRoleKey: string): boolean {
  const expected = serviceRoleKey.trim();
  if (!expected) return false;

  const candidates = [
    extractBearerOrKey(req.headers.get("Authorization")),
    extractBearerOrKey(req.headers.get("apikey")),
  ];
  if (candidates.some((token) => token === expected)) return true;

  const cronSecret = Deno.env.get("CRON_SECRET");
  const cronHeader = req.headers.get("x-cron-secret");
  if (cronSecret && cronHeader === cronSecret) return true;

  return false;
}

async function getPostAccessToken(params: {
  clientId: string;
  clientSecret: string;
}): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: params.clientId,
    client_secret: params.clientSecret,
    scope: "DCAPI_BARCODE_READ",
  });

  const resp = await fetch("https://api.post.ch/OAuth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const json = (await resp.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!resp.ok || !json.access_token) {
    const detail = json.error_description || json.error || "OAuth token request failed";
    throw new Error(`La Poste OAuth: ${detail}`);
  }

  return json.access_token;
}

type TrackingResult = {
  status: string;
  date: string | null;
  description: string;
  tracking_number: string;
  delivered: boolean;
  raw?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function pickString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

function pickDate(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v !== "string" || !v.trim()) continue;
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
    return v.trim();
  }
  return null;
}

function firstEvent(payload: Record<string, unknown>): Record<string, unknown> | null {
  const candidates = [
    payload.events,
    payload.eventList,
    payload.statuses,
    payload.statusHistory,
    asRecord(payload.consignment)?.events,
    asRecord(payload.item)?.events,
    Array.isArray(payload.consignment)
      ? asRecord((payload.consignment as unknown[])[0])?.events
      : null,
  ];

  for (const list of candidates) {
    if (!Array.isArray(list) || list.length === 0) continue;
    const last = asRecord(list[list.length - 1]);
    const first = asRecord(list[0]);
    const lastTs = pickDate(
      last?.timestamp,
      last?.eventTimestamp,
      last?.date,
      last?.eventDate,
      last?.time,
    );
    const firstTs = pickDate(
      first?.timestamp,
      first?.eventTimestamp,
      first?.date,
      first?.eventDate,
      first?.time,
    );
    if (lastTs && firstTs) {
      return new Date(lastTs).getTime() >= new Date(firstTs).getTime() ? last : first;
    }
    return last ?? first;
  }
  return null;
}

/** Détecte un statut « livré » (FR / EN / DE / IT + codes courants). */
function isDeliveredStatus(...parts: Array<string | null | undefined>): boolean {
  const haystack = parts
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");

  if (!haystack) return false;

  const needles = [
    "livre",
    "livree",
    "delivered",
    "delivery completed",
    "zugestellt",
    "abgeliefert",
    "consegnat",
    "consegnata",
    "remis au destinataire",
    "handed over",
  ];
  if (needles.some((n) => haystack.includes(n))) return true;

  const tokens = new Set(haystack.split(/[^a-z0-9]+/g).filter(Boolean));
  return tokens.has("delivered") || tokens.has("livre") || tokens.has("b06");
}

function normalizeTrackingPayload(
  trackingNumber: string,
  payload: unknown,
): TrackingResult {
  const root = asRecord(payload) ?? {};
  const consignment = Array.isArray(root.consignment)
    ? asRecord(root.consignment[0])
    : asRecord(root.consignment);
  const item = asRecord(root.item) ?? consignment ?? root;
  const event = firstEvent(root) ?? firstEvent(item ?? {}) ?? null;

  const status =
    pickString(
      root.status,
      root.deliveryStatus,
      root.shipmentStatus,
      item?.status,
      item?.deliveryStatus,
      event?.status,
      event?.eventCode,
      event?.code,
      event?.eventName,
      event?.name,
    ) ?? "unknown";

  const description =
    pickString(
      root.description,
      root.statusDescription,
      root.statusText,
      root.message,
      item?.description,
      item?.statusDescription,
      item?.statusText,
      event?.description,
      event?.eventDescription,
      event?.statusDescription,
      event?.eventName,
      event?.name,
      event?.text,
    ) ?? status;

  const date = pickDate(
    root.timestamp,
    root.statusTimestamp,
    root.lastUpdate,
    root.updatedAt,
    item?.timestamp,
    item?.statusTimestamp,
    item?.lastUpdate,
    event?.timestamp,
    event?.eventTimestamp,
    event?.date,
    event?.eventDate,
    event?.time,
  );

  const delivered = isDeliveredStatus(status, description);

  return {
    status,
    date,
    description,
    tracking_number: trackingNumber,
    delivered,
    raw: payload,
  };
}

const TRACKING_URLS = [
  (code: string) =>
    `https://api.post.ch/api/barcode/v1/trackingStatus/${encodeURIComponent(code)}`,
  (code: string) =>
    `https://dcapi.apis.post.ch/barcode/v1/trackingStatus/${encodeURIComponent(code)}`,
];

async function fetchTrackingStatus(params: {
  accessToken: string;
  trackingNumber: string;
}): Promise<{ ok: boolean; status: number; body: unknown; url: string }> {
  let last: { ok: boolean; status: number; body: unknown; url: string } | null = null;

  for (const buildUrl of TRACKING_URLS) {
    const url = buildUrl(params.trackingNumber);
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        Accept: "application/json",
        "Accept-Language": "fr",
      },
    });

    const rawText = await resp.text();
    let body: unknown = rawText;
    try {
      body = rawText ? JSON.parse(rawText) : null;
    } catch {
      body = { error: "non_json_response", preview: rawText.slice(0, 240) };
    }

    last = { ok: resp.ok, status: resp.status, body, url };
    if (resp.ok) return last;
    if (resp.status !== 404 && resp.status !== 405) break;
  }

  return last ?? {
    ok: false,
    status: 502,
    body: { error: "no_response" },
    url: "",
  };
}

async function markOrderDeliveredIfShipped(
  supabaseAdmin: SupabaseClient,
  trackingNumber: string,
): Promise<{ updated: boolean; error?: string }> {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .update({
      status: "completed",
      delivered_at: new Date().toISOString(),
    })
    .eq("tracking_number", trackingNumber)
    .eq("status", "shipped")
    .select("id");

  if (error) {
    return { updated: false, error: error.message };
  }
  return { updated: Array.isArray(data) && data.length > 0 };
}

async function trackOne(params: {
  supabaseAdmin: SupabaseClient;
  accessToken: string;
  trackingNumber: string;
}): Promise<{
  success: boolean;
  tracking_number: string;
  status?: string;
  date?: string | null;
  description?: string;
  delivered?: boolean;
  order_updated?: boolean;
  error?: string;
  details?: unknown;
}> {
  const tracked = await fetchTrackingStatus({
    accessToken: params.accessToken,
    trackingNumber: params.trackingNumber,
  });

  if (!tracked.ok) {
    return {
      success: false,
      tracking_number: params.trackingNumber,
      error: "Impossible de récupérer le suivi La Poste",
      details: tracked.body,
    };
  }

  const normalized = normalizeTrackingPayload(params.trackingNumber, tracked.body);
  let orderUpdated = false;

  if (normalized.delivered) {
    const mark = await markOrderDeliveredIfShipped(
      params.supabaseAdmin,
      params.trackingNumber,
    );
    if (mark.error) {
      return {
        success: false,
        tracking_number: params.trackingNumber,
        status: normalized.status,
        date: normalized.date,
        description: normalized.description,
        delivered: true,
        error: "Suivi OK mais mise à jour commande échouée",
        details: mark.error,
      };
    }
    orderUpdated = mark.updated;
  }

  return {
    success: true,
    tracking_number: params.trackingNumber,
    status: normalized.status,
    date: normalized.date,
    description: normalized.description,
    delivered: normalized.delivered,
    order_updated: orderUpdated,
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const postClientId = Deno.env.get("POST_CH_CLIENT_ID");
  const postClientSecret = Deno.env.get("POST_CH_CLIENT_SECRET");

  if (
    !supabaseUrl ||
    !supabaseAnonKey ||
    !supabaseServiceRoleKey ||
    !postClientId ||
    !postClientSecret
  ) {
    return jsonResponse({ error: "Configuration manquante côté serveur" }, { status: 500 });
  }

  const isCron = isAuthorizedCronOrServiceRole(req, supabaseServiceRoleKey);
  const authHeader = normalizeAuthHeader(req);

  let body: Record<string, unknown> = {};
  try {
    const parsed = await req.json();
    if (parsed && typeof parsed === "object") {
      body = parsed as Record<string, unknown>;
    }
  } catch {
    // Cron may send empty body — only reject for non-cron callers below.
    if (!isCron) {
      return jsonResponse({ error: "Body JSON invalide" }, { status: 400 });
    }
  }

  const mode = String(body.mode ?? "").trim().toLowerCase();
  const wantsBatch =
    isCron && (mode === "cron" || mode === "batch" || !String(body.tracking_number ?? "").trim());

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

  // ---- Batch / cron : toutes les commandes shipped avec tracking ----
  if (wantsBatch) {
    try {
      const { data: orders, error: ordersErr } = await supabaseAdmin
        .from("orders")
        .select("id, tracking_number, status")
        .eq("status", "shipped")
        .not("tracking_number", "is", null);

      if (ordersErr) {
        return jsonResponse(
          { error: "Impossible de charger les commandes shipped", details: ordersErr.message },
          { status: 500 },
        );
      }

      const rows = (orders ?? []).filter((o) => String(o.tracking_number ?? "").trim());
      if (rows.length === 0) {
        return jsonResponse({ success: true, processed: 0, results: [] });
      }

      const accessToken = await getPostAccessToken({
        clientId: postClientId,
        clientSecret: postClientSecret,
      });

      const results: Array<Record<string, unknown>> = [];
      for (const row of rows) {
        const tn = String(row.tracking_number).trim();
        const outcome = await trackOne({
          supabaseAdmin,
          accessToken,
          trackingNumber: tn,
        });
        results.push({ order_id: row.id, ...outcome });
      }

      return jsonResponse({
        success: true,
        processed: results.length,
        delivered_count: results.filter((r) => r.delivered === true).length,
        updated_count: results.filter((r) => r.order_updated === true).length,
        results,
      });
    } catch (e) {
      return jsonResponse(
        {
          error: "Erreur track-shipment (cron)",
          details: e instanceof Error ? e.message : String(e),
        },
        { status: 500 },
      );
    }
  }

  // ---- Appel unitaire (acheteur / vendeur) ----
  if (!authHeader) {
    return jsonResponse({ error: "Non authentifié" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const jwt = authHeader.slice("Bearer ".length);
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(jwt);
  if (authError || !authData?.user) {
    // Service role already handled above for batch; here we need a user JWT.
    if (isCron) {
      return jsonResponse({ error: "tracking_number requis hors mode cron" }, { status: 400 });
    }
    return jsonResponse({ error: "JWT Supabase invalide" }, { status: 401 });
  }

  const trackingNumber = String(body.tracking_number ?? "").trim();
  if (!trackingNumber) {
    return jsonResponse({ error: "tracking_number est requis" }, { status: 400 });
  }

  const orderId = typeof body.order_id === "string" ? body.order_id.trim() : "";
  if (orderId) {
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, buyer_id, seller_id, tracking_number")
      .eq("id", orderId)
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
    const uid = authData.user.id;
    if (order.buyer_id !== uid && order.seller_id !== uid) {
      return jsonResponse({ error: "Accès refusé à cette commande" }, { status: 403 });
    }
    const orderTn = String(order.tracking_number ?? "").trim();
    if (orderTn && orderTn !== trackingNumber) {
      return jsonResponse(
        { error: "Le numéro de suivi ne correspond pas à la commande" },
        { status: 400 },
      );
    }
  }

  try {
    const accessToken = await getPostAccessToken({
      clientId: postClientId,
      clientSecret: postClientSecret,
    });

    const outcome = await trackOne({
      supabaseAdmin,
      accessToken,
      trackingNumber,
    });

    if (!outcome.success) {
      return jsonResponse(
        {
          error: outcome.error ?? "Erreur track-shipment",
          details: outcome.details,
        },
        { status: 502 },
      );
    }

    return jsonResponse({
      success: true,
      status: outcome.status,
      date: outcome.date,
      description: outcome.description,
      tracking_number: outcome.tracking_number,
      delivered: outcome.delivered === true,
      order_updated: outcome.order_updated === true,
    });
  } catch (e) {
    return jsonResponse(
      {
        error: "Erreur track-shipment",
        details: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
});
