import type { SupabaseClient } from '@supabase/supabase-js';
import { BLOOMI_COUNTRY_CODE } from './bloomiRegion';
import {
  buildListingPickupSnapshot,
  isCompletePickupAddress,
  type ListingPickupSnapshot,
  type PickupAddressFields
} from './pickupAddress';
import { isCompletePostalAddress } from './shippingAddress';

export type ProfilePickupAddresses = {
  primary: PickupAddressFields | null;
  work: PickupAddressFields | null;
};

function parseAddressRow(row: Record<string, unknown>, prefix: '' | 'work_'): PickupAddressFields | null {
  const street = String(row[`${prefix}street`] ?? '').trim();
  const postal_code = String(row[`${prefix}postal_code`] ?? '').trim();
  const city = String(row[`${prefix}city`] ?? '').trim();

  if (prefix === 'work_') {
    const country = String(row.work_country ?? BLOOMI_COUNTRY_CODE).trim().toUpperCase();
    if (!isCompletePickupAddress({ street, postal_code, city, country })) {
      return null;
    }
    return { street, postal_code, city, country };
  }

  if (!isCompletePostalAddress({ street, city, postalCode: postal_code })) {
    return null;
  }

  return { street, postal_code, city, country: BLOOMI_COUNTRY_CODE };
}

export async function fetchProfilePickupAddresses(
  supabase: SupabaseClient,
  userId: string
): Promise<ProfilePickupAddresses> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'street, postal_code, city, country, work_street, work_postal_code, work_city, work_country'
    )
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    return { primary: null, work: null };
  }

  const row = data as Record<string, unknown>;
  return {
    primary: parseAddressRow(row, ''),
    work: parseAddressRow(row, 'work_')
  };
}

export function listingPickupSnapshotFromProfile(
  addresses: ProfilePickupAddresses
): ListingPickupSnapshot {
  return buildListingPickupSnapshot(addresses.primary, addresses.work);
}
