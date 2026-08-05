import { roundChf } from './fees';

export type OfferPreset = {
  /** Montant d'offre (CHF, 2 décimales max). */
  amount: number;
  /** Réduction par rapport au prix listing (CHF). */
  discountChf: number;
};

/**
 * Trois montants d'offre prédéfinis en CHF (pas de %),
 * avec des pas « propres » (0.50 / 1 / …) pour éviter les décimales moches.
 */
export function buildOfferPresetAmounts(listingPriceChf: number): OfferPreset[] {
  const price = roundChf(listingPriceChf);
  if (!(price >= 1)) return [];

  let discounts: number[];
  if (price >= 20) {
    discounts = [2, 4, 6];
  } else if (price >= 10) {
    discounts = [1, 2, 3];
  } else if (price >= 4) {
    discounts = [0.5, 1, 1.5];
  } else {
    discounts = [0.5, 1, 1.5];
  }

  const seen = new Set<string>();
  const presets: OfferPreset[] = [];
  for (const discount of discounts) {
    const amount = roundChf(price - discount);
    if (!(amount >= 0.5) || !(amount < price)) continue;
    const key = amount.toFixed(2);
    if (seen.has(key)) continue;
    seen.add(key);
    presets.push({ amount, discountChf: roundChf(price - amount) });
    if (presets.length >= 3) break;
  }

  return presets;
}

/** Formate une réduction preset, ex. « −1 CHF » / « −0.50 CHF ». */
export function formatOfferDiscountLabel(discountChf: number): string {
  const d = roundChf(discountChf);
  const body = Number.isInteger(d) ? String(d) : d.toFixed(2);
  return `−${body} CHF`;
}
