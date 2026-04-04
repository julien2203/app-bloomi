import React, { useMemo, useState } from 'react';
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
import { supabase } from '../../../../lib/supabase';
import { SUPABASE_URL } from '../../../../lib/env';
import { theme } from '../../../../lib/theme';
import { Button } from '../../../../components/ui/Button';
import { Text } from '../../../../components/ui/Text';
import { HeaderBackButton } from '../../../../components/ui/HeaderBackButton';
import { useAuthStore } from '../../../../stores/authStore';

type CheckoutParams = {
  listing_id: string;
  seller_id: string;
  amount: string;
  title: string;
  cover_photo?: string;
};

type DeliveryMode = 'pickup' | 'shipping';

const COUNTRY_OPTIONS = [
  { code: 'CH', label: 'Switzerland (CH)' },
  { code: 'FR', label: 'France (FR)' },
  { code: 'DE', label: 'Germany (DE)' },
  { code: 'IT', label: 'Italy (IT)' }
] as const;

type CountryCode = (typeof COUNTRY_OPTIONS)[number]['code'];

export default function CheckoutScreen() {
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

  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('pickup');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState<CountryCode>('CH');
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  const [paying, setPaying] = useState(false);

  const buyerProtectionCommission = useMemo(() => amountNum * 0.1, [amountNum]);
  const total = useMemo(() => amountNum + buyerProtectionCommission, [amountNum, buyerProtectionCommission]);

  const formattedPrice = useMemo(() => `${amountNum.toFixed(2)} CHF`, [amountNum]);
  const formattedCommission = useMemo(
    () => `${buyerProtectionCommission.toFixed(2)} CHF`,
    [buyerProtectionCommission]
  );
  const formattedTotal = useMemo(() => `${total.toFixed(2)} CHF`, [total]);

  const shippingAddressPayload = useMemo(() => {
    if (deliveryMode !== 'shipping') return null;
    return {
      street,
      rue: street,
      city,
      postal_code: postalCode,
      country
    };
  }, [deliveryMode, street, city, postalCode, country]);

  const countryLabel = useMemo(() => {
    return COUNTRY_OPTIONS.find((c) => c.code === country)?.label ?? 'Switzerland (CH)';
  }, [country]);

  const handlePay = async () => {
    if (paying) return;

    if (!user?.id) {
      Alert.alert('Erreur', 'Vous devez être connecté pour payer');
      router.push('/auth/login');
      return;
    }

    if (!listingId || !sellerId) {
      Alert.alert('Erreur', 'Paramètres de commande manquants');
      return;
    }

    if (amountNum <= 0) {
      Alert.alert('Erreur', 'Montant invalide');
      return;
    }

    if (deliveryMode === 'shipping') {
      if (!street.trim() || !city.trim() || !postalCode.trim() || !country.trim()) {
        Alert.alert('Adresse incomplète', 'Veuillez remplir rue, ville, code postal et pays');
        return;
      }
    }

    setPaying(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        Alert.alert('Erreur', 'Session expirée, veuillez vous reconnecter');
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
          shipping_address: shippingAddressPayload
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
        throw new Error('client_secret manquant');
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
        throw new Error('paymentIntentId invalide');
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
      if (!orderId) throw new Error('order_id manquant');

      router.replace({
        pathname: '/tabs/feed/listing/order-confirmation',
        params: { order_id: orderId }
      });
    } catch (e) {
      Alert.alert('Paiement impossible', e instanceof Error ? e.message : 'Erreur inconnue');
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
            Checkout
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
                  Prix
                </Text>
                <Text variant="body" color="textPrimary">
                  {formattedPrice}
                </Text>
              </View>
              <View style={styles.moneyRow}>
                <Text variant="body" color="textSecondary">
                  Buyer Protection (+10%)
                </Text>
                <Text variant="body" color="textPrimary">
                  {formattedCommission}
                </Text>
              </View>
              <View style={[styles.moneyRow, styles.moneyRowTotal]}>
                <Text variant="body" color="textPrimary">
                  Total
                </Text>
                <Text variant="body" color="primary">
                  {formattedTotal}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text variant="captionSm" color="textSecondary" style={styles.sectionTitle}>
              Mode de livraison
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
                  Remise en main propre
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
                  Livraison
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {deliveryMode === 'shipping' && (
            <View style={styles.section}>
              <Text variant="captionSm" color="textSecondary" style={styles.sectionTitle}>
                Adresse de livraison
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Rue"
                placeholderTextColor={theme.colors.textSecondary}
                value={street}
                onChangeText={setStreet}
              />
              <TextInput
                style={styles.input}
                placeholder="Ville"
                placeholderTextColor={theme.colors.textSecondary}
                value={city}
                onChangeText={setCity}
              />
              <TextInput
                style={styles.input}
                placeholder="Code postal"
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
              <Text style={styles.countryModalTitle}>Country</Text>
              {COUNTRY_OPTIONS.map((opt) => {
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
                  title="Close"
                  onPress={() => setShowCountryPicker(false)}
                  variant="google"
                />
              </View>
            </View>
          </View>
        </Modal>

        <View style={[styles.ctaContainer, { paddingBottom: insets.bottom + 80 }]}>
          <Button
            title={paying ? 'Paiement...' : 'Payer'}
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
  moneyRowTotal: {
    marginBottom: 0
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
  ctaContainer: {
    paddingHorizontal: theme.spacing.screenPaddingX,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border
  }
});

