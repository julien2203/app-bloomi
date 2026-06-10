import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  RefreshControl,
  StyleSheet,
  Text as RNText,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../stores/authStore';
import { supabase } from '../../../lib/supabase';
import { SUPABASE_URL } from '../../../lib/env';
import { sendPushNotificationWithUserJwt } from '../../../lib/pushNotifications';
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
  seller_commission_chf?: number | string | null;
  created_at: string | null;
  delivery_mode?: string | null;
  shipping_address?: string | null;
  shipping_city?: string | null;
  shipping_postal_code?: string | null;
  shipping_country?: string | null;
  tracking_number?: string | null;
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
  commissionLabel?: string | null;
};

type SenderAddress = {
  street: string;
  city: string;
  zip: string;
  country: string;
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
  const { t } = useTranslation();
  const router = useRouter();
  const { from_notifications, from_notifications_origin } = useLocalSearchParams<{
    from_notifications?: string;
    from_notifications_origin?: string;
  }>();
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
  const [generatingLabelOrderIds, setGeneratingLabelOrderIds] = useState<Set<string>>(
    () => new Set()
  );
  const [markingShippedOrderIds, setMarkingShippedOrderIds] = useState<Set<string>>(
    () => new Set()
  );
  const [reviewedOrderIds, setReviewedOrderIds] = useState<Set<string>>(() => new Set());
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [addressModalOrder, setAddressModalOrder] = useState<EnrichedOrder | null>(null);
  const [addressModalSellerName, setAddressModalSellerName] = useState('Seller');
  const [senderStreetInput, setSenderStreetInput] = useState('');
  const [senderCityInput, setSenderCityInput] = useState('');
  const [senderZipInput, setSenderZipInput] = useState('');
  const [senderCountryInput, setSenderCountryInput] = useState('');
  const [saveSenderAddress, setSaveSenderAddress] = useState(true);
  const [submittingAddressModal, setSubmittingAddressModal] = useState(false);
  const [disputeModalVisible, setDisputeModalVisible] = useState(false);
  const [disputeOrderId, setDisputeOrderId] = useState<string | null>(null);

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
          seller_commission_chf,
          created_at,
          delivery_mode,
          shipping_address,
          shipping_city,
          shipping_postal_code,
          shipping_country,
          tracking_number,
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
          ),
          commissionLabel:
            tab === 'sales' && o.seller_commission_chf != null
              ? (() => {
                  const commission =
                    typeof o.seller_commission_chf === 'number'
                      ? o.seller_commission_chf
                      : Number(o.seller_commission_chf);
                  return Number.isFinite(commission) && commission > 0
                    ? t('profile.orders.sellerCommission', {
                        amount: formatAmount(commission)
                      })
                    : null;
                })()
              : null
        };
      });

      setOrders(enriched);

      if (rows.length > 0) {
        const orderIds = rows.map((row) => row.id);
        const { data: reviewRows, error: reviewErr } = await supabase
          .from('reviews')
          .select('order_id')
          .eq('reviewer_id', userId)
          .in('order_id', orderIds);
        if (reviewErr) {
          // eslint-disable-next-line no-console
          console.log('Erreur chargement reviews orders:', reviewErr);
          setReviewedOrderIds(new Set());
        } else {
          const ids = (reviewRows ?? [])
            .map((r: any) => String(r.order_id ?? '').trim())
            .filter(Boolean);
          setReviewedOrderIds(new Set(ids));
        }
      } else {
        setReviewedOrderIds(new Set());
      }
    } catch (e) {
      // Log détaillé pour debug Supabase/SQL
      // eslint-disable-next-line no-console
      console.log('Erreur chargement commandes:', e);
      const message =
        e instanceof Error && e.message
          ? `${t('profile.orders.unableLoad')}: ${e.message}`
          : t('profile.orders.unableLoad');
      Alert.alert(t('common.error'), message);
    } finally {
      setLoading(false);
    }
  }, [tab, tabQuery, t, userId]);

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
      String(order.status ?? '').toLowerCase() === 'shipped',
    [tab, userId]
  );

  const canCancelOrder = useCallback(
    (order: EnrichedOrder) =>
      userId != null && String(order.status ?? '').toLowerCase() === 'pending',
    [userId]
  );

  const openDisputeModal = useCallback((orderId: string) => {
    setDisputeOrderId(orderId);
    setDisputeModalVisible(true);
  }, []);

  const closeDisputeModal = useCallback(() => {
    setDisputeModalVisible(false);
    setDisputeOrderId(null);
  }, []);

  const copyDisputeOrderId = useCallback(async () => {
    if (!disputeOrderId) return;
    await Clipboard.setStringAsync(disputeOrderId);
  }, [disputeOrderId]);

  const sendDisputeEmail = useCallback(async () => {
    const orderId = disputeOrderId ?? '';
    const subject = encodeURIComponent('Order dispute');
    const body = encodeURIComponent(`Order ID: ${orderId}`);
    const url = `mailto:contact@bloomi.ch?subject=${subject}&body=${body}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    }
  }, [disputeOrderId]);

  const canGenerateShippingLabel = useCallback(
    (order: EnrichedOrder) =>
      tab === 'sales' &&
      userId != null &&
      order.seller_id === userId &&
      String(order.delivery_mode ?? '').toLowerCase() !== 'pickup' &&
      (String(order.status ?? '').toLowerCase() === 'pending' ||
        (String(order.status ?? '').toLowerCase() === 'shipped' &&
          !String(order.tracking_number ?? '').trim())),
    [tab, userId]
  );

  const confirmReception = useCallback(
    async (order: EnrichedOrder) => {
      const orderId = order.id;
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

        void sendPushNotificationWithUserJwt({
          user_id: order.buyer_id,
          titleKey: 'profile.orders.ratePurchase',
          bodyKey: 'profile.orders.reviewPrompt',
          notification_type: 'new_feedback',
          data: { order_id: orderId, listing_id: order.listing_id }
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log('Erreur confirmReception:', e);
        const message =
          e instanceof Error && e.message
            ? `Unable to confirm receipt: ${e.message}`
            : 'Unable to confirm receipt.';
        Alert.alert(t('common.error'), message);
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
        t('profile.orders.cancelOrderTitle'),
        t('profile.orders.cancelOrderMessage'),
        [
          { text: t('common.back'), style: 'cancel' },
          {
            text: t('profile.orders.cancelOrder'),
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
                Alert.alert(t('common.error'), message);
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

  const invokeGenerateShippingLabel = useCallback(
    async (order: EnrichedOrder, sender: SenderAddress, sellerName: string) => {
      const recipientStreet = String(order.shipping_address ?? '').trim();
      const recipientCity = String(order.shipping_city ?? '').trim();
      const recipientZip = String(order.shipping_postal_code ?? '').trim();
      const recipientCountry = String(order.shipping_country ?? '')
        .trim()
        .toUpperCase();

      if (!recipientStreet || !recipientCity || !recipientZip || !recipientCountry) {
        throw new Error('Shipping address is incomplete for this order.');
      }

      const { data: buyerProfile, error: buyerErr } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', order.buyer_id)
        .maybeSingle();

      if (buyerErr) {
        throw new Error(buyerErr.message);
      }

      const buyerName = String((buyerProfile as any)?.display_name ?? '').trim() || 'Buyer';

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error('Session expired. Please sign in again.');
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/generate-shipping-label`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            order_id: order.id,
            sender_name: sellerName,
            sender_street: sender.street,
            sender_zip: sender.zip,
            sender_city: sender.city,
            sender_country: sender.country,
            recipient_name: buyerName,
            recipient_street: recipientStreet,
            recipient_zip: recipientZip,
            recipient_city: recipientCity,
            recipient_country: recipientCountry
          })
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
        const rawDetails = (data as any)?.details;
        const detailsStr =
          typeof rawDetails === 'object' && rawDetails !== null
            ? JSON.stringify(rawDetails)
            : String(rawDetails ?? '');
        throw new Error(
          (data as any)?.error ??
            (detailsStr || responseText || 'generate-shipping-label: failed')
        );
      }

      const trackingNumber = String((data as any)?.tracking_number ?? '').trim() || null;
      if (trackingNumber) {
        setOrders((prev) =>
          prev.map((row) =>
            row.id === order.id ? { ...row, tracking_number: trackingNumber } : row
          )
        );
      }

      const labelPdfBase64 = String((data as any)?.label_pdf_base64 ?? '').trim();
      const labelUrl = String((data as any)?.label_url ?? '').trim();

      if (labelPdfBase64) {
        const cacheDir = FileSystem.cacheDirectory;
        if (!cacheDir) {
          throw new Error('Cache directory unavailable');
        }
        const fileUri = `${cacheDir}etiquette_bloomi.pdf`;
        await FileSystem.writeAsStringAsync(fileUri, labelPdfBase64, {
          encoding: FileSystem.EncodingType.Base64
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Swiss Post shipping label'
          });
        } else {
          await Print.printAsync({ uri: fileUri });
        }
      } else if (labelUrl) {
        await Linking.openURL(labelUrl);
      } else {
        Alert.alert(t('common.success'), t('profile.orders.labelNoDoc'));
      }

      await loadOrders();
    },
    [loadOrders]
  );

  const generateShippingLabel = useCallback(
    async (order: EnrichedOrder) => {
      if (!userId) return;
      if (generatingLabelOrderIds.has(order.id)) return;

      setGeneratingLabelOrderIds((prev) => new Set(prev).add(order.id));
      try {
        const { data: sellerProfile, error: sellerErr } = await supabase
          .from('profiles')
          .select('display_name, street, postal_code, city, country')
          .eq('id', userId)
          .maybeSingle();

        if (sellerErr) {
          throw new Error(sellerErr.message);
        }

        const sellerName =
          String((sellerProfile as any)?.display_name ?? '').trim() ||
          'Seller';
        const sellerStreet = String((sellerProfile as any)?.street ?? '').trim();
        const sellerCity = String((sellerProfile as any)?.city ?? '').trim();
        const sellerZip = String((sellerProfile as any)?.postal_code ?? '').trim();
        const sellerCountry = String((sellerProfile as any)?.country ?? '')
          .trim()
          .toUpperCase();

        if (!sellerStreet || !sellerCity || !sellerZip || !sellerCountry) {
          setAddressModalOrder(order);
          setAddressModalSellerName(sellerName);
          setSenderStreetInput(sellerStreet);
          setSenderCityInput(sellerCity);
          setSenderZipInput(sellerZip);
          setSenderCountryInput(sellerCountry);
          setSaveSenderAddress(true);
          setAddressModalVisible(true);
          return;
        }

        await invokeGenerateShippingLabel(
          order,
          {
            street: sellerStreet,
            city: sellerCity,
            zip: sellerZip,
            country: sellerCountry
          },
          sellerName
        );
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log('Erreur generateShippingLabel:', e);
        const message =
          e instanceof Error && e.message
            ? `Could not generate label: ${e.message}`
            : 'Could not generate label.';
        Alert.alert(t('common.error'), message);
      } finally {
        setGeneratingLabelOrderIds((prev) => {
          const next = new Set(prev);
          next.delete(order.id);
          return next;
        });
      }
    },
    [generatingLabelOrderIds, invokeGenerateShippingLabel, userId]
  );

  const submitSenderAddressModal = useCallback(async () => {
    if (!addressModalOrder || !userId || submittingAddressModal) return;

    const street = senderStreetInput.trim();
    const city = senderCityInput.trim();
    const zip = senderZipInput.trim();
    const country = senderCountryInput.trim().toUpperCase();

    if (!street || !city || !zip || !country) {
      Alert.alert(
        t('profile.orders.incompleteAddress'),
        t('profile.orders.incompleteAddressMessage')
      );
      return;
    }

    setSubmittingAddressModal(true);
    try {
      if (saveSenderAddress) {
        const { error: updateErr } = await supabase
          .from('profiles')
          .update({
            street,
            city,
            postal_code: zip,
            country
          })
          .eq('id', userId);
        if (updateErr) {
          throw new Error(updateErr.message);
        }
      }

      await invokeGenerateShippingLabel(
        addressModalOrder,
        { street, city, zip, country },
        addressModalSellerName
      );

      setAddressModalVisible(false);
      setAddressModalOrder(null);
    } catch (e) {
      const message =
        e instanceof Error && e.message
          ? `Could not generate label: ${e.message}`
          : 'Could not generate label.';
      Alert.alert(t('common.error'), message);
    } finally {
      setSubmittingAddressModal(false);
      setGeneratingLabelOrderIds((prev) => {
        if (!addressModalOrder) return prev;
        const next = new Set(prev);
        next.delete(addressModalOrder.id);
        return next;
      });
    }
  }, [
    addressModalOrder,
    addressModalSellerName,
    invokeGenerateShippingLabel,
    saveSenderAddress,
    senderCityInput,
    senderCountryInput,
    senderStreetInput,
    senderZipInput,
    submittingAddressModal,
    userId
  ]);

  const markAsShipped = useCallback(
    async (order: EnrichedOrder) => {
      if (!userId) return;
      if (markingShippedOrderIds.has(order.id)) return;

      setMarkingShippedOrderIds((prev) => new Set(prev).add(order.id));
      try {
        const { error } = await supabase
          .from('orders')
          .update({ status: 'shipped', shipped_at: new Date().toISOString() })
          .eq('id', order.id)
          .eq('seller_id', userId);

        if (error) {
          throw new Error(error.message);
        }

        await loadOrders();

        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const accessToken = sessionData.session?.access_token;
          if (accessToken) {
            void fetch(`${SUPABASE_URL}/functions/v1/insert-order-shipped-chat-message`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ order_id: order.id })
            });
          }
        } catch {
          // silencieux — message chat best-effort
        }

        void sendPushNotificationWithUserJwt({
          user_id: order.buyer_id,
          titleKey: 'profile.orders.parcelShipped',
          bodyKey: 'profile.orders.sellerShipped',
          notification_type: 'new_items',
          data: { order_id: order.id, listing_id: order.listing_id }
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log('Erreur markAsShipped:', e);
        const message =
          e instanceof Error && e.message
            ? `Could not mark order as shipped: ${e.message}`
            : 'Could not mark order as shipped.';
        Alert.alert(t('common.error'), message);
      } finally {
        setMarkingShippedOrderIds((prev) => {
          const next = new Set(prev);
          next.delete(order.id);
          return next;
        });
      }
    },
    [loadOrders, markingShippedOrderIds, userId]
  );

  const leaveReview = useCallback(
    async (order: EnrichedOrder) => {
      const reviewedId = tab === 'purchases' ? order.seller_id : order.buyer_id;
      if (!reviewedId) return;

      const { data: reviewedProfile, error: reviewedErr } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .eq('id', reviewedId)
        .maybeSingle();

      if (reviewedErr) {
        // eslint-disable-next-line no-console
        console.log('Erreur chargement profil à noter:', reviewedErr);
      }

      router.push({
        pathname: '/tabs/profile/leave-review',
        params: {
          order_id: order.id,
          reviewed_id: reviewedId,
          reviewed_name: (reviewedProfile as any)?.display_name ?? 'User',
          reviewed_avatar: (reviewedProfile as any)?.avatar_url ?? ''
        }
      });
    },
    [router, tab]
  );

  const followPackage = useCallback(async (trackingNumber: string) => {
    const trimmed = String(trackingNumber ?? '').trim();
    if (!trimmed) return;
    await Linking.openURL(
      `https://service.post.ch/ekp-web/ui/list?lang=fr#/item/${encodeURIComponent(trimmed)}`
    );
  }, []);

  const renderOrderItem = useCallback(
    ({ item }: { item: EnrichedOrder }) => {
      const statusNorm = String(item.status ?? 'unknown').toLowerCase();
      const isPurchasesTab = tab === 'purchases';
      const showConfirm = canConfirmReception(item);
      const isConfirming = confirmingOrderIds.has(item.id);
      const showCancel = canCancelOrder(item);
      const isCancelling = cancellingOrderIds.has(item.id);
      const showGenerateLabel = canGenerateShippingLabel(item);
      const isGeneratingLabel = generatingLabelOrderIds.has(item.id);
      const isMarkingShipped = markingShippedOrderIds.has(item.id);
      const trackingNumber = String(item.tracking_number ?? '').trim();
      const hasTracking = Boolean(trackingNumber);
      const hasReviewed = reviewedOrderIds.has(item.id);
      const showLeaveReview = statusNorm === 'completed' && !hasReviewed;

      let statusText = String(item.status ?? 'unknown');
      if (isPurchasesTab) {
        if (statusNorm === 'pending') statusText = 'Awaiting shipment';
        if (statusNorm === 'shipped') statusText = 'Package on the way 📦';
        if (statusNorm === 'completed') statusText = 'Order completed ✅';
        if (statusNorm === 'cancelled') statusText = 'Order cancelled';
      } else {
        if (statusNorm === 'shipped') statusText = 'Shipped ✅';
        if (statusNorm === 'completed') statusText = 'Completed ✅ — Payment received';
        if (statusNorm === 'cancelled') statusText = 'Cancelled';
      }

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
                {item.listing?.title ?? 'Listing'}
              </Text>
              <Text variant="body" color="textSecondary" style={styles.orderAmount}>
                {!isPurchasesTab && item.commissionLabel
                  ? t('profile.orders.sellerPayout', { amount: item.displayAmount })
                  : item.displayAmount}
              </Text>
              {!isPurchasesTab && item.commissionLabel ? (
                <Text variant="captionSm" color="textSecondary">
                  {item.commissionLabel}
                </Text>
              ) : null}
              <Text
                variant="captionSm"
                color={statusColor}
                style={styles.orderStatus}
              >
                {statusText}
              </Text>
              {hasTracking ? (
                <Text variant="captionSm" color="textSecondary">
                  Tracking: {trackingNumber}
                </Text>
              ) : null}
            </View>
          </View>

          {((isPurchasesTab &&
            ((statusNorm === 'pending' && showCancel) ||
              statusNorm === 'shipped' ||
              (statusNorm === 'completed' && showLeaveReview))) ||
            (!isPurchasesTab &&
              ((statusNorm === 'pending' &&
                (showCancel || (!hasTracking && showGenerateLabel) || hasTracking)) ||
                (statusNorm === 'shipped' && showGenerateLabel) ||
                (statusNorm === 'completed' && showLeaveReview)))) ? (
            <View style={styles.actionsWrap}>
              {isPurchasesTab && statusNorm === 'shipped' && showConfirm ? (
                <View style={styles.confirmButtonWrap}>
                  <Button
                    title={isConfirming ? 'Confirming…' : 'Confirm receipt'}
                    onPress={() => void confirmReception(item)}
                    disabled={isConfirming}
                    loading={isConfirming}
                    variant="primary"
                  />
                </View>
              ) : null}

              {isPurchasesTab && statusNorm === 'pending' && showCancel ? (
                <View style={styles.cancelButtonWrap}>
                  <Button
                    title={
                      isCancelling
                        ? t('profile.orders.cancelling')
                        : t('profile.orders.cancelOrder')
                    }
                    onPress={() => cancelOrder(item.id)}
                    disabled={isCancelling}
                    loading={isCancelling}
                    variant="secondary"
                  />
                </View>
              ) : null}
              {isPurchasesTab && statusNorm === 'shipped' ? (
                <View style={styles.disputeButtonWrap}>
                  <TouchableOpacity
                    style={styles.disputeButton}
                    activeOpacity={0.85}
                    onPress={() => openDisputeModal(item.id)}
                  >
                    <RNText style={styles.disputeButtonText}>
                      {t('profile.orders.openDispute')}
                    </RNText>
                  </TouchableOpacity>
                </View>
              ) : null}
              {isPurchasesTab && statusNorm === 'shipped' && hasTracking ? (
                <View style={styles.cancelButtonWrap}>
                  <Button
                    title={t('profile.orders.trackParcel')}
                    onPress={() => void followPackage(trackingNumber)}
                    variant="secondary"
                  />
                </View>
              ) : null}
              {isPurchasesTab && statusNorm === 'completed' && showLeaveReview ? (
                <View style={styles.cancelButtonWrap}>
                  <Button
                    title={t('profile.orders.leaveReview')}
                    onPress={() => void leaveReview(item)}
                    variant="secondary"
                  />
                </View>
              ) : null}

              {!isPurchasesTab && showGenerateLabel ? (
                <View style={styles.generateLabelButtonWrap}>
                  <Button
                    title={
                      isGeneratingLabel
                        ? 'Generating...'
                        : 'Generate Swiss Post label'
                    }
                    onPress={() => generateShippingLabel(item)}
                    disabled={isGeneratingLabel}
                    loading={isGeneratingLabel}
                    variant="secondary"
                  />
                </View>
              ) : null}
              {!isPurchasesTab && statusNorm === 'pending' && hasTracking ? (
                <View style={styles.generateLabelButtonWrap}>
                  <Button
                    title={isMarkingShipped ? 'Updating…' : 'Mark as shipped'}
                    onPress={() => markAsShipped(item)}
                    disabled={isMarkingShipped}
                    loading={isMarkingShipped}
                    variant="primary"
                  />
                </View>
              ) : null}
              {!isPurchasesTab && statusNorm === 'pending' && showCancel ? (
                <View style={styles.cancelButtonWrap}>
                  <Button
                    title={isCancelling ? 'Cancelling…' : 'Cancel'}
                    onPress={() => cancelOrder(item.id)}
                    disabled={isCancelling}
                    loading={isCancelling}
                    variant="secondary"
                  />
                </View>
              ) : null}
              {!isPurchasesTab && statusNorm === 'completed' && showLeaveReview ? (
                <View style={styles.cancelButtonWrap}>
                  <Button
                    title={t('profile.orders.leaveReview')}
                    onPress={() => void leaveReview(item)}
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
      canGenerateShippingLabel,
      cancellingOrderIds,
      confirmingOrderIds,
      generatingLabelOrderIds,
      markingShippedOrderIds,
      reviewedOrderIds,
      confirmReception,
      cancelOrder,
      generateShippingLabel,
      leaveReview,
      followPackage,
      markAsShipped,
      openDisputeModal,
      tab,
      t
    ]
  );

  const title = tab === 'purchases' ? t('profile.orders.myPurchases') : t('profile.orders.mySales');

  const handleBack = useCallback(() => {
    if (from_notifications === '1') {
      router.replace({
        pathname: '/tabs/profile/notifications',
        params:
          from_notifications_origin === 'feed' || from_notifications_origin === 'profile'
            ? { from: from_notifications_origin }
            : undefined
      });
      return;
    }
    router.back();
  }, [from_notifications, from_notifications_origin, router]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <HeaderBackButton onPress={handleBack} />
          <Text variant="h2" style={styles.title}>
            {t('profile.orders.title')}
          </Text>
          <View style={styles.headerRightPlaceholder} />
        </View>
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, tab === 'purchases' && styles.tabActive]}
            onPress={() => setTab('purchases')}
            activeOpacity={0.8}
          >
            <RNText style={styles.tabText}>{t('profile.orders.myPurchases')}</RNText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'sales' && styles.tabActive]}
            onPress={() => setTab('sales')}
            activeOpacity={0.8}
          >
            <RNText style={styles.tabText}>{t('profile.orders.mySales')}</RNText>
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
                {t('profile.orders.noOrdersYet', { tab: title })}
              </Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
        />
      )}
      <Modal
        visible={addressModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (submittingAddressModal) return;
          setAddressModalVisible(false);
          setAddressModalOrder(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text variant="h3" style={styles.modalTitle}>
              {t('profile.orders.senderAddressTitle')}
            </Text>
            <Text variant="captionSm" color="textSecondary" style={styles.modalSubtitle}>
              {t('profile.orders.senderAddressSubtitle')}
            </Text>

            <TextInput
              value={senderStreetInput}
              onChangeText={setSenderStreetInput}
              placeholder={t('profile.orders.streetNumber')}
              style={styles.modalInput}
              editable={!submittingAddressModal}
            />
            <TextInput
              value={senderCityInput}
              onChangeText={setSenderCityInput}
              placeholder={t('feed.checkout.city')}
              style={styles.modalInput}
              editable={!submittingAddressModal}
            />
            <TextInput
              value={senderZipInput}
              onChangeText={setSenderZipInput}
              placeholder={t('feed.checkout.postalCode')}
              style={styles.modalInput}
              editable={!submittingAddressModal}
            />
            <TextInput
              value={senderCountryInput}
              onChangeText={setSenderCountryInput}
              placeholder={t('profile.orders.countryExample')}
              autoCapitalize="characters"
              style={styles.modalInput}
              editable={!submittingAddressModal}
            />

            <TouchableOpacity
              style={styles.modalCheckboxRow}
              activeOpacity={0.8}
              onPress={() => setSaveSenderAddress((prev) => !prev)}
              disabled={submittingAddressModal}
            >
              <View style={[styles.checkbox, saveSenderAddress && styles.checkboxChecked]} />
              <Text variant="captionSm" color="textSecondary">
                {t('profile.orders.saveAddress')}
              </Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <Button
                title={t('common.cancel')}
                onPress={() => {
                  setAddressModalVisible(false);
                  setAddressModalOrder(null);
                }}
                variant="secondary"
                disabled={submittingAddressModal}
              />
              <Button
                title={submittingAddressModal ? t('profile.orders.generating') : t('profile.orders.generateLabel')}
                onPress={() => void submitSenderAddressModal()}
                loading={submittingAddressModal}
                disabled={submittingAddressModal}
                variant="primary"
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={disputeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeDisputeModal}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.disputeModalBackdrop}
            activeOpacity={1}
            onPress={closeDisputeModal}
          />
          <View style={styles.modalCard}>
            <Text variant="h3" style={styles.modalTitle}>
              {t('profile.orders.openDispute')}
            </Text>
            <Text variant="body" color="textSecondary" style={styles.disputeModalMessage}>
              {t('profile.orders.disputeMessage')}
            </Text>
            {disputeOrderId ? (
              <Text variant="captionSm" color="textSecondary" style={styles.disputeOrderId}>
                {disputeOrderId}
              </Text>
            ) : null}
            <View style={styles.disputeModalActions}>
              <Button
                title={t('profile.orders.copyOrderId')}
                onPress={() => void copyDisputeOrderId()}
                variant="secondary"
              />
              <Button
                title={t('profile.orders.sendEmail')}
                onPress={() => void sendDisputeEmail()}
                variant="secondary"
              />
              <Button title={t('common.close')} onPress={closeDisputeModal} variant="google" />
            </View>
          </View>
        </View>
      </Modal>
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent'
  },
  tabActive: {
    backgroundColor: '#C3EA4F',
    borderColor: '#C3EA4F'
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
  },
  generateLabelButtonWrap: {
    marginTop: 0
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  modalCard: {
    width: '100%',
    borderRadius: 16,
    padding: 16,
    backgroundColor: theme.colors.googleWhite,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 10
  },
  modalTitle: {
    marginBottom: 2
  },
  modalSubtitle: {
    marginBottom: 8
  },
  modalInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.text
  },
  modalCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2
  },
  checkbox: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 4
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8
  },
  disputeButtonWrap: {
    marginTop: 0
  },
  disputeButton: {
    backgroundColor: '#F0F0F0',
    borderRadius: theme.radius.button,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  disputeButtonText: {
    color: '#000000',
    fontSize: 16,
    fontFamily: theme.fontFamily.semiBold,
    textAlign: 'center'
  },
  disputeModalBackdrop: {
    ...StyleSheet.absoluteFillObject
  },
  disputeModalMessage: {
    lineHeight: 22,
    marginBottom: 8
  },
  disputeOrderId: {
    marginBottom: 12
  },
  disputeModalActions: {
    gap: 10,
    marginTop: 8
  }
});

