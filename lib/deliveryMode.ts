export type ListingDeliveryMode = 'pickup' | 'shipping' | 'both';
export type CheckoutDeliveryMode = 'pickup' | 'shipping';

export function normalizeDeliveryMode(mode: string | null | undefined): ListingDeliveryMode {
  const dm = String(mode ?? 'both').toLowerCase();
  if (dm === 'pickup' || dm === 'shipping' || dm === 'both') return dm;
  return 'both';
}

export function deliveryModeIncludesShipping(mode: string | null | undefined): boolean {
  const dm = normalizeDeliveryMode(mode);
  return dm === 'shipping' || dm === 'both';
}

export function deliveryModeIncludesPickup(mode: string | null | undefined): boolean {
  const dm = normalizeDeliveryMode(mode);
  return dm === 'pickup' || dm === 'both';
}

/** Commande en remise en main propre (pas « both » hérité des anciennes commandes). */
export function isOrderPickupDelivery(deliveryMode: string | null | undefined): boolean {
  return String(deliveryMode ?? '').toLowerCase() === 'pickup';
}

export function defaultCheckoutDeliveryMode(
  listingMode: string | null | undefined
): CheckoutDeliveryMode {
  const dm = normalizeDeliveryMode(listingMode);
  if (dm === 'shipping') return 'shipping';
  return 'pickup';
}

export function isCheckoutDeliveryAllowed(
  listingMode: string | null | undefined,
  checkoutMode: CheckoutDeliveryMode
): boolean {
  if (checkoutMode === 'pickup') return deliveryModeIncludesPickup(listingMode);
  return deliveryModeIncludesShipping(listingMode);
}
