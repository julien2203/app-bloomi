/** Deep links Bloomi pour les CTA des e-mails transactionnels. */

export function profileHomeDeepLink(): string {
  return "bloomi://tabs/profile";
}

export function ordersDeepLink(): string {
  return "bloomi://tabs/profile/orders";
}

export function orderDeepLink(orderId: string): string {
  const id = orderId.trim();
  return id ? `bloomi://tabs/profile/order/${encodeURIComponent(id)}` : ordersDeepLink();
}

export function messagesThreadDeepLink(threadId: string): string {
  const id = threadId.trim();
  return id ? `bloomi://tabs/messages/${encodeURIComponent(id)}` : "bloomi://tabs/messages";
}

export function sellDeepLink(): string {
  return "bloomi://tabs/sell";
}

export function walletDeepLink(): string {
  return "bloomi://tabs/profile/wallet";
}
