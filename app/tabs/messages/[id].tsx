import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
  Image
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../../lib/supabase';
import { Text } from '../../../components/ui/Text';
import { Button } from '../../../components/ui/Button';
import { AppIcon } from '../../../components/ui/AppIcon';
import { HeaderBackButton } from '../../../components/ui/HeaderBackButton';
import { theme } from '../../../lib/theme';
import { useAuthStore } from '../../../stores/authStore';
import { markThreadMessagesAsRead, type ThreadListItem } from '../../../lib/api_queries';
import { orderBlocksAcceptedOfferCheckout } from '../../../lib/messagesOfferCheckout';
import { guardedPush } from '../../../lib/navigation/guardedNav';
import { notificationsShortcutHref } from '../../../lib/navigation/feedShortcutNav';
import { SUPABASE_URL } from '../../../lib/env';
import { sendPushNotificationWithUserJwt } from '../../../lib/pushNotifications';
import { refreshUnreadThreadsBadge } from '../../../lib/unreadMessagesBadge';
import { computeBuyerFinalPriceChf, formatCatalogPriceChf, formatChf } from '../../../lib/formatBuyerPrice';
import { BuyerFinalPriceRow } from '../../../components/pricing/BuyerFinalPriceRow';
import { createOrGetThreadForListing } from '../../../lib/api';
import { translateChatSystemMessage, getOrderPlacedSystemMessageKind } from '../../../lib/messagesSystemI18n';
import { isOrderPickupDelivery } from '../../../lib/deliveryMode';
import { getSafeBottomInset } from '../../../lib/safeArea';
import { TransactionEventCard } from '../../../components/messages/TransactionEventCard';
import { MessagesSafetyBanner } from '../../../components/messages/MessagesSafetyBanner';
import {
  buildChatEventCardModel,
  CHAT_EVENT_PREFIX,
  encodeChatEventBody,
  resolveChatEvent,
  swissPostTrackingUrl,
  trimEventName,
  type ChatEventCardAction,
  type ChatEventPayload
} from '../../../lib/chatTransactionEvents';
import { computeChatCardWidth } from '../../../lib/chatCardLayout';

const CHAT_ORDER_EVENT_KINDS = new Set([
  'offer_accepted',
  'order_confirmed',
  'label_preparing',
  'label_ready',
  'order_shipped',
  'buyer_confirm_prompt',
  'payment_released',
  'transaction_complete'
]);

type MessageRow = {
  id: string;
  thread_id: string;
  sender_id: string | null;
  body: string;
  type?: 'text' | 'offer' | 'system' | string | null;
  is_system?: boolean | null;
  offer_amount?: number | null;
  offer_status?: 'pending' | 'accepted' | 'declined' | string | null;
  offer_currency?: string | null;
  listing_id?: string | null;
  read_at: string | null;
  created_at: string;
};

function formatTime(dateString: string): string {
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function parseOfferAmount(
  offerAmount: number | string | null | undefined,
  body?: string | null
): number | null {
  if (typeof offerAmount === 'number' && Number.isFinite(offerAmount)) return offerAmount;
  if (typeof offerAmount === 'string' && offerAmount.trim()) {
    const n = Number(offerAmount);
    if (Number.isFinite(n)) return n;
  }
  const amountMatch = body?.match(/Offer:\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
  if (!amountMatch) return null;
  const n = parseFloat(amountMatch[1]);
  return Number.isFinite(n) ? n : null;
}

export default function ThreadScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: windowHeight } = useWindowDimensions();
  const chatCardWidth = useMemo(() => computeChatCardWidth(screenWidth), [screenWidth]);
  const { id, listing_id, seller_id, from_listing_id, from_order_id, from_notifications, from_inbox, from_notifications_origin } = useLocalSearchParams<{
    id?: string;
    listing_id?: string;
    seller_id?: string;
    from_listing_id?: string;
    from_order_id?: string;
    from_notifications?: string;
    from_inbox?: string;
    from_notifications_origin?: string;
  }>();
  const threadId = typeof id === 'string' ? id : '';
  const isDraftMode = threadId === 'draft';
  const draftListingId = typeof listing_id === 'string' ? listing_id : '';
  const draftSellerId = typeof seller_id === 'string' ? seller_id : '';
  const fromListingId = typeof from_listing_id === 'string' ? from_listing_id : '';
  const fromOrderId = typeof from_order_id === 'string' ? from_order_id : '';
  const [activeThreadId, setActiveThreadId] = useState<string | null>(
    isDraftMode ? null : threadId || null
  );
  const effectiveThreadId = activeThreadId ?? (isDraftMode ? null : threadId || null);

  const { user } = useAuthStore();

  const [threadMeta, setThreadMeta] = useState<ThreadListItem | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deletingThread, setDeletingThread] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkBlockedError, setLinkBlockedError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [latestOrderStatus, setLatestOrderStatus] = useState<string | null>(null);
  const [latestOrderPaymentStatus, setLatestOrderPaymentStatus] = useState<string | null>(null);
  const [latestOrderId, setLatestOrderId] = useState<string | null>(null);
  const [latestOrderDeliveryMode, setLatestOrderDeliveryMode] = useState<string | null>(null);
  const [latestOrderTrackingNumber, setLatestOrderTrackingNumber] = useState<string | null>(null);
  const [latestOrderParcelSize, setLatestOrderParcelSize] = useState<string | null>(null);
  const [expandedOfferIds, setExpandedOfferIds] = useState<Set<string>>(new Set());
  const [confirmingOrder, setConfirmingOrder] = useState(false);
  const [androidKeyboardInset, setAndroidKeyboardInset] = useState(0);
  const [footerDockHeight, setFooterDockHeight] = useState(0);

  const flatListRef = useRef<FlatList<MessageRow> | null>(null);
  const skipFirstFocusReload = useRef(true);
  const shouldScrollToEndRef = useRef(true);
  const messageTimestamps = useRef<number[]>([]);
  const threadMetaRef = useRef<ThreadListItem | null>(null);
  threadMetaRef.current = threadMeta;

  const checkRateLimit = (): boolean => {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    // Garde uniquement les messages des 60 dernières secondes
    messageTimestamps.current = messageTimestamps.current.filter((t) => t > oneMinuteAgo);
    if (messageTimestamps.current.length >= 5) {
      return false; // bloqué
    }
    messageTimestamps.current.push(now);
    return true; // autorisé
  };

  const scrollToLatestMessage = useCallback((animated = true) => {
    shouldScrollToEndRef.current = true;
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated });
    });
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const applyKeyboardInset = (event: { endCoordinates: { height: number; screenY: number } }) => {
      const { height, screenY } = event.endCoordinates;
      const lift = Math.max(height, windowHeight - screenY);
      setAndroidKeyboardInset(Math.max(0, Math.round(lift)));
      scrollToLatestMessage(true);
    };

    const onShow = Keyboard.addListener('keyboardDidShow', applyKeyboardInset);
    const onFrame = Keyboard.addListener('keyboardDidChangeFrame', applyKeyboardInset);
    const onHide = Keyboard.addListener('keyboardDidHide', () => {
      setAndroidKeyboardInset(0);
    });

    return () => {
      onShow.remove();
      onFrame.remove();
      onHide.remove();
    };
  }, [scrollToLatestMessage, windowHeight]);

  const androidKeyboardOpen = Platform.OS === 'android' && androidKeyboardInset > 0;
  const footerBottomOffset = androidKeyboardOpen ? androidKeyboardInset : 0;
  const footerSafePadding = androidKeyboardOpen ? 8 : getSafeBottomInset(insets.bottom) || 16;

  const loadThreadMeta = async (targetThreadId = effectiveThreadId) => {
    if (!targetThreadId) return;
    try {
      const { data, error: qError } = await supabase
        .from('v_thread_list')
        .select('*')
        .eq('thread_id', targetThreadId)
        .maybeSingle();

      if (qError) {
        throw qError;
      }

      const row = data ? ({ ...(data as ThreadListItem) } as ThreadListItem) : null;
      if (row && user?.id) {
        const isBuyer = row.buyer_id === user.id;
        row.other_participant_name = isBuyer
          ? row.seller_display_name
          : row.buyer_display_name;
        row.other_participant_avatar = isBuyer
          ? row.seller_avatar_url
          : row.buyer_avatar_url;
      }
      setThreadMeta(row);
    } catch {
      setThreadMeta(null);
    }
  };

  const loadDraftContext = async () => {
    if (!draftListingId || !draftSellerId || !user) {
      setLoading(false);
      setError(t('messages.notFound'));
      return;
    }

    try {
      setError(null);
      const [listingRes, sellerRes, coverRes] = await Promise.all([
        supabase
          .from('listings')
          .select('id, title, price, status, seller_id')
          .eq('id', draftListingId)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .eq('id', draftSellerId)
          .maybeSingle(),
        supabase
          .from('listing_photos')
          .select('url')
          .eq('listing_id', draftListingId)
          .order('order_index', { ascending: true })
          .limit(1)
          .maybeSingle()
      ]);

      if (listingRes.error) throw listingRes.error;
      if (sellerRes.error) throw sellerRes.error;

      const listing = listingRes.data as {
        id?: string;
        title?: string | null;
        price?: number | null;
        status?: string | null;
        seller_id?: string;
      } | null;
      const seller = sellerRes.data as {
        display_name?: string | null;
        avatar_url?: string | null;
      } | null;

      if (!listing?.id) {
        setError(t('messages.notFound'));
        setThreadMeta(null);
        return;
      }

      setThreadMeta({
        thread_id: '',
        listing_id: draftListingId,
        buyer_id: user.id,
        seller_id: draftSellerId,
        thread_created_at: new Date().toISOString(),
        last_message_at: null,
        listing_title: String(listing.title ?? ''),
        listing_price: typeof listing.price === 'number' ? listing.price : Number(listing.price) || 0,
        listing_status: String(listing.status ?? 'published'),
        listing_cover_photo_url:
          typeof (coverRes.data as { url?: string } | null)?.url === 'string'
            ? String((coverRes.data as { url: string }).url)
            : null,
        last_message_id: null,
        last_message_body: null,
        last_message_sender_id: null,
        last_message_created_at: null,
        last_message_read_at: null,
        last_message_sender_name: null,
        last_message_sender_avatar: null,
        buyer_display_name: null,
        buyer_avatar_url: null,
        seller_display_name: seller?.display_name ?? null,
        seller_avatar_url: seller?.avatar_url ?? null,
        other_participant_name: seller?.display_name ?? null,
        other_participant_avatar: seller?.avatar_url ?? null
      });
      setMessages([]);
    } catch {
      setError(t('messages.loadError'));
      setThreadMeta(null);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (targetThreadId = effectiveThreadId) => {
    if (!targetThreadId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const { data, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .eq('thread_id', targetThreadId)
        .order('created_at', { ascending: true });

      if (msgError) {
        throw msgError;
      }

      setMessages(((data || []) as MessageRow[]).map((row) => ({ ...row })));
      shouldScrollToEndRef.current = true;
    } catch {
      setError(t('messages.loadError'));
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const loadLatestOrder = async (meta: ThreadListItem | null) => {
    if (!meta?.listing_id || !meta?.buyer_id) {
      setLatestOrderStatus(null);
      setLatestOrderPaymentStatus(null);
      setLatestOrderId(null);
      setLatestOrderDeliveryMode(null);
      setLatestOrderTrackingNumber(null);
      setLatestOrderParcelSize(null);
      return;
    }
    const { data, error: oErr } = await supabase
      .from('orders')
      .select('id, status, payment_status, delivery_mode, tracking_number, parcel_size, created_at')
      .eq('listing_id', meta.listing_id)
      .eq('buyer_id', meta.buyer_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (oErr) {
      setLatestOrderStatus(null);
      setLatestOrderPaymentStatus(null);
      setLatestOrderId(null);
      setLatestOrderDeliveryMode(null);
      setLatestOrderTrackingNumber(null);
      setLatestOrderParcelSize(null);
      return;
    }
    setLatestOrderStatus((data as any)?.status ?? null);
    setLatestOrderPaymentStatus((data as any)?.payment_status ?? null);
    setLatestOrderId((data as any)?.id ?? null);
    setLatestOrderDeliveryMode((data as any)?.delivery_mode ?? null);
    setLatestOrderTrackingNumber((data as any)?.tracking_number ?? null);
    setLatestOrderParcelSize((data as any)?.parcel_size ?? null);
  };

  useEffect(() => {
    skipFirstFocusReload.current = true;
    if (isDraftMode) {
      void loadDraftContext();
      return;
    }
    if (!threadId) {
      setLoading(false);
      setError(t('messages.notFound'));
      return;
    }
    void loadThreadMeta(threadId);
    void loadMessages(threadId);
  }, [threadId, isDraftMode, draftListingId, draftSellerId, user?.id]);

  useEffect(() => {
    void loadLatestOrder(threadMeta);
  }, [threadMeta?.listing_id, threadMeta?.buyer_id]);

  useFocusEffect(
    React.useCallback(() => {
      if (skipFirstFocusReload.current) {
        skipFirstFocusReload.current = false;
        return;
      }
      if (isDraftMode) {
        if (!activeThreadId) return;
        void loadThreadMeta(activeThreadId);
        void loadMessages(activeThreadId);
        void loadLatestOrder(threadMetaRef.current);
        return;
      }
      if (!threadId) return;
      void loadThreadMeta(threadId);
      void loadMessages(threadId);
      void loadLatestOrder(threadMetaRef.current);
    }, [threadId, isDraftMode, activeThreadId])
  );

  // Temps réel : nouveaux messages + mises à jour (ex. offer_status acceptée)
  useEffect(() => {
    if (!effectiveThreadId || !user?.id) return;

    const channel = supabase
      .channel(`thread:${effectiveThreadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${effectiveThreadId}`
        },
        (payload) => {
          const newMsg = payload.new as MessageRow;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            shouldScrollToEndRef.current = true;
            return [...prev, newMsg].sort((a, b) => a.created_at.localeCompare(b.created_at));
          });
          if (newMsg.type === 'system' || newMsg.is_system) {
            void loadMessages(effectiveThreadId);
            const meta = threadMetaRef.current;
            if (meta?.listing_id && meta?.buyer_id) {
              void loadLatestOrder(meta);
            }
          }
          if (newMsg.sender_id && newMsg.sender_id !== user.id) {
            void markThreadMessagesAsRead(effectiveThreadId, user.id).then(() => {
              void refreshUnreadThreadsBadge(user.id);
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${effectiveThreadId}`
        },
        (payload) => {
          const updated = payload.new as MessageRow;
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
          );
          if (String(updated.offer_status ?? '').toLowerCase() === 'accepted') {
            const meta = threadMetaRef.current;
            if (meta?.listing_id && meta?.buyer_id) {
              void loadLatestOrder(meta);
            }
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [effectiveThreadId, user?.id]);

  // Marquer comme lus les messages reçus dès l'ouverture du thread
  useEffect(() => {
    if (!effectiveThreadId || !user?.id) return;

    void (async () => {
      const { ok } = await markThreadMessagesAsRead(effectiveThreadId, user.id);
      if (ok) {
        void refreshUnreadThreadsBadge(user.id);
      }
    })();
  }, [effectiveThreadId, user?.id]);

  // Mise à jour de la commande liée (ex. après paiement acheteur)
  useEffect(() => {
    const meta = threadMeta;
    if (!meta?.listing_id || !meta?.buyer_id) return;

    const channel = supabase
      .channel(`thread-order:${meta.listing_id}:${meta.buyer_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `listing_id=eq.${meta.listing_id}`
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as { buyer_id?: string } | null;
          if (row?.buyer_id !== meta.buyer_id) return;
          void loadLatestOrder(meta);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [threadMeta?.listing_id, threadMeta?.buyer_id]);

  const isSellerInThread = Boolean(threadMeta && user?.id && threadMeta.seller_id === user.id);
  const isBuyerInThread = Boolean(threadMeta && user?.id && threadMeta.buyer_id === user.id);

  const orderBlocksCheckout = orderBlocksAcceptedOfferCheckout(
    latestOrderStatus,
    latestOrderPaymentStatus
  );
  const orderPaymentTransferred =
    String(latestOrderPaymentStatus ?? '').toLowerCase() === 'transferred';

  const goToSellerOrder = useCallback(() => {
    guardedPush(router, {
      pathname: '/tabs/profile/orders',
      params: { tab: 'sales' }
    });
  }, [router]);

  const goToBuyerOrders = useCallback(() => {
    guardedPush(router, {
      pathname: '/tabs/profile/orders',
      params: { tab: 'purchases' }
    });
  }, [router]);

  const goToOrderDetail = useCallback(
    (orderId?: string | null) => {
      const targetId = orderId ?? latestOrderId;
      if (!targetId) {
        if (isSellerInThread) goToSellerOrder();
        else goToBuyerOrders();
        return;
      }
      guardedPush(router, {
        pathname: '/tabs/profile/order/[id]',
        params: { id: targetId }
      });
    },
    [goToBuyerOrders, goToSellerOrder, isSellerInThread, latestOrderId, router]
  );

  const goToWallet = useCallback(() => {
    guardedPush(router, { pathname: '/tabs/profile/wallet' });
  }, [router]);

  const sellerOrderNeedsShipmentAction = useMemo(() => {
    if (!isSellerInThread || !latestOrderId) return false;
    const statusNorm = String(latestOrderStatus ?? '').toLowerCase();
    if (statusNorm === 'cancelled' || statusNorm === 'completed') return false;
    if (isOrderPickupDelivery(latestOrderDeliveryMode)) {
      return statusNorm === 'pending';
    }
    const hasTracking = Boolean(String(latestOrderTrackingNumber ?? '').trim());
    return statusNorm === 'pending' || (statusNorm === 'shipped' && !hasTracking);
  }, [
    isSellerInThread,
    latestOrderDeliveryMode,
    latestOrderId,
    latestOrderStatus,
    latestOrderTrackingNumber
  ]);

  const isLatestOrderLetterAplus =
    String(latestOrderParcelSize ?? '').toLowerCase() === 'letter_aplus';

  const sellerShipBannerCopy = useMemo(() => {
    if (isOrderPickupDelivery(latestOrderDeliveryMode)) {
      return {
        subtitle: t('messages.sellerShipBannerPickup'),
        cta: t('messages.viewMyOrder'),
        a11y: t('messages.viewMyOrderA11y')
      };
    }
    if (isLatestOrderLetterAplus) {
      return {
        subtitle: t('messages.sellerShipBannerLetterAplus'),
        cta: t('messages.generateShippingLabel'),
        a11y: t('messages.generateLabelA11y')
      };
    }
    return {
      subtitle: t('messages.sellerShipBannerShipping'),
      cta: t('messages.generateShippingLabel'),
      a11y: t('messages.generateLabelA11y')
    };
  }, [isLatestOrderLetterAplus, latestOrderDeliveryMode, t]);

  const handlePayOffer = useCallback(
    (offerMessageId: string, amount: number) => {
      if (!threadMeta || !effectiveThreadId) return;
      guardedPush(router, {
        pathname: '/tabs/messages/listing/checkout' as any,
        params: {
          listing_id: threadMeta.listing_id,
          seller_id: threadMeta.seller_id,
          amount: String(amount),
          title: threadMeta.listing_title,
          offer_message_id: offerMessageId,
          from_messages_thread: effectiveThreadId,
          ...(threadMeta.listing_cover_photo_url
            ? { cover_photo: threadMeta.listing_cover_photo_url }
            : {})
        }
      });
    },
    [effectiveThreadId, router, threadMeta]
  );

  const confirmOrderFromChat = useCallback(
    async (orderId?: string | null) => {
      const targetOrderId = String(orderId ?? latestOrderId ?? '').trim();
      if (confirmingOrder) return;
      if (!targetOrderId) {
        Alert.alert(t('common.error'), t('profile.orders.unableConfirm'));
        return;
      }
      setConfirmingOrder(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) throw new Error(t('common.error'));

        const resp = await fetch(`${SUPABASE_URL}/functions/v1/confirm-order`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ order_id: targetOrderId })
        });
        const json = (await resp.json()) as { error?: string; details?: string };
        if (!resp.ok) {
          throw new Error(json.details ?? json.error ?? t('common.error'));
        }
        if (threadMeta) await loadLatestOrder(threadMeta);
        if (effectiveThreadId) await loadMessages(effectiveThreadId);
      } catch (e) {
        Alert.alert(
          t('common.error'),
          e instanceof Error ? e.message : t('common.error')
        );
      } finally {
        setConfirmingOrder(false);
      }
    },
    [confirmingOrder, effectiveThreadId, latestOrderId, t, threadMeta]
  );

  const reportProblemFromChat = useCallback(
    (orderId?: string | null) => {
      const resolvedOrderId = String(orderId ?? latestOrderId ?? '').trim();
      const subject = encodeURIComponent(t('profile.orders.disputeEmailSubject'));
      const body = encodeURIComponent(
        t('profile.orders.disputeEmailBody', { orderId: resolvedOrderId })
      );
      void Linking.openURL(`mailto:contact@bloomi.ch?subject=${subject}&body=${body}`);
    },
    [latestOrderId, t]
  );

  const findOfferAmountForEvent = useCallback(
    (event: ChatEventPayload, messageIndex: number): number | null => {
      if (event.offer_amount != null && Number.isFinite(event.offer_amount)) {
        return event.offer_amount;
      }
      if (event.offer_message_id) {
        const linked = messages.find((m) => m.id === event.offer_message_id);
        if (linked) return parseOfferAmount(linked.offer_amount, linked.body);
      }
      for (let i = messageIndex; i >= 0; i -= 1) {
        const m = messages[i];
        const isOffer = m.type === 'offer' || m.body?.startsWith('Offer:');
        if (!isOffer) continue;
        if (String(m.offer_status ?? '').toLowerCase() !== 'accepted') continue;
        return parseOfferAmount(m.offer_amount, m.body);
      }
      return null;
    },
    [messages]
  );

  const otherName = useMemo(() => {
    if (!threadMeta) return t('messages.conversation');
    return threadMeta.other_participant_name || t('messages.conversation');
  }, [threadMeta, t]);

  const listingTitle = useMemo(() => {
    if (!threadMeta) return '';
    return threadMeta.listinf_title ?? threadMeta.listing_title ?? '';
  }, [threadMeta]);

  const listingPrice = useMemo(() => {
    if (!threadMeta) return null;
    const price = (threadMeta as any).listing_price as number | null;
    return typeof price === 'number' ? price : null;
  }, [threadMeta]);

  const listingImage = useMemo(() => {
    if (!threadMeta) return null;
    return (threadMeta as any).listing_cover_photo_url as string | null;
  }, [threadMeta]);

  const listingAllowsCheckout = useMemo(() => {
    const listingSt = String((threadMeta as any)?.listing_status ?? '').toLowerCase();
    return !listingSt || listingSt === 'published';
  }, [threadMeta]);

  const acceptedOfferPayAction = useMemo(() => {
    if (!user?.id || !threadMeta || threadMeta.buyer_id !== user.id) return null;
    if (!listingAllowsCheckout) return null;
    if (!threadMeta.listing_id || !threadMeta.seller_id) return null;

    const orderStatusNorm = String(latestOrderStatus ?? '').toLowerCase();
    if (orderBlocksAcceptedOfferCheckout(latestOrderStatus, latestOrderPaymentStatus)) return null;

    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      const isOffer = m.type === 'offer' || (m.body && m.body.startsWith('Offer:'));
      if (!isOffer) continue;
      if (String(m.sender_id ?? '') !== user.id) continue;
      if (String(m.offer_status ?? '').toLowerCase() !== 'accepted') continue;
      const amt = parseOfferAmount(m.offer_amount, m.body);
      if (amt == null) continue;
      return { messageId: m.id, amount: amt };
    }
    return null;
  }, [
    user?.id,
    threadMeta,
    messages,
    latestOrderStatus,
    latestOrderPaymentStatus,
    listingAllowsCheckout
  ]);

  const handlePayAcceptedOfferFromBar = useCallback(() => {
    if (!threadMeta || !acceptedOfferPayAction || !effectiveThreadId) return;
    guardedPush(router, {
      pathname: '/tabs/messages/listing/checkout' as any,
      params: {
        listing_id: threadMeta.listing_id,
        seller_id: threadMeta.seller_id,
        amount: String(acceptedOfferPayAction.amount),
        title: threadMeta.listing_title,
        offer_message_id: acceptedOfferPayAction.messageId,
        from_messages_thread: effectiveThreadId,
        ...(threadMeta.listing_cover_photo_url
          ? { cover_photo: threadMeta.listing_cover_photo_url }
          : {})
      }
    });
  }, [acceptedOfferPayAction, effectiveThreadId, router, threadMeta]);

  const handleEventAction = useCallback(
    (action: ChatEventCardAction['action'], event: ChatEventPayload, offerAmount?: number | null) => {
      switch (action) {
        case 'pay_offer':
          if (event.offer_message_id && offerAmount != null) {
            handlePayOffer(event.offer_message_id, offerAmount);
          } else if (acceptedOfferPayAction) {
            handlePayAcceptedOfferFromBar();
          }
          break;
        case 'view_order':
          goToOrderDetail(event.order_id);
          break;
        case 'view_wallet':
          goToWallet();
          break;
        case 'generate_label':
        case 'download_label':
          if (isSellerInThread) goToSellerOrder();
          else goToOrderDetail(event.order_id);
          break;
        case 'track_parcel':
          if (event.tracking_number) {
            void Linking.openURL(swissPostTrackingUrl(event.tracking_number));
          } else if (latestOrderTrackingNumber) {
            void Linking.openURL(swissPostTrackingUrl(latestOrderTrackingNumber));
          } else {
            goToOrderDetail(event.order_id);
          }
          break;
        case 'confirm_reception':
          void confirmOrderFromChat(event.order_id ?? latestOrderId);
          break;
        case 'report_problem':
          reportProblemFromChat(event.order_id ?? latestOrderId);
          break;
        default:
          break;
      }
    },
    [
      acceptedOfferPayAction,
      confirmOrderFromChat,
      goToOrderDetail,
      goToSellerOrder,
      goToWallet,
      handlePayAcceptedOfferFromBar,
      handlePayOffer,
      isSellerInThread,
      latestOrderId,
      latestOrderTrackingNumber,
      reportProblemFromChat
    ]
  );

  const handleSend = async () => {
    const body = input.trim();
    if (!body || !user || sending) return;

    if (/(https?:\/\/|www\.)[^\s]+/i.test(body)) {
      setLinkBlockedError('Les liens externes ne sont pas autorisés sur Bloomi.');
      return;
    }
    if (!checkRateLimit()) {
      setLinkBlockedError('Vous envoyez trop de messages. Veuillez patienter une minute.');
      return;
    }
    setLinkBlockedError(null);

    setSending(true);
    try {
      let targetThreadId = effectiveThreadId;
      if (!targetThreadId) {
        if (!isDraftMode || !draftListingId || !draftSellerId) return;
        const { data: thread, error: threadError } = await createOrGetThreadForListing(
          draftListingId,
          draftSellerId
        );
        if (threadError || !thread?.id) {
          // eslint-disable-next-line no-console
          console.warn('Erreur création thread:', threadError);
          return;
        }
        targetThreadId = thread.id;
        setActiveThreadId(thread.id);
        await loadThreadMeta(thread.id);
      }

      const { data, error: insertError } = await supabase
        .from('messages')
        .insert({
          thread_id: targetThreadId,
          sender_id: user.id,
          body
        })
        .select('*')
        .single();

      if (insertError) {
        // eslint-disable-next-line no-console
        console.warn('Erreur envoi message:', insertError);
      } else if (data) {
        setMessages((prev) =>
          [...prev, data as MessageRow].sort((a, b) =>
            a.created_at.localeCompare(b.created_at)
          )
        );

        // Mettre à jour last_message_at sur le thread
        await supabase
          .from('threads')
          .update({ last_message_at: (data as MessageRow).created_at })
          .eq('id', targetThreadId);

        // Best-effort: notifier l'autre participant via Edge Function
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const accessToken = sessionData.session?.access_token;
          if (accessToken) {
            const clipped = body.trim().slice(0, 100);
            await fetch(`${SUPABASE_URL}/functions/v1/notify-new-message`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                thread_id: targetThreadId,
                sender_id: user.id,
                message_body: clipped
              })
            });
          }
        } catch (e) {
          // silencieux: ne doit pas bloquer l'envoi du message
        }

        setInput('');
        shouldScrollToEndRef.current = true;
        // Scroll vers le bas
        flatListRef.current?.scrollToEnd({ animated: true });
      }
    } finally {
      setSending(false);
    }
  };

  const renderItem = ({ item, index }: { item: MessageRow; index: number }) => {
    const isMine = item.sender_id != null && item.sender_id === user?.id;

    const isSystem = item.is_system === true || item.type === 'system';
    if (isSystem) {
      const event = resolveChatEvent(item.body, { isSeller: isSellerInThread });
      if (event) {
        if (
          event.kind === 'buyer_confirm_prompt' &&
          (orderPaymentTransferred ||
            String(latestOrderStatus ?? '').toLowerCase() === 'completed' ||
            String(latestOrderStatus ?? '').toLowerCase() === 'cancelled')
        ) {
          return null;
        }

        const offerAmount =
          event.kind === 'offer_accepted' ? findOfferAmountForEvent(event, index) : null;
        const otherName = String(threadMeta?.other_participant_name ?? '').trim();
        const enrichedEvent: ChatEventPayload = {
          ...event,
          order_id: event.order_id ?? latestOrderId ?? undefined,
          seller_name:
            trimEventName(event.seller_name) ||
            trimEventName(threadMeta?.seller_display_name ?? undefined) ||
            (isBuyerInThread ? otherName : undefined),
          buyer_name:
            trimEventName(event.buyer_name) ||
            trimEventName(threadMeta?.buyer_display_name ?? undefined) ||
            (isSellerInThread ? otherName : undefined),
          offer_amount: event.offer_amount ?? offerAmount ?? undefined,
          tracking_number:
            event.tracking_number ??
            (event.kind === 'order_shipped' ? latestOrderTrackingNumber ?? undefined : undefined)
        };

        const model = buildChatEventCardModel({
          event: enrichedEvent,
          isSeller: isSellerInThread,
          isBuyer: isBuyerInThread,
          offerPayAmount: offerAmount,
          hasBlockingOrder: orderBlocksCheckout,
          orderPaymentTransferred,
          isLetterAplus: isLatestOrderLetterAplus
        });

        if (model) {
          return (
            <View style={styles.systemMessageRow}>
              <TransactionEventCard
                width={chatCardWidth}
                listingTitle={
                  CHAT_ORDER_EVENT_KINDS.has(event.kind) ? listingTitle || null : null
                }
                listingImage={
                  CHAT_ORDER_EVENT_KINDS.has(event.kind) ? listingImage : null
                }
                listingPriceLabel={
                  CHAT_ORDER_EVENT_KINDS.has(event.kind) && listingPrice != null
                    ? formatChf(listingPrice)
                    : null
                }
                model={model}
                primaryLoading={event.kind === 'buyer_confirm_prompt' && confirmingOrder}
                onPrimaryPress={
                  model.primaryAction
                    ? () =>
                        handleEventAction(
                          model.primaryAction!.action,
                          enrichedEvent,
                          offerAmount
                        )
                    : undefined
                }
                onSecondaryPress={
                  model.secondaryAction
                    ? () =>
                        handleEventAction(
                          model.secondaryAction!.action,
                          enrichedEvent,
                          offerAmount
                        )
                    : undefined
                }
              />
            </View>
          );
        }

        // Événement connu mais sans carte pour ce rôle / état → ne jamais afficher le payload brut
        return null;
      }

      // Payload événement non parsé (JSON cassé, etc.) → masquer
      if (String(item.body ?? '').trim().startsWith(CHAT_EVENT_PREFIX)) {
        return null;
      }

      const orderPlacedKind = getOrderPlacedSystemMessageKind(item.body);
      const showSellerOrderCta =
        isSellerInThread &&
        orderPlacedKind != null &&
        sellerOrderNeedsShipmentAction;
      const sellerPickupOrder = orderPlacedKind === 'pickup';
      const sellerLetterAplusCta = !sellerPickupOrder && isLatestOrderLetterAplus;

      return (
        <View style={styles.systemMessageRow}>
          <View
            style={[
              styles.systemMessagePill,
              showSellerOrderCta && styles.systemMessagePillSeller
            ]}
          >
            <Text
              variant="captionSm"
              style={[
                styles.systemMessageText,
                showSellerOrderCta && styles.systemMessageTextSeller
              ]}
            >
              {sellerLetterAplusCta
                ? t('messages.sellerShipBannerLetterAplus')
                : translateChatSystemMessage(item.body, t, {
                    isSeller: isSellerInThread
                  })}
            </Text>
            {showSellerOrderCta ? (
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.systemMessageCta}
                onPress={goToSellerOrder}
                accessibilityRole="button"
                accessibilityLabel={
                  sellerPickupOrder
                    ? t('messages.viewMyOrderA11y')
                    : t('messages.generateLabelA11y')
                }
              >
                <Text variant="captionSm" style={styles.systemMessageCtaText}>
                  {sellerPickupOrder
                    ? t('messages.viewMyOrder')
                    : t('messages.generateShippingLabel')}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      );
    }

    const isOffer = item.type === 'offer' || item.body.startsWith('Offer:');

    if (isOffer) {
      const amount = parseOfferAmount(item.offer_amount, item.body);

      const normalizedStatus = (item.offer_status || '').toString().toLowerCase();
      let status: 'Pending' | 'Accepted' | 'Declined' = 'Pending';
      if (normalizedStatus === 'accepted' || /accepted/i.test(item.body)) status = 'Accepted';
      if (normalizedStatus === 'declined' || /declined|refused/i.test(item.body)) status = 'Declined';

      const originalPrice = listingPrice ?? null;
      const isSeller = !!threadMeta && user?.id === threadMeta.seller_id;
      const canActOnOffer = isSeller && status === 'Pending' && !isMine;
      const isBuyer = !!threadMeta && user?.id === threadMeta.buyer_id;
      const orderStatusNorm = String(latestOrderStatus ?? '').toLowerCase();
      const orderPaymentNorm = String(latestOrderPaymentStatus ?? '').toLowerCase();
      const hasBlockingOrder = orderBlocksAcceptedOfferCheckout(
        latestOrderStatus,
        latestOrderPaymentStatus
      );
      const isActiveAcceptedOffer =
        status === 'Accepted' &&
        isBuyer &&
        acceptedOfferPayAction?.messageId === item.id;

      const updateOfferStatus = async (next: 'accepted' | 'declined') => {
        if (!effectiveThreadId || !user) return;

        const { error: updateError } = await supabase
          .from('messages')
          .update({ offer_status: next })
          .eq('id', item.id);

        if (updateError) {
          console.error('[messages] offer status update failed', updateError);
          Alert.alert(t('common.error'), t('messages.offerUpdateError'));
          return;
        }

        setMessages((prev) =>
          prev.map((m) => (m.id === item.id ? { ...m, offer_status: next } : m))
        );

        const buyerId = threadMeta?.buyer_id;
        const eventBody =
          next === 'accepted'
            ? encodeChatEventBody({
                kind: 'offer_accepted',
                offer_amount: amount ?? undefined,
                offer_message_id: item.id,
                seller_name: threadMeta?.seller_display_name
                  ? String(threadMeta.seller_display_name)
                  : undefined,
                buyer_name: threadMeta?.buyer_display_name
                  ? String(threadMeta.buyer_display_name)
                  : undefined
              })
            : encodeChatEventBody({ kind: 'offer_declined' });

        const { data: insertedRow, error: insertError } = await supabase
          .from('messages')
          .insert({
            thread_id: effectiveThreadId,
            sender_id: user.id,
            body: eventBody,
            type: 'system',
            is_system: true
          })
          .select('*')
          .single();

        if (insertError) {
          console.warn('[messages] offer system event insert failed', insertError);
        } else if (insertedRow) {
          const row = insertedRow as MessageRow;
          setMessages((prev) =>
            [...prev, row].sort((a, b) => a.created_at.localeCompare(b.created_at))
          );
          const { error: threadUpdateError } = await supabase
            .from('threads')
            .update({ last_message_at: row.created_at })
            .eq('id', effectiveThreadId);
          if (threadUpdateError) {
            console.warn('[messages] thread last_message_at update failed', threadUpdateError);
          }
        }

        if (next === 'accepted' && buyerId && amount != null) {
          void sendPushNotificationWithUserJwt({
            user_id: buyerId,
            titleKey: 'messages.offerAcceptedTitle',
            bodyKey: 'messages.offerAcceptedBody',
            bodyParams: { amount: amount.toFixed(2) },
            notification_type: 'new_message',
            data: {
              thread_id: effectiveThreadId,
              listing_id: threadMeta?.listing_id ?? '',
              offer_amount: amount
            }
          });
        } else if (next === 'declined' && buyerId) {
          void sendPushNotificationWithUserJwt({
            user_id: buyerId,
            titleKey: 'messages.offerDeclinedTitle',
            bodyKey: 'messages.offerDeclinedBody',
            notification_type: 'new_message',
            data: {
              thread_id: effectiveThreadId,
              listing_id: threadMeta?.listing_id ?? ''
            }
          });
        }
      };

      const statusLabel =
        status === 'Pending'
          ? t('messages.pending')
          : status === 'Accepted'
            ? t('messages.accepted')
            : t('messages.declined');

      const offerCardStyle = [
        styles.offerCard,
        { width: chatCardWidth },
        status === 'Accepted' && styles.offerCardAccepted,
        status === 'Declined' && styles.offerCardDeclined,
        status === 'Pending' && styles.offerCardPending
      ];

      const statusBadgeStyle = [
        styles.offerStatusBadge,
        status === 'Accepted' && styles.offerStatusBadgeAccepted,
        status === 'Declined' && styles.offerStatusBadgeDeclined,
        status === 'Pending' && styles.offerStatusBadgePending
      ];

      const isExpanded = expandedOfferIds.has(item.id);
      const buyerName =
        String(threadMeta?.buyer_display_name ?? '').trim() || t('messages.conversation');
      const showSellerPendingLayout = canActOnOffer && status === 'Pending';
      const toggleOfferExpanded = () => {
        setExpandedOfferIds((prev) => {
          const next = new Set(prev);
          if (next.has(item.id)) next.delete(item.id);
          else next.add(item.id);
          return next;
        });
      };

      return (
        <View style={[styles.messageRow, isMine ? styles.messageRowRight : styles.messageRowLeft]}>
          <View style={offerCardStyle}>
            <View style={styles.offerCardHeader}>
              <Text variant="captionSm" style={styles.offerCardLabel}>
                {showSellerPendingLayout
                  ? t('messages.offerReceivedFrom', { name: buyerName })
                  : t('messages.offerCardLabel')}
              </Text>
              <View style={statusBadgeStyle}>
                {status === 'Accepted' && (
                  <AppIcon name="checkCircleBold" size={12} color="#15803D" />
                )}
                <Text
                  variant="captionSm"
                  style={[
                    styles.offerStatusBadgeText,
                    status === 'Accepted' && styles.offerStatusBadgeTextAccepted,
                    status === 'Declined' && styles.offerStatusBadgeTextDeclined,
                    status === 'Pending' && styles.offerStatusBadgeTextPending
                  ]}
                >
                  {status === 'Accepted' && isSeller && !hasBlockingOrder
                    ? t('messages.awaitingPayment')
                    : statusLabel}
                </Text>
              </View>
            </View>

            {listingTitle ? (
              <View style={styles.offerListingMini}>
                {listingImage ? (
                  <Image source={{ uri: listingImage }} style={styles.offerListingMiniImage} />
                ) : (
                  <View style={[styles.offerListingMiniImage, styles.offerListingMiniPlaceholder]} />
                )}
                <View style={styles.offerListingMiniInfo}>
                  <Text variant="captionSm" color="textSecondary" style={styles.offerListingKicker}>
                    {t('messages.events.listingKicker')}
                  </Text>
                  <Text variant="caption" style={styles.offerListingMiniTitle} numberOfLines={2}>
                    {listingTitle}
                  </Text>
                  {listingPrice != null ? (
                    <Text variant="captionSm" color="textSecondary">
                      {formatChf(listingPrice)}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}
            {status === 'Accepted' && amount != null ? (
              <View style={styles.offerAcceptedPriceBlock}>
                <Text variant="captionSm" color="textSecondary">
                  {t('messages.offerAcceptedAgreedPrice')}
                </Text>
                <Text variant="body" style={styles.offerAmount}>
                  {formatChf(amount)}
                </Text>
                <Text variant="captionSm" color="textSecondary" style={styles.offerPayTotalLabel}>
                  {t('messages.offerAcceptedPayTotal')}
                </Text>
                <Text variant="body" style={styles.offerPayTotalValue}>
                  {formatCatalogPriceChf(computeBuyerFinalPriceChf(amount))}
                </Text>
                <Text variant="captionSm" color="textSecondary" style={styles.offerFinalPriceFootnote}>
                  {t('messages.offerAcceptedFinalPriceFootnote')}
                </Text>
                {originalPrice != null && originalPrice !== amount ? (
                  <Text variant="captionSm" style={styles.offerListingPriceStruck}>
                    {formatChf(originalPrice)}
                  </Text>
                ) : null}
              </View>
            ) : (
              <View style={styles.offerRow}>
                <Text variant="body" style={styles.offerAmount}>
                  {amount != null ? formatChf(amount) : t('messages.offer')}
                </Text>
                {originalPrice != null && amount != null && originalPrice !== amount && (
                  <Text variant="captionSm" style={styles.offerOriginalPrice}>
                    {formatChf(originalPrice)}
                  </Text>
                )}
              </View>
            )}
            {status === 'Accepted' && hasBlockingOrder && (
              <Text variant="captionSm" color="textSecondary" style={styles.offerOrderNote}>
                {orderStatusNorm === 'cancelled'
                  ? t('messages.orderCancelled')
                  : orderPaymentNorm === 'transferred'
                    ? t('messages.purchased')
                    : t('messages.orderInProgress')}
              </Text>
            )}
            {isActiveAcceptedOffer && (
              <Text variant="captionSm" style={styles.offerAcceptedHint}>
                {t('messages.offerAcceptedBuyerHint')}
              </Text>
            )}
            {status === 'Accepted' && isSeller && !hasBlockingOrder && (
              <Text variant="captionSm" style={styles.offerAcceptedHintSeller}>
                {t('messages.events.awaitingPaymentBody')}
              </Text>
            )}
            {showSellerPendingLayout && !isExpanded ? (
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.offerViewBtn}
                onPress={toggleOfferExpanded}
              >
                <Text variant="captionSm" style={styles.offerViewBtnText}>
                  {t('messages.viewOffer')}
                </Text>
              </TouchableOpacity>
            ) : null}
            {canActOnOffer && (isExpanded || !showSellerPendingLayout) ? (
              <View style={styles.offerActionsRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.offerActionBtn, styles.offerAcceptBtn]}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  onPress={() => void updateOfferStatus('accepted')}
                >
                  <Text variant="captionSm" style={styles.offerActionText}>
                    {t('messages.accept')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.offerActionBtn, styles.offerDeclineBtn]}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  onPress={() => void updateOfferStatus('declined')}
                >
                  <Text variant="captionSm" style={styles.offerActionText}>
                    {t('messages.decline')}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>
      );
    }

    // Événement mal tagué (pas is_system) → ne jamais afficher le payload brut en bulle
    if (String(item.body ?? '').trim().startsWith(CHAT_EVENT_PREFIX)) {
      const event = resolveChatEvent(item.body, { isSeller: isSellerInThread });
      if (!event) return null;
      const offerAmount =
        event.kind === 'offer_accepted' ? findOfferAmountForEvent(event, index) : null;
      const otherName = String(threadMeta?.other_participant_name ?? '').trim();
      const enrichedEvent: ChatEventPayload = {
        ...event,
        order_id: event.order_id ?? latestOrderId ?? undefined,
        seller_name:
          trimEventName(event.seller_name) ||
          trimEventName(threadMeta?.seller_display_name ?? undefined) ||
          (isBuyerInThread ? otherName : undefined),
        buyer_name:
          trimEventName(event.buyer_name) ||
          trimEventName(threadMeta?.buyer_display_name ?? undefined) ||
          (isSellerInThread ? otherName : undefined),
        offer_amount: event.offer_amount ?? offerAmount ?? undefined
      };
      const model = buildChatEventCardModel({
        event: enrichedEvent,
        isSeller: isSellerInThread,
        isBuyer: isBuyerInThread,
        offerPayAmount: offerAmount,
        hasBlockingOrder: orderBlocksCheckout,
        orderPaymentTransferred,
        isLetterAplus: isLatestOrderLetterAplus
      });
      if (!model) return null;
      return (
        <View style={styles.systemMessageRow}>
          <TransactionEventCard
            width={chatCardWidth}
            listingTitle={CHAT_ORDER_EVENT_KINDS.has(event.kind) ? listingTitle || null : null}
            listingImage={CHAT_ORDER_EVENT_KINDS.has(event.kind) ? listingImage : null}
            listingPriceLabel={
              CHAT_ORDER_EVENT_KINDS.has(event.kind) && listingPrice != null
                ? formatChf(listingPrice)
                : null
            }
            model={model}
            primaryLoading={event.kind === 'buyer_confirm_prompt' && confirmingOrder}
            onPrimaryPress={
              model.primaryAction
                ? () => handleEventAction(model.primaryAction!.action, enrichedEvent, offerAmount)
                : undefined
            }
            onSecondaryPress={
              model.secondaryAction
                ? () =>
                    handleEventAction(model.secondaryAction!.action, enrichedEvent, offerAmount)
                : undefined
            }
          />
        </View>
      );
    }

    // Bulle standard
    return (
      <View style={[styles.messageRow, isMine ? styles.messageRowRight : styles.messageRowLeft]}>
        <View
          style={[
            styles.messageBubble,
            isMine ? styles.messageBubbleMine : styles.messageBubbleOther
          ]}
        >
          <Text
            variant="body"
            color={isMine ? 'appleBlack' : 'textPrimary'}
            style={styles.messageText}
          >
            {translateChatSystemMessage(item.body, t)}
          </Text>
          <Text
            variant="captionSm"
            color={isMine ? 'appleBlack' : 'textSecondary'}
            style={styles.messageTime}
          >
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  const goBackToContext = useCallback(() => {
    if (from_notifications === '1') {
      const origin =
        from_notifications_origin === 'feed' || from_notifications_origin === 'profile'
          ? from_notifications_origin
          : undefined;
      router.replace({
        pathname: notificationsShortcutHref(origin) as any,
        params: origin ? { from: origin } : undefined
      });
      return;
    }
    if (from_inbox === '1') {
      // Pop natif (animation retour) après un push inbox → thread ; replace seulement en fallback.
      if (router.canGoBack?.()) {
        router.back();
        return;
      }
      router.replace('/tabs/messages');
      return;
    }
    if (fromOrderId) {
      router.replace({
        pathname: '/tabs/profile/order/[id]',
        params: { id: fromOrderId }
      });
      return;
    }
    if (fromListingId) {
      // Retour contextuel sans POP_TO_TOP (dismissAll provoque un warning selon le navigator actif).
      router.replace({
        pathname: `/tabs/feed/${fromListingId}` as any,
        params: { from_offer_chat: '1' }
      });
      return;
    }
    if (router.canGoBack && router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/tabs/messages');
  }, [fromListingId, fromOrderId, from_inbox, from_notifications, from_notifications_origin, router]);

  const content = useMemo(() => {
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text variant="captionSm" color="textSecondary" style={styles.loadingText}>
            {t('messages.loadingConversation')}
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.center}>
          <Text variant="body" style={styles.errorText}>
            {error}
          </Text>
          <Button
            title={t('common.back')}
            variant="secondary"
            onPress={goBackToContext}
            style={styles.errorButton}
          />
        </View>
      );
    }

    return (
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        extraData={{
          expandedOfferIds,
          confirmingOrder,
          latestOrderId,
          latestOrderStatus,
          latestOrderPaymentStatus,
          latestOrderTrackingNumber,
          latestOrderParcelSize,
          isBuyerInThread,
          isSellerInThread,
          orderPaymentTransferred,
          acceptedOfferPayAction,
          chatCardWidth,
          listingTitle,
          listingImage,
          listingPrice
        }}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        onContentSizeChange={() => {
          if (!shouldScrollToEndRef.current) return;
          flatListRef.current?.scrollToEnd({ animated: false });
          shouldScrollToEndRef.current = false;
        }}
      />
    );
  }, [
    loading,
    error,
    messages,
    threadMeta,
    user?.id,
    listingPrice,
    latestOrderId,
    latestOrderStatus,
    latestOrderPaymentStatus,
    latestOrderTrackingNumber,
    latestOrderParcelSize,
    listingAllowsCheckout,
    acceptedOfferPayAction,
    expandedOfferIds,
    confirmingOrder,
    chatCardWidth,
    listingTitle,
    listingImage,
    isBuyerInThread,
    isSellerInThread,
    orderPaymentTransferred,
    handleEventAction,
    goBackToContext,
    t
  ]);

  const handleBack = () => {
    goBackToContext();
  };

  const handleDeleteConversation = useCallback(() => {
    if (!effectiveThreadId || !user?.id || deletingThread) return;
    Alert.alert(
      t('messages.deleteConversationTitle'),
      t('messages.deleteConversationConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setDeletingThread(true);
              try {
                const { data: sessionData } = await supabase.auth.getSession();
                const accessToken = sessionData.session?.access_token;
                if (!accessToken) {
                  Alert.alert(t('common.error'), t('messages.deleteConversationError'));
                  return;
                }

                const resp = await fetch(`${SUPABASE_URL}/functions/v1/delete-thread`, {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ thread_id: effectiveThreadId })
                });

                if (!resp.ok) {
                  Alert.alert(t('common.error'), t('messages.deleteConversationError'));
                  return;
                }

                await refreshUnreadThreadsBadge(user.id);
                goBackToContext();
              } catch {
                Alert.alert(t('common.error'), t('messages.deleteConversationError'));
              } finally {
                setDeletingThread(false);
              }
            })();
          }
        }
      ]
    );
  }, [deletingThread, effectiveThreadId, goBackToContext, t, user?.id]);

  const ChatBodyWrapper = Platform.OS === 'ios' ? KeyboardAvoidingView : View;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <HeaderBackButton onPress={handleBack} />
        <View style={styles.headerCenter}>
          <Text variant="body" style={styles.otherName} numberOfLines={1}>
            {otherName}
          </Text>
          {!!listingTitle && (
            <Text variant="captionSm" color="textSecondary" numberOfLines={1}>
              {listingTitle}
            </Text>
          )}
        </View>
        {!isDraftMode || effectiveThreadId ? (
          <TouchableOpacity
            onPress={handleDeleteConversation}
            activeOpacity={0.7}
            disabled={deletingThread}
            style={styles.headerDeleteButton}
          >
            <AppIcon name="trashBinTrashOutline" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerDeleteButton} />
        )}
      </View>

      <MessagesSafetyBanner />

      <ChatBodyWrapper
        style={[styles.flex, Platform.OS === 'android' && styles.chatBodyAndroid]}
        {...(Platform.OS === 'ios'
          ? { behavior: 'padding' as const, keyboardVerticalOffset: insets.top }
          : {})}
      >
        {/* Carte article sticky */}
        {threadMeta && (
          <View style={styles.listingHeader}>
            {listingImage ? (
              <Image source={{ uri: listingImage }} style={styles.listingHeaderImage} />
            ) : (
              <View style={[styles.listingHeaderImage, styles.listingHeaderImagePlaceholder]}>
                <Text variant="body" color="textSecondary">
                  ?
                </Text>
              </View>
            )}
            <View style={styles.listingHeaderInfo}>
              <Text
                variant="body"
                style={styles.listingHeaderTitle}
                numberOfLines={2}
              >
                {listingTitle}
              </Text>
              {(acceptedOfferPayAction?.amount ?? listingPrice) != null &&
              (acceptedOfferPayAction?.amount ?? listingPrice)! > 0 ? (
                <BuyerFinalPriceRow
                  itemPriceChf={acceptedOfferPayAction?.amount ?? listingPrice!}
                  textStyle={styles.listingHeaderPrice}
                />
              ) : null}
            </View>
          </View>
        )}

        <View
          style={[
            styles.messagesContainer,
            Platform.OS === 'android' && footerDockHeight > 0
              ? { paddingBottom: footerDockHeight + 8 }
              : null
          ]}
        >
          {content}
        </View>

        {Platform.OS === 'android' ? (
          <View
            style={[styles.footerDock, { bottom: footerBottomOffset }]}
            onLayout={(event) => {
              const nextHeight = Math.round(event.nativeEvent.layout.height);
              if (nextHeight > 0 && nextHeight !== footerDockHeight) {
                setFooterDockHeight(nextHeight);
              }
            }}
          >
            {!loading && !error && acceptedOfferPayAction ? (
              <View style={styles.payOfferStickyBar}>
                <View style={styles.payOfferBanner}>
                  <View style={styles.payOfferBannerIcon}>
                    <AppIcon name="checkCircleBold" size={22} color="#15803D" />
                  </View>
                  <View style={styles.payOfferBannerText}>
                    <Text variant="body" style={styles.payOfferBannerTitle}>
                      {t('messages.acceptedOfferBannerTitle')}
                    </Text>
                    <Text variant="captionSm" color="textSecondary">
                      {t('messages.acceptedOfferBannerSubtitle', {
                        amount: acceptedOfferPayAction.amount.toFixed(2)
                      })}
                    </Text>
                    <Text variant="body" style={styles.payOfferBannerPrice}>
                      {formatCatalogPriceChf(
                        computeBuyerFinalPriceChf(acceptedOfferPayAction.amount)
                      )}
                    </Text>
                    <Text variant="captionSm" color="textSecondary" style={styles.offerFinalPriceFootnote}>
                      {t('messages.offerAcceptedFinalPriceFootnote')}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.offerPayLimeButton}
                  onPress={handlePayAcceptedOfferFromBar}
                  accessibilityRole="button"
                  accessibilityLabel={t('messages.payNowA11y', {
                    amount: String(computeBuyerFinalPriceChf(acceptedOfferPayAction.amount))
                  })}
                >
                  <Text variant="body" style={styles.offerPayLimeButtonText}>
                    {t('messages.payNow', {
                      amount: String(computeBuyerFinalPriceChf(acceptedOfferPayAction.amount))
                    })}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {!loading && !error && sellerOrderNeedsShipmentAction && !acceptedOfferPayAction ? (
              <View style={styles.sellerShipStickyBar}>
                <View style={styles.sellerShipBanner}>
                  <Text variant="body" style={styles.sellerShipBannerTitle}>
                    {t('messages.sellerShipBannerTitle')}
                  </Text>
                  <Text variant="captionSm" style={styles.sellerShipBannerSubtitle}>
                    {sellerShipBannerCopy.subtitle}
                  </Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.offerPayLimeButton}
                  onPress={goToSellerOrder}
                  accessibilityRole="button"
                  accessibilityLabel={sellerShipBannerCopy.a11y}
                >
                  <Text variant="body" style={styles.offerPayLimeButtonText}>
                    {sellerShipBannerCopy.cta}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={{ paddingBottom: footerSafePadding }}>
              <View style={styles.inputBarContainer}>
                <View style={styles.inputBar}>
                  <TextInput
                    style={styles.textInput}
                    placeholder={t('messages.placeholder')}
                    placeholderTextColor={theme.colors.textSecondary}
                    value={input}
                    onChangeText={(text) => {
                      setInput(text);
                      if (linkBlockedError) setLinkBlockedError(null);
                    }}
                    onFocus={() => scrollToLatestMessage(true)}
                    multiline
                  />
                  <TouchableOpacity
                    onPress={() => {}}
                    activeOpacity={0.7}
                    style={styles.iconButton}
                  >
                    <AppIcon
                      name="paperclipOutline"
                      size={18}
                      color={theme.colors.textSecondary}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {}}
                    activeOpacity={0.7}
                    style={styles.iconButton}
                  >
                    <AppIcon
                      name="stickerSmileCircle2Outline"
                      size={18}
                      color={theme.colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  onPress={handleSend}
                  activeOpacity={0.8}
                  disabled={!input.trim() || sending}
                  style={[
                    styles.sendCircle,
                    (!input.trim() || sending) && styles.sendCircleDisabled
                  ]}
                >
                  <AppIcon
                    name={(!input.trim() || sending) ? 'conversationPlainOutline' : 'conversationPlainBold'}
                    size={20}
                    color={(!input.trim() || sending) ? theme.colors.textSecondary : theme.colors.googleWhite}
                  />
                </TouchableOpacity>
              </View>
              {linkBlockedError ? (
                <Text variant="captionSm" style={styles.linkBlockedError}>
                  {linkBlockedError}
                </Text>
              ) : null}
            </View>
          </View>
        ) : (
          <>
            {!loading && !error && acceptedOfferPayAction && (
              <View style={styles.payOfferStickyBar}>
                <View style={styles.payOfferBanner}>
                  <View style={styles.payOfferBannerIcon}>
                    <AppIcon name="checkCircleBold" size={22} color="#15803D" />
                  </View>
                  <View style={styles.payOfferBannerText}>
                    <Text variant="body" style={styles.payOfferBannerTitle}>
                      {t('messages.acceptedOfferBannerTitle')}
                    </Text>
                    <Text variant="captionSm" color="textSecondary">
                      {t('messages.acceptedOfferBannerSubtitle', {
                        amount: acceptedOfferPayAction.amount.toFixed(2)
                      })}
                    </Text>
                    <Text variant="body" style={styles.payOfferBannerPrice}>
                      {formatCatalogPriceChf(
                        computeBuyerFinalPriceChf(acceptedOfferPayAction.amount)
                      )}
                    </Text>
                    <Text variant="captionSm" color="textSecondary" style={styles.offerFinalPriceFootnote}>
                      {t('messages.offerAcceptedFinalPriceFootnote')}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.offerPayLimeButton}
                  onPress={handlePayAcceptedOfferFromBar}
                  accessibilityRole="button"
                  accessibilityLabel={t('messages.payNowA11y', {
                    amount: String(computeBuyerFinalPriceChf(acceptedOfferPayAction.amount))
                  })}
                >
                  <Text variant="body" style={styles.offerPayLimeButtonText}>
                    {t('messages.payNow', {
                      amount: String(computeBuyerFinalPriceChf(acceptedOfferPayAction.amount))
                    })}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {!loading && !error && sellerOrderNeedsShipmentAction && !acceptedOfferPayAction && (
              <View style={styles.sellerShipStickyBar}>
                <View style={styles.sellerShipBanner}>
                  <Text variant="body" style={styles.sellerShipBannerTitle}>
                    {t('messages.sellerShipBannerTitle')}
                  </Text>
                  <Text variant="captionSm" style={styles.sellerShipBannerSubtitle}>
                    {sellerShipBannerCopy.subtitle}
                  </Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.offerPayLimeButton}
                  onPress={goToSellerOrder}
                  accessibilityRole="button"
                  accessibilityLabel={sellerShipBannerCopy.a11y}
                >
                  <Text variant="body" style={styles.offerPayLimeButtonText}>
                    {sellerShipBannerCopy.cta}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={{ paddingBottom: footerSafePadding }}>
              <View style={styles.inputBarContainer}>
                <View style={styles.inputBar}>
                  <TextInput
                    style={styles.textInput}
                    placeholder={t('messages.placeholder')}
                    placeholderTextColor={theme.colors.textSecondary}
                    value={input}
                    onChangeText={(text) => {
                      setInput(text);
                      if (linkBlockedError) setLinkBlockedError(null);
                    }}
                    onFocus={() => scrollToLatestMessage(true)}
                    multiline
                  />
                  <TouchableOpacity
                    onPress={() => {}}
                    activeOpacity={0.7}
                    style={styles.iconButton}
                  >
                    <AppIcon
                      name="paperclipOutline"
                      size={18}
                      color={theme.colors.textSecondary}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {}}
                    activeOpacity={0.7}
                    style={styles.iconButton}
                  >
                    <AppIcon
                      name="stickerSmileCircle2Outline"
                      size={18}
                      color={theme.colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  onPress={handleSend}
                  activeOpacity={0.8}
                  disabled={!input.trim() || sending}
                  style={[
                    styles.sendCircle,
                    (!input.trim() || sending) && styles.sendCircleDisabled
                  ]}
                >
                  <AppIcon
                    name={(!input.trim() || sending) ? 'conversationPlainOutline' : 'conversationPlainBold'}
                    size={20}
                    color={(!input.trim() || sending) ? theme.colors.textSecondary : theme.colors.googleWhite}
                  />
                </TouchableOpacity>
              </View>
              {linkBlockedError ? (
                <Text variant="captionSm" style={styles.linkBlockedError}>
                  {linkBlockedError}
                </Text>
              ) : null}
            </View>
          </>
        )}
      </ChatBodyWrapper>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgroundWhite
  },
  flex: {
    flex: 1
  },
  chatBodyAndroid: {
    position: 'relative'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5'
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 12
  },
  headerRightPlaceholder: {
    width: 24
  },
  headerDeleteButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center'
  },
  otherName: {
    ...theme.typography.body,
    fontFamily: theme.fontFamily.semiBold,
    color: theme.colors.textPrimary
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32
  },
  loadingText: {
    marginTop: 8
  },
  errorText: {
    textAlign: 'center',
    marginBottom: 8
  },
  errorButton: {
    marginTop: 8
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8
  },
  footerDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: theme.colors.backgroundWhite,
    zIndex: 2,
    elevation: 8
  },
  messagesContent: {
    paddingBottom: 8
  },
  systemMessageRow: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 6
  },
  systemMessagePill: {
    maxWidth: '92%',
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  systemMessagePillSeller: {
    backgroundColor: '#F4FBE8',
    borderWidth: 1,
    borderColor: '#D4E89A'
  },
  systemMessageText: {
    color: '#888888',
    fontStyle: 'italic',
    textAlign: 'center'
  },
  systemMessageTextSeller: {
    color: '#3F6212',
    fontStyle: 'normal'
  },
  systemMessageCta: {
    marginTop: 10,
    alignSelf: 'stretch',
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center'
  },
  systemMessageCtaText: {
    color: theme.colors.appleBlack,
    fontWeight: '600',
    textAlign: 'center'
  },
  messageRow: {
    marginVertical: 4,
    flexDirection: 'row'
  },
  messageRowLeft: {
    justifyContent: 'flex-start'
  },
  messageRowRight: {
    justifyContent: 'flex-end'
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  messageBubbleMine: {
    backgroundColor: '#C3EA4F',
    borderBottomRightRadius: 4
  },
  messageBubbleOther: {
    backgroundColor: '#F3F4F6',
    borderBottomLeftRadius: 4
  },
  messageText: {
    marginBottom: 2
  },
  messageTime: {
    textAlign: 'right'
  },
  inputBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F5F5F5',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  textInput: {
    flex: 1,
    maxHeight: 100,
    minHeight: 36,
    paddingVertical: 6,
    textAlignVertical: 'center',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
    ...theme.typography.body,
    color: theme.colors.textPrimary
  },
  inputBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5E5',
    backgroundColor: theme.colors.backgroundWhite
  },
  linkBlockedError: {
    paddingHorizontal: 16,
    paddingTop: 6,
    color: '#DC2626'
  },
  iconButton: {
    marginLeft: 8
  },
  iconText: {
    fontSize: 18
  },
  sendCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#C3EA4F',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8
  },
  sendCircleDisabled: {
    backgroundColor: '#E5E5E5'
  },
  sendCircleIcon: {
    fontSize: 18
  },
  listingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
    backgroundColor: theme.colors.backgroundWhite
  },
  listingHeaderImage: {
    width: 64,
    height: 64,
    borderRadius: 8
  },
  listingHeaderImagePlaceholder: {
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center'
  },
  listingHeaderInfo: {
    flex: 1,
    marginLeft: 12
  },
  listingHeaderTitle: {
    fontSize: 16,
    marginBottom: 4
  },
  listingHeaderPrice: {
    ...theme.typography.body,
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary
  },
  offerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    ...theme.shadows.card
  },
  offerCardPending: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB'
  },
  offerCardAccepted: {
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4'
  },
  offerCardDeclined: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2'
  },
  offerCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  offerCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    flex: 1,
    paddingRight: 8
  },
  offerListingMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border
  },
  offerListingMiniImage: {
    width: 44,
    height: 44,
    borderRadius: 8
  },
  offerListingMiniPlaceholder: {
    backgroundColor: theme.colors.border
  },
  offerListingMiniInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2
  },
  offerListingKicker: {
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    fontSize: 10,
    lineHeight: 12
  },
  offerListingMiniTitle: {
    fontWeight: '600',
    lineHeight: 18
  },
  offerViewBtn: {
    marginTop: 4,
    marginBottom: 8,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: theme.colors.primary
  },
  offerViewBtnText: {
    fontWeight: '600',
    color: theme.colors.appleBlack
  },
  offerStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999
  },
  offerStatusBadgePending: {
    backgroundColor: '#FEF3C7'
  },
  offerStatusBadgeAccepted: {
    backgroundColor: '#DCFCE7'
  },
  offerStatusBadgeDeclined: {
    backgroundColor: '#FEE2E2'
  },
  offerStatusBadgeText: {
    fontSize: 12,
    fontWeight: '600'
  },
  offerStatusBadgeTextPending: {
    color: '#B45309'
  },
  offerStatusBadgeTextAccepted: {
    color: '#15803D'
  },
  offerStatusBadgeTextDeclined: {
    color: '#B91C1C'
  },
  offerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  offerAcceptedPriceBlock: {
    marginBottom: 4
  },
  offerAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary
  },
  offerPayTotalLabel: {
    marginTop: 8
  },
  offerPayTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginTop: 2
  },
  offerFinalPriceFootnote: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16
  },
  offerListingPriceStruck: {
    marginTop: 4,
    fontSize: 13,
    color: theme.colors.textSecondary,
    textDecorationLine: 'line-through'
  },
  offerOriginalPrice: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textDecorationLine: 'line-through'
  },
  offerStatus: {
    fontSize: 13
  },
  offerAcceptedHint: {
    marginTop: 10,
    fontSize: 13,
    color: '#15803D',
    lineHeight: 18
  },
  offerAcceptedHintSeller: {
    marginTop: 10,
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18
  },
  offerOrderNote: {
    marginTop: 4,
    fontSize: 13
  },
  offerActionsRow: {
    flexDirection: 'row',
    columnGap: 8,
    marginTop: 10
  },
  offerActionBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1
  },
  offerAcceptBtn: {
    backgroundColor: '#C3EA4F',
    borderColor: '#C3EA4F'
  },
  offerDeclineBtn: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E5E5'
  },
  offerActionText: {
    color: theme.colors.textPrimary,
    fontWeight: '600'
  },
  offerPayLimeButton: {
    backgroundColor: '#C3EA4F',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  offerPayLimeButtonText: {
    ...theme.typography.body,
    fontWeight: '700',
    color: theme.colors.appleBlack,
    textAlign: 'center'
  },
  payOfferStickyBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5E5',
    backgroundColor: '#F0FDF4'
  },
  payOfferBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  payOfferBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  payOfferBannerText: {
    flex: 1
  },
  payOfferBannerTitle: {
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 2
  },
  payOfferBannerPrice: {
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 2
  },
  sellerShipStickyBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5E5',
    backgroundColor: '#F4FBE8'
  },
  sellerShipBanner: {
    marginBottom: 12
  },
  sellerShipBannerTitle: {
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 4
  },
  sellerShipBannerSubtitle: {
    color: theme.colors.textSecondary
  }
});

