import { isCompleteShippingAddress } from './shippingAddress';

export type PickupAddressFields = {
  street: string;
  postal_code: string;
  city: string;
  country?: string;
};

export function isCompletePickupAddress(fields: {
  street?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
}): boolean {
  return isCompleteShippingAddress({
    street: fields.street,
    city: fields.city,
    postalCode: fields.postal_code,
    country: fields.country ?? 'CH'
  });
}

export function formatPickupAddressLine(fields: PickupAddressFields): string {
  const street = fields.street.trim();
  const postal = fields.postal_code.trim();
  const city = fields.city.trim();
  if (!street && !postal && !city) return '';
  if (postal && city) return `${street}, ${postal} ${city}`;
  return [street, postal, city].filter(Boolean).join(', ');
}

export type ListingPickupSnapshot = {
  pickup_primary_street: string | null;
  pickup_primary_postal_code: string | null;
  pickup_primary_city: string | null;
  pickup_work_street: string | null;
  pickup_work_postal_code: string | null;
  pickup_work_city: string | null;
};

export type ListingPickupSnapshotFields = {
  pickup_primary_street?: string | null;
  pickup_primary_postal_code?: string | null;
  pickup_primary_city?: string | null;
  pickup_work_street?: string | null;
  pickup_work_postal_code?: string | null;
  pickup_work_city?: string | null;
};

/**
 * Villes visibles sur la fiche produit (public).
 * Rue et NPA ne doivent jamais apparaître ici (confidentialité).
 */
export function listingPickupDisplayLines(listing: ListingPickupSnapshotFields): string[] {
  const cities: string[] = [];
  const primary = String(listing.pickup_primary_city ?? '').trim();
  const work = String(listing.pickup_work_city ?? '').trim();
  if (primary) cities.push(primary);
  if (work && work.toLowerCase() !== primary.toLowerCase()) {
    cities.push(work);
  }
  return cities;
}

/** True si au moins une ville de remise est connue (sans exiger rue/NPA). */
export function listingHasPublicPickupCity(listing: ListingPickupSnapshotFields): boolean {
  return listingPickupDisplayLines(listing).length > 0;
}

export function buildListingPickupSnapshot(
  primary: PickupAddressFields | null,
  work: PickupAddressFields | null
): ListingPickupSnapshot {
  return {
    pickup_primary_street: primary?.street ?? null,
    pickup_primary_postal_code: primary?.postal_code ?? null,
    pickup_primary_city: primary?.city ?? null,
    pickup_work_street: work?.street ?? null,
    pickup_work_postal_code: work?.postal_code ?? null,
    pickup_work_city: work?.city ?? null
  };
}
