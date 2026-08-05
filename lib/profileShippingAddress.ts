import { Alert } from 'react-native';
import type { Router } from 'expo-router';
import type { TFunction } from 'i18next';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BLOOMI_COUNTRY_CODE } from './bloomiRegion';
import { formatLegalFullName, isCompletePostalAddress } from './shippingAddress';

export type ProfileShippingAddress = {
  street: string;
  postal_code: string;
  city: string;
  country: string;
  first_name: string;
  last_name: string;
  /** Prénom + Nom pour étiquette La Poste */
  full_name: string;
};

export async function fetchProfileShippingAddress(
  supabase: SupabaseClient,
  userId: string
): Promise<ProfileShippingAddress | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('street, postal_code, city, address_first_name, address_last_name')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as Record<string, unknown>;
  const street = String(row.street ?? '').trim();
  const postal_code = String(row.postal_code ?? '').trim();
  const city = String(row.city ?? '').trim();
  const first_name = String(row.address_first_name ?? '').trim();
  const last_name = String(row.address_last_name ?? '').trim();
  const full_name = formatLegalFullName(first_name, last_name);

  if (
    !isCompletePostalAddress({ street, city, postalCode: postal_code }) ||
    !first_name ||
    !last_name
  ) {
    return null;
  }

  return {
    street,
    postal_code,
    city,
    country: BLOOMI_COUNTRY_CODE,
    first_name,
    last_name,
    full_name
  };
}

export function promptCompleteProfileAddress(
  router: Router,
  t: TFunction,
  role: 'seller' | 'buyer'
): void {
  const titleKey =
    role === 'seller' ? 'profile.addressRequired.sellerTitle' : 'profile.addressRequired.buyerTitle';
  const messageKey =
    role === 'seller'
      ? 'profile.addressRequired.sellerMessage'
      : 'profile.addressRequired.buyerMessage';

  Alert.alert(t(titleKey), t(messageKey), [
    { text: t('common.cancel'), style: 'cancel' },
    {
      text: t('profile.addressRequired.cta'),
      onPress: () => router.push('/tabs/profile/my-address')
    }
  ]);
}

/** Charge l'adresse profil ou affiche une alerte avec redirection vers Mon adresse. */
export async function ensureProfileShippingAddress(
  supabase: SupabaseClient,
  userId: string,
  router: Router,
  t: TFunction,
  role: 'seller' | 'buyer'
): Promise<ProfileShippingAddress | null> {
  const address = await fetchProfileShippingAddress(supabase, userId);
  if (address) return address;
  promptCompleteProfileAddress(router, t, role);
  return null;
}
