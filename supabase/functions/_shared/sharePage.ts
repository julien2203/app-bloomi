export const IOS_APP_STORE = "https://apps.apple.com/app/id6760400669";
export const ANDROID_PLAY_STORE =
  "https://play.google.com/store/apps/details?id=com.jupouch.bloomiapp";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function parseShareId(
  req: Request,
  options: { segment: "listing" | "dressing"; functionName: string },
): string | null {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("id")?.trim();
  if (fromQuery) return fromQuery;

  const parts = url.pathname.split("/").filter(Boolean);
  const segmentIndex = parts.findIndex((part) => part === options.segment);
  if (segmentIndex >= 0 && parts[segmentIndex + 1]) {
    return parts[segmentIndex + 1].trim();
  }

  const fnIndex = parts.findIndex((part) => part === options.functionName);
  if (fnIndex >= 0 && parts[fnIndex + 1]) {
    return parts[fnIndex + 1].trim();
  }

  return null;
}

/** URL publique canonique (bloomi.ch) pour OG / partage. */
export function buildPublicShareUrl(req: Request, pathname: string): string {
  const envBase = Deno.env.get("PUBLIC_SHARE_BASE_URL")?.trim().replace(/\/+$/, "");
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const defaultBase = "https://bloomi.ch";
  const base = envBase || defaultBase;

  if (base) {
    return `${base}${normalizedPath}`;
  }

  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = (forwardedHost || req.headers.get("host") || "bloomi.ch")
    .split(",")[0]
    .trim()
    .replace(/^www\./, "");
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  return `${proto}://${host}${normalizedPath}`;
}

export function htmlResponse(
  html: string,
  init: ResponseInit,
  method = "GET",
): Response {
  const body = method === "HEAD" ? null : html;
  return new Response(body, {
    ...init,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      ...(init.headers ?? {}),
    },
  });
}

export type SharePageParams = {
  title: string;
  description: string;
  imageUrl: string | null;
  canonicalUrl: string;
  deepLink: string;
  badge?: string;
  unavailable?: boolean;
  ctaLabel?: string;
};

export function renderSharePage(params: SharePageParams): string {
  const {
    title,
    description,
    imageUrl,
    canonicalUrl,
    deepLink,
    badge,
    unavailable = false,
    ctaLabel = "Ouvrir dans l'app Bloomi",
  } = params;

  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeCanonical = escapeHtml(canonicalUrl);
  const safeImage = imageUrl ? escapeHtml(imageUrl) : "";
  const safeBadge = badge ? escapeHtml(badge) : "";
  const safeCta = escapeHtml(ctaLabel);
  const bodyText = unavailable
    ? "Ce contenu n'est plus disponible sur Bloomi."
    : "Découvre cette sélection seconde main sur Bloomi.";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle} — Bloomi</title>
  <meta name="description" content="${safeDescription}" />
  <link rel="canonical" href="${safeCanonical}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Bloomi" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDescription}" />
  <meta property="og:url" content="${safeCanonical}" />
  ${
    safeImage
      ? `<meta property="og:image" content="${safeImage}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="${safeImage}" />`
      : `<meta name="twitter:card" content="summary" />`
  }
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDescription}" />
  <style>
    :root {
      color-scheme: light;
      --bg: #f4f6ef;
      --card: #ffffff;
      --text: #1a1a1a;
      --muted: #5f5f5f;
      --accent: #c3ea4f;
      --accent-text: #1a1a1a;
      --border: #e8e8e8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background:
        radial-gradient(circle at top, rgba(195, 234, 79, 0.35), transparent 42%),
        var(--bg);
      color: var(--text);
      padding: 24px 16px 40px;
    }
    .shell {
      max-width: 440px;
      margin: 0 auto;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 20px;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .brand-mark {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: var(--accent);
      display: grid;
      place-items: center;
      font-weight: 800;
      color: var(--accent-text);
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 18px 50px rgba(0, 0, 0, 0.08);
    }
    .media {
      aspect-ratio: 4 / 5;
      background: #f0f0f0;
    }
    .media img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .content {
      padding: 20px;
    }
    .badge {
      display: inline-block;
      margin-bottom: 10px;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(195, 234, 79, 0.25);
      color: var(--text);
      font-size: 12px;
      font-weight: 600;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 1.35rem;
      line-height: 1.25;
    }
    .description {
      margin: 0 0 18px;
      color: var(--muted);
      line-height: 1.5;
    }
    .cta {
      display: block;
      width: 100%;
      text-align: center;
      text-decoration: none;
      background: var(--accent);
      color: var(--accent-text);
      font-weight: 700;
      padding: 14px 18px;
      border-radius: 12px;
      margin-bottom: 12px;
    }
    .stores {
      display: grid;
      gap: 8px;
    }
    .stores a {
      display: block;
      text-align: center;
      text-decoration: none;
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 12px 14px;
      font-weight: 600;
      background: #fafafa;
    }
    .footer {
      margin-top: 18px;
      text-align: center;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="shell">
    <div class="brand">
      <div class="brand-mark">B</div>
      <div>Bloomi</div>
    </div>
    <div class="card">
      ${
        safeImage
          ? `<div class="media"><img src="${safeImage}" alt="${safeTitle}" loading="lazy" /></div>`
          : ""
      }
      <div class="content">
        ${safeBadge ? `<div class="badge">${safeBadge}</div>` : ""}
        <h1>${safeTitle}</h1>
        <p class="description">${escapeHtml(bodyText)}</p>
        <p class="description">${safeDescription}</p>
        <a class="cta" id="open-app" href="${escapeHtml(deepLink)}">${safeCta}</a>
        <div class="stores">
          <a href="${escapeHtml(IOS_APP_STORE)}">Télécharger sur l'App Store</a>
          <a href="${escapeHtml(ANDROID_PLAY_STORE)}">Disponible sur Google Play</a>
        </div>
      </div>
    </div>
    <p class="footer">Seconde main, premier choix — la marketplace mode suisse.</p>
  </div>
  <script>
    (function () {
      var deepLink = ${JSON.stringify(deepLink)};
      var iosStore = ${JSON.stringify(IOS_APP_STORE)};
      var androidStore = ${JSON.stringify(ANDROID_PLAY_STORE)};
      var unavailable = ${unavailable ? "true" : "false"};
      if (unavailable) return;
      var ua = navigator.userAgent || "";
      var isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
      if (!isMobile) return;
      window.location.replace(deepLink);
      setTimeout(function () {
        if (/iPhone|iPad|iPod/i.test(ua)) {
          window.location.replace(iosStore);
        } else if (/Android/i.test(ua)) {
          window.location.replace(androidStore);
        }
      }, 1800);
    })();
  </script>
</body>
</html>`;
}
