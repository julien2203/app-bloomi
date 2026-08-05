import { BANKING_FEE_RATE, computeBuyerFees, roundChf, roundChfToInteger } from './fees';
import { isOrderPickupDelivery } from './deliveryMode';
import { getStandardParcelShippingFeeChf } from './useParcelShippingFees';

function parseChf(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export type OrderPriceFields = {
  listing_price?: number | string | null;
  buyer_protection_chf?: number | string | null;
  buyer_banking_fee_chf?: number | string | null;
  seller_amount?: number | string | null;
  seller_commission_chf?: number | string | null;
  /** Offre acceptée (messagerie) — prioritaire sur listing_price. */
  accepted_offer_amount_chf?: number | null;
};

export type OrderBuyerTotals = {
  itemPriceChf: number;
  buyerProtectionChf: number;
  buyerBankingFeeChf: number;
  buyerFeesChf: number;
  shippingFeeChf: number;
  finalPriceChf: number;
  totalPaidChf: number;
  includesShipping: boolean;
  isPromoShipping: boolean;
  isAcceptedOffer: boolean;
};

function feesMatchItemPrice(
  itemPriceChf: number,
  protectionChf: number | null,
  bankingChf: number | null
): boolean {
  if (protectionChf == null || bankingChf == null) return false;
  const fees = computeBuyerFees(itemPriceChf);
  if (!fees) return false;
  return fees.protectionChf === protectionChf && fees.bankingChf === bankingChf;
}

function inferItemPriceFromBuyerFees(protectionChf: number, bankingChf: number): number | null {
  const fromBanking = roundChf(bankingChf / BANKING_FEE_RATE);
  const candidates = new Set<number>();
  for (const delta of [-0.02, -0.01, 0, 0.01, 0.02]) {
    const candidate = roundChf(fromBanking + delta);
    if (candidate > 0) candidates.add(candidate);
  }
  for (const candidate of candidates) {
    const fees = computeBuyerFees(candidate);
    if (fees && fees.protectionChf === protectionChf && fees.bankingChf === bankingChf) {
      return candidate;
    }
  }
  return null;
}

/** Prix article réellement payé (prix affiché ou offre acceptée). */
export function resolveOrderItemPriceChf(order: OrderPriceFields): number | null {
  const acceptedOffer = parseChf(order.accepted_offer_amount_chf ?? null);
  if (acceptedOffer != null) return acceptedOffer;

  const listingPrice = parseChf(order.listing_price);
  const protectionChf = parseChf(order.buyer_protection_chf);
  const bankingChf = parseChf(order.buyer_banking_fee_chf);

  if (protectionChf != null && bankingChf != null) {
    const inferred = inferItemPriceFromBuyerFees(protectionChf, bankingChf);
    if (inferred != null) return inferred;
  }

  const sellerPayout = parseChf(order.seller_amount);
  const sellerCommission = parseChf(order.seller_commission_chf);
  if (sellerPayout != null) {
    if (sellerCommission != null && sellerCommission >= 0) {
      return roundChf(sellerPayout + sellerCommission);
    }
    return sellerPayout;
  }

  if (listingPrice != null && feesMatchItemPrice(listingPrice, protectionChf, bankingChf)) {
    return listingPrice;
  }

  return listingPrice;
}

export function isOrderAcceptedOffer(
  order: OrderPriceFields & { listing?: { price?: number | string | null } | null }
): boolean {
  const acceptedOffer = parseChf(order.accepted_offer_amount_chf ?? null);
  if (acceptedOffer != null) {
    const listingOriginal = parseChf(order.listing?.price ?? order.listing_price ?? null);
    if (listingOriginal == null) return true;
    return Math.abs(listingOriginal - acceptedOffer) > 0.009;
  }

  const itemPrice = resolveOrderItemPriceChf(order);
  const listingOriginal = parseChf(order.listing?.price ?? null);
  if (itemPrice == null || listingOriginal == null) return false;
  return Math.abs(listingOriginal - itemPrice) > 0.009;
}

function resolveShippingFeeChf(order: {
  shipping_fee_chf?: number | string | null;
  parcel_size?: string | null;
  delivery_mode?: string | null;
}): number {
  if (isOrderPickupDelivery(order.delivery_mode)) return 0;

  const stored = parseChf(order.shipping_fee_chf);
  if (stored != null) return stored;

  return getStandardParcelShippingFeeChf(order.parcel_size) ?? 0;
}

export function computeOrderBuyerTotals(
  order: OrderPriceFields & {
    shipping_fee_chf?: number | string | null;
    delivery_mode?: string | null;
    parcel_size?: string | null;
    is_promo_shipping?: boolean | null;
    listing?: { price?: number | string | null } | null;
  }
): OrderBuyerTotals | null {
  const itemPriceChf = resolveOrderItemPriceChf(order);
  if (itemPriceChf == null) return null;

  const expectedFees = computeBuyerFees(itemPriceChf);
  let buyerProtectionChf = parseChf(order.buyer_protection_chf);
  let buyerBankingFeeChf = parseChf(order.buyer_banking_fee_chf);

  const storedFeesMatchItem =
    buyerProtectionChf != null &&
    buyerBankingFeeChf != null &&
    feesMatchItemPrice(itemPriceChf, buyerProtectionChf, buyerBankingFeeChf);

  if (!storedFeesMatchItem && expectedFees) {
    buyerProtectionChf = expectedFees.protectionChf;
    buyerBankingFeeChf = expectedFees.bankingChf;
  } else if (buyerProtectionChf == null || buyerBankingFeeChf == null) {
    if (expectedFees) {
      buyerProtectionChf = buyerProtectionChf ?? expectedFees.protectionChf;
      buyerBankingFeeChf = buyerBankingFeeChf ?? expectedFees.bankingChf;
    } else {
      buyerProtectionChf = buyerProtectionChf ?? 0;
      buyerBankingFeeChf = buyerBankingFeeChf ?? 0;
    }
  }

  const includesShipping = !isOrderPickupDelivery(order.delivery_mode);
  const shippingFeeChf = includesShipping ? resolveShippingFeeChf(order) : 0;
  const finalPriceChf =
    expectedFees?.finalPriceChf ??
    roundChfToInteger(itemPriceChf + buyerProtectionChf + buyerBankingFeeChf);
  const buyerFeesChf = roundChf(finalPriceChf - itemPriceChf);
  const totalPaidChf = finalPriceChf + shippingFeeChf;

  return {
    itemPriceChf,
    buyerProtectionChf,
    buyerBankingFeeChf,
    buyerFeesChf,
    shippingFeeChf,
    finalPriceChf,
    totalPaidChf,
    includesShipping,
    isPromoShipping: includesShipping && Boolean(order.is_promo_shipping),
    isAcceptedOffer: isOrderAcceptedOffer(order)
  };
}

/** `is_promo_shipping` = tarif réduit (300 premières commandes, plafond 5 CHF), pas une livraison à 0 CHF. */
export function formatOrderShippingFeeValue(
  shippingFeeChf: number,
  isPromoShipping: boolean,
  formatChfFn: (amount: number) => string,
  promoRateLabel: string,
  freeShippingLabel: string
): string {
  if (!Number.isFinite(shippingFeeChf) || shippingFeeChf <= 0.009) {
    return freeShippingLabel;
  }
  const formatted = `+${formatChfFn(shippingFeeChf)}`;
  return isPromoShipping ? `${formatted} (${promoRateLabel})` : formatted;
}
