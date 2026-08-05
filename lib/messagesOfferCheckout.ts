/** Commande existante qui empêche un nouvel achat via offre acceptée (cancelled = OK pour réacheter). */
export function orderBlocksAcceptedOfferCheckout(
  orderStatus: string | null | undefined,
  _paymentStatus?: string | null | undefined
): boolean {
  const status = String(orderStatus ?? '').toLowerCase();
  if (!status || status === 'cancelled') return false;

  // Toute commande active (y compris pending après paiement) bloque un nouveau checkout.
  // Avant: pending + payment !== transferred retournait false, ce qui laissait la barre
  // « Payer maintenant » visible après l'achat (payment_status n'est pas encore transferred).
  return (
    status === 'pending' ||
    status === 'completed' ||
    status === 'confirmed' ||
    status === 'shipped' ||
    status === 'delivered'
  );
}
