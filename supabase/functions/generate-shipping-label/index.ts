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

type AddressInput = {
  name: string;
  street: string;
  zip: string;
  city: string;
  country: string;
};

function toAddress(prefix: "sender" | "recipient", body: Record<string, unknown>): AddressInput {
  return {
    name: String(body[`${prefix}_name`] ?? "").trim(),
    street: String(body[`${prefix}_street`] ?? "").trim(),
    zip: String(body[`${prefix}_zip`] ?? "").trim(),
    city: String(body[`${prefix}_city`] ?? "").trim(),
    country: String(body[`${prefix}_country`] ?? "").trim().toUpperCase(),
  };
}

function assertRequiredAddress(label: string, a: AddressInput): string | null {
  if (!a.name) return `${label}_name est requis`;
  if (!a.street) return `${label}_street est requis`;
  if (!a.zip) return `${label}_zip est requis`;
  if (!a.city) return `${label}_city est requis`;
  if (!a.country) return `${label}_country est requis`;
  return null;
}

/** Rue + numéro séparés (format attendu par l'API Barcode pour recipient). */
function splitStreetAndHouseNo(fullStreet: string): { street: string; houseNo: string } {
  const t = fullStreet.trim();
  const m = t.match(/^(.+?)\s+(\d+[a-zA-Z]?)$/u);
  if (m) {
    return { street: m[1].trim(), houseNo: m[2].trim() };
  }
  return { street: t, houseNo: "–" };
}

/**
 * URL officielle Barcode (Digital Commerce API) — cf. developer.post.ch.
 * L’hôte api.post.ch/api/barcode/… renvoie souvent du HTML (mauvaise route / portail).
 */
const LA_POSTE_GENERATE_LABEL_URL = "https://dcapi.apis.post.ch/barcode/v1/generateAddressLabel";

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

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const postClientId = Deno.env.get("POST_CH_CLIENT_ID");
  const postClientSecret = Deno.env.get("POST_CH_CLIENT_SECRET");
  const postLicence = Deno.env.get("POST_CH_LICENCE");

  if (
    !supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey ||
    !postClientId || !postClientSecret || !postLicence
  ) {
    return jsonResponse(
      { error: "Configuration manquante côté serveur" },
      { status: 500 },
    );
  }

  const authHeader = normalizeAuthHeader(req);
  if (!authHeader) {
    return jsonResponse({ error: "Non authentifié" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

  const token = authHeader.slice("Bearer ".length);
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) {
    return jsonResponse({ error: "JWT Supabase invalide" }, { status: 401 });
  }

  console.log("Auth OK, user:", authData.user.id);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "Body JSON invalide" }, { status: 400 });
  }

  const order_id = String(body.order_id ?? "").trim();
  if (!order_id) {
    return jsonResponse({ error: "order_id est requis" }, { status: 400 });
  }

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, buyer_id, seller_id")
    .eq("id", order_id)
    .maybeSingle();

  if (orderErr) {
    return jsonResponse(
      { error: "Impossible de charger la commande", details: orderErr.message },
      { status: 500 },
    );
  }
  if (!order) {
    return jsonResponse({ error: "Commande introuvable" }, { status: 404 });
  }

  console.log("Order:", JSON.stringify(order));

  const sender = toAddress("sender", body);
  const recipient = toAddress("recipient", body);

  const senderErr = assertRequiredAddress("sender", sender);
  if (senderErr) return jsonResponse({ error: senderErr }, { status: 400 });
  const recipientErr = assertRequiredAddress("recipient", recipient);
  if (recipientErr) return jsonResponse({ error: recipientErr }, { status: 400 });

  console.log("Sender:", JSON.stringify(sender), "Recipient:", JSON.stringify(recipient));

  const weightRaw = body.weight;
  const parsedWeight = typeof weightRaw === "number" ? weightRaw : Number(weightRaw ?? 500);
  const weight = Number.isFinite(parsedWeight) && parsedWeight > 0 ? Math.round(parsedWeight) : 500;

  const uid = authData.user.id;
  const buyerId = String((order as any).buyer_id ?? "");
  const sellerId = String((order as any).seller_id ?? "");
  if (uid !== buyerId && uid !== sellerId) {
    return jsonResponse({ error: "Accès refusé pour cette commande" }, { status: 403 });
  }

  const recipientParts = splitStreetAndHouseNo(recipient.street);

  try {
    const accessToken = await getPostAccessToken({
      clientId: postClientId,
      clientSecret: postClientSecret,
    });

    console.log("Post token obtained");

    // Corps conforme à la doc Post (Digital Commerce API) — generateAddressLabel
    const postBody = {
      language: "FR",
      frankingLicense: postLicence,
      ppFranking: false,
      customer: {
        name1: sender.name,
        street: sender.street,
        zip: sender.zip,
        city: sender.city,
        country: sender.country,
      },
      labelDefinition: {
        labelLayout: "A6",
        printAddresses: "RECIPIENT_AND_CUSTOMER",
        imageFileType: "PDF",
        imageResolution: 300,
        printPreview: true,
      },
      item: {
        itemID: order_id.replace(/-/g, "").slice(0, 35),
        recipient: {
          name1: recipient.name,
          street: recipientParts.street,
          houseNo: recipientParts.houseNo,
          zip: recipient.zip,
          city: recipient.city,
          country: recipient.country,
        },
        attributes: {
          przl: ["PRI"],
          weight,
        },
      },
    };

    const labelResp = await fetch(LA_POSTE_GENERATE_LABEL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(postBody),
    });

    const rawText = await labelResp.text();
    console.log("La Poste raw response:", rawText.substring(0, 500));

    let labelJson: Record<string, unknown>;
    try {
      labelJson = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
    } catch {
      return jsonResponse(
        {
          error: "Réponse La Poste non JSON (endpoint ou corps de requête incorrect ?)",
          details: rawText.substring(0, 300),
          http_status: labelResp.status,
        },
        { status: 502 },
      );
    }

    if (!labelResp.ok) {
      return jsonResponse(
        {
          error: "Erreur La Poste lors de la génération de l'étiquette",
          details: labelJson,
          http_status: labelResp.status,
        },
        { status: 500 },
      );
    }

    // Réponse La Poste (generateAddressLabel) : { item: { itemID, identCode, label: [base64pdf] } }
    const item = labelJson.item as { identCode?: string; label?: string[] } | undefined;
    const label_pdf_base64 = item?.label?.[0] ?? null;
    const tracking_number = item?.identCode ?? null;

    const label_url: string | null = null;

    if (tracking_number) {
      const { error: updateErr } = await supabaseAdmin
        .from("orders")
        .update({ tracking_number })
        .eq("id", order_id);

      if (updateErr) {
        return jsonResponse(
          {
            error: "Étiquette générée mais impossible de mettre à jour tracking_number",
            details: updateErr.message,
            tracking_number,
            raw: labelJson,
          },
          { status: 500 },
        );
      }
    }

    return jsonResponse({
      success: true,
      order_id,
      tracking_number,
      label_pdf_base64,
      label_url,
      raw: labelJson,
    });
  } catch (e) {
    console.log("Error details:", e instanceof Error ? e.message : String(e));
    return jsonResponse(
      {
        error: "Erreur generate-shipping-label",
        details: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
});
