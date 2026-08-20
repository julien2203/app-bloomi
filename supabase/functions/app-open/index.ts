import "@supabase/functions-js/edge-runtime.d.ts";
import { resolveAppDeepLinkFromOpenPath } from "../_shared/emailDeepLinks.ts";
import { buildPublicShareUrl, htmlResponse, renderSharePage } from "../_shared/sharePage.ts";

function parseOpenPath(req: Request): string | null {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("path")?.trim();
  if (fromQuery) return fromQuery;

  const parts = url.pathname.split("/").filter(Boolean);
  const fnIndex = parts.findIndex((part) => part === "app-open");
  if (fnIndex >= 0 && parts[fnIndex + 1]) {
    return parts.slice(fnIndex + 1).join("/");
  }

  return null;
}

function unavailablePage(req: Request, method: string): Response {
  const html = renderSharePage({
    title: "Bloomi",
    description: "Ce lien n'est plus disponible.",
    imageUrl: null,
    canonicalUrl: buildPublicShareUrl(req, "/open"),
    deepLink: "bloomi://tabs/feed",
    ctaLabel: "Ouvrir Bloomi",
    unavailable: true,
  });
  return htmlResponse(html, { status: 404 }, method);
}

Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const openPath = parseOpenPath(req);
  if (!openPath) {
    return unavailablePage(req, req.method);
  }

  const deepLink = resolveAppDeepLinkFromOpenPath(openPath);
  if (!deepLink) {
    return unavailablePage(req, req.method);
  }

  const canonicalUrl = buildPublicShareUrl(req, `/open/${openPath.replace(/^\/+|\/+$/g, "")}`);
  const html = renderSharePage({
    title: "Bloomi",
    description: "Ouvrez l'application Bloomi pour continuer.",
    imageUrl: null,
    canonicalUrl,
    deepLink,
    ctaLabel: "Ouvrir Bloomi",
  });

  return htmlResponse(html, { status: 200 }, req.method);
});
