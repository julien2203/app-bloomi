import { useMemo } from 'react';
import type { ParcelSizeValue } from './store/sellForm';
import { roundChf } from './fees';

export type ParcelShippingQuote = {
  feeChf: number;
  isPromo: boolean;
};

/** Tarifs livraison catalogue (hors promo « 300 premières commandes », plafond 5 CHF). */
const STANDARD_PARCEL_SHIPPING_FEE_CENTS: Record<ParcelSizeValue, number> = {
  letter_aplus: 390,
  small: 900,
  large: 1200,
  xlarge: 2100
};

export function getStandardParcelShippingFeeChf(
  parcelSize: string | null | undefined
): number | null {
  if (!parcelSize) return null;
  const key = parcelSize as ParcelSizeValue;
  const cents = STANDARD_PARCEL_SHIPPING_FEE_CENTS[key];
  return cents != null ? roundChf(cents / 100) : null;
}

const PARCEL_SIZES: ParcelSizeValue[] = ['letter_aplus', 'small', 'large', 'xlarge'];
/** Frais affichés au vendeur lors du choix de taille de colis (tarifs standards). */
export function useParcelShippingFees() {
  const quotes = useMemo(() => {
    const next: Partial<Record<ParcelSizeValue, ParcelShippingQuote>> = {};
    for (const size of PARCEL_SIZES) {
      next[size] = {
        feeChf: roundChf(STANDARD_PARCEL_SHIPPING_FEE_CENTS[size] / 100),
        isPromo: false
      };
    }
    return next;
  }, []);

  return { quotes, loading: false };
}
