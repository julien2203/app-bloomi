/** Liens HTTPS (e-mails) et deep links app (redirection mobile). */

function publicEmailLinkBase(): string {
  return Deno.env.get("PUBLIC_SHARE_BASE_URL")?.trim().replace(/\/+$/, "") || "https://bloomi.ch";
}

function emailOpenLink(openPath: string): string {
  const normalized = openPath.replace(/^\/+|\/+$/g, "");
  return `${publicEmailLinkBase()}/open/${normalized}`;
}

/** Résout un segment `/open/...` vers un deep link `bloomi://…`. */
export function resolveAppDeepLinkFromOpenPath(openPath: string): string | null {
  const path = openPath.replace(/^\/+|\/+$/g, "");
  if (!path) return null;

  if (path === "profile") return "bloomi://tabs/profile";
  if (path === "orders") return "bloomi://tabs/profile/orders";
  if (path === "sell") return "bloomi://tabs/sell";
  if (path === "wallet") return "bloomi://tabs/profile/wallet";
  if (path === "messages") return "bloomi://tabs/messages";

  const orderMatch = path.match(/^order\/(.+)$/);
  if (orderMatch?.[1]) {
    return `bloomi://tabs/profile/order/${orderMatch[1]}`;
  }

  const messageMatch = path.match(/^messages\/(.+)$/);
  if (messageMatch?.[1]) {
    return `bloomi://tabs/messages/${messageMatch[1]}`;
  }

  if (path === "feed") return "bloomi://tabs/feed";

  const listingMatch = path.match(/^listing\/(.+)$/);
  if (listingMatch?.[1]) {
    return `bloomi://listing/${listingMatch[1]}`;
  }

  return null;
}

export function profileHomeDeepLink(): string {
  return emailOpenLink("profile");
}

export function ordersDeepLink(): string {
  return emailOpenLink("orders");
}

export function orderDeepLink(orderId: string): string {
  const id = orderId.trim();
  return id ? emailOpenLink(`order/${encodeURIComponent(id)}`) : ordersDeepLink();
}

export function messagesThreadDeepLink(threadId: string): string {
  const id = threadId.trim();
  return id ? emailOpenLink(`messages/${encodeURIComponent(id)}`) : emailOpenLink("messages");
}

export function sellDeepLink(): string {
  return emailOpenLink("sell");
}

export function walletDeepLink(): string {
  return emailOpenLink("wallet");
}

export function listingDeepLink(listingId: string): string {
  const id = listingId.trim();
  if (!id) return profileHomeDeepLink();
  const base = publicEmailLinkBase();
  return `${base}/listing/${encodeURIComponent(id)}`;
}

export function feedDeepLink(): string {
  return emailOpenLink("feed");
}
