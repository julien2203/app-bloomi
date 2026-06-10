import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Text } from '../../../../components/ui/Text';
import { Button } from '../../../../components/ui/Button';
import { HeaderBackButton } from '../../../../components/ui/HeaderBackButton';
import { theme } from '../../../../lib/theme';
import { supabase } from '../../../../lib/supabase';
import { computeBuyerFees } from '../../../../lib/fees';
import { formatChf, formatPercent } from '../../../../lib/formatBuyerPrice';

type OrderRow = {
  id: string;
  status: string | null;
  payment_status: string | null;
  delivery_mode: string | null;
  listing_title: string | null;
  listing_price: number | string | null;
  listing_cover_photo_url: string | null;
  buyer_protection_chf?: number | string | null;
  buyer_banking_fee_chf?: number | string | null;
  shipping_fee_chf?: number | string | null;
  shipping_city?: string | null;
  shipping_postal_code?: string | null;
  shipping_country?: string | null;
  shipping_address?: string | null;
};

function parseNumber(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizePhotoUrl(rawUrl: string) {
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return rawUrl;
  const { data } = supabase.storage.from('listings').getPublicUrl(rawUrl);
  return data?.publicUrl ?? rawUrl;
}

export default function OrderConfirmationScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ order_id?: string }>();
  const orderId = params.order_id ?? null;

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<OrderRow | null>(null);
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
            status,
            payment_status,
            delivery_mode,
            listing_title,
            listing_price,
            listing_cover_photo_url,
            buyer_protection_chf,
            buyer_banking_fee_chf,
            shipping_fee_chf,
            shipping_city,
            shipping_postal_code,
            shipping_country,
            shipping_address
          `
          )
          .eq('id', orderId)
          .maybeSingle();

        if (qError) throw qError;
        if (!data) throw new Error(t('messages.notFound'));
        if (!cancelled) {
          setOrder({ ...(data as OrderRow) });
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

  const price = useMemo(() => parseNumber(order?.listing_price ?? null), [order?.listing_price]);
  const buyerFees = useMemo(() => {
    if (price == null) return null;
    const storedProtection = parseNumber(order?.buyer_protection_chf ?? null);
    const storedBanking = parseNumber(order?.buyer_banking_fee_chf ?? null);
    if (storedProtection != null && storedBanking != null) {
      return {
        protectionChf: storedProtection,
        bankingChf: storedBanking,
        protectionRate: storedProtection / price,
        bankingRate: storedBanking / price,
        finalPriceChf: price + storedProtection + storedBanking
      };
    }
    return computeBuyerFees(price);
  }, [order?.buyer_banking_fee_chf, order?.buyer_protection_chf, price]);
  const shippingFee = useMemo(() => parseNumber(order?.shipping_fee_chf ?? null) ?? 0, [order?.shipping_fee_chf]);
  const total = useMemo(
    () => (buyerFees != null ? buyerFees.finalPriceChf + shippingFee : null),
    [buyerFees, shippingFee]
  );

  const deliveryMode = String(order?.delivery_mode ?? '').toLowerCase();
  const isShipping = deliveryMode === 'shipping';

  const statusLabel = useMemo(() => {
    const base = t('feed.orderConfirmation.statusBase');
    const payment = order?.payment_status ? ` (${order.payment_status})` : '';
    const orderStatus = order?.status ? ` • ${order.status}` : '';
    return `${base}${payment}${orderStatus}`;
  }, [order?.payment_status, order?.status, t]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <HeaderBackButton onPress={() => router.back()} />
        <Text variant="body" style={styles.headerTitle}>
          {t('feed.orderConfirmation.title')}
        </Text>
        <View style={styles.headerRightPlaceholder} />
      </View>
      <View style={styles.headerSeparator} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 24 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="h2" style={styles.title}>
          {t('feed.orderConfirmation.paymentConfirmed')}
        </Text>
        <Text variant="body" color="textSecondary" style={styles.subtitle}>
          {t('feed.orderConfirmation.subtitle')}
        </Text>

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
                  <Text variant="body" style={styles.itemTitle} numberOfLines={2}>
                    {listingTitle}
                  </Text>

                  <View style={styles.moneyBlock}>
                    <View style={styles.moneyRow}>
                      <Text variant="caption" color="textSecondary">
                        {t('feed.orderConfirmation.itemPrice')}
                      </Text>
                      <Text variant="caption" style={styles.moneyValue}>
                        {price != null ? formatChf(price) : '—'}
                      </Text>
                    </View>
                    <View style={styles.moneyRow}>
                      <Text variant="caption" color="textSecondary">
                        {t('feed.orderConfirmation.buyerProtection', {
                          percent: buyerFees ? formatPercent(buyerFees.protectionRate) : 0
                        })}
                      </Text>
                      <Text variant="caption" style={styles.moneyValue}>
                        {buyerFees != null ? formatChf(buyerFees.protectionChf) : '—'}
                      </Text>
                    </View>
                    <View style={styles.moneyRow}>
                      <Text variant="caption" color="textSecondary">
                        {t('feed.orderConfirmation.bankingFee', {
                          percent: buyerFees ? formatPercent(buyerFees.bankingRate) : 0
                        })}
                      </Text>
                      <Text variant="caption" style={styles.moneyValue}>
                        {buyerFees != null ? formatChf(buyerFees.bankingChf) : '—'}
                      </Text>
                    </View>
                    {shippingFee > 0 ? (
                      <View style={styles.moneyRow}>
                        <Text variant="caption" color="textSecondary">
                          {t('feed.checkout.shippingFee')}
                        </Text>
                        <Text variant="caption" style={styles.moneyValue}>
                          {formatChf(shippingFee)}
                        </Text>
                      </View>
                    ) : null}
                    <View style={[styles.moneyRow, styles.moneyRowTotal]}>
                      <Text variant="body" style={styles.moneyTotalLabel}>
                        {t('feed.orderConfirmation.totalPaid')}
                      </Text>
                      <Text variant="body" color="primary" style={styles.moneyTotalValue}>
                        {total != null ? formatChf(total) : '—'}
                      </Text>
                    </View>
                  </View>
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
                {t('feed.orderConfirmation.whatsNext')}
              </Text>

              {isShipping ? (
                <>
                  <Text variant="body" color="textSecondary" style={styles.paragraph}>
                    {t('feed.orderConfirmation.shippingParagraph')}
                  </Text>

                  <View style={styles.infoBox}>
                    <Text variant="captionSm" color="textSecondary" style={styles.infoLabel}>
                      {t('feed.orderConfirmation.shippingTo')}
                    </Text>
                    <Text variant="body" style={styles.infoValue}>
                      {order?.shipping_city || order?.shipping_postal_code || order?.shipping_country
                        ? `${order?.shipping_postal_code ?? ''} ${order?.shipping_city ?? ''}`.trim() +
                          (order?.shipping_country ? `, ${order.shipping_country}` : '')
                        : t('feed.orderConfirmation.addressSaved')}
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <Text variant="body" color="textSecondary" style={styles.paragraph}>
                    {t('feed.orderConfirmation.pickupParagraph')}
                  </Text>
                  <View style={styles.infoBox}>
                    <Text variant="captionSm" color="textSecondary" style={styles.infoLabel}>
                      {t('feed.orderConfirmation.tip')}
                    </Text>
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
                title={t('feed.orderConfirmation.backToFeed')}
                onPress={() => router.replace('/tabs/feed')}
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
    paddingTop: theme.spacing.gapLg
  },
  title: {
    marginBottom: theme.spacing.gapSm
  },
  subtitle: {
    marginBottom: theme.spacing.gapLg
  },
  center: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    marginTop: 8
  },
  card: {
    backgroundColor: theme.colors.googleWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    marginBottom: 12,
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
    flex: 1
  },
  itemTitle: {
    marginBottom: 10
  },
  moneyBlock: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    padding: 10,
    backgroundColor: theme.colors.background
  },
  moneyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  moneyRowTotal: {
    marginBottom: 0,
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border
  },
  moneyValue: {
    color: theme.colors.textPrimary
  },
  moneyTotalLabel: {
    color: theme.colors.textPrimary
  },
  moneyTotalValue: {
    fontFamily: theme.fontFamily.semiBold
  },
  statusPill: {
    marginTop: 10,
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
    marginBottom: theme.spacing.gapSm
  },
  paragraph: {
    marginBottom: theme.spacing.gapMd
  },
  infoBox: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    padding: 12,
    backgroundColor: theme.colors.muted
  },
  infoLabel: {
    marginBottom: 6
  },
  infoValue: {
    color: theme.colors.textPrimary
  },
  ctaBlock: {
    marginTop: 4,
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

