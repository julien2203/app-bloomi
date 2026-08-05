import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildPublicShareUrl,
  htmlResponse,
  isUuid,
  parseShareId,
  renderSharePage,
} from "../_shared/sharePage.ts";

type ListingPhoto = { url?: string | null; order_index?: number | null };

function firstPhotoUrl(photos: unknown): string | null {
  if (!Array.isArray(photos) || photos.length === 0) return null;
  const sorted = [...photos].sort(
    (a, b) =>
      Number((a as ListingPhoto)?.order_index ?? 0) -
      Number((b as ListingPhoto)?.order_index ?? 0),
  );
  const url = (sorted[0] as ListingPhoto)?.url;
  return typeof url === "string" && url.trim() ? url.trim() : null;
}

function buildDescription(row: Record<string, unknown>): string {
  const price = Number(row.price);
  const priceLabel = Number.isFinite(price) ? `${price.toFixed(2)} CHF` : "";
  const brand = typeof row.brand === "string" ? row.brand.trim() : "";
  const description =
    typeof row.description === "string" ? row.description.trim() : "";

  const parts = [priceLabel, brand].filter(Boolean);
  if (parts.length > 0) return parts.join(" · ");
  if (description) return description.slice(0, 160);
  return "Découvre cet article sur Bloomi";
}

function unavailablePage(req: Request, listingId: string, title: string, description: string) {
  const canonicalUrl = buildPublicShareUrl(req, `/listing/${listingId}`);
  const html = renderSharePage({
    title,
    description,
    imageUrl: null,
    canonicalUrl,
    deepLink: `bloomi://listing/${listingId}`,
    badge: "Annonce",
    unavailable: true,
  });
  return htmlResponse(html, { status: 404 }, req.method);
}

Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const listingId = parseShareId(req, {
    segment: "listing",
    functionName: "listing-share",
  });
  if (!listingId) {
    return new Response("Missing listing id", { status: 400 });
  }

  if (!isUuid(listingId)) {
    return unavailablePage(
      req,
      listingId,
      "Annonce introuvable",
      "Cette annonce n'existe plus sur Bloomi.",
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response("Server misconfigured", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await supabase
    .from("v_listing_detail")
    .select("id, title, description, price, brand, status, photos")
    .eq("id", listingId)
    .maybeSingle();

  if (error) {
    console.error("listing-share query error", error.message);
    return new Response("Unable to load listing", { status: 500 });
  }

  if (!data) {
    return unavailablePage(
      req,
      listingId,
      "Annonce introuvable",
      "Cette annonce n'existe plus sur Bloomi.",
    );
  }

  const status = String((data as { status?: string }).status ?? "").toLowerCase();
  const unavailable = status !== "published";
  const title =
    typeof (data as { title?: string }).title === "string" &&
    (data as { title: string }).title.trim()
      ? (data as { title: string }).title.trim()
      : "Annonce Bloomi";

  const canonicalUrl = buildPublicShareUrl(req, `/listing/${listingId}`);
  const html = renderSharePage({
    title,
    description: buildDescription(data as Record<string, unknown>),
    imageUrl: firstPhotoUrl((data as { photos?: unknown }).photos),
    canonicalUrl,
    deepLink: `bloomi://listing/${listingId}`,
    badge: unavailable ? "Indisponible" : "Annonce",
    unavailable,
    ctaLabel: unavailable ? "Voir d'autres articles" : "Voir l'annonce dans Bloomi",
  });

  return htmlResponse(html, {
    status: unavailable ? 410 : 200,
    headers: { "Cache-Control": "public, max-age=300" },
  }, req.method);
});
