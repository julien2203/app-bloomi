import "@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  findOrCreateThreadForOrderChat,
  insertThreadEventMessage,
} from "../_shared/orderChatSystemMessage.ts";
import {
  fetchRecipientLanguage,
  itemSoldPushText,
  orderPaidBuyerPushText,
  pickupReminderPushText,
  urgencyActNowPushText,
} from "../_shared/pushNotificationI18n.ts";
import { notifyUser } from "../_shared/notifyUser.ts";
import {
  computeBuyerFees,
  parsePaymentIntentFeeMetadata,
  paymentIntentFeesToOrderSnapshot,
} from "../_shared/fees.ts";
import { isCompleteShippingAddress } from "../_shared/shippingAddress.ts";

type DeliveryMode = "pickup" | "shipping" | "both";

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

async function sendNotificationSilent(params: {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  user_id: string;
  title: string;
  body: string;
  data?: unknown;
}) {
  try {
    const url = `${params.supabaseUrl.replace(/\/+$/, "")}/functions/v1/send-notification`;
    await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.supabaseServiceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: params.user_id,
        title: params.title,
        body: params.body,
        data: params.data ?? undefined,
      }),
    });
  } catch {
    // silent — do not block order finalization
  }
}

function toCents(amount: unknown): number {
  const n =
    typeof amount === "number"
      ? amount
      : typeof amount === "string"
      ? Number(amount)
      : NaN;
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("amount doit être un nombre CHF > 0");
  }
  return Math.round(n * 100);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey || !stripeSecretKey) {
    return jsonResponse({ error: "Configuration manquante côté serveur" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Body JSON invalide" }, { status: 400 });
  }

  const { payment_intent_id } = (body ?? {}) as Record<string, unknown>;
  if (!payment_intent_id || typeof payment_intent_id !== "string") {
    return jsonResponse({ error: "payment_intent_id est requis" }, { status: 400 });
  }

  const authHeader = normalizeAuthHeader(req);
  if (!authHeader) {
    return jsonResponse({ error: "Non authentifié" }, { status: 401 });
  }

  // Client Supabase avec JWT utilisateur (RLS pour insert order)
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

  // Vérifie l'utilisateur authentifié
  const token = authHeader.slice("Bearer ".length);
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) {
    return jsonResponse({ error: "JWT Supabase invalide" }, { status: 401 });
  }
  const authenticatedUserId = authData.user.id;

  // Idempotence: si commande existe déjà pour ce PI, la renvoyer
  const { data: existingOrder, error: existingErr } = await supabase
    .from("orders")
    .select("id, listing_id")
    .eq("stripe_payment_intent_id", payment_intent_id)
    .maybeSingle();

  if (existingErr) {
    return jsonResponse(
      { error: "Impossible de vérifier la commande existante", details: existingErr.message },
      { status: 500 },
    );
  }
  if (existingOrder?.id) {
    return jsonResponse({ order_id: existingOrder.id });
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });

  try {
    const pi = await stripe.paymentIntents.retrieve(payment_intent_id);

    const piBuyerId = (pi.metadata?.buyer_id ?? "").toString();
    const piSellerId = (pi.metadata?.seller_id ?? "").toString();
    const piListingId = (pi.metadata?.listing_id ?? "").toString();
    if (!piBuyerId || !piSellerId || !piListingId) {
      return jsonResponse(
        { error: "PaymentIntent metadata incomplet (buyer_id/seller_id/listing_id)" },
        { status: 400 },
      );
    }
    if (piBuyerId !== authenticatedUserId) {
      return jsonResponse({ error: "Vous n'êtes pas l'acheteur de ce paiement" }, { status: 403 });
    }

    // On accepte la finalisation uniquement si l'autorisation a réussi
    // (manual capture => statut attendu: requires_capture)
    if (pi.status !== "requires_capture" && pi.status !== "succeeded") {
      return jsonResponse(
        {
          error: "Paiement non complété",
          stripe_payment_intent_status: pi.status,
        },
        { status: 409 },
      );
    }

    // Données listing snapshot
    const { data: listingRow, error: listingErr } = await supabaseAdmin
      .from("listings")
      .select("id, status, title, price")
      .eq("id", piListingId)
      .maybeSingle();

    if (listingErr) {
      return jsonResponse({ error: "Impossible de charger l'annonce", details: listingErr.message }, { status: 500 });
    }
    if (!listingRow) {
      return jsonResponse({ error: "Annonce introuvable" }, { status: 404 });
    }
    const listingStatus = String((listingRow as any)?.status ?? "").toLowerCase();
    if (listingStatus !== "published") {
      return jsonResponse(
        { error: "Annonce indisponible", details: `listing.status=${listingStatus || "unknown"}` },
        { status: 409 },
      );
    }

    const listingTitle = String((listingRow as any)?.title ?? "");
    const listingPriceRaw = (listingRow as any)?.price as number | string | null | undefined;
    const listingPrice =
      typeof listingPriceRaw === "number"
        ? listingPriceRaw
        : typeof listingPriceRaw === "string"
        ? Number(listingPriceRaw)
        : null;

    const { data: photoRow } = await supabaseAdmin
      .from("listing_photos")
      .select("url, order_index")
      .eq("listing_id", piListingId)
      .order("order_index", { ascending: true })
      .limit(1)
      .maybeSingle();
    const coverPhotoUrl = (photoRow as any)?.url ? String((photoRow as any).url) : null;

    const parsedFees = parsePaymentIntentFeeMetadata(
      pi.metadata as Record<string, string | undefined>,
    );
    const itemAmountCentsFromMeta = Number((pi.metadata?.item_amount_cents ?? "").toString());
    const itemPriceFromPi =
      Number.isFinite(itemAmountCentsFromMeta) && itemAmountCentsFromMeta > 0
        ? itemAmountCentsFromMeta / 100
        : null;

    let sellerAmountChf: number | null = null;
    let feeSnapshot: ReturnType<typeof paymentIntentFeesToOrderSnapshot> | null = null;

    if (parsedFees) {
      feeSnapshot = paymentIntentFeesToOrderSnapshot(parsedFees);
      sellerAmountChf = feeSnapshot.sellerPayoutChf;
    } else {
      // Rétrocompatibilité : anciens PaymentIntent sans seller_payout_cents
      const totalCents = pi.amount;
      const piCommissionCents = Number((pi.metadata?.commission_cents ?? "0").toString());
      const commissionCents =
        Number.isFinite(piCommissionCents) && piCommissionCents > 0 ? piCommissionCents : null;
      const sellerAmountCents =
        commissionCents != null ? Math.max(0, totalCents - commissionCents) : null;
      sellerAmountChf = sellerAmountCents != null ? sellerAmountCents / 100 : null;
    }

    // delivery_mode / shipping address viennent de la création du PI (pas stockés dans Stripe par défaut)
    // => fallback: delivery_mode = both (comme avant) si non disponible.
    // Pour garder la compatibilité, on laisse ces champs optionnels ici.
    const dm = (pi.metadata?.delivery_mode ?? "both").toString() as DeliveryMode;

    const metaShipAddr = String(pi.metadata?.shipping_address ?? "").trim() || null;
    const metaShipCity = String(pi.metadata?.shipping_city ?? "").trim() || null;
    const metaShipPostal = String(pi.metadata?.shipping_postal_code ?? "").trim() || null;
    const metaShipCountry = String(pi.metadata?.shipping_country ?? "").trim().toUpperCase() || null;
    const metaShipFirstName = String(pi.metadata?.shipping_first_name ?? "").trim() || null;
    const metaShipLastName = String(pi.metadata?.shipping_last_name ?? "").trim() || null;

    const shippingFeeCents = parseInt((pi.metadata?.shipping_fee_cents ?? "0").toString(), 10);
    const isPromoShipping = pi.metadata?.is_promo_shipping === "true";
    const rawParcelSize = (pi.metadata?.parcel_size ?? "").toString().trim();
    const parcelSize = rawParcelSize || null;

    const requiresShippingAddress =
      dm === "shipping" || (Number.isFinite(shippingFeeCents) && shippingFeeCents > 0);
    if (
      requiresShippingAddress &&
      !isCompleteShippingAddress({
        street: metaShipAddr,
        city: metaShipCity,
        postalCode: metaShipPostal,
        country: metaShipCountry ?? "CH",
      })
    ) {
      return jsonResponse(
        {
          error: "Adresse de livraison manquante ou incomplète",
          details: "Impossible de finaliser une commande en expédition sans adresse complète",
        },
        { status: 400 },
      );
    }

    const resolvedItemPriceChf =
      feeSnapshot?.itemPriceChf ?? itemPriceFromPi ?? listingPrice ?? null;
    let buyerProtectionChf = feeSnapshot?.buyerProtectionChf ?? null;
    let buyerBankingFeeChf = feeSnapshot?.buyerBankingFeeChf ?? null;
    if (
      (buyerProtectionChf == null || buyerBankingFeeChf == null) &&
      resolvedItemPriceChf != null &&
      resolvedItemPriceChf > 0
    ) {
      const buyerFees = computeBuyerFees(resolvedItemPriceChf);
      if (buyerFees) {
        buyerProtectionChf = buyerProtectionChf ?? buyerFees.protectionChf;
        buyerBankingFeeChf = buyerBankingFeeChf ?? buyerFees.bankingChf;
      }
    }

    // Insère la commande (pending) avec l'ID Stripe.
    const { data: created, error: orderInsertError } = await supabase
      .from("orders")
      .insert({
        listing_id: piListingId,
        buyer_id: piBuyerId,
        seller_id: piSellerId,
        status: "pending",
        delivery_mode: dm,
        stripe_payment_intent_id: pi.id,
        listing_title: listingTitle || null,
        listing_price: resolvedItemPriceChf,
        listing_cover_photo_url: coverPhotoUrl,
        seller_amount: sellerAmountChf,
        seller_commission_chf: feeSnapshot?.sellerCommissionChf ?? null,
        seller_fee_rate: feeSnapshot?.sellerFeeRate ?? null,
        buyer_protection_chf: buyerProtectionChf,
        buyer_banking_fee_chf: buyerBankingFeeChf,
        seller_profile_type: feeSnapshot?.sellerProfileType ?? null,
        shipping_address: metaShipAddr,
        shipping_city: metaShipCity,
        shipping_postal_code: metaShipPostal,
        shipping_country: metaShipCountry,
        shipping_first_name: metaShipFirstName,
        shipping_last_name: metaShipLastName,
        shipping_fee_chf: (Number.isFinite(shippingFeeCents) ? shippingFeeCents : 0) / 100,
        is_promo_shipping: isPromoShipping,
        parcel_size: parcelSize,
      })
      .select("id")
      .single();

    if (orderInsertError) {
      return jsonResponse(
        { error: "Impossible de créer la commande", details: orderInsertError.message },
        { status: 500 },
      );
    }
    const createdOrderId = (created as { id?: string } | null)?.id ?? null;
    if (!createdOrderId) {
      return jsonResponse({ error: "Commande créée mais id introuvable" }, { status: 500 });
    }

    // Réserve le listing (atomic-ish: published -> reserved)
    const { data: reservedRows, error: listingUpdateError } = await supabaseAdmin
      .from("listings")
      .update({ status: "reserved" })
      .eq("id", piListingId)
      .eq("status", "published")
      .select("id");

    if (listingUpdateError) {
      // Best-effort rollback: si on ne peut pas réserver, on supprime la commande créée.
      try {
        await supabaseAdmin.from("orders").delete().eq("id", createdOrderId);
      } catch {
        // ignore
      }
      return jsonResponse(
        { error: "Commande créée mais impossible de réserver l'annonce", details: listingUpdateError.message },
        { status: 500 },
      );
    }
    if (!reservedRows || reservedRows.length === 0) {
      try {
        await supabaseAdmin.from("orders").delete().eq("id", createdOrderId);
      } catch {
        // ignore
      }
      return jsonResponse(
        { error: "Commande créée mais annonce déjà réservée/vendue" },
        { status: 409 },
      );
    }

    const { error: counterErr } = await supabaseAdmin.rpc("increment_completed_orders");
    if (counterErr) {
      console.warn("increment_completed_orders failed:", counterErr.message);
    }

    // Best-effort: notify seller after order is created (payment authorized + listing reserved)
    const isPickupOrder = dm === "pickup";
    try {
      const sellerLang = await fetchRecipientLanguage(supabaseAdmin, String(piSellerId));
      const soldCopy = itemSoldPushText(sellerLang, { pickup: isPickupOrder });
      await notifyUser({
        supabaseAdmin,
        supabaseUrl,
        supabaseServiceRoleKey,
        userId: String(piSellerId),
        templateKey: "item_sold",
        entityId: createdOrderId,
        variables: {
          listingTitle: listingTitle.trim(),
          orderId: createdOrderId,
          pickup: isPickupOrder,
        },
        push: {
          title: soldCopy.title,
          body: soldCopy.body,
          data: {
            order_id: createdOrderId,
            listing_id: String(piListingId),
            buyer_id: String(piBuyerId),
            notification_type: "new_items",
          },
        },
      });
      if (isPickupOrder) {
        const reminderCopy = pickupReminderPushText(sellerLang);
        await sendNotificationSilent({
          supabaseUrl,
          supabaseServiceRoleKey,
          user_id: String(piSellerId),
          title: reminderCopy.title,
          body: reminderCopy.body,
          data: {
            order_id: createdOrderId,
            listing_id: String(piListingId),
            buyer_id: String(piBuyerId),
            notification_type: "new_items",
          },
        });
      }
    } catch {
      // silent
    }

    // Urgence acheteurs : personnes ayant liké l'annonce (sauf l'acheteur)
    try {
      const { data: likerRows } = await supabaseAdmin
        .from("likes")
        .select("user_id")
        .eq("listing_id", String(piListingId))
        .neq("user_id", String(piBuyerId));
      for (const row of likerRows ?? []) {
        const likerId = String((row as { user_id?: string }).user_id ?? "").trim();
        if (!likerId || likerId === String(piSellerId)) continue;
        const likerLang = await fetchRecipientLanguage(supabaseAdmin, likerId);
        const urgencyCopy = urgencyActNowPushText(likerLang);
        await sendNotificationSilent({
          supabaseUrl,
          supabaseServiceRoleKey,
          user_id: likerId,
          title: urgencyCopy.title,
          body: urgencyCopy.body,
          data: {
            order_id: createdOrderId,
            listing_id: String(piListingId),
            notification_type: "favorite_items",
          },
        });
      }
    } catch {
      // silent
    }

    try {
      const threadId = await findOrCreateThreadForOrderChat(supabaseAdmin, {
        listingId: String(piListingId),
        buyerId: String(piBuyerId),
        sellerId: String(piSellerId),
      });
      if (threadId) {
        const [{ data: buyerProfile }, { data: sellerProfile }] = await Promise.all([
          supabaseAdmin
            .from("profiles")
            .select("display_name")
            .eq("id", String(piBuyerId))
            .maybeSingle(),
          supabaseAdmin
            .from("profiles")
            .select("display_name")
            .eq("id", String(piSellerId))
            .maybeSingle(),
        ]);
        const buyerName = String(
          (buyerProfile as { display_name?: string | null } | null)?.display_name ?? "",
        ).trim();
        const sellerName = String(
          (sellerProfile as { display_name?: string | null } | null)?.display_name ?? "",
        ).trim();

        await insertThreadEventMessage(supabaseAdmin, threadId, {
          kind: "order_confirmed",
          order_id: createdOrderId,
          delivery_mode: isPickupOrder ? "pickup" : "shipping",
          buyer_name: buyerName || undefined,
          seller_name: sellerName || undefined,
        });

        if (!isPickupOrder) {
          await insertThreadEventMessage(supabaseAdmin, threadId, {
            kind: "label_preparing",
            order_id: createdOrderId,
            seller_name: sellerName || undefined,
          });
        } else if (isPickupOrder) {
          await insertThreadEventMessage(supabaseAdmin, threadId, {
            kind: "buyer_confirm_prompt",
            order_id: createdOrderId,
            delivery_mode: "pickup",
          });
        }

        try {
          const buyerLang = await fetchRecipientLanguage(supabaseAdmin, String(piBuyerId));
          const paidCopy = orderPaidBuyerPushText(buyerLang);
          await sendNotificationSilent({
            supabaseUrl,
            supabaseServiceRoleKey,
            user_id: String(piBuyerId),
            title: paidCopy.title,
            body: paidCopy.body,
            data: {
              order_id: createdOrderId,
              listing_id: String(piListingId),
              notification_type: "new_items",
            },
          });
        } catch {
          // silent
        }
      }
    } catch {
      // silent — ne pas bloquer la finalisation
    }

    return jsonResponse({ order_id: createdOrderId });
  } catch (e) {
    return jsonResponse(
      { error: "Erreur lors de la finalisation de la commande", details: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
});

