import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { isAuthorizedCronOrServiceRole } from "../_shared/cronAuth.ts";
import { notifyUser } from "../_shared/notifyUser.ts";
import {
  fetchRecipientLanguage,
  parcelDeliveredPushText,
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

function normalizeAuthHeader(req: Request): string | null {
  const h = req.headers.get("Authorization");
  if (!h) return null;
  if (!h.toLowerCase().startsWith("bearer ")) return null;
  return h;
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

  // Payload ekp-web (API publique site La Poste)
  const globalStatus = pickString(root.globalStatus);
  const productStatus = pickString(root.status);
  const eosEvents = Array.isArray(root.events) ? root.events : [];
  const lastEos = asRecord(eosEvents[eosEvents.length - 1] ?? null);

  const status =
    globalStatus ??
    pickString(
      root.deliveryStatus,
      root.shipmentStatus,
      productStatus,
      item?.status,
      item?.deliveryStatus,
      event?.status,
      event?.eventCode,
      event?.code,
      event?.eventName,
      event?.name,
      lastEos?.Status,
    ) ??
    "unknown";

  const description =
    pickString(
      root.description,
      root.statusDescription,
      root.statusText,
      root.message,
      globalStatus ? GLOBAL_STATUS_FR[globalStatus] : null,
      lastEos?.Description,
      lastEos?.FullDescription,
      item?.description,
      item?.statusDescription,
      item?.statusText,
      event?.description,
      event?.eventDescription,
      event?.statusDescription,
      event?.eventName,
      event?.name,
      event?.text,
      productStatus,
    ) ?? status;

  const date = pickDate(
    root.lastEventDateTime,
    root.deliveryDate,
    root.calculatedDeliveryDate,
    root.creationDateTime,
    root.timestamp,
    root.statusTimestamp,
    root.lastUpdate,
    root.updatedAt,
    lastEos?.TimeStamp,
    item?.timestamp,
    item?.statusTimestamp,
    item?.lastUpdate,
    event?.timestamp,
    event?.eventTimestamp,
    event?.date,
    event?.eventDate,
    event?.time,
  );

  const delivered =
    root.delivered === true ||
    String(globalStatus ?? "").toUpperCase() === "DELIVERED" ||
    isDeliveredStatus(status, description);

  return {
    status,
    date,
    description,
    tracking_number:
      pickString(root.shipmentNumber, root.identCode, trackingNumber) ?? trackingNumber,
    delivered,
    raw: payload,
  };
}

const EKP_USER_URL = "https://service.post.ch/ekp-web/api/user";
const EKP_HISTORY_URL = "https://service.post.ch/ekp-web/api/history";
const EKP_REFERER = "https://service.post.ch/ekp-web/ui/";
const EOS_HISTORY_URL = "https://eosapi.postlogistics.ch/api/trackandtrace/public";
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const GLOBAL_STATUS_FR: Record<string, string> = {
  REGISTERED: "Enregistré",
  REPORTED: "Annoncé (données transmises)",
  CUSTOMS: "En douane",
  TO_BE_DELIVERED: "En cours d’acheminement",
  IN_DELIVERY: "En distribution",
  DELIVERED: "Livré",
  MISSED_DELIVERY: "Livraison manquée",
  NOT_DELIVERED: "Non livré",
  RETURNED: "Retourné à l’expéditeur",
};

function cookieHeaderFromSetCookie(setCookie: string | null): string {
  if (!setCookie) return "";
  // Deno/fetch may join multiple Set-Cookie with ", " — keep name=value only.
  return setCookie
    .split(/,(?=\s*[^;=]+=)/)
    .map((part) => part.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

async function fetchEosEvents(trackingNumber: string): Promise<Array<Record<string, unknown>>> {
  try {
    const resp = await fetch(`${EOS_HISTORY_URL}?culture=fr-FR`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": BROWSER_UA,
        Origin: "https://tracking.postlogistics.ch",
        Referer: "https://tracking.postlogistics.ch/",
      },
      body: JSON.stringify({ Identifier: trackingNumber }),
    });
    if (!resp.ok) return [];
    const json = (await resp.json()) as {
      Data?: Array<{ History?: Array<Record<string, unknown>> }>;
    };
    const history = json.Data?.[0]?.History;
    return Array.isArray(history) ? history : [];
  } catch {
    return [];
  }
}

/**
 * Suivi public La Poste (même API que le site consommateur) — pas l’API Barcode.
 * Flow : GET /api/user → POST /api/history → GET /api/history/not-included/{hash}
 * + timeline optionnelle via eosapi.postlogistics.ch
 */
async function fetchTrackingStatus(params: {
  trackingNumber: string;
}): Promise<{ ok: boolean; status: number; body: unknown; url: string }> {
  const code = params.trackingNumber.trim();
  const baseHeaders = {
    Accept: "application/json",
    "User-Agent": BROWSER_UA,
    Referer: EKP_REFERER,
  };

  try {
    const userResp = await fetch(EKP_USER_URL, { method: "GET", headers: baseHeaders });
    if (!userResp.ok) {
      return {
        ok: false,
        status: userResp.status,
        body: { error: "ekp_user_failed", detail: await userResp.text() },
        url: EKP_USER_URL,
      };
    }
    const userJson = (await userResp.json()) as { userIdentifier?: string };
    const userId = userJson.userIdentifier;
    const csrf =
      userResp.headers.get("X-CSRF-TOKEN") ??
      userResp.headers.get("x-csrf-token") ??
      "";
    const cookie = cookieHeaderFromSetCookie(userResp.headers.get("set-cookie"));
    if (!userId || !csrf) {
      return {
        ok: false,
        status: 502,
        body: { error: "ekp_session_incomplete", userId: Boolean(userId), csrf: Boolean(csrf) },
        url: EKP_USER_URL,
      };
    }

    const sessionHeaders: Record<string, string> = {
      ...baseHeaders,
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": csrf,
    };
    if (cookie) sessionHeaders.Cookie = cookie;

    const historyUrl = `${EKP_HISTORY_URL}?userId=${encodeURIComponent(userId)}`;
    const regResp = await fetch(historyUrl, {
      method: "POST",
      headers: sessionHeaders,
      body: JSON.stringify({ searchQuery: code }),
    });
    const regSetCookie = cookieHeaderFromSetCookie(regResp.headers.get("set-cookie"));
    if (regSetCookie) {
      sessionHeaders.Cookie = [cookie, regSetCookie].filter(Boolean).join("; ");
    }
    if (!regResp.ok) {
      return {
        ok: false,
        status: regResp.status,
        body: { error: "ekp_history_register_failed", detail: await regResp.text() },
        url: historyUrl,
      };
    }
    const regJson = (await regResp.json()) as { hash?: string };
    const digest = regJson.hash;
    if (!digest) {
      return {
        ok: false,
        status: 502,
        body: { error: "ekp_history_no_hash", detail: regJson },
        url: historyUrl,
      };
    }

    const itemUrl =
      `https://service.post.ch/ekp-web/api/history/not-included/${encodeURIComponent(digest)}` +
      `?userId=${encodeURIComponent(userId)}`;
    const itemResp = await fetch(itemUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": BROWSER_UA,
        Referer: EKP_REFERER,
        Cookie: sessionHeaders.Cookie ?? cookie,
      },
    });
    if (!itemResp.ok) {
      // Fallback : timeline publique seule
      const events = await fetchEosEvents(code);
      if (events.length > 0) {
        const last = events[events.length - 1] ?? {};
        return {
          ok: true,
          status: 200,
          url: EOS_HISTORY_URL,
          body: {
            source: "eos",
            shipmentNumber: code,
            globalStatus: typeof last.Status === "string" ? last.Status : "UNKNOWN",
            status: typeof last.Status === "string" ? last.Status : null,
            lastEventDateTime: typeof last.TimeStamp === "string" ? last.TimeStamp : null,
            description:
              (typeof last.Description === "string" && last.Description) ||
              (typeof last.FullDescription === "string" && last.FullDescription) ||
              null,
            events,
            delivered: false,
          },
        };
      }
      return {
        ok: false,
        status: itemResp.status,
        body: { error: "ekp_history_item_failed", detail: await itemResp.text() },
        url: itemUrl,
      };
    }

    const shipments = (await itemResp.json()) as unknown;
    const list = Array.isArray(shipments) ? shipments : [];
    const shipment = (list[0] ?? null) as Record<string, unknown> | null;
    if (!shipment) {
      return {
        ok: false,
        status: 404,
        body: { error: "tracking_not_found", tracking_number: code },
        url: itemUrl,
      };
    }

    const events = await fetchEosEvents(code);
    const lastEvent = events.length > 0 ? events[events.length - 1] : null;

    return {
      ok: true,
      status: 200,
      url: itemUrl,
      body: {
        source: "ekp",
        ...shipment,
        events,
        description:
          (lastEvent && typeof lastEvent.Description === "string" && lastEvent.Description) ||
          (typeof shipment.globalStatus === "string" &&
            (GLOBAL_STATUS_FR[shipment.globalStatus] ?? shipment.globalStatus)) ||
          null,
      },
    };
  } catch (e) {
    return {
      ok: false,
      status: 502,
      body: {
        error: "ekp_fetch_failed",
        details: e instanceof Error ? e.message : String(e),
      },
      url: EKP_HISTORY_URL,
    };
  }
}

async function persistCarrierSnapshot(
  supabaseAdmin: SupabaseClient,
  params: {
    trackingNumber: string;
    orderId?: string | null;
    status: string;
    description: string;
    date: string | null;
  },
): Promise<void> {
  const checkedAt = new Date().toISOString();
  const patch = {
    carrier_status: params.status.slice(0, 120),
    carrier_status_description: params.description.slice(0, 500),
    carrier_status_at: params.date,
    carrier_tracking_checked_at: checkedAt,
  };

  try {
    let query = supabaseAdmin.from("orders").update(patch);
    if (params.orderId) {
      query = query.eq("id", params.orderId);
    } else {
      query = query.eq("tracking_number", params.trackingNumber);
    }
    const { error } = await query;
    if (error) {
      // Colonnes absentes tant que le SQL scripts/supabase-order-carrier-tracking.sql n’a pas été exécuté.
      console.warn("persistCarrierSnapshot:", error.message);
    }
  } catch (e) {
    console.warn(
      "persistCarrierSnapshot failed:",
      e instanceof Error ? e.message : String(e),
    );
  }
}

async function markOrderDeliveredIfShipped(
  supabaseAdmin: SupabaseClient,
  trackingNumber: string,
): Promise<{
  updated: boolean;
  error?: string;
  order?: { id: string; buyer_id: string; listing_title: string | null };
}> {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .update({
      delivered_at: new Date().toISOString(),
    })
    .eq("tracking_number", trackingNumber)
    .eq("status", "shipped")
    .is("delivered_at", null)
    .select("id, buyer_id, listing_title")
    .maybeSingle();

  if (error) {
    return { updated: false, error: error.message };
  }
  if (!data) return { updated: false };
  return {
    updated: true,
    order: {
      id: String((data as { id: string }).id),
      buyer_id: String((data as { buyer_id: string }).buyer_id),
      listing_title: (data as { listing_title?: string | null }).listing_title ?? null,
    },
  };
}

async function trackOne(params: {
  supabaseAdmin: SupabaseClient;
  trackingNumber: string;
  orderId?: string | null;
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  /** @deprecated OAuth barcode inutile pour le suivi public */
  accessToken?: string;
}): Promise<{
  success: boolean;
  tracking_number: string;
  status?: string;
  date?: string | null;
  description?: string;
  delivered?: boolean;
  order_updated?: boolean;
  checked_at?: string;
  error?: string;
  details?: unknown;
}> {
  const tracked = await fetchTrackingStatus({
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
  const checkedAt = new Date().toISOString();
  await persistCarrierSnapshot(params.supabaseAdmin, {
    trackingNumber: params.trackingNumber,
    orderId: params.orderId,
    status: normalized.status,
    description: normalized.description,
    date: normalized.date,
  });

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
    if (
      mark.updated &&
      mark.order &&
      params.supabaseUrl &&
      params.supabaseServiceRoleKey
    ) {
      try {
        const buyerLang = await fetchRecipientLanguage(
          params.supabaseAdmin,
          mark.order.buyer_id,
        );
        const push = parcelDeliveredPushText(buyerLang);
        await notifyUser({
          supabaseAdmin: params.supabaseAdmin,
          supabaseUrl: params.supabaseUrl,
          supabaseServiceRoleKey: params.supabaseServiceRoleKey,
          userId: mark.order.buyer_id,
          templateKey: "parcel_delivered",
          entityId: mark.order.id,
          variables: {
            listingTitle: String(mark.order.listing_title ?? ""),
            orderId: mark.order.id,
          },
          push: {
            title: push.title,
            body: push.body,
            data: {
              order_id: mark.order.id,
              notification_type: "new_items",
            },
          },
        });
      } catch (e) {
        console.warn("parcel_delivered notify failed:", mark.order.id, e);
      }
    }
  }

  return {
    success: true,
    tracking_number: params.trackingNumber,
    status: normalized.status,
    date: normalized.date,
    description: normalized.description,
    delivered: normalized.delivered,
    order_updated: orderUpdated,
    checked_at: checkedAt,
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  // POST_CH_* plus nécessaires pour le suivi (API publique ekp-web). Conservés si présents.

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
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
  const bodyOrderId = typeof body.order_id === "string" ? body.order_id.trim() : "";
  const bodyTracking = String(body.tracking_number ?? "").trim();
  const wantsBatch =
    isCron &&
    (mode === "cron" || mode === "batch" || (!bodyTracking && !bodyOrderId));

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

  // ---- Admin / cron unitaire (service_role) : une commande ----
  if (isCron && (bodyOrderId || bodyTracking) && !wantsBatch) {
    try {
      let trackingNumber = bodyTracking;
      let orderId = bodyOrderId || null;

      if (orderId) {
        const { data: order, error: orderError } = await supabaseAdmin
          .from("orders")
          .select("id, tracking_number")
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
        const orderTn = String(order.tracking_number ?? "").trim();
        if (!orderTn) {
          return jsonResponse(
            { error: "Cette commande n’a pas de numéro de suivi" },
            { status: 400 },
          );
        }
        if (trackingNumber && trackingNumber !== orderTn) {
          return jsonResponse(
            { error: "Le numéro de suivi ne correspond pas à la commande" },
            { status: 400 },
          );
        }
        trackingNumber = orderTn;
      }

      if (!trackingNumber) {
        return jsonResponse({ error: "tracking_number ou order_id requis" }, { status: 400 });
      }

      const outcome = await trackOne({
        supabaseAdmin,
        trackingNumber,
        orderId,
        supabaseUrl,
        supabaseServiceRoleKey,
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
        checked_at: outcome.checked_at ?? new Date().toISOString(),
      });
    } catch (e) {
      return jsonResponse(
        {
          error: "Erreur track-shipment (admin)",
          details: e instanceof Error ? e.message : String(e),
        },
        { status: 500 },
      );
    }
  }

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

      const results: Array<Record<string, unknown>> = [];
      for (const row of rows) {
        const tn = String(row.tracking_number).trim();
        const outcome = await trackOne({
          supabaseAdmin,
          trackingNumber: tn,
          orderId: String(row.id),
          supabaseUrl,
          supabaseServiceRoleKey,
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
    const outcome = await trackOne({
      supabaseAdmin,
      trackingNumber,
      orderId: orderId || null,
      supabaseUrl,
      supabaseServiceRoleKey,
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
