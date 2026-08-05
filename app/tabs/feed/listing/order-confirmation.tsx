import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { getSafeBottomInset } from '../../../../lib/safeArea';
import { Text } from '../../../../components/ui/Text';
import { Button } from '../../../../components/ui/Button';
import { HeaderBackButton } from '../../../../components/ui/HeaderBackButton';
import { theme } from '../../../../lib/theme';
import { supabase } from '../../../../lib/supabase';
import { formatCatalogPriceChf, formatChf, formatFeeLineChf } from '../../../../lib/formatBuyerPrice';
import { fetchAcceptedOfferAmountForOrder } from '../../../../lib/fetchOrderAcceptedOfferAmount';
import { computeOrderBuyerTotals, formatOrderShippingFeeValue } from '../../../../lib/orderTotals';
import { isOrderPickupDelivery } from '../../../../lib/deliveryMode';

type OrderRow = {
  id: string;
  listing_id: string;
  buyer_id: string;
  status: string | null;
  payment_status: string | null;
  delivery_mode: string | null;
  listing_title: string | null;
  listing_price: number | string | null;
  listing_cover_photo_url: string | null;
  buyer_protection_chf?: number | string | null;
  buyer_banking_fee_chf?: number | string | null;
  shipping_fee_chf?: number | string | null;
  parcel_size?: string | null;
  is_promo_shipping?: boolean | null;
  shipping_city?: string | null;
  shipping_postal_code?: string | null;
  shipping_country?: string | null;
  shipping_address?: string | null;
  listing?: { price: number | string | null } | null;
};

function normalizePhotoUrl(rawUrl: string) {
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return rawUrl;
  const { data } = supabase.storage.from('listings').getPublicUrl(rawUrl);
  return data?.publicUrl ?? rawUrl;
}

export default function OrderConfirmationScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const safeBottom = getSafeBottomInset(insets.bottom);
  const params = useLocalSearchParams<{ order_id?: string; from_messages_thread?: string }>();
  const orderId = params.order_id ?? null;
  const fromMessagesThread =
    typeof params.from_messages_thread === 'string' ? params.from_messages_thread.trim() : '';

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [acceptedOfferAmount, setAcceptedOfferAmount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!orderId) {
        setError(t('feed.checkout.missingParams'));
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const { data, error: qError } = await supabase
          .from('orders')
          .select(
            `
            id,
            listing_id,
            buyer_id,
            status,
            payment_status,
            delivery_mode,
            listing_title,
            listing_price,
            listing_cover_photo_url,
            buyer_protection_chf,
            buyer_banking_fee_chf,
            shipping_fee_chf,
            parcel_size,
            is_promo_shipping,
            shipping_city,
            shipping_postal_code,
            shipping_country,
            shipping_address,
            listing:listings(price)
          `
          )
          .eq('id', orderId)
          .maybeSingle();

        if (qError) throw qError;
        if (!data) throw new Error(t('messages.notFound'));

        const row = data as OrderRow;
        const offerAmount = await fetchAcceptedOfferAmountForOrder({
          listingId: row.listing_id,
          buyerId: row.buyer_id
        });

        if (!cancelled) {
          setOrder({ ...row });
          setAcceptedOfferAmount(offerAmount);
        }
      } catch (e) {
        if (!cancelled) {
          setOrder(null);
          setError(e instanceof Error ? e.message : t('feed.orderConfirmation.loadError'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [orderId, t]);

  const listingTitle = order?.listing_title ?? t('feed.orderConfirmation.yourItem');
  const rawCover = order?.listing_cover_photo_url ?? null;
  const coverUrl = rawCover ? normalizePhotoUrl(rawCover) : null;

  const orderForTotals = useMemo(
    () =>
      order
        ? { ...order, accepted_offer_amount_chf: acceptedOfferAmount }
        : null,
    [acceptedOfferAmount, order]
  );

  const totals = useMemo(
    () => (orderForTotals ? computeOrderBuyerTotals(orderForTotals) : null),
    [orderForTotals]
  );

  const isAcceptedOffer = totals?.isAcceptedOffer ?? false;

  const isShipping = !isOrderPickupDelivery(order?.delivery_mode);

  const statusLabel = useMemo(() => {
    const base = t('feed.orderConfirmation.statusBase');
    const payment = order?.payment_status ? ` (${order.payment_status})` : '';
    const orderStatus = order?.status ? ` • ${order.status}` : '';
    return `${base}${payment}${orderStatus}`;
  }, [order?.payment_status, order?.status, t]);

  const shippingAddressLine = useMemo(() => {
    if (!order) return null;
    const street = order.shipping_address?.trim();
    const cityLine = `${order.shipping_postal_code ?? ''} ${order.shipping_city ?? ''}`.trim();
    const country = order.shipping_country?.trim();
    const parts = [street, cityLine, country].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  }, [order]);

  const handleHeaderBack = useCallback(() => {
    if (fromMessagesThread) {
      router.replace({
        pathname: '/tabs/messages/[id]',
        params: { id: fromMessagesThread, from_inbox: '1' }
      });
      return;
    }
    if (router.canGoBack?.()) {
      router.back();
      return;
    }
    router.replace('/tabs/feed');
  }, [fromMessagesThread, router]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <HeaderBackButton onPress={handleHeaderBack} />
        <Text variant="body" style={styles.headerTitle}>
          {t('feed.orderConfirmation.title')}
        </Text>
        <View style={styles.headerRightPlaceholder} />
      </View>
      <View style={styles.headerSeparator} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: safeBottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text variant="captionSm" color="textSecondary" style={styles.loadingText}>
              {t('feed.orderConfirmation.loadingOrder')}
            </Text>
          </View>
        ) : error ? (
          <View style={styles.card}>
            <Text variant="body" style={styles.errorTitle}>
              {t('feed.orderConfirmation.loadError')}
            </Text>
            <Text variant="caption" color="textSecondary" style={styles.errorText}>
              {error}
            </Text>
            <View style={styles.errorActions}>
              <Button
                title={t('feed.orderConfirmation.viewOrders')}
                onPress={() => router.replace('/tabs/profile/orders')}
                variant="primary"
              />
              <Button
                title={t('feed.orderConfirmation.backToFeed')}
                onPress={() => router.replace('/tabs/feed')}
                variant="secondary"
              />
            </View>
          </View>
        ) : (
          <>
            <View style={styles.successHero}>
              <View style={styles.successIconWrap}>
                <Feather name="check" size={28} color={theme.colors.appleBlack} />
              </View>
              <Text variant="h2" style={styles.successTitle}>
                {t('feed.orderConfirmation.paymentConfirmed')}
              </Text>
              <Text variant="body" color="textSecondary" style={styles.successSubtitle}>
                {t('feed.orderConfirmation.subtitle')}
              </Text>
            </View>

            <View style={styles.card}>
              <View style={styles.itemRow}>
                <View style={styles.coverWrap}>
                  {coverUrl ? (
                    <Image source={{ uri: coverUrl }} style={styles.cover} />
                  ) : (
                    <View style={[styles.cover, styles.coverPlaceholder]} />
                  )}
                </View>
                <View style={styles.itemInfo}>
                  <Text variant="captionSm" color="textSecondary" style={styles.itemLabel}>
                    {t('feed.orderConfirmation.yourItem')}
                  </Text>
                  <Text variant="body" style={styles.itemTitle} numberOfLines={3}>
                    {listingTitle}
                  </Text>
                </View>
              </View>

              <View style={styles.statusPill}>
                <Feather name="shield" size={14} color={theme.colors.textPrimary} />
                <Text variant="captionSm" style={styles.statusText}>
                  {statusLabel}
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text variant="h3" style={styles.sectionTitle}>
                {t('feed.orderConfirmation.priceSummary')}
              </Text>

              <View style={styles.moneyBlock}>
                <View style={styles.moneyRow}>
                  <Text variant="body" color="textSecondary" style={styles.moneyLabel}>
                    {isAcceptedOffer
                      ? t('feed.orderConfirmation.acceptedOfferPrice')
                      : t('feed.orderConfirmation.itemPrice')}
                  </Text>
                  <Text variant="body" style={styles.moneyValue}>
                    {totals ? formatChf(totals.itemPriceChf) : '—'}
                  </Text>
                </View>

                <View style={styles.moneyRow}>
                  <Text variant="body" color="textSecondary" style={styles.moneyLabel}>
                    {t('feed.orderConfirmation.bloomiFees')}
                  </Text>
                  <Text variant="body" style={styles.moneyValue}>
                    {totals ? `+${formatFeeLineChf(totals.buyerFeesChf)}` : '—'}
                  </Text>
                </View>

                {isShipping ? (
                  <View style={styles.moneyRow}>
                    <Text variant="body" color="textSecondary" style={styles.moneyLabel}>
                      {t('feed.checkout.shippingFee')}
                    </Text>
                    <Text variant="body" style={styles.moneyValue}>
                      {totals
                        ? formatOrderShippingFeeValue(
                            totals.shippingFeeChf,
                            totals.isPromoShipping,
                            formatChf,
                            t('feed.listingDetail.shippingPromo'),
                            t('profile.orders.promoShipping')
                          )
                        : '—'}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.moneyDivider} />

                <View style={styles.moneyRow}>
                  <Text variant="body" style={styles.totalLabel}>
                    {t('feed.orderConfirmation.totalPaid')}
                  </Text>
                  <Text variant="h3" style={styles.totalValue}>
                    {totals ? formatCatalogPriceChf(totals.totalPaidChf) : '—'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <Text variant="h3" style={styles.sectionTitle}>
                {t('feed.orderConfirmation.whatsNext')}
              </Text>

              {isShipping ? (
                <>
                  <Text variant="body" color="textSecondary" style={styles.paragraph}>
                    {t('feed.orderConfirmation.shippingParagraph')}
                  </Text>

                  <View style={styles.infoBox}>
                    <View style={styles.infoBoxHeader}>
                      <Feather name="map-pin" size={16} color={theme.colors.textSecondary} />
                      <Text variant="captionSm" color="textSecondary" style={styles.infoLabel}>
                        {t('feed.orderConfirmation.shippingTo')}
                      </Text>
                    </View>
                    <Text variant="body" style={styles.infoValue}>
                      {shippingAddressLine ?? t('feed.orderConfirmation.addressSaved')}
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <Text variant="body" color="textSecondary" style={styles.paragraph}>
                    {t('feed.orderConfirmation.pickupParagraph')}
                  </Text>
                  <View style={styles.infoBox}>
                    <View style={styles.infoBoxHeader}>
                      <Feather name="info" size={16} color={theme.colors.textSecondary} />
                      <Text variant="captionSm" color="textSecondary" style={styles.infoLabel}>
                        {t('feed.orderConfirmation.tip')}
                      </Text>
                    </View>
                    <Text variant="body" style={styles.infoValue}>
                      {t('feed.orderConfirmation.checkBeforeConfirm')}
                    </Text>
                  </View>
                </>
              )}
            </View>

            <View style={styles.ctaBlock}>
              <Button
                title={t('feed.orderConfirmation.viewOrders')}
                onPress={() => router.replace('/tabs/profile/orders')}
                variant="primary"
              />
              <Button
                title={
                  fromMessagesThread
                    ? t('feed.orderConfirmation.backToConversation')
                    : t('feed.orderConfirmation.backToFeed')
                }
                onPress={() => {
                  if (fromMessagesThread) {
                    router.replace({
                      pathname: '/tabs/messages/[id]',
                      params: { id: fromMessagesThread, from_inbox: '1' }
                    });
                    return;
                  }
                  router.replace('/tabs/feed');
                }}
                variant="secondary"
                style={styles.secondaryCta}
              />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.muted
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: theme.colors.background
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
    paddingTop: theme.spacing.gapLg
  },
  successHero: {
    alignItems: 'center',
    marginBottom: theme.spacing.gapLg,
    paddingHorizontal: 8
  },
  successIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14
  },
  successTitle: {
    textAlign: 'center',
    marginBottom: 8
  },
  successSubtitle: {
    textAlign: 'center',
    lineHeight: 22
  },
  center: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    marginTop: 8
  },
  card: {
    backgroundColor: theme.colors.googleWhite,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    ...theme.shadows.card
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14
  },
  coverWrap: {
    width: 88,
    height: 88,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: theme.colors.muted
  },
  cover: {
    width: 88,
    height: 88,
    resizeMode: 'cover'
  },
  coverPlaceholder: {
    backgroundColor: theme.colors.muted
  },
  itemInfo: {
    flex: 1,
    paddingTop: 2
  },
  itemLabel: {
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4
  },
  itemTitle: {
    fontFamily: theme.fontFamily.semiBold
  },
  statusPill: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F4FBE8',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12
  },
  statusText: {
    flex: 1,
    color: theme.colors.textPrimary
  },
  sectionTitle: {
    marginBottom: 12
  },
  moneyBlock: {
    gap: 10
  },
  moneyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  moneyLabel: {
    flex: 1
  },
  moneyValue: {
    fontFamily: theme.fontFamily.medium,
    color: theme.colors.textPrimary
  },
  moneyDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginVertical: 4
  },
  totalLabel: {
    fontFamily: theme.fontFamily.semiBold,
    color: theme.colors.textPrimary
  },
  totalValue: {
    fontFamily: theme.fontFamily.bold,
    color: theme.colors.textPrimary
  },
  paragraph: {
    marginBottom: theme.spacing.gapMd,
    lineHeight: 22
  },
  infoBox: {
    borderRadius: 14,
    padding: 14,
    backgroundColor: theme.colors.muted
  },
  infoBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6
  },
  infoLabel: {
    fontFamily: theme.fontFamily.medium
  },
  infoValue: {
    color: theme.colors.textPrimary,
    lineHeight: 22
  },
  ctaBlock: {
    marginTop: 8,
    gap: 10
  },
  secondaryCta: {
    marginTop: 0
  },
  errorTitle: {
    marginBottom: 6
  },
  errorText: {
    marginBottom: 12
  },
  errorActions: {
    gap: 10
  }
});
