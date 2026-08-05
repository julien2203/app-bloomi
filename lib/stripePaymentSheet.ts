import type { PaymentSheet } from '@stripe/stripe-react-native';
import { STRIPE_PUBLISHABLE_KEY } from './env';

export const STRIPE_MERCHANT_IDENTIFIER = 'merchant.com.jupouch.bloomiapp';
export const STRIPE_MERCHANT_COUNTRY_CODE = 'CH';
export const STRIPE_CURRENCY_CODE = 'chf';
export const STRIPE_URL_SCHEME = 'bloomi';
export const STRIPE_RETURN_URL = `${STRIPE_URL_SCHEME}://stripe-redirect`;

/** Retour 3DS / banque après Payment Sheet (ferme la webview Stripe). */
export function isStripePaymentReturnUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === `${STRIPE_URL_SCHEME}:` && parsed.host === 'stripe-redirect';
  } catch {
    return false;
  }
}

/** True when the publishable key is pk_test_ (Google Pay testEnv must match). */
export function isStripeTestMode(): boolean {
  const k = STRIPE_PUBLISHABLE_KEY ?? '';
  return k.startsWith('pk_test_');
}

type BuildPaymentSheetParams = {
  clientSecret: string;
  merchantDisplayName?: string;
  /** TWINT-only intents must not advertise card wallets. */
  includeWalletPay?: boolean;
};

/** Shared Payment Sheet config (Apple Pay + Google Pay + card). */
export function buildStripePaymentSheetParams({
  clientSecret,
  merchantDisplayName = 'Bloomi',
  includeWalletPay = true
}: BuildPaymentSheetParams): PaymentSheet.SetupParams {
  return {
    merchantDisplayName,
    paymentIntentClientSecret: clientSecret,
    returnURL: STRIPE_RETURN_URL,
    ...(includeWalletPay
      ? {
          applePay: {
            merchantCountryCode: STRIPE_MERCHANT_COUNTRY_CODE
          },
          googlePay: {
            merchantCountryCode: STRIPE_MERCHANT_COUNTRY_CODE,
            testEnv: isStripeTestMode(),
            currencyCode: STRIPE_CURRENCY_CODE
          },
          paymentMethodOrder: ['apple_pay', 'google_pay', 'card']
        }
      : {}),
    allowsDelayedPaymentMethods: false,
    defaultBillingDetails: {
      address: {
        country: STRIPE_MERCHANT_COUNTRY_CODE
      }
    }
  };
}
