import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../../../components/ui/Text';
import { Button } from '../../../../components/ui/Button';
import { HeaderBackButton } from '../../../../components/ui/HeaderBackButton';
import { theme } from '../../../../lib/theme';
import { supabase } from '../../../../lib/supabase';

type OrderRow = {
  id: string;
  status: string | null;
  payment_status: string | null;
  delivery_mode: string | null;
  listing_title: string | null;
  listing_price: number | string | null;
  listing_cover_photo_url: string | null;
  shipping_city?: string | null;
  shipping_postal_code?: string | null;
  shipping_country?: string | null;
  shipping_address?: string | null;
};

function formatChf(amount: number) {
  return `${amount.toFixed(2)} CHF`;
}

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
        setError('Missing order id.');
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
            shipping_city,
            shipping_postal_code,
            shipping_country,
            shipping_address
          `
          )
          .eq('id', orderId)
          .maybeSingle();

        if (qError) throw qError;
        if (!data) throw new Error('Order not found.');
        if (!cancelled) {
          setOrder(data as OrderRow);
        }
      } catch (e) {
        if (!cancelled) {
          setOrder(null);
          setError(e instanceof Error ? e.message : 'Unable to load order.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const listingTitle = order?.listing_title ?? 'Your item';
  const rawCover = order?.listing_cover_photo_url ?? null;
  const coverUrl = rawCover ? normalizePhotoUrl(rawCover) : null;

  const price = useMemo(() => parseNumber(order?.listing_price ?? null), [order?.listing_price]);
  const commission = useMemo(() => (price != null ? price * 0.1 : null), [price]);
  const total = useMemo(() => (price != null && commission != null ? price + commission : null), [price, commission]);

  const deliveryMode = String(order?.delivery_mode ?? '').toLowerCase();
  const isShipping = deliveryMode === 'shipping';

  const statusLabel = useMemo(() => {
    const base = 'Secure payment — funds on hold';
    const payment = order?.payment_status ? ` (${order.payment_status})` : '';
    const orderStatus = order?.status ? ` • Order: ${order.status}` : '';
    return `${base}${payment}${orderStatus}`;
  }, [order?.payment_status, order?.status]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <HeaderBackButton onPress={() => router.back()} />
        <Text variant="body" style={styles.headerTitle}>
          Order confirmation
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
          Payment confirmed
        </Text>
        <Text variant="body" color="textSecondary" style={styles.subtitle}>
          Your payment is secured. The funds are currently on hold.
        </Text>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text variant="captionSm" color="textSecondary" style={styles.loadingText}>
              Loading your order…
            </Text>
          </View>
        ) : error ? (
          <View style={styles.card}>
            <Text variant="body" style={styles.errorTitle}>
              We couldn&apos;t load your order.
            </Text>
            <Text variant="caption" color="textSecondary" style={styles.errorText}>
              {error}
            </Text>
            <View style={styles.errorActions}>
              <Button
                title="View my orders"
                onPress={() => router.replace('/tabs/profile/orders')}
                variant="primary"
              />
              <Button
                title="Back to feed"
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
                        Item price
                      </Text>
                      <Text variant="caption" style={styles.moneyValue}>
                        {price != null ? formatChf(price) : '—'}
                      </Text>
                    </View>
                    <View style={styles.moneyRow}>
                      <Text variant="caption" color="textSecondary">
                        Buyer Protection (10%)
                      </Text>
                      <Text variant="caption" style={styles.moneyValue}>
                        {commission != null ? formatChf(commission) : '—'}
                      </Text>
                    </View>
                    <View style={[styles.moneyRow, styles.moneyRowTotal]}>
                      <Text variant="body" style={styles.moneyTotalLabel}>
                        Total paid
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
                What&apos;s next
              </Text>

              {isShipping ? (
                <>
                  <Text variant="body" color="textSecondary" style={styles.paragraph}>
                    The seller will ship your item. Once you receive it, confirm reception in your orders to release the payment to the seller.
                  </Text>

                  <View style={styles.infoBox}>
                    <Text variant="captionSm" color="textSecondary" style={styles.infoLabel}>
                      Shipping to
                    </Text>
                    <Text variant="body" style={styles.infoValue}>
                      {order?.shipping_city || order?.shipping_postal_code || order?.shipping_country
                        ? `${order?.shipping_postal_code ?? ''} ${order?.shipping_city ?? ''}`.trim() +
                          (order?.shipping_country ? `, ${order.shipping_country}` : '')
                        : 'Address saved in your order.'}
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <Text variant="body" color="textSecondary" style={styles.paragraph}>
                    Arrange a meet-up with the seller for an in-person handoff. After you get the item, confirm reception in your orders to release the payment.
                  </Text>
                  <View style={styles.infoBox}>
                    <Text variant="captionSm" color="textSecondary" style={styles.infoLabel}>
                      Tip
                    </Text>
                    <Text variant="body" style={styles.infoValue}>
                      Check the item before confirming reception.
                    </Text>
                  </View>
                </>
              )}
            </View>

            <View style={styles.ctaBlock}>
              <Button
                title="View my orders"
                onPress={() => router.replace('/tabs/profile/orders')}
                variant="primary"
              />
              <Button
                title="Back to feed"
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

