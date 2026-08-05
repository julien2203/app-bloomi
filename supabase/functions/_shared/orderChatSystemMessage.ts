import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  encodeChatEventBody,
  type ChatEventPayload,
} from "./chatTransactionEvents.ts";

/**
 * Trouve ou crée le thread listing + acheteur + vendeur (service role, hors RLS).
 */
export async function findOrCreateThreadForOrderChat(
  admin: SupabaseClient,
  params: { listingId: string; buyerId: string; sellerId: string },
): Promise<string | null> {
  const { listingId, buyerId, sellerId } = params;
  const { data: existing, error: selErr } = await admin
    .from("threads")
    .select("id")
    .eq("listing_id", listingId)
    .eq("buyer_id", buyerId)
    .maybeSingle();

  if (selErr) {
    console.warn("findOrCreateThreadForOrderChat select:", selErr.message);
    return null;
  }
  if (existing && typeof (existing as { id?: string }).id === "string") {
    return (existing as { id: string }).id;
  }

  const { data: created, error: insErr } = await admin
    .from("threads")
    .insert({
      listing_id: listingId,
      buyer_id: buyerId,
      seller_id: sellerId,
    })
    .select("id")
    .single();

  if (!insErr && created && typeof (created as { id?: string }).id === "string") {
    return (created as { id: string }).id;
  }

  if (insErr && /duplicate|unique/i.test(String(insErr.message ?? ""))) {
    const { data: again, error: againErr } = await admin
      .from("threads")
      .select("id")
      .eq("listing_id", listingId)
      .eq("buyer_id", buyerId)
      .maybeSingle();
    if (!againErr && again && typeof (again as { id?: string }).id === "string") {
      return (again as { id: string }).id;
    }
  }

  console.warn("findOrCreateThreadForOrderChat insert:", insErr?.message);
  return null;
}

export async function insertThreadSystemMessage(
  admin: SupabaseClient,
  threadId: string,
  body: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { error: msgErr } = await admin.from("messages").insert({
    thread_id: threadId,
    sender_id: null,
    body,
    type: "system",
    is_system: true,
  });
  if (msgErr) {
    console.warn("insertThreadSystemMessage:", msgErr.message);
    return;
  }
  await admin.from("threads").update({ last_message_at: now }).eq("id", threadId);
}

export async function insertThreadEventMessage(
  admin: SupabaseClient,
  threadId: string,
  payload: ChatEventPayload,
): Promise<void> {
  await insertThreadSystemMessage(admin, threadId, encodeChatEventBody(payload));
}
