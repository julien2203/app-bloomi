import {
  computeBuyerFees,
  computeBuyerDisplayPriceChf,
  computeBuyerFinalPriceChf,
  roundChf,
  roundChfToInteger
} from './fees';

export function formatChf(amount: number): string {
  try {
    return `${roundChf(amount).toFixed(2)} CHF`;
  } catch {
    const safe = Number(amount);
    return `${(Number.isFinite(safe) ? safe : 0).toFixed(2)} CHF`;
  }
}

/** Prix catalogue / checkout acheteur : entier CHF, sans décimales (ex. 61 CHF). */
export function formatCatalogPriceChf(amount: number, currency = 'CHF'): string {
  try {
    return `${roundChfToInteger(amount)} ${currency}`;
  } catch {
    const safe = Number(amount);
    return `${Number.isFinite(safe) ? Math.round(safe) : 0} ${currency}`;
  }
}

/**
 * Ligne « prix article / offre » dans un récap : toujours 2 décimales.
 * Ne pas utiliser formatCatalogPriceChf ici (ceil → 2.70 devient 3).
 */
export function formatItemPriceChf(amount: number, currency = 'CHF'): string {
  return formatChf(amount).replace(' CHF', ` ${currency}`);
}

/**
 * Ligne frais Bloomi dans un récap (peut être décimal).
 * Préfixe « + » optionnel côté UI.
 */
export function formatFeeLineChf(amount: number, currency = 'CHF'): string {
  return formatItemPriceChf(amount, currency);
}

export function formatChfAmount(amount: number): string {
  try {
    return roundChf(amount).toFixed(2);
  } catch {
    const safe = Number(amount);
    return (Number.isFinite(safe) ? safe : 0).toFixed(2);
  }
}

export function formatBuyerFinalPrice(price: number, currency = 'CHF'): string {
  try {
    const display = computeBuyerDisplayPriceChf(price);
    return formatCatalogPriceChf(display, currency);
  } catch {
    const safe = Number(price);
    return formatCatalogPriceChf(Number.isFinite(safe) ? safe : 0, currency);
  }
}

export function formatPercent(rate: number): number {
  try {
    return Math.round(rate * 100);
  } catch {
    return 0;
  }
}

export {
  computeBuyerFees,
  computeBuyerDisplayPriceChf,
  computeBuyerFinalPriceChf,
  roundChfToInteger
};
