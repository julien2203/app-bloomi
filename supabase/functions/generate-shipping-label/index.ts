import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendResendEmail } from "../_shared/sendResendEmail.ts";
import {
  normalizeShippingLabelEmailLang,
  shippingLabelEmailContent,
} from "../_shared/shippingLabelEmail.ts";
import {
  labelReadyEmailCtaBlock,
  normalizeEmailLang,
} from "../_shared/transactionalEmailI18n.ts";
import { logTransactionalEmailSent } from "../_shared/transactionalEmailLog.ts";

import {
  findOrCreateThreadForOrderChat,
  insertThreadEventMessage,
} from "../_shared/orderChatSystemMessage.ts";
import {
  fetchRecipientLanguage,
  labelReadyBuyerPushText,
  labelReadySellerPushText,
} from "../_shared/pushNotificationI18n.ts";

const DEFAULT_RESEND_FROM = "Bloomi <contact@bloomi.ch>";

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

/** Caractères interdits par l'API Barcode La Poste (cf. OCA delivery_postlogistics). */
const POST_DISALLOWED_CHARS: Record<string, string> = {
  "|": "",
  "\\": "",
  "<": "",
  ">": "",
  "\u2018": "'",
  "\u2019": "'",
};

function sanitizePostField(value: string): string {
  let out = value.trim();
  for (const [char, repl] of Object.entries(POST_DISALLOWED_CHARS)) {
    out = out.split(char).join(repl);
  }
  return out;
}

/** Rue + numéro séparés (format attendu par l'API Barcode pour recipient). */
function splitStreetAndHouseNo(fullStreet: string): { street: string; houseNo: string } {
  const t = sanitizePostField(fullStreet);
  const m = t.match(/^(.+?)\s+(\d+[a-zA-Z]?)$/u);
  if (m) {
    return { street: m[1].trim(), houseNo: m[2].trim() };
  }
  return { street: t, houseNo: "" };
}

function buildItemNumber(orderId: string): string {
  const digits = orderId.replace(/\D/g, "");
  return `9${digits.slice(-7).padStart(7, "0")}`;
}

function formatDomicilePostOffice(zip: string, city: string): string {
  return `${zip.trim()} ${city.trim()}`.trim();
}

type PostLabelProfile = {
  przl: string[];
  weight: number;
  labelLayout: "A6" | "A7";
  /** Numéro colis (préfixe 9…) — invalide pour les lettres BMB / A+. */
  useParcelItemNumber: boolean;
  requiresDomesticCh: boolean;
  licenceEnvKey?: "POST_CH_LETTER_APLUS_LICENCE";
};

const POST_LABEL_PROFILES: Record<string, PostLabelProfile> = {
  letter_aplus: {
    przl: ["APLUS"],
    weight: 500,
    labelLayout: "A6",
    useParcelItemNumber: false,
    requiresDomesticCh: true,
    licenceEnvKey: "POST_CH_LETTER_APLUS_LICENCE",
  },
  small: {
    przl: ["PRI"],
    weight: 500,
    labelLayout: "A6",
    useParcelItemNumber: true,
    requiresDomesticCh: false,
  },
  large: {
    przl: ["PRI"],
    weight: 2000,
    labelLayout: "A6",
    useParcelItemNumber: true,
    requiresDomesticCh: false,
  },
  xlarge: {
    przl: ["PRI"],
    weight: 10000,
    labelLayout: "A6",
    useParcelItemNumber: true,
    requiresDomesticCh: false,
  },
};

function resolvePostLabelProfile(parcelSize: string): PostLabelProfile {
  return POST_LABEL_PROFILES[parcelSize] ?? POST_LABEL_PROFILES.small;
}

function resolveFrankingLicense(
  env: {
    defaultLicence: string | undefined;
    letterAplusLicence: string | undefined;
  },
  labelProfile: PostLabelProfile,
): string | null {
  if (labelProfile.licenceEnvKey === "POST_CH_LETTER_APLUS_LICENCE") {
    const dedicated = env.letterAplusLicence?.trim() ?? "";
    if (dedicated) return dedicated;
  }
  const fallback = env.defaultLicence?.trim() ?? "";
  return fallback || null;
}

function extractPostItemWarnings(item: Record<string, unknown> | undefined): string[] {
  if (!item) return [];
  const warnings = item.warnings;
  if (!Array.isArray(warnings)) return [];
  return warnings
    .map((entry) => {
      if (entry && typeof entry === "object") {
        const row = entry as { code?: unknown; message?: unknown };
        const code = row.code != null ? String(row.code).trim() : "";
        const message = row.message != null ? String(row.message).trim() : "";
        return [code, message].filter(Boolean).join(": ");
      }
      return String(entry ?? "").trim();
    })
    .filter(Boolean);
}

function extractPostItemErrors(item: Record<string, unknown> | undefined): string[] {
  if (!item) return [];
  const errors = item.errors;
  if (!Array.isArray(errors)) return [];
  return errors
    .map((entry) => {
      if (entry && typeof entry === "object") {
        const row = entry as { code?: unknown; message?: unknown };
        const code = row.code != null ? String(row.code).trim() : "";
        const message = row.message != null ? String(row.message).trim() : "";
        return [code, message].filter(Boolean).join(": ");
      }
      return String(entry ?? "").trim();
    })
    .filter(Boolean);
}

/** PDF base64 renvoyé par La Poste (`item.label` = string ou string[]). */
function extractLabelPdfBase64(labelJson: Record<string, unknown>): string | null {
  const item = labelJson.item as Record<string, unknown> | undefined;
  if (!item) return null;

  const rawLabel = item.label;
  if (typeof rawLabel === "string" && rawLabel.trim()) {
    return rawLabel.trim();
  }
  if (Array.isArray(rawLabel)) {
    for (const entry of rawLabel) {
      if (typeof entry === "string" && entry.trim()) {
        return entry.trim();
      }
    }
  }
  return null;
}

function extractTrackingNumber(labelJson: Record<string, unknown>): string | null {
  const item = labelJson.item as { identCode?: unknown } | undefined;
  const code = item?.identCode;
  return code != null && String(code).trim() ? String(code).trim() : null;
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
  const postLetterAplusLicence = Deno.env.get("POST_CH_LETTER_APLUS_LICENCE");

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
    .select("id, buyer_id, seller_id, listing_id, parcel_size, listing_title")
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
  const senderSanitized: AddressInput = {
    name: sanitizePostField(sender.name),
    street: sanitizePostField(sender.street),
    zip: sanitizePostField(sender.zip),
    city: sanitizePostField(sender.city),
    country: sender.country,
  };
  const recipientSanitized: AddressInput = {
    name: sanitizePostField(recipient.name),
    street: sanitizePostField(recipient.street),
    zip: sanitizePostField(recipient.zip),
    city: sanitizePostField(recipient.city),
    country: recipient.country,
  };

  const senderErr = assertRequiredAddress("sender", senderSanitized);
  if (senderErr) return jsonResponse({ error: senderErr }, { status: 400 });
  const recipientErr = assertRequiredAddress("recipient", recipientSanitized);
  if (recipientErr) return jsonResponse({ error: recipientErr }, { status: 400 });

  console.log(
    "Sender:",
    JSON.stringify(senderSanitized),
    "Recipient:",
    JSON.stringify(recipientSanitized),
  );

  const parcelSize = String((order as { parcel_size?: string | null }).parcel_size ?? "small");
  const labelProfile = resolvePostLabelProfile(parcelSize);
  const frankingLicense = resolveFrankingLicense(
    {
      defaultLicence: postLicence,
      letterAplusLicence: postLetterAplusLicence,
    },
    labelProfile,
  );

  if (!frankingLicense) {
    return jsonResponse(
      {
        error: "Licence d'affranchissement manquante pour la génération d'étiquette",
        parcel_size: parcelSize,
      },
      { status: 500 },
    );
  }

  if (labelProfile.requiresDomesticCh) {
    if (senderSanitized.country !== "CH" || recipientSanitized.country !== "CH") {
      return jsonResponse(
        {
          error: "Lettre A+ : expédition nationale Suisse (CH → CH) uniquement",
          parcel_size: parcelSize,
        },
        { status: 400 },
      );
    }
  }

  const uid = authData.user.id;
  const buyerId = String((order as any).buyer_id ?? "");
  const sellerId = String((order as any).seller_id ?? "");
  if (uid !== buyerId && uid !== sellerId) {
    return jsonResponse({ error: "Accès refusé pour cette commande" }, { status: 403 });
  }

  const recipientParts = splitStreetAndHouseNo(recipientSanitized.street);

  try {
    const accessToken = await getPostAccessToken({
      clientId: postClientId,
      clientSecret: postClientSecret,
    });

    console.log("Post token obtained", {
      parcelSize,
      przl: labelProfile.przl,
      frankingLicense,
    });

    const postItem: Record<string, unknown> = {
      itemID: order_id.replace(/-/g, "").slice(0, 35),
      recipient: {
        name1: recipientSanitized.name,
        street: recipientParts.street,
        ...(recipientParts.houseNo ? { houseNo: recipientParts.houseNo } : {}),
        zip: recipientSanitized.zip,
        city: recipientSanitized.city,
        country: recipientSanitized.country,
      },
      attributes: {
        przl: labelProfile.przl,
        weight: labelProfile.weight,
      },
    };
    if (labelProfile.useParcelItemNumber) {
      postItem.itemNumber = buildItemNumber(order_id);
    }

    // Corps conforme à la doc Post (Digital Commerce API) — generateAddressLabel
    const postBody = {
      language: "FR",
      frankingLicense,
      ppFranking: false,
      customer: {
        name1: senderSanitized.name,
        street: senderSanitized.street,
        zip: senderSanitized.zip,
        city: senderSanitized.city,
        country: senderSanitized.country,
        domicilePostOffice: formatDomicilePostOffice(
          senderSanitized.zip,
          senderSanitized.city,
        ),
      },
      labelDefinition: {
        labelLayout: labelProfile.labelLayout,
        printAddresses: "RECIPIENT_AND_CUSTOMER",
        imageFileType: "pdf",
        imageResolution: 300,
        printPreview: false,
      },
      item: postItem,
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
          details: JSON.stringify(labelJson),
          http_status: labelResp.status,
        },
        { status: 500 },
      );
    }

    const itemRecord = labelJson.item as Record<string, unknown> | undefined;
    const postErrors = extractPostItemErrors(itemRecord);
    const postWarnings = extractPostItemWarnings(itemRecord);
    if (postErrors.length > 0) {
      return jsonResponse(
        {
          error: "La Poste a refusé la génération de l'étiquette",
          details: postErrors.join(" | "),
          warnings: postWarnings.length > 0 ? postWarnings.join(" | ") : undefined,
          parcel_size: parcelSize,
          http_status: labelResp.status,
          raw: labelJson,
        },
        { status: 422 },
      );
    }

    const label_pdf_base64 = extractLabelPdfBase64(labelJson);
    const tracking_number = extractTrackingNumber(labelJson);

    if (!label_pdf_base64) {
      return jsonResponse(
        {
          error: parcelSize === "letter_aplus"
            ? "La Poste n'a pas renvoyé l'étiquette Lettre A+"
            : "La Poste n'a pas renvoyé le PDF de l'étiquette",
          details: [
            tracking_number != null ? `identCode=${tracking_number}` : null,
            postWarnings.length > 0 ? postWarnings.join(" | ") : null,
            "Vérifiez que la licence d'affranchissement couvre ce produit (APLUS pour Lettre A+).",
          ]
            .filter(Boolean)
            .join(" — "),
          tracking_number,
          parcel_size: parcelSize,
          warnings: postWarnings.length > 0 ? postWarnings : undefined,
          http_status: labelResp.status,
          raw: labelJson,
        },
        { status: 502 },
      );
    }

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

    let email_sent = false;
    let email_sent_to: string | null = null;

    if (label_pdf_base64 && uid === sellerId) {
      const resendApiKey = Deno.env.get("RESEND_API_KEY")?.trim() ?? "";
      const resendFrom = Deno.env.get("RESEND_FROM_EMAIL")?.trim() || DEFAULT_RESEND_FROM;

      if (resendApiKey) {
        try {
          const { data: sellerUser, error: sellerUserErr } = await supabaseAdmin.auth.admin
            .getUserById(sellerId);
          const sellerEmail = sellerUser?.user?.email?.trim() ?? "";

          if (!sellerUserErr && sellerEmail) {
            const { data: sellerProfile } = await supabaseAdmin
              .from("profiles")
              .select("display_name, language")
              .eq("id", sellerId)
              .maybeSingle();

            const sellerName = String(
              (sellerProfile as { display_name?: string | null } | null)?.display_name ??
                senderSanitized.name,
            ).trim();
            const sellerLang = normalizeShippingLabelEmailLang(
              (sellerProfile as { language?: string | null } | null)?.language,
            );
            const listingTitle = String(
              (order as { listing_title?: string | null }).listing_title ?? "",
            ).trim();

            const emailContent = shippingLabelEmailContent({
              lang: sellerLang,
              sellerName,
              listingTitle,
              trackingNumber: tracking_number ? String(tracking_number) : null,
              orderId: order_id,
              ctaHtml: labelReadyEmailCtaBlock(normalizeEmailLang(sellerLang)),
            });

            const emailResult = await sendResendEmail({
              apiKey: resendApiKey,
              from: resendFrom,
              to: sellerEmail,
              subject: emailContent.subject,
              html: emailContent.html,
              attachments: [
                {
                  filename: emailContent.attachmentFilename,
                  content: label_pdf_base64,
                },
              ],
            });

            if (emailResult.ok) {
              email_sent = true;
              email_sent_to = sellerEmail;
              console.log("Shipping label email sent:", emailResult.id);
              await logTransactionalEmailSent(supabaseAdmin, {
                userId: sellerId,
                templateKey: "label_ready",
                entityId: order_id,
                resendId: emailResult.id,
              });
            } else {
              console.warn("Shipping label email failed:", emailResult.error);
            }
          } else {
            console.warn("Shipping label email skipped: seller email unavailable");
          }
        } catch (e) {
          console.warn(
            "Shipping label email error:",
            e instanceof Error ? e.message : String(e),
          );
        }
      } else {
        console.warn("Shipping label email skipped: RESEND_API_KEY missing");
      }
    }

    try {
      const orderRow = order as {
        buyer_id: string;
        seller_id: string;
        listing_id?: string | null;
      };
      const listingId = String(orderRow.listing_id ?? "").trim();
      if (listingId) {
        const threadId = await findOrCreateThreadForOrderChat(supabaseAdmin, {
          listingId,
          buyerId: String(orderRow.buyer_id),
          sellerId: String(orderRow.seller_id),
        });
        if (threadId) {
          await insertThreadEventMessage(supabaseAdmin, threadId, {
            kind: "label_ready",
            order_id,
            tracking_number: tracking_number ? String(tracking_number) : undefined,
          });
        }

        const serviceKey = supabaseServiceRoleKey;
        try {
          const sellerLang = await fetchRecipientLanguage(supabaseAdmin, String(orderRow.seller_id));
          const sellerCopy = labelReadySellerPushText(sellerLang);
          await fetch(`${supabaseUrl.replace(/\/+$/, "")}/functions/v1/send-notification`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${serviceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              user_id: String(orderRow.seller_id),
              title: sellerCopy.title,
              body: sellerCopy.body,
              data: { order_id, notification_type: "new_items" },
            }),
          });
        } catch {
          // silent
        }
        try {
          const buyerLang = await fetchRecipientLanguage(supabaseAdmin, String(orderRow.buyer_id));
          const buyerCopy = labelReadyBuyerPushText(buyerLang);
          await fetch(`${supabaseUrl.replace(/\/+$/, "")}/functions/v1/send-notification`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${serviceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              user_id: String(orderRow.buyer_id),
              title: buyerCopy.title,
              body: buyerCopy.body,
              data: { order_id, notification_type: "new_items" },
            }),
          });
        } catch {
          // silent
        }
      }
    } catch (e) {
      console.warn(
        "generate-shipping-label chat/push:",
        e instanceof Error ? e.message : String(e),
      );
    }

    return jsonResponse({
      success: true,
      order_id,
      parcel_size: parcelSize,
      tracking_number,
      label_pdf_base64,
      label_url,
      email_sent,
      email_sent_to,
      raw: labelJson,
    });
  } catch (e) {
    console.log("Error details:", e instanceof Error ? e.message : String(e));
    return jsonResponse(
      {
        error: "Erreur generate-shipping-label",
        details:
          e instanceof Error
            ? e.message
            : typeof e === "object" && e !== null
            ? JSON.stringify(e)
            : String(e),
      },
      { status: 500 },
    );
  }
});
