import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildPublicShareUrl,
  htmlResponse,
  isUuid,
  parseShareId,
  renderSharePage,
} from "../_shared/sharePage.ts";

function unavailablePage(req: Request, sellerId: string, title: string, description: string) {
  const canonicalUrl = buildPublicShareUrl(req, `/dressing/${sellerId}`);
  const html = renderSharePage({
    title,
    description,
    imageUrl: null,
    canonicalUrl,
    deepLink: `bloomi://dressing/${sellerId}`,
    badge: "Dressing",
    unavailable: true,
  });
  return htmlResponse(html, { status: 404 }, req.method);
}

Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const sellerId = parseShareId(req, {
    segment: "dressing",
    functionName: "closet-share",
  });
  if (!sellerId) {
    return new Response("Missing seller id", { status: 400 });
  }

  if (!isUuid(sellerId)) {
    return unavailablePage(
      req,
      sellerId,
      "Dressing introuvable",
      "Ce profil n'existe plus sur Bloomi.",
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response("Server misconfigured", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const [{ data: profile, error: profileError }, { data: listings, error: listingsError }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, avatar_url, is_influencer")
        .eq("id", sellerId)
        .maybeSingle(),
      supabase
        .from("v_feed_listings")
        .select("cover_photo_url")
        .eq("seller_id", sellerId)
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(1),
    ]);

  if (profileError) {
    console.error("closet-share profile error", profileError.message);
    return new Response("Unable to load profile", { status: 500 });
  }
  if (listingsError) {
    console.error("closet-share listings error", listingsError.message);
  }

  if (!profile) {
    return unavailablePage(
      req,
      sellerId,
      "Dressing introuvable",
      "Ce profil n'existe plus sur Bloomi.",
    );
  }

  const displayName =
    typeof profile.display_name === "string" && profile.display_name.trim()
      ? profile.display_name.trim()
      : "Bloomi";

  const { count: listingCount } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("seller_id", sellerId)
    .eq("status", "published");

  const coverFromListing =
    typeof listings?.[0]?.cover_photo_url === "string"
      ? listings[0].cover_photo_url.trim()
      : "";
  const avatarUrl =
    typeof profile.avatar_url === "string" ? profile.avatar_url.trim() : "";
  const imageUrl = coverFromListing || avatarUrl || null;

  const countLabel =
    typeof listingCount === "number" && listingCount > 0
      ? `${listingCount} article${listingCount > 1 ? "s" : ""}`
      : "Dressing";
  const influencerSuffix = profile.is_influencer ? " · Influenceur" : "";
  const title = `Dressing de ${displayName}`;
  const description = `${countLabel} sur Bloomi${influencerSuffix}`;
  const canonicalUrl = buildPublicShareUrl(req, `/dressing/${sellerId}`);

  const html = renderSharePage({
    title,
    description,
    imageUrl,
    canonicalUrl,
    deepLink: `bloomi://dressing/${sellerId}`,
    badge: "Dressing",
    ctaLabel: "Voir le dressing dans Bloomi",
  });

  return htmlResponse(html, {
    status: 200,
    headers: { "Cache-Control": "public, max-age=300" },
  }, req.method);
});
