import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { notifyUser } from "../_shared/notifyUser.ts";
import { wasTransactionalEmailSent } from "../_shared/transactionalEmailLog.ts";
import {
  fetchRecipientLanguage,
  noPurchaseNudgePushText,
  sellerNoSaleTipsPushText,
} from "../_shared/pushNotificationI18n.ts";

/** Jours sans 1er achat avant nudge acheteur. */
const NO_PURCHASE_AFTER_DAYS = 10;
/** Jours sans vente sur une annonce publiée avant tips vendeur. */
const NO_SALE_AFTER_DAYS = 10;

function jsonResponse(payload: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

function isAuthorizedCronOrServiceRole(req: Request, serviceRoleKey: string): boolean {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader === `Bearer ${serviceRoleKey}`) return true;
  const cronSecret = Deno.env.get("CRON_SECRET");
  const cronHeader = req.headers.get("x-cron-secret");
  if (cronSecret && cronHeader === cronSecret) return true;
  return false;
}

function tipForListing(
  lang: "fr" | "en" | "de" | "it",
  signals: { photoCount: number; likesCount: number },
): string {
  if (signals.photoCount < 2) {
    return {
      fr: "Ajoutez au moins 2–3 photos claires (face, dos, détails).",
      en: "Add at least 2–3 clear photos (front, back, details).",
      de: "Füge mindestens 2–3 klare Fotos hinzu (vorne, hinten, Details).",
      it: "Aggiungi almeno 2–3 foto chiare (fronte, retro, dettagli).",
    }[lang];
  }
  if (signals.likesCount === 0) {
    return {
      fr: "Essayez de baisser légèrement le prix ou de booster l'annonce.",
      en: "Try a small price drop or boost your listing.",
      de: "Versuche einen kleinen Preisnachlass oder booste dein Inserat.",
      it: "Prova a abbassare un po' il prezzo o a potenziare l'annuncio.",
    }[lang];
  }
  return {
    fr: "Des acheteurs aiment déjà l'article — baissez 1–2 CHF pour déclencher une vente.",
    en: "Buyers already like it — drop 1–2 CHF to trigger a sale.",
    de: "Käufer mögen den Artikel bereits — senke 1–2 CHF, um einen Verkauf auszulösen.",
    it: "Qualcuno lo ha già messo nei preferiti — abbassa di 1–2 CHF per stimolare la vendita.",
  }[lang];
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse({ error: "Configuration manquante" }, { status: 500 });
  }

  if (!isAuthorizedCronOrServiceRole(req, supabaseServiceRoleKey)) {
    return jsonResponse({ error: "Non autorisé" }, { status: 403 });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
  const noPurchaseCutoff = new Date(
    Date.now() - NO_PURCHASE_AFTER_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const noSaleCutoff = new Date(Date.now() - NO_SALE_AFTER_DAYS * 24 * 60 * 60 * 1000)
    .toISOString();

  let buyerNudges = 0;
  let sellerTips = 0;

  // --- Acheteurs inscrits sans 1er achat (opt-in marketing requis pour l'e-mail) ---
  const { data: candidates, error: buyersErr } = await supabaseAdmin
    .from("profiles")
    .select("id, created_at, marketing_opt_in")
    .eq("marketing_opt_in", true)
    .lt("created_at", noPurchaseCutoff)
    .order("created_at", { ascending: true })
    .limit(80);

  if (buyersErr) {
    return jsonResponse(
      { error: "Impossible de charger les profils", details: buyersErr.message },
      { status: 500 },
    );
  }

  for (const row of candidates ?? []) {
    const userId = String((row as { id?: string }).id ?? "").trim();
    if (!userId) continue;

    const alreadySent = await wasTransactionalEmailSent(supabaseAdmin, {
      userId,
      templateKey: "no_purchase_nudge",
      entityId: userId,
    });
    if (alreadySent) continue;

    const { count: orderCount } = await supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("buyer_id", userId)
      .neq("status", "cancelled");

    if ((orderCount ?? 0) > 0) continue;

    try {
      const lang = await fetchRecipientLanguage(supabaseAdmin, userId);
      const push = noPurchaseNudgePushText(lang);
      const result = await notifyUser({
        supabaseAdmin,
        supabaseUrl,
        supabaseServiceRoleKey,
        userId,
        templateKey: "no_purchase_nudge",
        entityId: userId,
        requireMarketingOptIn: true,
        push: {
          title: push.title,
          body: push.body,
          data: { notification_type: "new_items" },
        },
      });
      if (result.emailSent || result.pushSent) buyerNudges += 1;
    } catch (e) {
      console.warn("no_purchase_nudge failed:", e instanceof Error ? e.message : String(e));
    }
  }

  // --- Annonces publiées sans vente depuis 10 jours ---
  const { data: staleListings, error: listingsErr } = await supabaseAdmin
    .from("listings")
    .select("id, seller_id, title, published_at, created_at")
    .eq("status", "published")
    .lt("published_at", noSaleCutoff)
    .order("published_at", { ascending: true })
    .limit(80);

  if (listingsErr) {
    return jsonResponse(
      { error: "Impossible de charger les annonces", details: listingsErr.message },
      { status: 500 },
    );
  }

  for (const row of staleListings ?? []) {
    const listing = row as {
      id: string;
      seller_id: string;
      title?: string | null;
      published_at?: string | null;
    };
    const listingId = String(listing.id ?? "").trim();
    const sellerId = String(listing.seller_id ?? "").trim();
    if (!listingId || !sellerId) continue;

    const { data: sellerProfile } = await supabaseAdmin
      .from("profiles")
      .select("marketing_opt_in")
      .eq("id", sellerId)
      .maybeSingle();
    if (!Boolean((sellerProfile as { marketing_opt_in?: boolean } | null)?.marketing_opt_in)) {
      continue;
    }

    const alreadySent = await wasTransactionalEmailSent(supabaseAdmin, {
      userId: sellerId,
      templateKey: "seller_no_sale_tips",
      entityId: listingId,
    });
    if (alreadySent) continue;

    const { count: saleCount } = await supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", listingId)
      .neq("status", "cancelled");

    if ((saleCount ?? 0) > 0) continue;

    const [{ count: photoCount }, { count: likesCount }] = await Promise.all([
      supabaseAdmin
        .from("listing_photos")
        .select("id", { count: "exact", head: true })
        .eq("listing_id", listingId),
      supabaseAdmin
        .from("likes")
        .select("id", { count: "exact", head: true })
        .eq("listing_id", listingId),
    ]);

    try {
      const lang = await fetchRecipientLanguage(supabaseAdmin, sellerId);
      const tip = tipForListing(lang, {
        photoCount: photoCount ?? 0,
        likesCount: likesCount ?? 0,
      });
      const listingTitle = String(listing.title ?? "").trim();
      const push = sellerNoSaleTipsPushText(lang, { listingTitle, tip });
      const result = await notifyUser({
        supabaseAdmin,
        supabaseUrl,
        supabaseServiceRoleKey,
        userId: sellerId,
        templateKey: "seller_no_sale_tips",
        entityId: listingId,
        requireMarketingOptIn: true,
        variables: {
          listingTitle,
          tip,
          listingId,
        },
        push: {
          title: push.title,
          body: push.body,
          data: {
            listing_id: listingId,
            notification_type: "new_items",
          },
        },
      });
      if (result.emailSent || result.pushSent) sellerTips += 1;
    } catch (e) {
      console.warn("seller_no_sale_tips failed:", e instanceof Error ? e.message : String(e));
    }
  }

  return jsonResponse({
    success: true,
    buyer_nudges: buyerNudges,
    seller_tips: sellerTips,
  });
});
