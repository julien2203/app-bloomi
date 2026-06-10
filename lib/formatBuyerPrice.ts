import { computeBuyerFees, computeBuyerFinalPriceChf, roundChf } from './fees';

export function formatChf(amount: number): string {
  try {
    return `${roundChf(amount).toFixed(2)} CHF`;
  } catch {
    const safe = Number(amount);
    return `${(Number.isFinite(safe) ? safe : 0).toFixed(2)} CHF`;
  }
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
    const fees = price > 0 && !isNaN(price) ? computeBuyerFees(price) : null;
    if (!fees) {
      const safe = Number(price);
      return `${(Number.isFinite(safe) ? roundChf(safe) : 0).toFixed(2)} ${currency}`;
    }
    return `${fees.finalPriceChf.toFixed(2)} ${currency}`;
  } catch {
    const safe = Number(price);
    return `${(Number.isFinite(safe) ? roundChf(safe) : 0).toFixed(2)} ${currency}`;
  }
}

export function formatPercent(rate: number): number {
  try {
    return Math.round(rate * 100);
  } catch {
    return 0;
  }
}

export { computeBuyerFees, computeBuyerFinalPriceChf };
