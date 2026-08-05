/**
 * Grille tarifaire Bloomi — source de vérité côté app.
 * Copie synchronisée : supabase/functions/_shared/fees.ts
 */

export type PriceTier = 'low' | 'mid' | 'high';
export type SellerProfileType = 'individual' | 'influencer' | 'pro';
export type BoostSponsorType = 'listing' | 'dressing';

export type SellerProfileInput = {
  is_influencer?: boolean | null;
  company_name?: string | null;
  ide_number?: string | null;
  seller_type?: 'individual' | 'pro' | 'sole_proprietorship' | null;
};

export type BuyerFeesBreakdown = {
  itemPriceChf: number;
  tier: PriceTier;
  protectionRate: number;
  bankingRate: number;
  protectionChf: number;
  bankingChf: number;
  totalBuyerFeesChf: number;
  finalPriceChf: number;
};

export type SellerFeesBreakdown = {
  itemPriceChf: number;
  tier: PriceTier;
  profileType: SellerProfileType;
  feeRate: number;
  commissionChf: number;
  netPayoutChf: number;
};

export type BoostOption = {
  sponsorType: BoostSponsorType;
  durationDays: 3 | 7;
  priceChf: number;
  priceCents: number;
};

export const BUYER_PROTECTION_RATES: Record<PriceTier, number> = {
  low: 0.12,
  mid: 0.1,
  high: 0.08
};

export const SELLER_FEE_RATES: Record<PriceTier, number> = {
  low: 0.08,
  mid: 0.07,
  high: 0.05
};

export const BANKING_FEE_RATE = 0.03;

export const BOOST_OPTIONS: readonly BoostOption[] = [
  { sponsorType: 'listing', durationDays: 3, priceChf: 3, priceCents: 300 },
  { sponsorType: 'listing', durationDays: 7, priceChf: 5, priceCents: 500 },
  { sponsorType: 'dressing', durationDays: 3, priceChf: 5, priceCents: 500 },
  { sponsorType: 'dressing', durationDays: 7, priceChf: 9, priceCents: 900 }
] as const;

const TIER_BOUNDS = {
  lowMax: 100,
  midMax: 200
} as const;

export function roundChf(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** Prix catalogue / paiement acheteur (hors livraison) : arrondi à l’entier CHF supérieur. */
export function roundChfToInteger(amount: number): number {
  return Math.ceil(roundChf(amount));
}

export function chfToCents(amountChf: number): number {
  return Math.round(roundChf(amountChf) * 100);
}

export function centsToChf(amountCents: number): number {
  return roundChf(amountCents / 100);
}

export function getPriceTier(itemPriceChf: number): PriceTier {
  const price = roundChf(itemPriceChf);
  if (!Number.isFinite(price) || price < 0) {
    throw new Error('itemPriceChf doit être un nombre >= 0');
  }
  if (price <= TIER_BOUNDS.lowMax) return 'low';
  if (price <= TIER_BOUNDS.midMax) return 'mid';
  return 'high';
}

export function resolveSellerProfileType(profile: SellerProfileInput): SellerProfileType {
  if (profile.is_influencer) return 'influencer';
  const sellerType = profile.seller_type?.trim();
  if (sellerType === 'pro' || sellerType === 'sole_proprietorship') return 'pro';
  if (profile.company_name?.trim() && profile.ide_number?.trim()) return 'pro';
  return 'individual';
}

export function isSellerFeeExempt(profileType: SellerProfileType): boolean {
  return profileType === 'influencer' || profileType === 'pro';
}

export function getBuyerProtectionRate(itemPriceChf: number): number {
  return BUYER_PROTECTION_RATES[getPriceTier(itemPriceChf)];
}

export function getSellerFeeRate(
  itemPriceChf: number,
  profileType: SellerProfileType = 'individual'
): number {
  if (isSellerFeeExempt(profileType)) return 0;
  return SELLER_FEE_RATES[getPriceTier(itemPriceChf)];
}

export function getBuyerFeeMultiplier(itemPriceChf: number): number {
  return getBuyerProtectionRate(itemPriceChf) + BANKING_FEE_RATE;
}

export function computeBuyerFinalPriceChf(itemPriceChf: number): number {
  const fees = computeBuyerFees(itemPriceChf);
  if (!fees) return roundChfToInteger(Number(itemPriceChf) || 0);
  return fees.finalPriceChf;
}

/** Prix affiché catalogue : article + protection acheteur + frais bancaires (hors livraison). */
export function computeBuyerDisplayPriceChf(itemPriceChf: number): number {
  return computeBuyerFinalPriceChf(itemPriceChf);
}

export function computeBuyerFees(itemPriceChf: number): BuyerFeesBreakdown | null {
  if (!itemPriceChf || isNaN(itemPriceChf) || itemPriceChf <= 0) {
    return null;
  }

  const itemPrice = roundChf(itemPriceChf);
  if (!Number.isFinite(itemPrice) || itemPrice <= 0) {
    return null;
  }

  const tier = getPriceTier(itemPrice);
  const protectionRate = BUYER_PROTECTION_RATES[tier];
  const protectionChf = roundChf(itemPrice * protectionRate);
  const bankingChf = roundChf(itemPrice * BANKING_FEE_RATE);
  const totalBuyerFeesChf = roundChf(protectionChf + bankingChf);

  return {
    itemPriceChf: itemPrice,
    tier,
    protectionRate,
    bankingRate: BANKING_FEE_RATE,
    protectionChf,
    bankingChf,
    totalBuyerFeesChf,
    finalPriceChf: roundChfToInteger(itemPrice + totalBuyerFeesChf)
  };
}

export function computeSellerFees(
  itemPriceChf: number,
  profile: SellerProfileInput | SellerProfileType = 'individual'
): SellerFeesBreakdown | null {
  if (!itemPriceChf || isNaN(itemPriceChf) || itemPriceChf <= 0) {
    return null;
  }

  const itemPrice = roundChf(itemPriceChf);
  if (!Number.isFinite(itemPrice) || itemPrice <= 0) {
    return null;
  }

  const profileType =
    typeof profile === 'string' ? profile : resolveSellerProfileType(profile);
  const tier = getPriceTier(itemPrice);
  const feeRate = getSellerFeeRate(itemPrice, profileType);
  const commissionChf = roundChf(itemPrice * feeRate);

  return {
    itemPriceChf: itemPrice,
    tier,
    profileType,
    feeRate,
    commissionChf,
    netPayoutChf: roundChf(itemPrice - commissionChf)
  };
}

export function findBoostOption(
  sponsorType: BoostSponsorType,
  durationDays: 3 | 7
): BoostOption | undefined {
  return BOOST_OPTIONS.find(
    (option) => option.sponsorType === sponsorType && option.durationDays === durationDays
  );
}

export function getBoostPriceCents(
  sponsorType: BoostSponsorType,
  durationDays: 3 | 7
): number {
  const option = findBoostOption(sponsorType, durationDays);
  if (!option) {
    throw new Error(`Option boost inconnue: ${sponsorType} / ${durationDays} jours`);
  }
  return option.priceCents;
}

export type OrderFeeSnapshot = {
  itemPriceChf: number;
  buyerProtectionChf: number;
  buyerBankingFeeChf: number;
  sellerCommissionChf: number;
  sellerFeeRate: number;
  sellerProfileType: SellerProfileType;
  sellerPayoutChf: number;
  shippingFeeChf: number;
  totalPaidChf: number;
};

export type PaymentIntentFeeMetadata = {
  itemAmountCents: number;
  buyerProtectionCents: number;
  buyerBankingFeeCents: number;
  sellerCommissionCents: number;
  sellerPayoutCents: number;
  sellerFeeRate: number;
  sellerProfileType: SellerProfileType;
  shippingFeeCents: number;
  roundingAdjustmentCents: number;
  platformRetentionCents: number;
  totalCents: number;
};

export function buildPaymentIntentFeeBreakdown(params: {
  itemAmountCents: number;
  sellerProfile?: SellerProfileInput;
  shippingFeeCents?: number;
}): PaymentIntentFeeMetadata {
  const itemAmountCents = Math.round(params.itemAmountCents);
  if (!Number.isFinite(itemAmountCents) || itemAmountCents <= 0) {
    throw new Error('itemAmountCents doit être un entier > 0');
  }

  const shippingFeeCents = Math.max(0, Math.round(params.shippingFeeCents ?? 0));
  const itemPriceChf = centsToChf(itemAmountCents);
  const buyerFees = computeBuyerFees(itemPriceChf);
  const sellerFees = computeSellerFees(itemPriceChf, params.sellerProfile ?? {});
  if (!buyerFees || !sellerFees) {
    throw new Error('itemAmountCents invalide pour le calcul des frais');
  }

  const buyerProtectionCents = chfToCents(buyerFees.protectionChf);
  const buyerBankingFeeCents = chfToCents(buyerFees.bankingChf);
  const sellerCommissionCents = chfToCents(sellerFees.commissionChf);
  const sellerPayoutCents = chfToCents(sellerFees.netPayoutChf);
  const buyerSubtotalCentsRaw =
    itemAmountCents + buyerProtectionCents + buyerBankingFeeCents;
  const buyerSubtotalCentsRounded = chfToCents(
    roundChfToInteger(centsToChf(buyerSubtotalCentsRaw))
  );
  const roundingAdjustmentCents = buyerSubtotalCentsRounded - buyerSubtotalCentsRaw;
  const platformRetentionCents =
    buyerProtectionCents +
    buyerBankingFeeCents +
    shippingFeeCents +
    sellerCommissionCents +
    roundingAdjustmentCents;
  const totalCents = buyerSubtotalCentsRounded + shippingFeeCents;

  return {
    itemAmountCents,
    buyerProtectionCents,
    buyerBankingFeeCents,
    sellerCommissionCents,
    sellerPayoutCents,
    sellerFeeRate: sellerFees.feeRate,
    sellerProfileType: sellerFees.profileType,
    shippingFeeCents,
    roundingAdjustmentCents,
    platformRetentionCents,
    totalCents
  };
}

export function paymentIntentFeeMetadataToStrings(
  fees: PaymentIntentFeeMetadata
): Record<string, string> {
  return {
    item_amount_cents: String(fees.itemAmountCents),
    buyer_protection_cents: String(fees.buyerProtectionCents),
    buyer_banking_fee_cents: String(fees.buyerBankingFeeCents),
    seller_commission_cents: String(fees.sellerCommissionCents),
    seller_payout_cents: String(fees.sellerPayoutCents),
    seller_fee_rate: String(fees.sellerFeeRate),
    seller_profile_type: fees.sellerProfileType,
    shipping_fee_cents: String(fees.shippingFeeCents),
    rounding_adjustment_cents: String(fees.roundingAdjustmentCents),
    platform_retention_cents: String(fees.platformRetentionCents),
    commission_cents: String(fees.platformRetentionCents)
  };
}

export function parsePaymentIntentFeeMetadata(
  metadata: Record<string, string | undefined> | null | undefined
): PaymentIntentFeeMetadata | null {
  if (!metadata) return null;

  const sellerPayoutCents = Number(metadata.seller_payout_cents ?? '');
  const itemAmountCents = Number(metadata.item_amount_cents ?? '');
  if (!Number.isFinite(sellerPayoutCents) || sellerPayoutCents <= 0) {
    return null;
  }
  if (!Number.isFinite(itemAmountCents) || itemAmountCents <= 0) {
    return null;
  }

  const buyerProtectionCents = Number(metadata.buyer_protection_cents ?? '0');
  const buyerBankingFeeCents = Number(metadata.buyer_banking_fee_cents ?? '0');
  const sellerCommissionCents = Number(metadata.seller_commission_cents ?? '0');
  const shippingFeeCents = Number(metadata.shipping_fee_cents ?? '0');
  const roundingAdjustmentCents = Number(metadata.rounding_adjustment_cents ?? '0');
  const platformRetentionCents = Number(
    metadata.platform_retention_cents ?? metadata.commission_cents ?? '0'
  );
  const sellerFeeRate = Number(metadata.seller_fee_rate ?? '0');
  const sellerProfileType = (metadata.seller_profile_type ?? 'individual') as SellerProfileType;
  const buyerSubtotalCentsRaw =
    itemAmountCents + buyerProtectionCents + buyerBankingFeeCents;
  const buyerSubtotalCentsRounded =
    roundingAdjustmentCents !== 0
      ? buyerSubtotalCentsRaw + roundingAdjustmentCents
      : chfToCents(roundChfToInteger(centsToChf(buyerSubtotalCentsRaw)));
  const totalCents = buyerSubtotalCentsRounded + shippingFeeCents;

  return {
    itemAmountCents,
    buyerProtectionCents,
    buyerBankingFeeCents,
    sellerCommissionCents,
    sellerPayoutCents,
    sellerFeeRate,
    sellerProfileType,
    shippingFeeCents,
    roundingAdjustmentCents,
    platformRetentionCents,
    totalCents
  };
}

export function paymentIntentFeesToOrderSnapshot(
  fees: PaymentIntentFeeMetadata
): OrderFeeSnapshot {
  return {
    itemPriceChf: centsToChf(fees.itemAmountCents),
    buyerProtectionChf: centsToChf(fees.buyerProtectionCents),
    buyerBankingFeeChf: centsToChf(fees.buyerBankingFeeCents),
    sellerCommissionChf: centsToChf(fees.sellerCommissionCents),
    sellerFeeRate: fees.sellerFeeRate,
    sellerProfileType: fees.sellerProfileType,
    sellerPayoutChf: centsToChf(fees.sellerPayoutCents),
    shippingFeeChf: centsToChf(fees.shippingFeeCents),
    totalPaidChf: centsToChf(fees.totalCents)
  };
}
