import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text as RNText,
  TouchableOpacity,
  View
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../../stores/authStore';
import { supabase } from '../../../lib/supabase';
import { SUPABASE_URL } from '../../../lib/env';
import { Text } from '../../../components/ui/Text';
import { Button } from '../../../components/ui/Button';
import { HeaderBackButton } from '../../../components/ui/HeaderBackButton';
import { theme } from '../../../lib/theme';

type OrdersTab = 'purchases' | 'sales';

type OrderRow = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  status: string | null;
  payment_status: string | null;
  seller_amount: number | string | null;
  created_at: string | null;
  listing_title?: string | null;
  listing_price?: number | string | null;
  listing_cover_photo_url?: string | null;
};

type ListingForOrder = {
  id: string;
  title: string;
  price: number | null;
  photos: Array<{
    url: string;
    order_index: number;
  }> | null;
};

type EnrichedOrder = OrderRow & {
  listing: ListingForOrder | null;
  coverPhotoUrl: string | null;
  displayAmount: string;
};

function formatAmount(amount: number | string | null | undefined) {
  if (amount == null) return '-';
  const n = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(n)) return String(amount);
  return `${n.toFixed(2)} CHF`;
}

function normalizePhotoUrl(rawUrl: string) {
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return rawUrl;
  const { data } = supabase.storage.from('listings').getPublicUrl(rawUrl);
  return data?.publicUrl ?? rawUrl;
}

export default function OrdersScreen() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [tab, setTab] = useState<OrdersTab>('purchases');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<EnrichedOrder[]>([]);
  const [confirmingOrderIds, setConfirmingOrderIds] = useState<Set<string>>(
    () => new Set()
  );
  const [cancellingOrderIds, setCancellingOrderIds] = useState<Set<string>>(
    () => new Set()
  );

  const userId = user?.id ?? null;

  const tabQuery = useMemo(() => {
    if (!userId) return null;
    if (tab === 'purchases') return { field: 'buyer_id', value: userId };
    return { field: 'seller_id', value: userId };
  }, [tab, userId]);

  const loadOrders = useCallback(async () => {
    if (!userId || !tabQuery) return;

    setLoading(true);
    try {
      const { data: orderRows, error: orderErr } = await supabase
        .from('orders')
        .select(
          `
          id,
          listing_id,
          buyer_id,
          seller_id,
          status,
          payment_status,
          seller_amount,
          created_at,
          listing_title,
          listing_price,
          listing_cover_photo_url,
          listing:listings(
            id,
            title,
            price,
            photos:listing_photos(url, order_index)
          )
        `
        )
        .eq(tabQuery.field, tabQuery.value)
        .order('created_at', { ascending: false });

      if (orderErr) {
        // eslint-disable-next-line no-console
        console.log('Orders load error:', orderErr);
        const extra = [
          (orderErr as any)?.code ? `code=${(orderErr as any).code}` : null,
          (orderErr as any)?.details ? `details=${(orderErr as any).details}` : null,
          (orderErr as any)?.hint ? `hint=${(orderErr as any).hint}` : null
        ]
          .filter(Boolean)
          .join(' ');
        throw new Error(extra ? `${orderErr.message} (${extra})` : orderErr.message);
      }

      const rows = (orderRows ?? []) as (OrderRow & {
        listing: ListingForOrder | null;
      })[];

      const enriched: EnrichedOrder[] = rows.map((o) => {
        const listing = o.listing ?? null;
        const photos = listing?.photos ?? [];
        const sortedPhotos = [...photos].sort(
          (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
        );
        const coverPhotoUrl =
          sortedPhotos[0]?.url
            ? normalizePhotoUrl(sortedPhotos[0].url)
            : o.listing_cover_photo_url
            ? normalizePhotoUrl(o.listing_cover_photo_url)
            : null;

        return {
          ...o,
          listing:
            listing ??
            (o.listing_title || o.listing_price != null
              ? {
                  id: o.listing_id,
                  title: o.listing_title ?? 'Listing',
                  price:
                    typeof o.listing_price === 'number'
                      ? o.listing_price
                      : typeof o.listing_price === 'string'
                      ? Number(o.listing_price)
                      : null,
                  photos: null
                }
              : null),
          coverPhotoUrl,
          displayAmount: formatAmount(
            (o.seller_amount as any) ??
              listing?.price ??
              (o.listing_price as any) ??
              null
          )
        };
      });

      setOrders(enriched);
    } catch (e) {
      // Log détaillé pour debug Supabase/SQL
      // eslint-disable-next-line no-console
      console.log('Erreur chargement commandes:', e);
      const message =
        e instanceof Error && e.message
          ? `Unable to load your orders: ${e.message}`
          : 'Unable to load your orders.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, [tabQuery, userId]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const onRefresh = useCallback(async () => {
    if (!tabQuery || !userId) return;
    setRefreshing(true);
    try {
      await loadOrders();
    } finally {
      setRefreshing(false);
    }
  }, [loadOrders, tabQuery, userId]);

  const canConfirmReception = useCallback(
    (order: EnrichedOrder) =>
      tab === 'purchases' &&
      userId != null &&
      order.buyer_id === userId &&
      String(order.status ?? '').toLowerCase() === 'pending',
    [tab, userId]
  );

  const canCancelOrder = useCallback(
    (order: EnrichedOrder) =>
      userId != null && String(order.status ?? '').toLowerCase() === 'pending',
    [userId]
  );

  const confirmReception = useCallback(
    async (orderId: string) => {
      if (!userId) return;
      if (confirmingOrderIds.has(orderId)) return;

      setConfirmingOrderIds((prev) => new Set(prev).add(orderId));
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) {
          throw new Error('Session expired. Please sign in again.');
        }

        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/confirm-order`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ order_id: orderId })
          }
        );

        const responseText = await response.text();
        let data: any = null;
        try {
          data = responseText ? JSON.parse(responseText) : null;
        } catch {
          data = null;
        }
        if (!response.ok || (data as any)?.success !== true) {
          throw new Error(
            (data as any)?.error ??
              (data as any)?.details ??
              responseText ??
              'confirm-order: failed'
          );
        }

        await loadOrders();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log('Erreur confirmReception:', e);
        const message =
          e instanceof Error && e.message
            ? `Unable to confirm receipt: ${e.message}`
            : 'Unable to confirm receipt.';
        Alert.alert('Error', message);
      } finally {
        setConfirmingOrderIds((prev) => {
          const next = new Set(prev);
          next.delete(orderId);
          return next;
        });
      }
    },
    [confirmingOrderIds, loadOrders, userId]
  );

  const cancelOrder = useCallback(
    async (orderId: string) => {
      if (!userId) return;
      if (cancellingOrderIds.has(orderId)) return;

      Alert.alert(
        'Cancel this order?',
        'This will trigger a refund if needed. Do you want to continue?',
        [
          { text: 'Back', style: 'cancel' },
          {
            text: 'Cancel order',
            style: 'destructive',
            onPress: async () => {
              setCancellingOrderIds((prev) => new Set(prev).add(orderId));
              try {
                const { data: sessionData } = await supabase.auth.getSession();
                const accessToken = sessionData.session?.access_token;
                if (!accessToken) {
                  throw new Error('Session expired. Please sign in again.');
                }

                const response = await fetch(
                  `${SUPABASE_URL}/functions/v1/refund-order`,
                  {
                    method: 'POST',
                    headers: {
                      Authorization: `Bearer ${accessToken}`,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ order_id: orderId })
                  }
                );

                const responseText = await response.text();
                let data: any = null;
                try {
                  data = responseText ? JSON.parse(responseText) : null;
                } catch {
                  data = null;
                }
                if (!response.ok || (data as any)?.success !== true) {
                  throw new Error(
                    (data as any)?.error ??
                      (data as any)?.details ??
                      responseText ??
                      'refund-order: failed'
                  );
                }

                await loadOrders();
              } catch (e) {
                // eslint-disable-next-line no-console
                console.log('Erreur cancelOrder:', e);
                const message =
                  e instanceof Error && e.message
                    ? `Unable to cancel the order: ${e.message}`
                    : 'Unable to cancel the order.';
                Alert.alert('Error', message);
              } finally {
                setCancellingOrderIds((prev) => {
                  const next = new Set(prev);
                  next.delete(orderId);
                  return next;
                });
              }
            }
          }
        ]
      );
    },
    [cancellingOrderIds, loadOrders, userId]
  );

  const renderOrderItem = useCallback(
    ({ item }: { item: EnrichedOrder }) => {
      const statusNorm = String(item.status ?? 'unknown').toLowerCase();
      const statusText = String(item.status ?? 'unknown');
      const paymentStatusText = item.payment_status
        ? ` • ${item.payment_status}`
        : '';

      const showConfirm = canConfirmReception(item);
      const isConfirming = confirmingOrderIds.has(item.id);
      const showCancel = canCancelOrder(item);
      const isCancelling = cancellingOrderIds.has(item.id);

      const statusColor: any =
        statusNorm === 'cancelled' ? 'danger' : 'textSecondary';

      return (
        <View style={styles.orderCard}>
          <View style={styles.orderTop}>
            <View style={styles.coverWrap}>
              {item.coverPhotoUrl ? (
                <Image source={{ uri: item.coverPhotoUrl }} style={styles.cover} />
              ) : (
                <View style={[styles.cover, styles.coverPlaceholder]} />
              )}
            </View>

            <View style={styles.orderInfo}>
              <Text variant="body" style={styles.orderTitle} numberOfLines={2}>
                {item.listing?.title ?? 'Annonce'}
              </Text>
              <Text variant="body" color="textSecondary" style={styles.orderAmount}>
                {item.displayAmount}
              </Text>
              <Text
                variant="captionSm"
                color={statusColor}
                style={styles.orderStatus}
              >
                {statusText}
                {paymentStatusText}
              </Text>
            </View>
          </View>

          {(showConfirm || showCancel) ? (
            <View style={styles.actionsWrap}>
              {showConfirm ? (
                <View style={styles.confirmButtonWrap}>
                  <Button
                    title={isConfirming ? 'Confirmation…' : 'Confirmer la réception'}
                    onPress={() => confirmReception(item.id)}
                    disabled={isConfirming}
                    loading={isConfirming}
                    variant="primary"
                  />
                </View>
              ) : null}

              {showCancel ? (
                <View style={styles.cancelButtonWrap}>
                  <Button
                    title={isCancelling ? 'Annulation…' : 'Annuler la commande'}
                    onPress={() => cancelOrder(item.id)}
                    disabled={isCancelling}
                    loading={isCancelling}
                    variant="secondary"
                  />
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      );
    },
    [
      canCancelOrder,
      canConfirmReception,
      cancellingOrderIds,
      confirmingOrderIds,
      confirmReception,
      cancelOrder
    ]
  );

  const title = tab === 'purchases' ? 'My purchases' : 'My sales';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <HeaderBackButton onPress={() => router.back()} />
          <Text variant="h2" style={styles.title}>
            Orders
          </Text>
          <View style={styles.headerRightPlaceholder} />
        </View>
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, tab === 'purchases' && styles.tabActive]}
            onPress={() => setTab('purchases')}
            activeOpacity={0.8}
          >
            <RNText style={styles.tabText}>My purchases</RNText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'sales' && styles.tabActive]}
            onPress={() => setTab('sales')}
            activeOpacity={0.8}
          >
            <RNText style={styles.tabText}>My sales</RNText>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.separator} />

      {loading && orders.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          renderItem={renderOrderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text variant="body" color="textSecondary" style={styles.emptyText}>
                No orders yet ({title})
              </Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  header: {
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingTop: 16,
    paddingBottom: 10
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerRightPlaceholder: {
    width: 28
  },
  title: {
    marginBottom: 10,
    flex: 1,
    textAlign: 'center'
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.muted,
    borderRadius: 14,
    padding: 4
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10
  },
  tabActive: {
    backgroundColor: theme.colors.googleWhite,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2
  },
  tabText: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    fontWeight: '600'
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border
  },
  listContent: {
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingBottom: 24
  },
  itemSeparator: {
    height: 12
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  emptyWrap: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyText: {
    textAlign: 'center'
  },
  orderCard: {
    backgroundColor: theme.colors.googleWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12
  },
  orderTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12
  },
  coverWrap: {
    width: 84,
    height: 84,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: theme.colors.muted
  },
  cover: {
    width: 84,
    height: 84,
    resizeMode: 'cover'
  },
  coverPlaceholder: {
    backgroundColor: theme.colors.muted
  },
  orderInfo: {
    flex: 1
  },
  orderTitle: {
    marginBottom: 6
  },
  orderAmount: {
    marginBottom: 4
  },
  orderStatus: {
    marginBottom: 6
  },
  actionsWrap: {
    marginTop: 10,
    gap: 10
  },
  confirmButtonWrap: {
    marginTop: 0
  },
  cancelButtonWrap: {
    marginTop: 0
  }
});

