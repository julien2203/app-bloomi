import { supabase } from './supabase';

export const FEATURED_INFLUENCERS_LIMIT = 8;
const FEATURED_INFLUENCERS_POOL_LIMIT = 80;

export type FeaturedInfluencer = {
  id: string;
  display_name: string | null;
  image_url: string;
  active_listings_count: number;
};

function getIsoWeekSeed(date = new Date()): string {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  utc.setUTCDate(utc.getUTCDate() + 4 - (utc.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/** Mélange déterministe (même ordre pour tous les utilisateurs pendant la semaine). */
export function shuffleWithSeed<T>(items: T[], seed: string): T[] {
  const arr = [...items];
  let state = 0;
  for (let i = 0; i < seed.length; i++) {
    state = (state * 31 + seed.charCodeAt(i)) | 0;
  }
  for (let i = arr.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1_103_515_245) + 12_345) | 0;
    const j = (state >>> 0) % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickProfileImage(row: {
  cover_image?: string | null;
  avatar_url?: string | null;
}): string | null {
  const avatar = String(row.avatar_url ?? '').trim();
  if (avatar) return avatar;
  const cover = String(row.cover_image ?? '').trim();
  return cover || null;
}

export async function fetchFeaturedInfluencers(
  blockedSellerIds: string[] = []
): Promise<FeaturedInfluencer[]> {
  try {
    const blocked = new Set(blockedSellerIds.map(String));

    const { data: profs, error: profErr } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, cover_image')
      .eq('is_influencer', true)
      .limit(FEATURED_INFLUENCERS_POOL_LIMIT);
    if (profErr) throw profErr;

    const candidates = (profs ?? []).filter((p) => !blocked.has(String(p.id)));
    const ids = candidates.map((p) => String(p.id)).filter(Boolean);
    if (ids.length === 0) return [];

    const [{ data: listingRows, error: listingErr }, { data: thumbRows, error: thumbErr }] =
      await Promise.all([
        supabase.from('listings').select('seller_id').in('seller_id', ids).eq('status', 'published'),
        supabase
          .from('v_feed_listings')
          .select('seller_id, cover_photo_url')
          .in('seller_id', ids)
          .eq('status', 'published')
          .order('created_at', { ascending: false })
          .limit(400)
      ]);
    if (listingErr) throw listingErr;
    if (thumbErr) throw thumbErr;

    const countBySeller = new Map<string, number>();
    for (const row of listingRows ?? []) {
      const sid = String((row as { seller_id?: string }).seller_id ?? '');
      if (!sid) continue;
      countBySeller.set(sid, (countBySeller.get(sid) ?? 0) + 1);
    }

    const thumbBySeller = new Map<string, string>();
    for (const row of thumbRows ?? []) {
      const sid = String((row as { seller_id?: string }).seller_id ?? '');
      const url = String((row as { cover_photo_url?: string }).cover_photo_url ?? '').trim();
      if (!sid || !url || thumbBySeller.has(sid)) continue;
      thumbBySeller.set(sid, url);
    }

    const built: FeaturedInfluencer[] = [];
    for (const p of candidates) {
      const id = String(p.id);
      const activeCount = countBySeller.get(id) ?? 0;
      if (activeCount <= 0) continue;

      const imageUrl = pickProfileImage(p) ?? thumbBySeller.get(id) ?? null;
      if (!imageUrl) continue;

      built.push({
        id,
        display_name: (p.display_name as string | null) ?? null,
        image_url: imageUrl,
        active_listings_count: activeCount
      });
    }

    return shuffleWithSeed(built, getIsoWeekSeed()).slice(0, FEATURED_INFLUENCERS_LIMIT);
  } catch {
    return [];
  }
}
