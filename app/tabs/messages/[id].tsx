import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  Image
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import { Text } from '../../../components/ui/Text';
import { Button } from '../../../components/ui/Button';
import { AppIcon } from '../../../components/ui/AppIcon';
import { HeaderBackButton } from '../../../components/ui/HeaderBackButton';
import { theme } from '../../../lib/theme';
import { useAuthStore } from '../../../stores/authStore';
import type { ThreadListItem } from '../../../lib/api_queries';
import { SUPABASE_URL } from '../../../lib/env';
import { sendPushNotificationWithUserJwt } from '../../../lib/pushNotifications';

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

export default function ThreadScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const threadId = typeof id === 'string' ? id : '';

  const { user } = useAuthStore();

  const [threadMeta, setThreadMeta] = useState<ThreadListItem | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [latestOrderStatus, setLatestOrderStatus] = useState<string | null>(null);
  const [latestOrderPaymentStatus, setLatestOrderPaymentStatus] = useState<string | null>(null);

  const flatListRef = useRef<FlatList<MessageRow> | null>(null);

  const loadThreadMeta = async () => {
    try {
      const { data, error: qError } = await supabase
        .from('v_thread_list')
        .select('*')
        .eq('thread_id', threadId)
        .maybeSingle();

      if (qError) {
        throw qError;
      }

      setThreadMeta(data as ThreadListItem);
    } catch {
      setThreadMeta(null);
    }
  };

  const loadMessages = async () => {
    try {
      setError(null);
      const { data, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      if (msgError) {
        throw msgError;
      }

      setMessages((data || []) as MessageRow[]);
    } catch {
      setError('Unable to load this conversation.');
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const loadLatestOrder = async (meta: ThreadListItem | null) => {
    if (!meta?.listing_id || !meta?.buyer_id) {
      setLatestOrderStatus(null);
      setLatestOrderPaymentStatus(null);
      return;
    }
    const { data, error: oErr } = await supabase
      .from('orders')
      .select('status, payment_status, created_at')
      .eq('listing_id', meta.listing_id)
      .eq('buyer_id', meta.buyer_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (oErr) {
      setLatestOrderStatus(null);
      setLatestOrderPaymentStatus(null);
      return;
    }
    setLatestOrderStatus((data as any)?.status ?? null);
    setLatestOrderPaymentStatus((data as any)?.payment_status ?? null);
  };

  useEffect(() => {
    if (!threadId) {
      setLoading(false);
      setError('Conversation not found.');
      return;
    }
    void loadThreadMeta();
    void loadMessages();
  }, [threadId]);

  useEffect(() => {
    void loadLatestOrder(threadMeta);
  }, [threadMeta?.listing_id, threadMeta?.buyer_id]);

  useFocusEffect(
    React.useCallback(() => {
      if (!threadId) return;
      void loadThreadMeta();
      void loadMessages();
    }, [threadId])
  );

  // Temps réel pour ce thread
  useEffect(() => {
    if (!threadId) return;

    // const channel = supabase // TODO: réactiver le realtime
    //   .channel(`thread:${threadId}`) // TODO: réactiver le realtime
    //   .on( // TODO: réactiver le realtime
    //     'postgres_changes', // TODO: réactiver le realtime
    //     { // TODO: réactiver le realtime
    //       event: 'INSERT',
    //       schema: 'public',
    //       table: 'messages',
    //       filter: `thread_id=eq.${threadId}`
    //     },
    //     (payload) => { // TODO: réactiver le realtime
    //       const newMsg = payload.new as MessageRow;
    //       setMessages((prev) => [...prev, newMsg].sort((a, b) =>
    //         a.created_at.localeCompare(b.created_at)
    //       ));
    //     } // TODO: réactiver le realtime
    //   ) // TODO: réactiver le realtime
    //   .subscribe(); // TODO: réactiver le realtime

    // return () => { // TODO: réactiver le realtime
    //   void supabase.removeChannel(channel); // TODO: réactiver le realtime
    // }; // TODO: réactiver le realtime
  }, [threadId]);

  // Marquer comme lus les messages de l'autre participant à l'ouverture
  useEffect(() => {
    if (!threadId || !user || messages.length === 0) return;

    void (async () => {
      const now = new Date().toISOString();
      await supabase
        .from('messages')
        .update({ read_at: now })
        .eq('thread_id', threadId)
        .eq('is_system', false)
        .neq('sender_id', user.id)
        .is('read_at', null);
    })();
  }, [threadId, user, messages.length]);

  const otherName = useMemo(() => {
    if (!threadMeta) return 'Conversation';
    return threadMeta.other_participant_name || 'Conversation';
  }, [threadMeta]);

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
    const hasAnyOrder =
      orderStatusNorm === 'pending' ||
      orderStatusNorm === 'completed' ||
      orderStatusNorm === 'cancelled' ||
      orderStatusNorm === 'confirmed' ||
      orderStatusNorm === 'shipped' ||
      orderStatusNorm === 'delivered';
    if (hasAnyOrder) return null;

    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      const isOffer = m.type === 'offer' || (m.body && m.body.startsWith('Offer:'));
      if (!isOffer) continue;
      if (String(m.offer_status ?? '').toLowerCase() !== 'accepted') continue;
      const fromCol = typeof m.offer_amount === 'number' ? m.offer_amount : null;
      const amountMatch = m.body?.match(/Offer:\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
      const amountFromBody = amountMatch ? parseFloat(amountMatch[1]) : null;
      const amt = fromCol ?? amountFromBody;
      if (amt == null || !Number.isFinite(amt)) continue;
      return { messageId: m.id, amount: amt };
    }
    return null;
  }, [
    user?.id,
    threadMeta,
    messages,
    latestOrderStatus,
    listingAllowsCheckout
  ]);

  const handlePayAcceptedOfferFromBar = useCallback(() => {
    if (!threadMeta || !acceptedOfferPayAction) return;
    router.push({
      pathname: '/tabs/feed/listing/checkout' as any,
      params: {
        listing_id: threadMeta.listing_id,
        seller_id: threadMeta.seller_id,
        amount: String(acceptedOfferPayAction.amount),
        title: threadMeta.listing_title,
        offer_message_id: acceptedOfferPayAction.messageId,
        ...(threadMeta.listing_cover_photo_url
          ? { cover_photo: threadMeta.listing_cover_photo_url }
          : {})
      }
    });
  }, [acceptedOfferPayAction, router, threadMeta]);

  const handleSend = async () => {
    const body = input.trim();
    if (!body || !user || !threadId || sending) return;

    setSending(true);
    try {
      const { data, error: insertError } = await supabase
        .from('messages')
        .insert({
          thread_id: threadId,
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
          .eq('id', threadId);

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
                thread_id: threadId,
                sender_id: user.id,
                message_body: clipped
              })
            });
          }
        } catch (e) {
          // silencieux: ne doit pas bloquer l'envoi du message
        }

        setInput('');
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
      return (
        <View style={styles.systemMessageRow}>
          <View style={styles.systemMessagePill}>
            <Text variant="captionSm" style={styles.systemMessageText}>
              {item.body}
            </Text>
          </View>
        </View>
      );
    }

    const isOffer = item.type === 'offer' || item.body.startsWith('Offer:');

    if (isOffer) {
      const amountFromCol = typeof item.offer_amount === 'number' ? item.offer_amount : null;
      const amountMatch = item.body.match(/Offer:\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
      const amountFromBody = amountMatch ? parseFloat(amountMatch[1]) : null;
      const amount = amountFromCol ?? amountFromBody;

      const normalizedStatus = (item.offer_status || '').toString().toLowerCase();
      let status: 'Pending' | 'Accepted' | 'Declined' = 'Pending';
      if (normalizedStatus === 'accepted' || /accepted/i.test(item.body)) status = 'Accepted';
      if (normalizedStatus === 'declined' || /declined|refused/i.test(item.body)) status = 'Declined';

      let statusColor = theme.colors.textSecondary;
      if (status === 'Accepted') statusColor = '#16A34A';
      if (status === 'Declined') statusColor = '#EF4444';

      const originalPrice = listingPrice ?? null;
      const isSeller = !!threadMeta && user?.id === threadMeta.seller_id;
      const canActOnOffer = isSeller && status === 'Pending' && !isMine;
      const isBuyer = !!threadMeta && user?.id === threadMeta.buyer_id;
      const orderStatusNorm = String(latestOrderStatus ?? '').toLowerCase();
      const orderPaymentNorm = String(latestOrderPaymentStatus ?? '').toLowerCase();
      const hasAnyOrder =
        orderStatusNorm === 'pending' ||
        orderStatusNorm === 'completed' ||
        orderStatusNorm === 'cancelled' ||
        orderStatusNorm === 'confirmed' ||
        orderStatusNorm === 'shipped' ||
        orderStatusNorm === 'delivered';
      const canBuyAcceptedOffer =
        isBuyer &&
        status === 'Accepted' &&
        amount != null &&
        !!threadMeta?.listing_id &&
        !!threadMeta?.seller_id &&
        !hasAnyOrder &&
        listingAllowsCheckout;

      const updateOfferStatus = async (next: 'accepted' | 'declined') => {
        if (!threadId || !user) return;
        try {
          const { error: updateError } = await supabase
            .from('messages')
            .update({ offer_status: next })
            .eq('id', item.id);
          if (updateError) throw updateError;

          setMessages((prev) =>
            prev.map((m) => (m.id === item.id ? { ...m, offer_status: next } : m))
          );

          const buyerId = threadMeta?.buyer_id;

          if (next === 'accepted') {
            const { data: insertedRow, error: insertError } = await supabase
              .from('messages')
              .insert({
                thread_id: threadId,
                sender_id: user.id,
                body: "✅ Offre acceptée ! L'acheteur peut maintenant finaliser son achat.",
                type: 'system',
                is_system: true
              })
              .select('*')
              .single();
            if (insertError) throw insertError;
            if (insertedRow) {
              const row = insertedRow as MessageRow;
              setMessages((prev) =>
                [...prev, row].sort((a, b) => a.created_at.localeCompare(b.created_at))
              );
              await supabase
                .from('threads')
                .update({ last_message_at: row.created_at })
                .eq('id', threadId);
            }

            if (buyerId && amount != null) {
              void sendPushNotificationWithUserJwt({
                user_id: buyerId,
                title: "✅ Offre acceptée, let's gooo !",
                body: `Le vendeur a accepté ton offre de ${amount.toFixed(2)} CHF. Finalise ton achat !`,
                data: {
                  thread_id: threadId,
                  listing_id: threadMeta?.listing_id ?? '',
                  offer_amount: amount
                }
              });
            }
          } else {
            const { data: insertedRow, error: insertError } = await supabase
              .from('messages')
              .insert({
                thread_id: threadId,
                sender_id: user.id,
                body: 'Offer declined.',
                type: 'text'
              })
              .select('*')
              .single();
            if (insertError) throw insertError;
            if (insertedRow) {
              const row = insertedRow as MessageRow;
              setMessages((prev) =>
                [...prev, row].sort((a, b) => a.created_at.localeCompare(b.created_at))
              );
              await supabase
                .from('threads')
                .update({ last_message_at: row.created_at })
                .eq('id', threadId);
            }

            if (buyerId) {
              void sendPushNotificationWithUserJwt({
                user_id: buyerId,
                title: '❌ Offre refusée… next !',
                body:
                  "Le vendeur n'a pas accepté ton offre. Tu peux faire une nouvelle offre ou acheter au prix normal.",
                data: {
                  thread_id: threadId,
                  listing_id: threadMeta?.listing_id ?? ''
                }
              });
            }
          }
        } catch {
          // no-op: on garde l'UI existante (errors gérés globalement)
        }
      };

      const handleBuyAcceptedOffer = () => {
        if (!threadMeta || amount == null) return;
        router.push({
          pathname: '/tabs/feed/listing/checkout' as any,
          params: {
            listing_id: threadMeta.listing_id,
            seller_id: threadMeta.seller_id,
            amount: String(amount),
            title: threadMeta.listing_title,
            offer_message_id: item.id,
            ...(threadMeta.listing_cover_photo_url
              ? { cover_photo: threadMeta.listing_cover_photo_url }
              : {})
          }
        });
      };

      return (
        <View style={[styles.messageRow, isMine ? styles.messageRowRight : styles.messageRowLeft]}>
          <View style={styles.offerCard}>
            <View style={styles.offerRow}>
              <Text variant="body" style={styles.offerAmount}>
                {amount != null ? `${amount.toFixed(2)} CHF` : 'Offer'}
              </Text>
              {originalPrice != null && (
                <Text variant="captionSm" style={styles.offerOriginalPrice}>
                  {originalPrice.toFixed(2)} CHF
                </Text>
              )}
            </View>
            <Text
              variant="captionSm"
              style={[styles.offerStatus, { color: statusColor }]}
            >
              {status}
            </Text>
            {status === 'Accepted' && hasAnyOrder && (
              <Text variant="captionSm" color="textSecondary" style={styles.offerOrderNote}>
                {orderStatusNorm === 'cancelled'
                  ? 'Order cancelled'
                  : orderPaymentNorm === 'transferred'
                    ? 'Purchased'
                    : 'Order in progress'}
              </Text>
            )}
            {canActOnOffer && (
              <View style={styles.offerActionsRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.offerActionBtn, styles.offerAcceptBtn]}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  onPress={() => void updateOfferStatus('accepted')}
                >
                  <Text variant="captionSm" style={styles.offerActionText}>
                    Accept
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.offerActionBtn, styles.offerDeclineBtn]}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  onPress={() => void updateOfferStatus('declined')}
                >
                  <Text variant="captionSm" style={styles.offerActionText}>
                    Decline
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            {canBuyAcceptedOffer && (
              <View style={styles.offerBuyWrap}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.offerPayLimeButton}
                  onPress={handleBuyAcceptedOffer}
                  accessibilityRole="button"
                  accessibilityLabel={`Payer ${amount!.toFixed(2)} CHF maintenant`}
                >
                  <Text variant="body" style={styles.offerPayLimeButtonText}>
                    {`💳 Payer ${amount!.toFixed(2)} CHF maintenant`}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
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
            {item.body}
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

  const content = useMemo(() => {
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text variant="captionSm" color="textSecondary" style={styles.loadingText}>
            Chargement de la conversation...
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
            title="Back"
            variant="secondary"
            onPress={() => router.back()}
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
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />
    );
  }, [
    loading,
    error,
    messages,
    threadMeta,
    user?.id,
    listingPrice,
    latestOrderStatus,
    latestOrderPaymentStatus,
    listingAllowsCheckout
  ]);

  const handleBack = () => {
    // @ts-expect-error canGoBack peut exister
    if (router.canGoBack && router.canGoBack()) {
      router.back();
    } else {
      router.replace('/tabs/messages');
    }
  };

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
        <View style={styles.headerRightPlaceholder} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top}
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
              {listingPrice != null && (
                <Text variant="body" style={styles.listingHeaderPrice}>
                  {listingPrice.toFixed(2)} CHF
                </Text>
              )}
              {listingPrice != null && (
                <Text variant="captionSm" style={styles.listingHeaderProtection}>
                  {(listingPrice * (1 + 0.08)).toFixed(0)}CHF includes Buyer Protection 🛡️
                </Text>
              )}
            </View>
          </View>
        )}

        <View style={styles.messagesContainer}>{content}</View>

        {!loading && !error && acceptedOfferPayAction && (
          <View style={styles.payOfferStickyBar}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.offerPayLimeButton}
              onPress={handlePayAcceptedOfferFromBar}
              accessibilityRole="button"
              accessibilityLabel={`Payer ${acceptedOfferPayAction.amount.toFixed(2)} CHF`}
            >
              <Text variant="body" style={styles.offerPayLimeButtonText}>
                {`💳 Payer ${acceptedOfferPayAction.amount.toFixed(2)} CHF`}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View
          style={[
            styles.inputBarContainer,
            { paddingBottom: (insets.bottom || 16) }
          ]}
        >
          <View style={styles.inputBar}>
            <TextInput
              style={styles.textInput}
              placeholder="Write a message here..."
              placeholderTextColor={theme.colors.textSecondary}
              value={input}
              onChangeText={setInput}
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
      </KeyboardAvoidingView>
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
  otherName: {
    fontFamily: theme.fontFamily.semiBold
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
  messagesContent: {
    paddingBottom: 8
  },
  systemMessageRow: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 8
  },
  systemMessagePill: {
    maxWidth: '92%',
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  systemMessageText: {
    color: '#888888',
    fontStyle: 'italic',
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
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  textInput: {
    flex: 1,
    maxHeight: 100,
    paddingVertical: 6,
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
    backgroundColor: '#CCFF00',
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
  listingHeaderProtection: {
    marginTop: 2,
    fontSize: 13,
    color: theme.colors.danger
  },
  offerCard: {
    maxWidth: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5'
  },
  offerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  offerAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary
  },
  offerOriginalPrice: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textDecorationLine: 'line-through'
  },
  offerStatus: {
    fontSize: 13
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
  offerBuyWrap: {
    marginTop: 10
  },
  offerPayLimeButton: {
    backgroundColor: '#CCFF00',
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
    paddingTop: 8,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5E5',
    backgroundColor: theme.colors.backgroundWhite
  }
});

