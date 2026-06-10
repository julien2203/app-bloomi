import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../stores/authStore';
import { useNotificationsBadgeStore } from '../../../stores/notificationsBadgeStore';
import { theme } from '../../../lib/theme';
import { HeaderBackButton } from '../../../components/ui/HeaderBackButton';
import { Text } from '../../../components/ui/Text';
import { Button } from '../../../components/ui/Button';
import { AppIcon } from '../../../components/ui/AppIcon';

type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  data: any | null;
  created_at: string;
  read_at: string | null;
};

function formatRelative(dateString: string, t: (key: string, opts?: any) => string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) return date.toLocaleDateString();
  const s = Math.floor(diffMs / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  const w = Math.floor(d / 7);
  const mo = Math.floor(d / 30);
  const y = Math.floor(d / 365);
  if (m < 1) return t('feed.listingDetail.justNow');
  if (h < 1) return t('feed.listingDetail.minutesAgo', { count: m });
  if (d < 1) return t('feed.listingDetail.hoursAgo', { count: h });
  if (w < 1) return t('feed.listingDetail.daysAgo', { count: d });
  if (mo < 1) return t('feed.listingDetail.weeksAgo', { count: w });
  if (y < 1) return t('feed.listingDetail.monthsAgo', { count: mo });
  return t('feed.listingDetail.yearsAgo', { count: y });
}

function pickIconName(data: any): import('../../../lib/assets').IconName {
  const threadId = typeof data?.thread_id === 'string' ? data.thread_id : null;
  const listingId = typeof data?.listing_id === 'string' ? data.listing_id : null;
  const orderId = typeof data?.order_id === 'string' ? data.order_id : null;

  if (threadId) return 'conversationPlainOutline';
  if (orderId) return 'billListOutline';
  if (listingId) return 'bookmarkOutline';
  return 'notificationsBellOutline';
}

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const notificationsOrigin = from === 'feed' || from === 'profile' ? from : undefined;
  const { user } = useAuthStore();
  const userId = user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const markingReadIdsRef = useRef<Set<string>>(new Set());
  const skipFirstFocusReload = useRef(true);
  /** Dernière liste connue (évite closures périmées dans markAllAsRead). */
  const rowsRef = useRef<NotificationRow[]>([]);

  const unreadCount = useMemo(() => rows.filter((r) => !r.read_at).length, [rows]);
  rowsRef.current = rows;

  const loadNotifications = useCallback(async (_opts?: { fromUserRefresh?: boolean }) => {
    markingReadIdsRef.current.clear();
    if (!userId) {
      setRows([]);
      useNotificationsBadgeStore.getState().setUnreadCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, user_id, title, body, data, created_at, read_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const list = (data || []) as NotificationRow[];
      setRows(list);
      useNotificationsBadgeStore
        .getState()
        .setUnreadCount(list.filter((r) => !r.read_at).length);
    } catch {
      setRows([]);
      useNotificationsBadgeStore.getState().setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setRows([]);
      useNotificationsBadgeStore.getState().setUnreadCount(0);
      setLoading(false);
      return;
    }
    void loadNotifications();
  }, [loadNotifications, userId]);

  useFocusEffect(
    useCallback(() => {
      if (skipFirstFocusReload.current) {
        skipFirstFocusReload.current = false;
        return;
      }
      if (!userId) {
        setRows([]);
        useNotificationsBadgeStore.getState().setUnreadCount(0);
        setLoading(false);
        return;
      }
      void loadNotifications();
    }, [userId, loadNotifications])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadNotifications({ fromUserRefresh: true });
    } finally {
      setRefreshing(false);
    }
  }, [loadNotifications]);

  const navigateFromData = useCallback(
    (data: any) => {
      const threadId = typeof data?.thread_id === 'string' ? data.thread_id : null;
      const listingId = typeof data?.listing_id === 'string' ? data.listing_id : null;
      const orderId = typeof data?.order_id === 'string' ? data.order_id : null;

      if (threadId) {
        router.replace({
          pathname: '/tabs/messages/[id]',
          params: {
            id: threadId,
            from_notifications: '1',
            ...(notificationsOrigin
              ? { from_notifications_origin: notificationsOrigin }
              : {})
          }
        });
        return;
      }
      if (listingId) {
        router.replace({
          pathname: '/tabs/feed/[id]',
          params: {
            id: listingId,
            from_notifications: '1',
            ...(notificationsOrigin
              ? { from_notifications_origin: notificationsOrigin }
              : {})
          }
        });
        return;
      }
      if (orderId) {
        router.replace({
          pathname: '/tabs/profile/orders',
          params: {
            from_notifications: '1',
            ...(notificationsOrigin
              ? { from_notifications_origin: notificationsOrigin }
              : {})
          }
        } as any);
      }
    },
    [notificationsOrigin, router]
  );

  const markAsReadAndNavigate = useCallback(
    (n: NotificationRow) => {
      const nowIso = new Date().toISOString();
      if (userId && !n.read_at && !markingReadIdsRef.current.has(n.id)) {
        markingReadIdsRef.current.add(n.id);
        useNotificationsBadgeStore.getState().decrementUnread(1);
        setRows((prev) =>
          prev.map((r) => (r.id === n.id ? { ...r, read_at: nowIso } : r))
        );
        void (async () => {
          try {
            const { error } = await supabase
              .from('notifications')
              .update({ read_at: nowIso })
              .eq('id', n.id)
              .eq('user_id', userId);
            if (error) throw error;
          } catch {
            setRows((prev) =>
              prev.map((r) => (r.id === n.id ? { ...r, read_at: null } : r))
            );
            useNotificationsBadgeStore.getState().incrementUnread(1);
          } finally {
            markingReadIdsRef.current.delete(n.id);
          }
        })();
      }

      queueMicrotask(() => {
        navigateFromData(n.data);
      });
    },
    [navigateFromData, userId]
  );

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    if (markingAll) return;

    const unreadIds = rowsRef.current.filter((r) => !r.read_at).map((r) => r.id);
    if (unreadIds.length === 0) return;

    setMarkingAll(true);
    try {
      const nowIso = new Date().toISOString();
      // Mise à jour bulk fiable: toutes les notifications non lues du user courant.
      const { data: updatedRows, error: updateErr } = await supabase
        .from('notifications')
        .update({ read_at: nowIso })
        .eq('user_id', userId)
        .is('read_at', null)
        .select('id');
      if (updateErr) throw updateErr;
      const updatedCount = (updatedRows ?? []).length;
      if (updatedCount === 0 && unreadIds.length > 0) {
        throw new Error('No rows updated. Supabase RLS/policy may block UPDATE on notifications.');
      }

      const { count, error: cErr } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('read_at', null);
      if (cErr) throw cErr;
      const remaining = count ?? 0;
      useNotificationsBadgeStore.getState().setUnreadCount(remaining);

      if (remaining > 0) await loadNotifications();
      await loadNotifications();
    } catch (err: any) {
      const details = typeof err?.message === 'string' ? err.message : 'Unknown database error';
      Alert.alert(
        t('profile.notificationsScreen.unableMarkRead'),
        t('profile.notificationsScreen.markReadPartial', { details })
      );
      await loadNotifications();
    } finally {
      setMarkingAll(false);
    }
  }, [loadNotifications, markingAll, userId]);

  const renderItem = useCallback(
    ({ item }: { item: NotificationRow }) => {
      const isUnread = !item.read_at;
      const icon = pickIconName(item.data);
      return (
        <Pressable
          onPress={() => markAsReadAndNavigate(item)}
          style={[styles.row, isUnread && styles.rowUnread]}
        >
          <View style={styles.rowLeft}>
            <View style={styles.iconWrap}>
              <AppIcon name={icon} size={18} color={theme.colors.textPrimary} />
            </View>
            <View style={styles.textCol}>
              <Text variant="body" style={styles.title} numberOfLines={1}>
                {item.title}
              </Text>
              <Text variant="captionSm" color="textSecondary" style={styles.body} numberOfLines={2}>
                {item.body}
              </Text>
            </View>
          </View>
          <Text variant="captionSm" color="textSecondary" style={styles.time}>
            {formatRelative(item.created_at, t)}
          </Text>
        </Pressable>
      );
    },
    [markAsReadAndNavigate]
  );

  const handleBack = useCallback(() => {
    if (from === 'feed') {
      router.replace('/tabs/feed');
      return;
    }
    if (from === 'profile') {
      router.replace('/tabs/profile');
      return;
    }
    router.back();
  }, [from, router]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <HeaderBackButton onPress={handleBack} />
        <Text variant="body" style={styles.headerTitle}>
          {t('profile.notifications')}
        </Text>
        <View style={styles.headerRight}>
          <Button
            title={t('profile.notificationsScreen.markAllRead')}
            onPress={() => void markAllAsRead()}
            variant="link"
            disabled={markingAll || unreadCount === 0}
          />
        </View>
      </View>
      <View style={styles.headerSeparator} />

      {loading ? (
        <View style={styles.skeletonWrap}>
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <View key={k} style={styles.skeletonRow}>
              <View style={styles.skeletonIcon} />
              <View style={styles.skeletonTextBlock}>
                <View style={styles.skeletonLineWide} />
                <View style={styles.skeletonLine} />
              </View>
            </View>
          ))}
          <ActivityIndicator style={{ marginTop: 10 }} color={theme.colors.textSecondary} />
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text variant="body" color="textSecondary">
            {t('profile.notificationsScreen.empty')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          extraData={unreadCount}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          removeClippedSubviews={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgroundWhite
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12
  },
  headerTitle: {
    ...theme.typography.body,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    flex: 1
  },
  headerRight: {
    minWidth: 44,
    alignItems: 'flex-end'
  },
  headerSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5E5'
  },
  listContent: {
    paddingBottom: 16
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.backgroundWhite
  },
  rowUnread: {
    backgroundColor: `${theme.colors.primary}14`
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: 10,
    paddingRight: 12
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.muted,
    alignItems: 'center',
    justifyContent: 'center'
  },
  textCol: {
    flex: 1
  },
  title: {
    fontFamily: theme.fontFamily.semiBold
  },
  body: {
    marginTop: 2
  },
  time: {
    marginLeft: 10,
    marginTop: 2
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24
  },
  skeletonWrap: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12
  },
  skeletonIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.muted,
    marginRight: 10
  },
  skeletonTextBlock: {
    flex: 1
  },
  skeletonLineWide: {
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.muted,
    width: '70%'
  },
  skeletonLine: {
    height: 10,
    borderRadius: 6,
    backgroundColor: theme.colors.muted,
    width: '55%',
    marginTop: 8
  }
});

