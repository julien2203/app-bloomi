import { supabase } from './supabase';
import { orderBlocksAcceptedOfferCheckout } from './messagesOfferCheckout';

export type BuyerListingOfferGate =
  | { canOffer: true }
  | {
      canOffer: false;
      reason: 'pending' | 'accepted';
      threadId: string;
      offerMessageId: string;
      amount: number;
    };

export async function getBuyerListingOfferGate(
  listingId: string
): Promise<{ data: BuyerListingOfferGate | null; error: string | null }> {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: 'NOT_SIGNED_IN' };
  }

  const { data: pending, error: pendingErr } = await supabase
    .from('messages')
    .select('id, thread_id, offer_amount')
    .eq('listing_id', listingId)
    .eq('sender_id', user.id)
    .eq('type', 'offer')
    .eq('offer_status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pendingErr) {
    return { data: null, error: pendingErr.message };
  }

  if (pending) {
    return {
      data: {
        canOffer: false,
        reason: 'pending',
        threadId: String(pending.thread_id),
        offerMessageId: String(pending.id),
        amount: Number(pending.offer_amount)
      },
      error: null
    };
  }

  const { data: accepted, error: acceptedErr } = await supabase
    .from('messages')
    .select('id, thread_id, offer_amount')
    .eq('listing_id', listingId)
    .eq('sender_id', user.id)
    .eq('type', 'offer')
    .eq('offer_status', 'accepted')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (acceptedErr) {
    return { data: null, error: acceptedErr.message };
  }

  if (accepted) {
    const { data: orderRow } = await supabase
      .from('orders')
      .select('status, payment_status')
      .eq('listing_id', listingId)
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const order = orderRow as { status?: string | null; payment_status?: string | null } | null;
    if (!orderBlocksAcceptedOfferCheckout(order?.status, order?.payment_status)) {
      return {
        data: {
          canOffer: false,
          reason: 'accepted',
          threadId: String(accepted.thread_id),
          offerMessageId: String(accepted.id),
          amount: Number(accepted.offer_amount)
        },
        error: null
      };
    }
  }

  return { data: { canOffer: true }, error: null };
}
