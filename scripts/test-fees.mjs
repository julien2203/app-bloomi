import assert from 'node:assert/strict';
import {
  computeBuyerFees,
  computeSellerFees,
  computeBuyerFinalPriceChf,
  roundChf
} from '../lib/fees.ts';

assert.equal(computeBuyerFees(0), null);
assert.equal(computeBuyerFees(NaN), null);

const buyer = computeBuyerFees(50);
assert.ok(buyer);
assert.equal(buyer.finalPriceChf, roundChf(50 + 50 * 0.12 + 50 * 0.03));

const seller = computeSellerFees(50, 'individual');
assert.ok(seller);
assert.equal(seller.commissionChf, roundChf(50 * 0.08));

assert.equal(computeBuyerFinalPriceChf(0), 0);

console.log('fees:test OK');
