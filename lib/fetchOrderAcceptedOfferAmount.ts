import { supabase } from './supabase';

function parseOfferAmount(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

function orderOfferKey(listingId: string, buyerId: string): string {
  return `${listingId}:${buyerId}`;
}

/** Montant d'une offre acceptée pour une commande (source messagerie). */
export async function fetchAcceptedOfferAmountForOrder(params: {
  listingId: string;
  buyerId: string;
}): Promise<number | null> {
  const { data, error } = await supabase
    .from('messages')
    .select('offer_amount')
    .eq('listing_id', params.listingId)
    .eq('sender_id', params.buyerId)
    .eq('type', 'offer')
    .eq('offer_status', 'accepted')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !data?.length) return null;
  return parseOfferAmount(data[0].offer_amount);
}

/** Offres acceptées pour un lot de commandes (clé listingId:buyerId). */
export async function fetchAcceptedOfferAmountsForOrders(
  orders: Array<{ listing_id: string; buyer_id: string }>
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (orders.length === 0) return map;

  const listingIds = [...new Set(orders.map((o) => o.listing_id).filter(Boolean))];
  if (listingIds.length === 0) return map;

  const wanted = new Set(orders.map((o) => orderOfferKey(o.listing_id, o.buyer_id)));

  const { data, error } = await supabase
    .from('messages')
    .select('listing_id, sender_id, offer_amount, created_at')
    .in('listing_id', listingIds)
    .eq('type', 'offer')
    .eq('offer_status', 'accepted')
    .order('created_at', { ascending: false });

  if (error || !data) return map;

  const seen = new Set<string>();
  for (const row of data) {
    const listingId = String(row.listing_id ?? '');
    const buyerId = String(row.sender_id ?? '');
    if (!listingId || !buyerId) continue;
    const key = orderOfferKey(listingId, buyerId);
    if (!wanted.has(key) || seen.has(key)) continue;
    const amount = parseOfferAmount(row.offer_amount);
    if (amount == null) continue;
    map.set(key, amount);
    seen.add(key);
  }

  return map;
}

export function getOrderAcceptedOfferAmountFromMap(
  map: Map<string, number>,
  listingId: string,
  buyerId: string
): number | null {
  return map.get(orderOfferKey(listingId, buyerId)) ?? null;
}
