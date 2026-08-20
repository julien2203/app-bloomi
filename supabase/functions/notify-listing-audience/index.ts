import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { notifyUser } from "../_shared/notifyUser.ts";
import {
  fetchRecipientLanguage,
  followedSellerNewListingPushText,
  priceDropPushText,
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

type RequestBody = {
  event?: unknown;
  listing_id?: unknown;
  old_price?: unknown;
  new_price?: unknown;
};

function formatChf(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
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

  const event = typeof parsed.event === "string" ? parsed.event.trim() : "";
  const listingId = typeof parsed.listing_id === "string" ? parsed.listing_id.trim() : "";
  if (!listingId || (event !== "price_drop" && event !== "published")) {
    return jsonResponse({ error: "Paramètres invalides" }, { status: 400 });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
  const token = authHeader.slice("Bearer ".length);
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user?.id) {
    return jsonResponse({ error: "JWT invalide" }, { status: 401 });
  }
  const callerId = authData.user.id;

  const { data: listing, error: listingErr } = await supabaseAdmin
    .from("listings")
    .select("id, seller_id, title, price, status")
    .eq("id", listingId)
    .maybeSingle();

  if (listingErr || !listing) {
    return jsonResponse({ error: "Annonce introuvable" }, { status: 404 });
  }

  const sellerId = String((listing as { seller_id?: string }).seller_id ?? "");
  if (!sellerId || sellerId !== callerId) {
    return jsonResponse({ error: "Non autorisé" }, { status: 403 });
  }

  const listingTitle = String((listing as { title?: string | null }).title ?? "").trim();
  let notified = 0;

  if (event === "price_drop") {
    const oldPriceRaw = Number(parsed.old_price);
    const newPriceRaw = Number(
      parsed.new_price ?? (listing as { price?: number | null }).price ?? NaN,
    );
    if (!Number.isFinite(oldPriceRaw) || !Number.isFinite(newPriceRaw) || newPriceRaw >= oldPriceRaw) {
      return jsonResponse({ error: "Prix invalide pour une baisse" }, { status: 400 });
    }

    const { data: likers } = await supabaseAdmin
      .from("likes")
      .select("user_id")
      .eq("listing_id", listingId)
      .limit(200);

    const oldPrice = formatChf(oldPriceRaw);
    const newPrice = formatChf(newPriceRaw);
    const entityId = `${listingId}:price:${oldPrice}:${newPrice}`;

    for (const row of likers ?? []) {
      const userId = String((row as { user_id?: string }).user_id ?? "").trim();
      if (!userId || userId === sellerId) continue;

      try {
        const lang = await fetchRecipientLanguage(supabaseAdmin, userId);
        const push = priceDropPushText(lang, {
          title: listingTitle,
          oldPrice,
          newPrice,
        });
        await notifyUser({
          supabaseAdmin,
          supabaseUrl,
          supabaseServiceRoleKey,
          userId,
          templateKey: "price_drop",
          entityId,
          variables: {
            listingTitle,
            oldPrice,
            newPrice,
            listingId,
          },
          push: {
            title: push.title,
            body: push.body,
            data: {
              listing_id: listingId,
              notification_type: "favorite_items",
            },
          },
        });
        notified += 1;
      } catch (e) {
        console.warn("price_drop notify failed:", e instanceof Error ? e.message : String(e));
      }
    }

    return jsonResponse({ success: true, event, notified });
  }

  // event === published → followers du vendeur
  const { data: sellerProfile } = await supabaseAdmin
    .from("profiles")
    .select("display_name")
    .eq("id", sellerId)
    .maybeSingle();
  const sellerName = String(
    (sellerProfile as { display_name?: string | null } | null)?.display_name ?? "",
  ).trim();

  const { data: followers } = await supabaseAdmin
    .from("follows")
    .select("follower_id")
    .eq("following_id", sellerId)
    .limit(300);

  const entityId = `${listingId}:published`;

  for (const row of followers ?? []) {
    const userId = String((row as { follower_id?: string }).follower_id ?? "").trim();
    if (!userId || userId === sellerId) continue;

    try {
      const lang = await fetchRecipientLanguage(supabaseAdmin, userId);
      const push = followedSellerNewListingPushText(lang, {
        sellerName,
        listingTitle,
      });
      await notifyUser({
        supabaseAdmin,
        supabaseUrl,
        supabaseServiceRoleKey,
        userId,
        templateKey: "followed_seller_new_listing",
        entityId,
        variables: {
          sellerName,
          listingTitle,
          listingId,
        },
        push: {
          title: push.title,
          body: push.body,
          data: {
            listing_id: listingId,
            seller_id: sellerId,
            notification_type: "new_items",
          },
        },
      });
      notified += 1;
    } catch (e) {
      console.warn("published notify failed:", e instanceof Error ? e.message : String(e));
    }
  }

  return jsonResponse({ success: true, event, notified });
});
