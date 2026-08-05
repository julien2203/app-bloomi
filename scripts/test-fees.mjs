import assert from 'node:assert/strict';
import {
  buildPaymentIntentFeeBreakdown,
  computeBuyerFees,
  computeSellerFees,
  computeBuyerFinalPriceChf,
  computeBuyerDisplayPriceChf,
  getBoostPriceCents,
  roundChf
} from '../lib/fees.ts';
import { computeOrderBuyerTotals } from '../lib/orderTotals.ts';

assert.equal(computeBuyerFees(0), null);
assert.equal(computeBuyerFees(NaN), null);

const buyer = computeBuyerFees(50);
assert.ok(buyer);
assert.equal(buyer.finalPriceChf, 58);

const buyerLow = computeBuyerFees(1);
assert.ok(buyerLow);
assert.equal(buyerLow.finalPriceChf, 2, '1 CHF + frais arrondi au supérieur → 2 CHF');

const seller = computeSellerFees(50, 'individual');
assert.ok(seller);
assert.equal(seller.commissionChf, roundChf(50 * 0.08));

const influencerSeller = computeSellerFees(50, { is_influencer: true });
assert.ok(influencerSeller);
assert.equal(influencerSeller.commissionChf, 0);
assert.equal(influencerSeller.netPayoutChf, 50);

const proSeller = computeSellerFees(50, {
  company_name: 'ACME SA',
  ide_number: 'CHE-123'
});
assert.ok(proSeller);
assert.equal(proSeller.commissionChf, 0);

const soleProprietorSeller = computeSellerFees(50, {
  seller_type: 'sole_proprietorship',
  company_name: 'Boutique Marie',
  ide_number: null
});
assert.ok(soleProprietorSeller);
assert.equal(soleProprietorSeller.profileType, 'pro');
assert.equal(soleProprietorSeller.commissionChf, 0);

const piIndividual = buildPaymentIntentFeeBreakdown({
  itemAmountCents: 5000,
  sellerProfile: {}
});
const piInfluencer = buildPaymentIntentFeeBreakdown({
  itemAmountCents: 5000,
  sellerProfile: { is_influencer: true }
});
assert.equal(
  piIndividual.totalCents,
  piInfluencer.totalCents,
  'acheteur paie le même total quel que soit le type de vendeur'
);
assert.ok(piIndividual.sellerCommissionCents > 0);
assert.equal(piInfluencer.sellerCommissionCents, 0);

assert.equal(computeBuyerFinalPriceChf(0), 0);

const display50 = computeBuyerDisplayPriceChf(50);
assert.equal(display50, 58);

assert.equal(
  piIndividual.totalCents,
  5800,
  'total acheteur arrondi à 58 CHF pour un article à 50 CHF'
);
assert.equal(getBoostPriceCents('listing', 3), 300);
assert.equal(getBoostPriceCents('listing', 7), 500);
assert.equal(getBoostPriceCents('dressing', 3), 500);
assert.equal(getBoostPriceCents('dressing', 7), 900);

const orderTotals = computeOrderBuyerTotals({
  listing_price: 50,
  buyer_protection_chf: 6,
  buyer_banking_fee_chf: 1.5,
  delivery_mode: 'pickup'
});
assert.ok(orderTotals);
assert.equal(orderTotals.finalPriceChf, 58);
assert.equal(orderTotals.buyerFeesChf, 8);
assert.equal(orderTotals.totalPaidChf, 58);

console.log('fees:test OK');
