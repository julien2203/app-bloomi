import { supabase } from './supabase';
import { SUPABASE_URL } from './env';

export type ListingAudienceEvent = 'price_drop' | 'published';

/**
 * Notifie l'audience d'une annonce (favoris / followers) via Edge Function.
 * Best-effort : n'interrompt jamais le flux vendeur.
 */
export async function notifyListingAudience(params: {
  event: ListingAudienceEvent;
  listingId: string;
  oldPrice?: number;
  newPrice?: number;
}): Promise<void> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;

    await fetch(`${SUPABASE_URL}/functions/v1/notify-listing-audience`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        event: params.event,
        listing_id: params.listingId,
        old_price: params.oldPrice,
        new_price: params.newPrice
      })
    });
  } catch {
    // silent
  }
}
