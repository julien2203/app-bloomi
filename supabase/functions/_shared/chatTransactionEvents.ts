/** Partagé avec lib/chatTransactionEvents.ts — garder synchronisé. */

export type ChatEventKind =
  | "offer_accepted"
  | "offer_declined"
  | "order_confirmed"
  | "label_preparing"
  | "label_ready"
  | "order_shipped"
  | "buyer_confirm_prompt"
  | "transaction_complete"
  | "payment_released";

export type ChatEventDeliveryMode = "shipping" | "pickup";

export type ChatEventPayload = {
  kind: ChatEventKind;
  order_id?: string;
  offer_amount?: number;
  offer_message_id?: string;
  tracking_number?: string;
  delivery_mode?: ChatEventDeliveryMode;
  participant_name?: string;
  buyer_name?: string;
  seller_name?: string;
};

export const CHAT_EVENT_PREFIX = "@@bloomi:event:v1:";

export function encodeChatEventBody(payload: ChatEventPayload): string {
  return `${CHAT_EVENT_PREFIX}${JSON.stringify(payload)}`;
}

export function parseChatEventBody(body: string | null | undefined): ChatEventPayload | null {
  const raw = String(body ?? "").trim();
  if (!raw.startsWith(CHAT_EVENT_PREFIX)) return null;
  try {
    const parsed = JSON.parse(raw.slice(CHAT_EVENT_PREFIX.length)) as ChatEventPayload;
    if (!parsed?.kind) return null;
    return parsed;
  } catch {
    return null;
  }
}
