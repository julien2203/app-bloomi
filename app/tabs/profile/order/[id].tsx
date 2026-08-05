import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  View
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
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
import { OrderStatusStepper } from '../../../../components/orders/OrderStatusStepper';
import { listingDetailHref } from '../../../../lib/navigation/listingDetailNav';
import { useAuthStore } from '../../../../stores/authStore';
import { getExistingThreadForOrder } from '../../../../lib/api';

type OrderDetailRow = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  status: string | null;
  payment_status: string | null;
  delivery_mode: string | null;
  listing_title: string | null;
  listing_price: number | string | null;
  listing_cover_photo_url: string | null;
  seller_amount?: number | string | null;
  seller_commission_chf?: number | string | null;
  buyer_protection_chf?: number | string | null;
  buyer_banking_fee_chf?: number | string | null;
  shipping_fee_chf?: number | string | null;
  parcel_size?: string | null;
  is_promo_shipping?: boolean | null;
  shipping_city?: string | null;
  shipping_postal_code?: string | null;
  shipping_country?: string | null;
  shipping_address?: string | null;
  tracking_number?: string | null;
  created_at: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
  confirmed_at?: string | null;
  listing?: { price: number | string | null } | null;
};

function normalizePhotoUrl(rawUrl: string) {
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return rawUrl;
  const { data } = supabase.storage.from('listings').getPublicUrl(rawUrl);
  return data?.publicUrl ?? rawUrl;
}

function formatOrderDate(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

export default function OrderDetailScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const safeBottom = getSafeBottomInset(insets.bottom);
  const params = useLocalSearchParams<{ id?: string; from?: string; tab?: string }>();
  const orderId = params.id ?? null;
  const ordersTabParam = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const ordersReturnTab = ordersTabParam === 'sales' ? 'sales' : 'purchases';
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<OrderDetailRow | null>(null);
  const [acceptedOfferAmount, setAcceptedOfferAmount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openingChat, setOpeningChat] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!orderId) {
        setError(t('profile.orders.detail.missingOrder'));
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
            seller_id,
            status,
            payment_status,
            delivery_mode,
            listing_title,
            listing_price,
            listing_cover_photo_url,
            seller_amount,
            seller_commission_chf,
            buyer_protection_chf,
            buyer_banking_fee_chf,
            shipping_fee_chf,
            parcel_size,
            is_promo_shipping,
            shipping_city,
            shipping_postal_code,
            shipping_country,
            shipping_address,
            tracking_number,
            created_at,
            shipped_at,
            delivered_at,
            confirmed_at,
            listing:listings(price)
          `
          )
          .eq('id', orderId)
          .maybeSingle();

        if (qError) throw qError;
        if (!data) throw new Error(t('profile.orders.detail.notFound'));

        const row = data as OrderDetailRow;
        const offerAmount = await fetchAcceptedOfferAmountForOrder({
          listingId: row.listing_id,
          buyerId: row.buyer_id
        });

        if (!cancelled) {
          setOrder(row);
          setAcceptedOfferAmount(offerAmount);
        }
      } catch (e) {
        if (!cancelled) {
          setOrder(null);
          setError(e instanceof Error ? e.message : t('profile.orders.detail.loadError'));
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
  const acceptedOffer = totals?.isAcceptedOffer ?? false;
  const itemPriceLabel = acceptedOffer
    ? t('feed.orderConfirmation.acceptedOfferPrice')
    : t('feed.orderConfirmation.itemPrice');
  const isBuyer = Boolean(user?.id && order?.buyer_id === user.id);
  const isSeller = Boolean(user?.id && order?.seller_id === user.id);
  const sellerPayoutChf = useMemo(() => {
    if (!order) return null;
    const raw = order.seller_amount;
    if (raw == null) return null;
    const n = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(n) ? n : null;
  }, [order]);
  const sellerCommissionChf = useMemo(() => {
    if (!order?.seller_commission_chf) return null;
    const n =
      typeof order.seller_commission_chf === 'number'
        ? order.seller_commission_chf
        : Number(order.seller_commission_chf);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [order?.seller_commission_chf]);

  const listingTitle = order?.listing_title ?? t('feed.orderConfirmation.yourItem');
  const rawCover = order?.listing_cover_photo_url ?? null;
  const coverUrl = rawCover ? normalizePhotoUrl(rawCover) : null;
  const isPickup = isOrderPickupDelivery(order?.delivery_mode);
  const orderDate = formatOrderDate(order?.created_at ?? null, i18n.language);

  const statusLabel = useMemo(() => {
    const statusNorm = String(order?.status ?? '').toLowerCase();
    if (statusNorm === 'pending') {
      return isPickup
        ? t('profile.orders.awaitingPickup')
        : t('profile.orders.awaitingShipment');
    }
    if (statusNorm === 'shipped') return t('profile.orders.packageOnWay');
    if (statusNorm === 'completed') return t('profile.orders.orderCompleted');
    if (statusNorm === 'cancelled') return t('profile.orders.orderCancelled');
    return String(order?.status ?? '—');
  }, [isPickup, order?.status, t]);

  const openListing = useCallback(() => {
    if (!order?.listing_id) return;
    router.push(
      listingDetailHref(order.listing_id, {
        return_to: 'profile',
        cover_photo: rawCover ?? undefined
      })
    );
  }, [order?.listing_id, rawCover, router]);

  const contactParticipant = useCallback(async () => {
    if (!order?.listing_id || !order.buyer_id || !order.seller_id || openingChat) return;

    setOpeningChat(true);
    try {
      const { data: existing, error: threadErr } = await getExistingThreadForOrder(
        order.listing_id,
        order.buyer_id
      );

      if (threadErr) {
        throw new Error(threadErr);
      }

      if (existing?.id) {
        router.push({
          pathname: '/tabs/messages/[id]',
          params: { id: existing.id, from_order_id: order.id }
        });
        return;
      }

      if (isBuyer) {
        router.push({
          pathname: '/tabs/messages/[id]',
          params: {
            id: 'draft',
            listing_id: order.listing_id,
            seller_id: order.seller_id,
            from_order_id: order.id
          }
        });
        return;
      }

      Alert.alert(t('common.error'), t('profile.orders.detail.contactUnavailable'));
    } catch (e) {
      Alert.alert(
        t('common.error'),
        e instanceof Error ? e.message : t('profile.orders.detail.contactError')
      );
    } finally {
      setOpeningChat(false);
    }
  }, [isBuyer, openingChat, order, router, t]);

  const goBackToOrders = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace({
      pathname: '/tabs/profile/orders',
      params: { tab: ordersReturnTab }
    });
  }, [ordersReturnTab, router]);

  const handleBack = goBackToOrders;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <HeaderBackButton onPress={handleBack} />
        <Text variant="body" style={styles.headerTitle}>
          {t('profile.orders.detail.title')}
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
          </View>
        ) : error ? (
          <View style={styles.card}>
            <Text variant="body">{error}</Text>
            <Button
              title={t('profile.orders.title')}
              onPress={goBackToOrders}
              variant="primary"
              style={styles.backButton}
            />
          </View>
        ) : order ? (
          <>
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
                  <Text variant="body" style={styles.itemTitle} numberOfLines={3}>
                    {listingTitle}
                  </Text>
                  {orderDate ? (
                    <Text variant="captionSm" color="textSecondary">
                      {t('profile.orders.detail.orderedOn', { date: orderDate })}
                    </Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.statusPill}>
                <Text variant="captionSm" style={styles.statusText}>
                  {statusLabel}
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text variant="h3" style={styles.sectionTitle}>
                {t('profile.orders.detail.progressTitle')}
              </Text>
              <OrderStatusStepper
                order={order}
                isBuyer={isBuyer}
              />
            </View>

            <View style={styles.card}>
              {isBuyer ? (
                <View style={styles.moneyBlock}>
                  <Text variant="h3" style={styles.sectionTitle}>
                    {t('feed.orderConfirmation.priceSummary')}
                  </Text>
                  <View style={styles.moneyRow}>
                    <Text variant="body" color="textSecondary">
                      {itemPriceLabel}
                    </Text>
                    <Text variant="body">
                      {totals ? formatChf(totals.itemPriceChf) : '—'}
                    </Text>
                  </View>
                  <View style={styles.moneyRow}>
                    <Text variant="body" color="textSecondary">
                      {t('feed.orderConfirmation.bloomiFees')}
                    </Text>
                    <Text variant="body">
                      {totals ? `+${formatFeeLineChf(totals.buyerFeesChf)}` : '—'}
                    </Text>
                  </View>
                  {totals?.includesShipping ? (
                    <View style={styles.moneyRow}>
                      <Text variant="body" color="textSecondary">
                        {t('feed.checkout.shippingFee')}
                      </Text>
                      <Text variant="body">
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
                  <View style={[styles.moneyRow, styles.totalRow]}>
                    <Text variant="body" style={styles.totalLabel}>
                      {t('feed.orderConfirmation.totalPaid')}
                    </Text>
                    <Text variant="body" style={styles.totalValue}>
                      {totals ? formatCatalogPriceChf(totals.totalPaidChf) : '—'}
                    </Text>
                  </View>
                </View>
              ) : isSeller ? (
                <View style={styles.moneyBlock}>
                  <Text variant="h3" style={styles.sectionTitle}>
                    {t('feed.pricing.breakdownTitle')}
                  </Text>
                  <View style={styles.moneyRow}>
                    <Text variant="body" color="textSecondary">
                      {itemPriceLabel}
                    </Text>
                    <Text variant="body">
                      {totals ? formatChf(totals.itemPriceChf) : '—'}
                    </Text>
                  </View>
                  {sellerCommissionChf != null ? (
                    <View style={styles.moneyRow}>
                      <Text variant="body" color="textSecondary">
                        {t('profile.orders.sellerCommission')}
                      </Text>
                      <Text variant="body">-{formatChf(sellerCommissionChf)}</Text>
                    </View>
                  ) : null}
                  <View style={[styles.moneyRow, styles.totalRow]}>
                    <Text variant="body" style={styles.totalLabel}>
                      {t('profile.orders.sellerPayout')}
                    </Text>
                    <Text variant="body" style={styles.totalValue}>
                      {sellerPayoutChf != null ? formatChf(sellerPayoutChf) : '—'}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.moneyBlock}>
                  <Text variant="h3" style={styles.sectionTitle}>
                    {t('feed.orderConfirmation.priceSummary')}
                  </Text>
                  <View style={styles.moneyRow}>
                    <Text variant="body" color="textSecondary">
                      {itemPriceLabel}
                    </Text>
                    <Text variant="body">
                      {totals ? formatChf(totals.itemPriceChf) : '—'}
                    </Text>
                  </View>
                  <View style={styles.moneyRow}>
                    <Text variant="body" color="textSecondary">
                      {t('feed.orderConfirmation.bloomiFees')}
                    </Text>
                    <Text variant="body">
                      {totals ? `+${formatFeeLineChf(totals.buyerFeesChf)}` : '—'}
                    </Text>
                  </View>
                  {totals?.includesShipping ? (
                    <View style={styles.moneyRow}>
                      <Text variant="body" color="textSecondary">
                        {t('feed.checkout.shippingFee')}
                      </Text>
                      <Text variant="body">
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
                  <View style={[styles.moneyRow, styles.totalRow]}>
                    <Text variant="body" style={styles.totalLabel}>
                      {t('feed.orderConfirmation.totalPaid')}
                    </Text>
                    <Text variant="body" style={styles.totalValue}>
                      {totals ? formatCatalogPriceChf(totals.totalPaidChf) : '—'}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {!isPickup && order.shipping_address ? (
              <View style={styles.card}>
                <Text variant="h3" style={styles.sectionTitle}>
                  {t('feed.orderConfirmation.shippingTo')}
                </Text>
                <Text variant="body" style={styles.addressText}>
                  {order.shipping_address}
                </Text>
                <Text variant="body" color="textSecondary">
                  {[order.shipping_postal_code, order.shipping_city, order.shipping_country]
                    .filter(Boolean)
                    .join(' ')}
                </Text>
                {order.tracking_number ? (
                  <Text variant="captionSm" color="textSecondary" style={styles.trackingText}>
                    {t('profile.orders.trackingNumber', { number: order.tracking_number })}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {order.listing_id ? (
              <View style={styles.ctaBlock}>
                {isBuyer || isSeller ? (
                  <Button
                    title={
                      isBuyer
                        ? t('profile.orders.detail.contactSeller')
                        : t('profile.orders.detail.contactBuyer')
                    }
                    onPress={() => void contactParticipant()}
                    loading={openingChat}
                    disabled={openingChat}
                    variant="primary"
                  />
                ) : null}
                <Button
                  title={t('profile.orders.detail.viewListing')}
                  onPress={openListing}
                  variant="secondary"
                />
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
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
    paddingTop: theme.spacing.gapLg,
    gap: 12
  },
  center: {
    paddingVertical: 40,
    alignItems: 'center'
  },
  card: {
    backgroundColor: theme.colors.googleWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    ...theme.shadows.card
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12
  },
  coverWrap: {
    width: 92,
    height: 92,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: theme.colors.muted
  },
  cover: {
    width: 92,
    height: 92,
    resizeMode: 'cover'
  },
  coverPlaceholder: {
    backgroundColor: theme.colors.muted
  },
  itemInfo: {
    flex: 1,
    gap: 6
  },
  itemTitle: {
    fontFamily: theme.fontFamily.semiBold
  },
  statusPill: {
    marginTop: 12,
    backgroundColor: '#F9FFE8',
    borderWidth: 1,
    borderColor: theme.colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999
  },
  statusText: {
    color: theme.colors.textPrimary
  },
  sectionTitle: {
    marginBottom: 10
  },
  moneyBlock: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    padding: 12,
    backgroundColor: theme.colors.background,
    gap: 8
  },
  moneyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  totalRow: {
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border
  },
  totalLabel: {
    fontFamily: theme.fontFamily.bold
  },
  totalValue: {
    fontFamily: theme.fontFamily.bold
  },
  addressText: {
    marginBottom: 4
  },
  trackingText: {
    marginTop: 8
  },
  ctaBlock: {
    gap: 10
  },
  backButton: {
    marginTop: 12
  }
});
