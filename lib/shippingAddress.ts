export type ShippingAddressFields = {
  street?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

export function normalizeShippingCountry(country: string | null | undefined): string {
  return String(country ?? 'CH')
    .trim()
    .toUpperCase();
}

export function formatLegalFullName(
  firstName?: string | null,
  lastName?: string | null
): string {
  return [String(firstName ?? '').trim(), String(lastName ?? '').trim()]
    .filter(Boolean)
    .join(' ')
    .trim();
}

/** Rue + NPA + ville renseignés (indépendamment du pays profil / téléphone). */
export function isCompletePostalAddress(fields: {
  street?: string | null;
  city?: string | null;
  postalCode?: string | null;
}): boolean {
  const street = String(fields.street ?? '').trim();
  const city = String(fields.city ?? '').trim();
  const postalCode = String(fields.postalCode ?? '').trim();
  return Boolean(street && city && postalCode);
}

/** Adresse de livraison complète pour expédition La Poste (CH). */
export function isCompleteShippingAddress(fields: ShippingAddressFields): boolean {
  const street = String(fields.street ?? '').trim();
  const city = String(fields.city ?? '').trim();
  const postalCode = String(fields.postalCode ?? '').trim();
  const country = normalizeShippingCountry(fields.country);
  return Boolean(street && city && postalCode && country === 'CH');
}

export function shippingAddressFromOrderRow(row: {
  shipping_address?: string | null;
  shipping_city?: string | null;
  shipping_postal_code?: string | null;
  shipping_country?: string | null;
}): ShippingAddressFields {
  return {
    street: row.shipping_address,
    city: row.shipping_city,
    postalCode: row.shipping_postal_code,
    country: row.shipping_country
  };
}
