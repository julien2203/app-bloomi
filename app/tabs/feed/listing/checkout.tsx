import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStripe } from '@stripe/stripe-react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../../../lib/supabase';
import { isStripePublishableKeyConfigured, SUPABASE_URL } from '../../../../lib/env';
import { theme } from '../../../../lib/theme';
import { Button } from '../../../../components/ui/Button';
import { Text } from '../../../../components/ui/Text';
import { HeaderBackButton } from '../../../../components/ui/HeaderBackButton';
import { useAuthStore } from '../../../../stores/authStore';
import { openGuestAuthPrompt } from '../../../../lib/guestAuthPrompt';
import { computeBuyerFees } from '../../../../lib/fees';
import { formatChf, formatPercent } from '../../../../lib/formatBuyerPrice';
import {
  BuyerPriceBreakdownSheet,
  BuyerPriceInfoButton
} from '../../../../components/pricing/BuyerPriceBreakdownSheet';

type CheckoutParams = {
  listing_id: string;
  seller_id: string;
  amount: string;
  title: string;
  cover_photo?: string;
  offer_message_id?: string;
};

type DeliveryMode = 'pickup' | 'shipping';

type SavedProfileAddress = {
  street: string;
  postal_code: string;
  city: string;
  country: string;
};

type CountryCode = 'CH' | 'FR' | 'DE' | 'IT';

function isSavedAddressComplete(a: SavedProfileAddress | null): a is SavedProfileAddress {
  if (!a) return false;
  return Boolean(
    a.street.trim() && a.postal_code.trim() && a.city.trim() && String(a.country ?? '').trim()
  );
}

export default function CheckoutScreen() {
  const { t } = useTranslation();
  const countryOptions = React.useMemo(
    () =>
      [
        { code: 'CH' as const, label: t('feed.checkout.countryCH') },
        { code: 'FR' as const, label: t('feed.checkout.countryFR') },
        { code: 'DE' as const, label: t('feed.checkout.countryDE') },
        { code: 'IT' as const, label: t('feed.checkout.countryIT') }
      ] as const,
    [t]
  );
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('pickup');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState<CountryCode>('CH');
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  const [savedProfileAddress, setSavedProfileAddress] = useState<SavedProfileAddress | null>(null);
  /** Shipping address: saved profile or manual entry */
  const [shippingAddressMode, setShippingAddressMode] = useState<'profile' | 'custom'>('custom');
  const prevDeliveryModeRef = useRef<DeliveryMode>(deliveryMode);
  /** Prevents overwriting “Different address” when the profile loads or updates */
  const userChoseCustomShippingRef = useRef(false);

  const [paying, setPaying] = useState(false);
  const guestCheckoutPromptedRef = useRef(false);

  const [parcelSize, setParcelSize] = useState<string | null>(null);
  const [shippingFeeCents, setShippingFeeCents] = useState<number | null>(null);
  const [isPromoShipping, setIsPromoShipping] = useState(false);
  const [loadingShippingFee, setLoadingShippingFee] = useState(false);
  const [showPriceBreakdown, setShowPriceBreakdown] = useState(false);

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
    void (async () => {
      const { data, error } = await supabase
        .from('listings')
        .select('parcel_size')
        .eq('id', listingId)
        .maybeSingle();
      if (cancelled || error || !data) return;
      const ps = (data as { parcel_size?: string | null }).parcel_size;
      if (ps) setParcelSize(String(ps));
    })();
    return () => {
      cancelled = true;
    };
  }, [listingId]);

  useEffect(() => {
    if (!parcelSize) {
      setShippingFeeCents(null);
      setIsPromoShipping(false);
      return;
    }

    let cancelled = false;
    setLoadingShippingFee(true);
    setShippingFeeCents(null);
    setIsPromoShipping(false);

    void (async () => {
      const { data, error } = await supabase.rpc('get_shipping_fee', {
        p_parcel_size: parcelSize
      });
      if (cancelled) return;
      setLoadingShippingFee(false);
      if (error || !data) return;

      const row = data as { fee_cents?: number; is_promo?: boolean };
      if (typeof row.fee_cents !== 'number') return;
      setShippingFeeCents(row.fee_cents);
      setIsPromoShipping(Boolean(row.is_promo));
    })();

    return () => {
      cancelled = true;
    };
  }, [parcelSize]);

  const buyerFees = useMemo(() => computeBuyerFees(amountNum), [amountNum]);
  const shippingFeeChf = useMemo(() => {
    if (deliveryMode !== 'shipping' || shippingFeeCents == null) return 0;
    return shippingFeeCents / 100;
  }, [deliveryMode, shippingFeeCents]);
  const total = useMemo(
    () => buyerFees.finalPriceChf + shippingFeeChf,
    [buyerFees.finalPriceChf, shippingFeeChf]
  );

  const formattedPrice = useMemo(() => formatChf(amountNum), [amountNum]);
  const formattedCommission = useMemo(() => formatChf(buyerFees.protectionChf), [buyerFees.protectionChf]);
  const formattedBankingFee = useMemo(() => formatChf(buyerFees.bankingChf), [buyerFees.bankingChf]);
  const formattedShippingFee = useMemo(
    () => `${shippingFeeChf.toFixed(2)} CHF`,
    [shippingFeeChf]
  );
  const formattedTotal = useMemo(() => `${total.toFixed(2)} CHF`, [total]);

  const countryLabel = useMemo(() => {
    return countryOptions.find((c) => c.code === country)?.label ?? t('feed.checkout.countryCH');
  }, [country]);

  const applySavedAddressToForm = useCallback((a: SavedProfileAddress) => {
    setStreet(a.street.trim());
    setPostalCode(a.postal_code.trim());
    setCity(a.city.trim());
    const c = String(a.country ?? 'CH').toUpperCase();
    setCountry(countryOptions.some((o) => o.code === c) ? (c as CountryCode) : 'CH');
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setSavedProfileAddress(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('street, postal_code, city, country')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setSavedProfileAddress(null);
        return;
      }
      const row = data as Record<string, unknown>;
      const next: SavedProfileAddress = {
        street: String(row.street ?? ''),
        postal_code: String(row.postal_code ?? ''),
        city: String(row.city ?? ''),
        country: String(row.country ?? 'CH')
      };
      setSavedProfileAddress(isSavedAddressComplete(next) ? next : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    const prev = prevDeliveryModeRef.current;
    prevDeliveryModeRef.current = deliveryMode;

    if (deliveryMode === 'pickup') {
      userChoseCustomShippingRef.current = false;
      return;
    }

    if (deliveryMode !== 'shipping') return;

    const justEnteredShipping = prev !== 'shipping';
    if (!justEnteredShipping) return;

    userChoseCustomShippingRef.current = false;
    const complete = savedProfileAddress && isSavedAddressComplete(savedProfileAddress);
    if (complete) {
      setShippingAddressMode('profile');
      applySavedAddressToForm(savedProfileAddress);
    } else {
      setShippingAddressMode('custom');
    }
  }, [deliveryMode, savedProfileAddress, applySavedAddressToForm]);

  useEffect(() => {
    if (deliveryMode !== 'shipping') return;
    if (!savedProfileAddress || !isSavedAddressComplete(savedProfileAddress)) return;
    if (userChoseCustomShippingRef.current) return;
    if (shippingAddressMode !== 'custom') return;
    const formEmpty = !street.trim() && !city.trim() && !postalCode.trim();
    if (!formEmpty) return;
    setShippingAddressMode('profile');
    applySavedAddressToForm(savedProfileAddress);
  }, [
    deliveryMode,
    savedProfileAddress,
    applySavedAddressToForm,
    shippingAddressMode,
    street,
    city,
    postalCode
  ]);

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

    if (amountNum <= 0) {
      Alert.alert(t('common.error'), t('feed.checkout.invalidAmount'));
      return;
    }

    if (deliveryMode === 'shipping') {
      if (!street.trim() || !city.trim() || !postalCode.trim() || !country.trim()) {
        Alert.alert(t('feed.checkout.incompleteAddress'), t('feed.checkout.incompleteAddressMessage'));
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
            deliveryMode === 'shipping' ? street.trim() : null,
          shipping_city: deliveryMode === 'shipping' ? city.trim() : null,
          shipping_postal_code:
            deliveryMode === 'shipping' ? postalCode.trim() : null,
          shipping_country: deliveryMode === 'shipping' ? country : null,
          ...(offerMessageId ? { offer_message_id: offerMessageId } : {})
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

      const initRes = await initPaymentSheet({
        merchantDisplayName: 'Bloomi',
        paymentIntentClientSecret: clientSecret,
        defaultBillingDetails: {
          address: {
            country: 'CH'
          }
        }
      });
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
        pathname: '/tabs/feed/listing/order-confirmation',
        params: { order_id: orderId }
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
          <HeaderBackButton onPress={() => router.back()} />
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
                <Text variant="body" color="textSecondary">
                  {t('feed.checkout.itemPrice')}
                </Text>
                <Text variant="body" color="textPrimary">
                  {formattedPrice}
                </Text>
              </View>
              <View style={styles.moneyRow}>
                <Text variant="body" color="textSecondary">
                  {t('feed.checkout.buyerProtection', {
                    percent: formatPercent(buyerFees.protectionRate)
                  })}
                </Text>
                <Text variant="body" color="textPrimary">
                  +{formattedCommission}
                </Text>
              </View>
              <View style={styles.moneyRow}>
                <Text variant="body" color="textSecondary">
                  {t('feed.checkout.bankingFee', {
                    percent: formatPercent(buyerFees.bankingRate)
                  })}
                </Text>
                <Text variant="body" color="textPrimary">
                  +{formattedBankingFee}
                </Text>
              </View>
              {deliveryMode === 'shipping' ? (
                <View style={styles.moneyRow}>
                  <View style={styles.shippingFeeLabelCol}>
                    <Text variant="body" color="textSecondary">
                      {t('feed.checkout.shippingFee')}
                    </Text>
                    {isPromoShipping ? (
                      <View style={styles.shippingPromoBadge}>
                        <Text style={styles.shippingPromoBadgeText}>
                          {t('feed.checkout.shippingPromo')}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  {loadingShippingFee ? (
                    <ActivityIndicator size="small" color={theme.colors.textSecondary} />
                  ) : (
                    <Text variant="body" color="textPrimary">
                      +{formattedShippingFee}
                    </Text>
                  )}
                </View>
              ) : null}
              <View style={[styles.moneyRow, styles.moneyRowTotal]}>
                <View style={styles.totalLabelRow}>
                  <Text variant="body" style={styles.totalLabel}>
                    {t('feed.checkout.total')}
                  </Text>
                  <BuyerPriceInfoButton onPress={() => setShowPriceBreakdown(true)} />
                </View>
                <Text variant="body" style={styles.totalAmount}>
                  {formattedTotal}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text variant="captionSm" color="textSecondary" style={styles.sectionTitle}>
              {t('feed.checkout.deliveryMethod')}
            </Text>

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
          </View>

          {deliveryMode === 'shipping' && (
            <View style={styles.section}>
              <Text variant="captionSm" color="textSecondary" style={styles.sectionTitle}>
                {t('feed.orderConfirmation.shippingTo')}
              </Text>

              {savedProfileAddress && isSavedAddressComplete(savedProfileAddress) ? (
                <>
                  <View style={styles.shippingModeRow}>
                    <TouchableOpacity
                      style={[
                        styles.shippingModeCard,
                        shippingAddressMode === 'profile' && styles.shippingModeCardActive
                      ]}
                      onPress={() => {
                        userChoseCustomShippingRef.current = false;
                        setShippingAddressMode('profile');
                        applySavedAddressToForm(savedProfileAddress);
                      }}
                      activeOpacity={0.85}
                    >
                      <Text
                        variant="body"
                        color={shippingAddressMode === 'profile' ? 'appleBlack' : 'textSecondary'}
                        style={styles.shippingModeTitle}
                      >
                        {t('feed.checkout.savedAddress')}
                      </Text>
                      <Text variant="captionSm" color="textSecondary" style={styles.shippingModeHint}>
                        {t('feed.checkout.fromProfile')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.shippingModeCard,
                        shippingAddressMode === 'custom' && styles.shippingModeCardActive
                      ]}
                      onPress={() => {
                        userChoseCustomShippingRef.current = true;
                        setShippingAddressMode('custom');
                      }}
                      activeOpacity={0.85}
                    >
                      <Text
                        variant="body"
                        color={shippingAddressMode === 'custom' ? 'appleBlack' : 'textSecondary'}
                        style={styles.shippingModeTitle}
                      >
                        {t('feed.checkout.differentAddress')}
                      </Text>
                      <Text variant="captionSm" color="textSecondary" style={styles.shippingModeHint}>
                        {t('feed.checkout.enterManually')}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {shippingAddressMode === 'profile' ? (
                    <View style={styles.savedAddressBox}>
                      <Text variant="body" color="textPrimary" style={styles.savedAddressLine}>
                        {savedProfileAddress.street.trim()}
                      </Text>
                      <Text variant="body" color="textSecondary">
                        {savedProfileAddress.postal_code.trim()} {savedProfileAddress.city.trim()}
                      </Text>
                      <Text variant="captionSm" color="textSecondary" style={styles.savedAddressCountry}>
                        {countryOptions.find(
                          (c) => c.code === String(savedProfileAddress.country).toUpperCase()
                        )?.label ?? savedProfileAddress.country}
                      </Text>
                    </View>
                  ) : (
                    <>
                      <TextInput
                        style={styles.input}
                        placeholder={t('feed.checkout.street')}
                        placeholderTextColor={theme.colors.textSecondary}
                        value={street}
                        onChangeText={setStreet}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder={t('feed.checkout.city')}
                        placeholderTextColor={theme.colors.textSecondary}
                        value={city}
                        onChangeText={setCity}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder={t('feed.checkout.postalCode')}
                        placeholderTextColor={theme.colors.textSecondary}
                        value={postalCode}
                        onChangeText={setPostalCode}
                        keyboardType="numbers-and-punctuation"
                      />
                      <TouchableOpacity
                        activeOpacity={0.85}
                        style={[styles.input, styles.countrySelect]}
                        onPress={() => setShowCountryPicker(true)}
                      >
                        <Text style={styles.countrySelectText}>{countryLabel}</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </>
              ) : (
                <>
                  <Text variant="captionSm" color="textSecondary" style={styles.noSavedHint}>
                    {t('feed.checkout.noSavedAddressHint')}
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder={t('feed.checkout.street')}
                    placeholderTextColor={theme.colors.textSecondary}
                    value={street}
                    onChangeText={setStreet}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder={t('feed.checkout.city')}
                    placeholderTextColor={theme.colors.textSecondary}
                    value={city}
                    onChangeText={setCity}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder={t('feed.checkout.postalCode')}
                    placeholderTextColor={theme.colors.textSecondary}
                    value={postalCode}
                    onChangeText={setPostalCode}
                    keyboardType="numbers-and-punctuation"
                  />
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[styles.input, styles.countrySelect]}
                    onPress={() => setShowCountryPicker(true)}
                  >
                    <Text style={styles.countrySelectText}>{countryLabel}</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </ScrollView>

        <Modal
          transparent
          animationType="fade"
          visible={showCountryPicker}
          onRequestClose={() => setShowCountryPicker(false)}
        >
          <View style={styles.countryModalOverlay}>
            <TouchableOpacity
              style={styles.countryModalBackdrop}
              activeOpacity={1}
              onPress={() => setShowCountryPicker(false)}
            />
            <View style={styles.countryModalCard}>
              <Text style={styles.countryModalTitle}>{t('feed.checkout.country')}</Text>
              {countryOptions.map((opt) => {
                const selected = opt.code === country;
                return (
                  <TouchableOpacity
                    key={opt.code}
                    activeOpacity={0.8}
                    style={[
                      styles.countryOptionRow,
                      selected && styles.countryOptionRowSelected
                    ]}
                    onPress={() => {
                      setCountry(opt.code);
                      setShowCountryPicker(false);
                    }}
                  >
                    <Text style={styles.countryOptionLabel}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
              <View style={styles.countryModalFooter}>
                <Button
                  title={t('common.close')}
                  onPress={() => setShowCountryPicker(false)}
                  variant="google"
                />
              </View>
            </View>
          </View>
        </Modal>

        <BuyerPriceBreakdownSheet
          visible={showPriceBreakdown}
          itemPriceChf={amountNum}
          onClose={() => setShowPriceBreakdown(false)}
        />

        <View style={[styles.ctaContainer, { paddingBottom: insets.bottom + 80 }]}>
          <Button
            title={paying ? t('common.loading') : t('feed.checkout.pay')}
            onPress={handlePay}
            variant="primary"
            disabled={paying}
            loading={paying}
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
  shippingFeeLabelCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: 8,
    rowGap: 4,
    marginRight: theme.spacing.gapSm
  },
  shippingPromoBadge: {
    backgroundColor: '#C3EA4F',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  shippingPromoBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    color: '#000000',
    fontFamily: theme.fontFamily.semiBold
  },
  totalLabel: {
    fontFamily: theme.fontFamily.bold,
    color: theme.colors.textPrimary
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
    marginBottom: theme.spacing.gapMd
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
    paddingVertical: 14,
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
  countrySelect: {
    justifyContent: 'center'
  },
  countrySelectText: {
    color: theme.colors.textPrimary,
    fontFamily: theme.fontFamily.regular
  },
  countryModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 16
  },
  countryModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent'
  },
  countryModalCard: {
    backgroundColor: theme.colors.backgroundWhite,
    borderRadius: 14,
    paddingVertical: 12,
    overflow: 'hidden'
  },
  countryModalTitle: {
    textAlign: 'center',
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary
  },
  countryOptionRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border
  },
  countryOptionRowSelected: {
    backgroundColor: theme.colors.googleWhite
  },
  countryOptionLabel: {
    color: theme.colors.textPrimary,
    fontFamily: theme.fontFamily.regular
  },
  countryModalFooter: {
    paddingTop: 12,
    paddingHorizontal: 16
  },
  shippingModeRow: {
    flexDirection: 'row',
    columnGap: theme.spacing.gapSm,
    marginBottom: theme.spacing.gapMd
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
    marginBottom: theme.spacing.gapMd,
    lineHeight: 18
  },
  ctaContainer: {
    paddingHorizontal: theme.spacing.screenPaddingX,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border
  }
});

