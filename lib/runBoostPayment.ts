import type { PaymentSheet } from '@stripe/stripe-react-native';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './env';
import { supabase } from './supabase';
import { buildStripePaymentSheetParams } from './stripePaymentSheet';
import type { BoostSponsorType } from './fees';

export class BoostPaymentCancelledError extends Error {
  constructor() {
    super('Payment cancelled');
    this.name = 'BoostPaymentCancelledError';
  }
}

type StripeSheetFns = {
  initPaymentSheet: (params: PaymentSheet.SetupParams) => Promise<{ error?: { message: string } }>;
  presentPaymentSheet: () => Promise<{ error?: { message: string; code?: string } }>;
};

export type RunBoostPaymentParams = {
  listingId: string;
  sellerId: string;
  sponsorType: BoostSponsorType;
  durationDays: 3 | 7;
} & StripeSheetFns;

export type RunBoostPaymentResult = {
  updated_count: number;
  sponsored_until?: string;
  duration_days?: number;
};

export async function runBoostPayment({
  listingId,
  sellerId,
  sponsorType,
  durationDays,
  initPaymentSheet,
  presentPaymentSheet
}: RunBoostPaymentParams): Promise<RunBoostPaymentResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error('Session expired. Please sign in again.');
  }

  const createRes = await fetch(`${SUPABASE_URL}/functions/v1/boost-listing`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action: 'create',
      listing_id: listingId,
      seller_id: sellerId,
      sponsor_type: sponsorType,
      duration_days: durationDays
    })
  });

  const createJson = (await createRes.json()) as {
    client_secret?: string;
    error?: string;
    details?: string;
  };

  if (!createRes.ok) {
    throw new Error(
      createJson.error && createJson.details
        ? `${createJson.error} (${createJson.details})`
        : createJson.error || createJson.details || 'boost-listing create failed'
    );
  }

  const clientSecret = createJson.client_secret;
  if (!clientSecret) throw new Error('Missing client_secret');

  const initRes = await initPaymentSheet(buildStripePaymentSheetParams({ clientSecret }));
  if (initRes.error) throw new Error(initRes.error.message);

  const presentRes = await presentPaymentSheet();
  if (presentRes.error) {
    if (presentRes.error.code === 'Canceled') {
      throw new BoostPaymentCancelledError();
    }
    throw new Error(presentRes.error.message);
  }

  const paymentIntentId = clientSecret.split('_secret')[0];
  if (!paymentIntentId) throw new Error('Invalid payment_intent_id');

  const confirmRes = await fetch(`${SUPABASE_URL}/functions/v1/boost-listing`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action: 'confirm',
      payment_intent_id: paymentIntentId
    })
  });

  const confirmJson = (await confirmRes.json()) as {
    success?: boolean;
    updated_count?: number;
    sponsored_until?: string;
    duration_days?: number;
    error?: string;
    details?: string;
  };

  if (!confirmRes.ok || confirmJson.success !== true) {
    throw new Error(
      confirmJson.error && confirmJson.details
        ? `${confirmJson.error} (${confirmJson.details})`
        : confirmJson.error || confirmJson.details || 'boost-listing confirm failed'
    );
  }

  return {
    updated_count: confirmJson.updated_count ?? 0,
    sponsored_until: confirmJson.sponsored_until,
    duration_days: confirmJson.duration_days
  };
}
