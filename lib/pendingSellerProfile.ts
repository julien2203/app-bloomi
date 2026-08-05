import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const PENDING_SELLER_PROFILE_KEY = 'bloomi_pending_seller_profile_v1';

export type SellerTypeChoice = 'individual' | 'pro' | 'sole_proprietorship';

export type PendingSellerProfile = {
  sellerType: SellerTypeChoice;
  isInfluencer: boolean | null;
  influencerInstagram?: string;
  companyName?: string;
  ideNumber?: string;
  companyAddress?: string;
  companySocial?: string;
  email?: string;
};

export function buildProfileUpsertFromSellerProfile(
  userId: string,
  data: PendingSellerProfile
): Record<string, unknown> {
  const payload: Record<string, unknown> = { id: userId };

  if (data.isInfluencer === true) {
    payload.is_influencer_request = true;
    payload.influencer_request_at = new Date().toISOString();
    payload.influencer_instagram = data.influencerInstagram?.trim().replace(/^@+/, '') || null;
  }

  payload.seller_type = data.sellerType;

  if (data.sellerType === 'pro' || data.sellerType === 'sole_proprietorship') {
    payload.company_name = data.companyName?.trim() ?? null;
    payload.ide_number = data.ideNumber?.trim() || null;
    payload.company_address = data.companyAddress?.trim() ?? null;
    payload.company_social = data.companySocial?.trim() || null;
  }

  return payload;
}

export async function savePendingSellerProfile(data: PendingSellerProfile): Promise<void> {
  await AsyncStorage.setItem(PENDING_SELLER_PROFILE_KEY, JSON.stringify(data));
}

export async function getPendingSellerProfile(): Promise<PendingSellerProfile | null> {
  const raw = await AsyncStorage.getItem(PENDING_SELLER_PROFILE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as PendingSellerProfile;
  } catch {
    return null;
  }
}

export async function clearPendingSellerProfile(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_SELLER_PROFILE_KEY);
}

export async function upsertSellerProfileFields(
  userId: string,
  data: PendingSellerProfile
): Promise<{ error: { message: string } | null }> {
  const payload = buildProfileUpsertFromSellerProfile(userId, data);

  if (Object.keys(payload).length <= 1) {
    return { error: null };
  }

  const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });
  return { error: error ? { message: error.message } : null };
}

/**
 * Applique les choix seller-type stockés localement (inscription sans session immédiate).
 */
export async function applyPendingSellerProfile(
  userId: string,
  opts?: { email?: string | null }
): Promise<{ applied: boolean; error: { message: string } | null }> {
  const pending = await getPendingSellerProfile();
  if (!pending) {
    return { applied: false, error: null };
  }

  if (pending.email && opts?.email && pending.email.toLowerCase() !== opts.email.toLowerCase()) {
    return { applied: false, error: null };
  }

  const { error } = await upsertSellerProfileFields(userId, pending);
  if (error) {
    return { applied: false, error };
  }

  await clearPendingSellerProfile();
  return { applied: true, error: null };
}
