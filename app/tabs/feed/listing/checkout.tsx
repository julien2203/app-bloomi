import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStripe } from '@stripe/stripe-react-native';
import { getSafeBottomInset } from '../../../../lib/safeArea';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../../../lib/supabase';
import { isStripePublishableKeyConfigured, SUPABASE_URL } from '../../../../lib/env';
import { theme } from '../../../../lib/theme';
import { Button } from '../../../../components/ui/Button';
import { Text } from '../../../../components/ui/Text';
import { HeaderBackButton } from '../../../../components/ui/HeaderBackButton';
import { useAuthStore } from '../../../../stores/authStore';
import { openGuestAuthPrompt } from '../../../../lib/guestAuthPrompt';
import { computeBuyerFees, type BuyerFeesBreakdown } from '../../../../lib/fees';
import { formatCatalogPriceChf } from '../../../../lib/formatBuyerPrice';
import {
  BuyerPriceBreakdownSheet,
  BuyerPriceInfoButton
} from '../../../../components/pricing/BuyerPriceBreakdownSheet';
import {
  defaultCheckoutDeliveryMode,
  deliveryModeIncludesPickup,
  deliveryModeIncludesShipping,
  isCheckoutDeliveryAllowed,
  type CheckoutDeliveryMode,
  type ListingDeliveryMode
} from '../../../../lib/deliveryMode';
import { LetterAplusLabelNote } from '../../../../components/listing/LetterAplusLabelNote';
import { buildStripePaymentSheetParams } from '../../../../lib/stripePaymentSheet';
import {
  fetchProfileShippingAddress,
  promptCompleteProfileAddress,
  type ProfileShippingAddress
} from '../../../../lib/profileShippingAddress';

type CheckoutParams = {
  listing_id: string;
  seller_id: string;
  amount: string;
  title: string;
  cover_photo?: string;
  offer_message_id?: string;
  from_messages_thread?: string;
};

type DeliveryMode = CheckoutDeliveryMode;
type CheckoutPaymentMethod = 'card' | 'twint';

export default function CheckoutScreen() {
  const { t } = useTranslation();
  const shippingCountryLabel = t('feed.checkout.countryCH');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const safeBottom = getSafeBottomInset(insets.bottom);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const { user } = useAuthStore();
  const params = useLocalSearchParams<CheckoutParams>();

  const listingId = params.listing_id;
  const sellerId = params.seller_id;
  const amountNum = useMemo(() => {
    const n = Number(params.amount);
    return Number.isFinite(n) ? n : 0;
  }, [params.amount]);

  const title = params.title ?? 'Item';
  const coverPhoto = params.cover_photo ?? null;
  const offerMessageId = typeof params.offer_message_id === 'string' ? params.offer_message_id.trim() : '';
  const fromMessagesThread =
    typeof params.from_messages_thread === 'string' ? params.from_messages_thread.trim() : '';

  const handleCheckoutBack = useCallback(() => {
    if (fromMessagesThread && router.canGoBack?.()) {
      router.back();
      return;
    }
    if (router.canGoBack && router.canGoBack()) {
      router.back();
      return;
    }
    if (fromMessagesThread) {
      router.replace({
        pathname: '/tabs/messages/[id]',
        params: { id: fromMessagesThread, from_inbox: '1' }
      });
      return;
    }
    router.replace('/tabs/feed');
  }, [fromMessagesThread, router]);

  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('pickup');

  const [profileShippingAddress, setProfileShippingAddress] =
    useState<ProfileShippingAddress | null>(null);
  const [profileAddressLoaded, setProfileAddressLoaded] = useState(false);
  const shippingAddressAlertShownRef = useRef(false);

  const [paying, setPaying] = useState(false);
  const guestCheckoutPromptedRef = useRef(false);
  const [sellerVacationMode, setSellerVacationMode] = useState(false);

  const [parcelSize, setParcelSize] = useState<string | null>(null);
  const [listingDeliveryMode, setListingDeliveryMode] = useState<ListingDeliveryMode>('both');
  const [listingMetaLoaded, setListingMetaLoaded] = useState(false);
  const [shippingFeeCents, setShippingFeeCents] = useState<number | null>(null);
  const [showPriceBreakdown, setShowPriceBreakdown] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>('card');

  useEffect(() => {
    if (user?.id) {
      guestCheckoutPromptedRef.current = false;
      return;
    }
    if (guestCheckoutPromptedRef.current) return;
    guestCheckoutPromptedRef.current = true;
    openGuestAuthPrompt();
    if (router.canGoBack && router.canGoBack()) {
      router.back();
    } else {
      router.replace('/tabs/feed');
    }
  }, [user?.id, router]);

  useEffect(() => {
    if (!listingId) return;
    let cancelled = false;
    setListingMetaLoaded(false);
    void (async () => {
      const { data, error } = await supabase
        .from('listings')
        .select('parcel_size, delivery_mode')
        .eq('id', listingId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setListingMetaLoaded(true);
        return;
      }
      const row = data as { parcel_size?: string | null; delivery_mode?: string | null };
      const ps = row.parcel_size;
      if (ps) setParcelSize(String(ps));
      const dm = String(row.delivery_mode ?? 'both').toLowerCase() as ListingDeliveryMode;
      const normalized: ListingDeliveryMode =
        dm === 'pickup' || dm === 'shipping' || dm === 'both' ? dm : 'both';
      setListingDeliveryMode(normalized);
      setDeliveryMode(defaultCheckoutDeliveryMode(normalized));
      if (!cancelled) setListingMetaLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [listingId]);

  const showPickupOption = deliveryModeIncludesPickup(listingDeliveryMode);
  const showShippingOption = deliveryModeIncludesShipping(listingDeliveryMode);

  useEffect(() => {
    if (!sellerId) {
      setSellerVacationMode(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('vacation_mode')
        .eq('id', sellerId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setSellerVacationMode(false);
        return;
      }
      const row = data as { vacation_mode?: boolean | null };
      setSellerVacationMode(Boolean(row.vacation_mode));
    })();
    return () => {
      cancelled = true;
    };
  }, [sellerId]);

  useEffect(() => {
    if (!parcelSize) {
      setShippingFeeCents(null);
      return;
    }

    let cancelled = false;
    setShippingFeeCents(null);

    void (async () => {
      const { data, error } = await supabase.rpc('get_shipping_fee', {
        p_parcel_size: parcelSize
      });
      if (cancelled) return;
      if (error || !data) return;

      const row = data as { fee_cents?: number };
      if (typeof row.fee_cents !== 'number') return;
      setShippingFeeCents(row.fee_cents);
    })();

    return () => {
      cancelled = true;
    };
  }, [parcelSize]);

  const buyerFees = useMemo((): BuyerFeesBreakdown => {
    const fees = computeBuyerFees(amountNum);
    if (fees) return fees;
    return {
      itemPriceChf: amountNum,
      tier: 'low',
      protectionRate: 0,
      bankingRate: 0,
      protectionChf: 0,
      bankingChf: 0,
      totalBuyerFeesChf: 0,
      finalPriceChf: amountNum
    };
  }, [amountNum]);
  const shippingFeeChf = useMemo(() => {
    if (deliveryMode !== 'shipping' || shippingFeeCents == null) return 0;
    return shippingFeeCents / 100;
  }, [deliveryMode, shippingFeeCents]);
  const total = useMemo(
    () => buyerFees.finalPriceChf + shippingFeeChf,
    [buyerFees.finalPriceChf, shippingFeeChf]
  );
  const twintMaxChf = 100;
  const isTwintEligible = total <= twintMaxChf + 1e-9;

  const formattedFinalPrice = useMemo(
    () => formatCatalogPriceChf(buyerFees.finalPriceChf),
    [buyerFees.finalPriceChf]
  );
  const formattedShippingFee = useMemo(
    () => (shippingFeeCents != null ? formatCatalogPriceChf(shippingFeeChf) : '…'),
    [shippingFeeCents, shippingFeeChf]
  );
  const formattedTotal = useMemo(() => formatCatalogPriceChf(total), [total]);
  const paymentMethodSummary = paymentMethod === 'twint' ? 'TWINT' : 'Carte';

  const shippingAddressComplete = useMemo(
    () => profileShippingAddress != null,
    [profileShippingAddress]
  );

  const loadProfileShippingAddress = useCallback(async () => {
    if (!user?.id) {
      setProfileShippingAddress(null);
      setProfileAddressLoaded(true);
      return;
    }
    setProfileAddressLoaded(false);
    const address = await fetchProfileShippingAddress(supabase, user.id);
    setProfileShippingAddress(address);
    setProfileAddressLoaded(true);
  }, [user?.id]);

  useEffect(() => {
    void loadProfileShippingAddress();
  }, [loadProfileShippingAddress]);

  useFocusEffect(
    useCallback(() => {
      void loadProfileShippingAddress();
    }, [loadProfileShippingAddress])
  );

  useEffect(() => {
    if (deliveryMode !== 'shipping') {
      shippingAddressAlertShownRef.current = false;
      return;
    }
    if (!profileAddressLoaded || profileShippingAddress) return;
    if (shippingAddressAlertShownRef.current) return;
    shippingAddressAlertShownRef.current = true;
    promptCompleteProfileAddress(router, t, 'buyer');
  }, [deliveryMode, profileAddressLoaded, profileShippingAddress, router, t]);

  const canProceedToPay = useMemo(() => {
    if (!listingMetaLoaded || sellerVacationMode || !profileAddressLoaded) return false;
    if (deliveryMode === 'shipping' && !shippingAddressComplete) return false;
    if (paymentMethod === 'twint' && !isTwintEligible) return false;
    return true;
  }, [
    deliveryMode,
    isTwintEligible,
    listingMetaLoaded,
    paymentMethod,
    profileAddressLoaded,
    sellerVacationMode,
    shippingAddressComplete
  ]);

  useEffect(() => {
    if (!isTwintEligible && paymentMethod === 'twint') {
      setPaymentMethod('card');
    }
  }, [isTwintEligible, paymentMethod]);

  const handlePay = async () => {
    if (paying) return;

    if (!user?.id) {
      Alert.alert(t('common.error'), t('feed.checkout.mustSignIn'));
      router.push('/auth/login');
      return;
    }

    if (!listingId || !sellerId) {
      Alert.alert(t('common.error'), t('feed.checkout.missingParams'));
      return;
    }
    if (sellerVacationMode) {
      Alert.alert(t('feed.listingDetail.sellerVacationTitle'), t('feed.listingDetail.sellerVacationMessage'));
      return;
    }

    if (amountNum <= 0) {
      Alert.alert(t('common.error'), t('feed.checkout.invalidAmount'));
      return;
    }

    if (!listingMetaLoaded) {
      Alert.alert(t('common.error'), t('common.loading'));
      return;
    }

    if (!isCheckoutDeliveryAllowed(listingDeliveryMode, deliveryMode)) {
      Alert.alert(t('common.error'), t('feed.checkout.deliveryNotAllowed'));
      return;
    }

    if (deliveryMode === 'shipping') {
      if (!profileShippingAddress) {
        promptCompleteProfileAddress(router, t, 'buyer');
        return;
      }
    }

    if (!isStripePublishableKeyConfigured()) {
      Alert.alert(
        t('feed.checkout.stripeNotConfigured'),
        t('feed.checkout.stripeNotConfiguredMessage')
      );
      return;
    }
    if (paymentMethod === 'twint' && !isTwintEligible) {
      Alert.alert(t('common.error'), t('feed.checkout.twintMaxError'));
      return;
    }

    setPaying(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        Alert.alert(t('common.error'), t('feed.checkout.sessionExpired'));
        return;
      }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-payment-intent`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          listing_id: listingId,
          buyer_id: user.id,
          seller_id: sellerId,
          amount: amountNum,
          delivery_mode: deliveryMode,
          ...(parcelSize ? { parcel_size: parcelSize } : {}),
          shipping_address:
            deliveryMode === 'shipping' ? profileShippingAddress!.street : null,
          shipping_city: deliveryMode === 'shipping' ? profileShippingAddress!.city : null,
          shipping_postal_code:
            deliveryMode === 'shipping' ? profileShippingAddress!.postal_code : null,
          shipping_country:
            deliveryMode === 'shipping' ? profileShippingAddress!.country : null,
          shipping_first_name:
            deliveryMode === 'shipping' ? profileShippingAddress!.first_name : null,
          shipping_last_name:
            deliveryMode === 'shipping' ? profileShippingAddress!.last_name : null,
          ...(offerMessageId ? { offer_message_id: offerMessageId } : {}),
          payment_method: paymentMethod
        })
      });

      const json = (await res.json()) as { client_secret?: string; error?: string; details?: string };
      if (!res.ok) {
        const message =
          json.error && json.details
            ? `${json.error} (${json.details})`
            : json.error || json.details || 'create-payment-intent failed';
        throw new Error(message);
      }
      const clientSecret = json.client_secret;
      if (!clientSecret) {
        throw new Error('Missing client_secret');
      }

      const initRes = await initPaymentSheet(
        buildStripePaymentSheetParams({
          clientSecret,
          includeWalletPay: paymentMethod === 'card'
        })
      );
      if (initRes.error) {
        throw new Error(initRes.error.message);
      }

      const presentRes = await presentPaymentSheet();
      if (presentRes.error) {
        throw new Error(presentRes.error.message);
      }

      const paymentIntentId = clientSecret.split('_secret')[0];
      if (!paymentIntentId) {
        throw new Error('Invalid paymentIntentId');
      }

      const finalizeRes = await fetch(`${SUPABASE_URL}/functions/v1/finalize-order`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ payment_intent_id: paymentIntentId })
      });

      const finalizeJson = (await finalizeRes.json()) as { order_id?: string; error?: string; details?: string };
      if (!finalizeRes.ok) {
        const message =
          finalizeJson.error && finalizeJson.details
            ? `${finalizeJson.error} (${finalizeJson.details})`
            : finalizeJson.error || finalizeJson.details || 'finalize-order failed';
        throw new Error(message);
      }

      const orderId = finalizeJson.order_id;
      if (!orderId) throw new Error('Missing order_id');

      router.replace({
        pathname: fromMessagesThread
          ? '/tabs/messages/listing/order-confirmation'
          : '/tabs/feed/listing/order-confirmation',
        params: {
          order_id: orderId,
          ...(fromMessagesThread ? { from_messages_thread: fromMessagesThread } : {})
        }
      });
    } catch (e) {
      Alert.alert(t('feed.checkout.paymentFailed'), e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setPaying(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <HeaderBackButton onPress={handleCheckoutBack} />
          <Text variant="body" style={styles.headerTitle}>
            {t('feed.checkout.title')}
          </Text>
          <View style={styles.headerRightPlaceholder} />
        </View>
        <View style={styles.headerSeparator} />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.recap}>
            {coverPhoto ? (
              <Image source={{ uri: coverPhoto }} style={styles.coverPhoto} />
            ) : (
              <View style={[styles.coverPhoto, styles.coverPlaceholder]}>
                <ActivityIndicator color={theme.colors.primary} />
              </View>
            )}

            <Text variant="h3" style={styles.title}>
              {title}
            </Text>

            <View style={styles.moneyBlock}>
              <View style={styles.moneyRow}>
                <View style={styles.totalLabelRow}>
                  <Text variant="body" style={styles.totalLabel}>
                    {t('feed.pricing.finalPrice')}
                    <Text style={styles.excludingDelivery}>
                      {' '}
                      ({t('feed.pricing.excludingDelivery')})
                    </Text>
                  </Text>
                  <BuyerPriceInfoButton onPress={() => setShowPriceBreakdown(true)} />
                </View>
                <Text variant="body" style={styles.totalAmount}>
                  {formattedFinalPrice}
                </Text>
              </View>
              {deliveryMode === 'shipping' ? (
                <View style={[styles.moneyRow, styles.moneyRowTotal]}>
                  <Text variant="body" color="textSecondary">
                    {t('feed.checkout.shippingFee')}
                  </Text>
                  <Text variant="body" color="textPrimary">
                    +{formattedShippingFee}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.section}>
            <Text variant="captionSm" color="textSecondary" style={styles.sectionTitle}>
              {t('feed.checkout.deliveryMethod')}
            </Text>

            {showPickupOption && showShippingOption ? (
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggleCard, deliveryMode === 'pickup' && styles.toggleCardActive]}
                  onPress={() => setDeliveryMode('pickup')}
                  activeOpacity={0.8}
                >
                  <Text
                    variant="body"
                    color={deliveryMode === 'pickup' ? 'appleBlack' : 'textSecondary'}
                    style={styles.toggleText}
                  >
                    {t('feed.checkout.localPickup')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.toggleCard, deliveryMode === 'shipping' && styles.toggleCardActive]}
                  onPress={() => setDeliveryMode('shipping')}
                  activeOpacity={0.8}
                >
                  <Text
                    variant="body"
                    color={deliveryMode === 'shipping' ? 'appleBlack' : 'textSecondary'}
                    style={styles.toggleText}
                  >
                    {t('feed.checkout.shipping')}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.singleDeliveryCard}>
                <Text variant="body" style={styles.singleDeliveryText}>
                  {showPickupOption
                    ? t('feed.checkout.localPickup')
                    : t('feed.checkout.shipping')}
                </Text>
                <Text variant="captionSm" color="textSecondary" style={styles.singleDeliveryHint}>
                  {showPickupOption
                    ? t('feed.checkout.pickupOnlyHint')
                    : t('feed.checkout.shippingOnlyHint')}
                </Text>
              </View>
            )}
          </View>

          {deliveryMode === 'shipping' && (
            <View style={styles.section}>
              <Text variant="captionSm" color="textSecondary" style={styles.sectionTitle}>
                {t('feed.orderConfirmation.shippingTo')}
              </Text>

              {parcelSize === 'letter_aplus' ? (
                <LetterAplusLabelNote style={styles.letterAplusNote} />
              ) : null}

              {!profileAddressLoaded ? (
                <ActivityIndicator color={theme.colors.primary} style={styles.addressLoading} />
              ) : profileShippingAddress ? (
                <View style={styles.savedAddressBox}>
                  <Text variant="body" color="textPrimary" style={styles.savedAddressLine}>
                    {profileShippingAddress.full_name}
                  </Text>
                  <Text variant="body" color="textPrimary" style={styles.savedAddressLine}>
                    {profileShippingAddress.street}
                  </Text>
                  <Text variant="body" color="textSecondary">
                    {profileShippingAddress.postal_code} {profileShippingAddress.city}
                  </Text>
                  <Text variant="captionSm" color="textSecondary" style={styles.savedAddressCountry}>
                    {shippingCountryLabel}
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => router.push('/tabs/profile/my-address')}
                    style={styles.editAddressLink}
                  >
                    <Text variant="captionSm" style={styles.addAddressLinkText}>
                      {t('profile.myAddress.title')}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.missingAddressBox}>
                  <Text variant="body" color="textSecondary" style={styles.noSavedHint}>
                    {t('feed.checkout.noSavedAddressHint')}
                  </Text>
                  <Button
                    title={t('profile.addressRequired.cta')}
                    variant="secondary"
                    onPress={() => router.push('/tabs/profile/my-address')}
                    style={styles.addAddressButton}
                  />
                </View>
              )}
            </View>
          )}

          <View style={styles.section}>
            <Text variant="captionSm" color="textSecondary" style={styles.sectionTitle}>
              Méthode de paiement
            </Text>
            <Text variant="captionSm" color="textSecondary" style={styles.paymentMethodLegend}>
              Choisissez comment vous souhaitez payer
            </Text>
            <View style={styles.paymentMethodStack}>
              <TouchableOpacity
                style={[
                  styles.paymentMethodCard,
                  paymentMethod === 'card' && styles.paymentMethodCardActive
                ]}
                onPress={() => setPaymentMethod('card')}
                activeOpacity={0.85}
              >
                <View style={styles.paymentMethodTopRow}>
                  <View style={styles.paymentMethodTextBlock}>
                    <Text
                      variant="body"
                      color={paymentMethod === 'card' ? 'appleBlack' : 'textPrimary'}
                      style={styles.paymentMethodTitle}
                    >
                      Carte
                    </Text>
                    <Text variant="captionSm" color="textSecondary" style={styles.paymentMethodSubtitle}>
                      Visa, Mastercard, Apple Pay, Google Pay
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.radioOuter,
                      paymentMethod === 'card' && styles.radioOuterActive
                    ]}
                  >
                    {paymentMethod === 'card' ? <View style={styles.radioInner} /> : null}
                  </View>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.paymentMethodCard,
                  paymentMethod === 'twint' && styles.paymentMethodCardActive,
                  !isTwintEligible && styles.paymentMethodCardDisabled
                ]}
                onPress={() => {
                  if (!isTwintEligible) return;
                  setPaymentMethod('twint');
                }}
                activeOpacity={0.85}
              >
                <View style={styles.paymentMethodTopRow}>
                  <View style={styles.paymentMethodTextBlock}>
                    <Text
                      variant="body"
                      color={paymentMethod === 'twint' ? 'appleBlack' : 'textPrimary'}
                      style={styles.paymentMethodTitle}
                    >
                      TWINT
                    </Text>
                    <Text variant="captionSm" color="textSecondary" style={styles.paymentMethodSubtitle}>
                      {isTwintEligible
                        ? t('feed.checkout.twintAvailable')
                        : t('feed.checkout.twintUnavailable')}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.radioOuter,
                      paymentMethod === 'twint' && styles.radioOuterActive
                    ]}
                  >
                    {paymentMethod === 'twint' ? <View style={styles.radioInner} /> : null}
                  </View>
                </View>
                {isTwintEligible ? (
                  <Text variant="captionSm" color="textSecondary" style={styles.twintDisclaimer}>
                    {t('feed.checkout.twintDisclaimer')}
                  </Text>
                ) : null}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        <BuyerPriceBreakdownSheet
          visible={showPriceBreakdown}
          onClose={() => setShowPriceBreakdown(false)}
        />

        <View style={[styles.ctaContainer, { paddingBottom: safeBottom + 14 }]}>
          <View style={styles.ctaSummaryRow}>
            <View>
              <Text variant="captionSm" color="textSecondary">
                {t('feed.pricing.finalPrice')} · {paymentMethodSummary}
              </Text>
              <Text variant="body" style={styles.ctaSummaryTotal}>
                {formattedTotal}
              </Text>
            </View>
          </View>
          <Button
            title={paying ? t('common.loading') : t('feed.checkout.pay')}
            onPress={handlePay}
            variant="primary"
            disabled={paying || !canProceedToPay}
            loading={paying}
            style={styles.ctaButton}
            textStyle={styles.ctaButtonText}
          />
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingTop: 12,
    paddingBottom: 12
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary
  },
  headerRightPlaceholder: {
    width: 40
  },
  headerSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingTop: theme.spacing.gapMd,
    paddingBottom: 8
  },
  recap: {
    marginBottom: theme.spacing.gapLg
  },
  coverPhoto: {
    width: '100%',
    height: 190,
    borderRadius: theme.radius.card,
    marginBottom: theme.spacing.gapMd,
    backgroundColor: theme.colors.muted
  },
  coverPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  title: {
    marginBottom: theme.spacing.gapSm
  },
  moneyBlock: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    padding: theme.spacing.gapMd
  },
  moneyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.gapSm
  },
  totalLabelRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  moneyRowTotal: {
    marginBottom: 0,
    marginTop: theme.spacing.gapSm,
    paddingTop: theme.spacing.gapSm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border
  },
  totalLabel: {
    fontFamily: theme.fontFamily.bold,
    color: theme.colors.textPrimary
  },
  excludingDelivery: {
    fontFamily: theme.fontFamily.regular,
    color: theme.colors.textSecondary
  },
  totalAmount: {
    fontFamily: theme.fontFamily.bold,
    color: theme.colors.textPrimary
  },
  section: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    padding: theme.spacing.gapMd,
    marginBottom: theme.spacing.gapMd
  },
  sectionTitle: {
    marginBottom: theme.spacing.gapSm
  },
  letterAplusNote: {
    marginBottom: theme.spacing.gapSm
  },
  toggleRow: {
    flexDirection: 'row',
    columnGap: theme.spacing.gapSm
  },
  toggleCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.background
  },
  toggleCardActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  },
  toggleText: {
    textAlign: 'center',
    fontWeight: '600'
  },
  paymentMethodLegend: {
    marginBottom: theme.spacing.gapSm,
    lineHeight: 17
  },
  paymentMethodStack: {
    rowGap: theme.spacing.gapSm
  },
  paymentMethodCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.background
  },
  paymentMethodCardActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary
  },
  paymentMethodCardDisabled: {
    opacity: 0.55
  },
  paymentMethodTopRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  paymentMethodTextBlock: {
    flex: 1
  },
  paymentMethodTitle: {
    fontWeight: '600',
    marginBottom: 4
  },
  paymentMethodSubtitle: {
    lineHeight: 16
  },
  twintDisclaimer: {
    marginTop: 10,
    fontSize: 11,
    lineHeight: 15
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    backgroundColor: theme.colors.background
  },
  radioOuterActive: {
    borderColor: theme.colors.appleBlack
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.appleBlack
  },
  singleDeliveryCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.background
  },
  singleDeliveryText: {
    fontWeight: '600'
  },
  singleDeliveryHint: {
    marginTop: 4
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: theme.spacing.gapSm,
    color: theme.colors.textPrimary,
    fontFamily: theme.fontFamily.regular,
    backgroundColor: theme.colors.background
  },
  countrySelectText: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fontFamily.regular
  },
  countryReadonly: {
    justifyContent: 'center',
    backgroundColor: theme.colors.muted
  },
  fieldLabel: {
    marginBottom: theme.spacing.gapSm
  },
  shippingModeRow: {
    flexDirection: 'row',
    columnGap: theme.spacing.gapSm,
    marginBottom: theme.spacing.gapSm
  },
  shippingModeCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: theme.colors.background
  },
  shippingModeCardActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  },
  shippingModeTitle: {
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 4
  },
  shippingModeHint: {
    textAlign: 'center'
  },
  savedAddressBox: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.input,
    padding: theme.spacing.gapMd,
    backgroundColor: theme.colors.muted,
    marginBottom: theme.spacing.gapSm
  },
  savedAddressLine: {
    marginBottom: 4
  },
  savedAddressCountry: {
    marginTop: 6
  },
  noSavedHint: {
    marginBottom: theme.spacing.gapSm,
    lineHeight: 18
  },
  addAddressLink: {
    alignSelf: 'flex-start',
    marginBottom: theme.spacing.gapMd
  },
  addAddressLinkText: {
    color: theme.colors.textPrimary,
    textDecorationLine: 'underline',
    fontFamily: theme.fontFamily.semiBold
  },
  addressLoading: {
    marginVertical: 12
  },
  missingAddressBox: {
    gap: 12
  },
  addAddressButton: {
    alignSelf: 'stretch'
  },
  editAddressLink: {
    alignSelf: 'flex-start',
    marginTop: 8
  },
  ctaContainer: {
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingTop: 10,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border
  },
  ctaSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  ctaSummaryTotal: {
    fontFamily: theme.fontFamily.bold,
    color: theme.colors.textPrimary
  },
  ctaButton: {
    height: 48,
    borderRadius: 14
  },
  ctaButtonText: {
    fontSize: 15
  }
});

