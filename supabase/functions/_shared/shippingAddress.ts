export type ShippingAddressFields = {
  street?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

export function normalizeShippingCountry(country: string | null | undefined): string {
  return String(country ?? "CH")
    .trim()
    .toUpperCase();
}

/** Adresse de livraison complète pour expédition La Poste (CH). */
export function isCompleteShippingAddress(fields: ShippingAddressFields): boolean {
  const street = String(fields.street ?? "").trim();
  const city = String(fields.city ?? "").trim();
  const postalCode = String(fields.postalCode ?? "").trim();
  const country = normalizeShippingCountry(fields.country);
  return Boolean(street && city && postalCode && country === "CH");
}
