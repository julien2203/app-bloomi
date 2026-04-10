import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../stores/authStore';
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

function formatRelative(dateString: string): string {
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
  if (m < 1) return "à l'instant";
  if (h < 1) return `il y a ${m} min`;
  if (d < 1) return `il y a ${h} h`;
  if (w < 1) return `il y a ${d} j`;
  if (mo < 1) return `il y a ${w} sem`;
  if (y < 1) return `il y a ${mo} mois`;
  return `il y a ${y} an${y > 1 ? 's' : ''}`;
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
  const router = useRouter();
  const { user } = useAuthStore();
  const userId = user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [rows, setRows] = useState<NotificationRow[]>([]);

  const unreadCount = useMemo(() => rows.filter((r) => !r.read_at).length, [rows]);

  const loadNotifications = useCallback(async () => {
    if (!userId) {
      setRows([]);
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
      setRows((data || []) as NotificationRow[]);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadNotifications();
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
        router.push({ pathname: '/tabs/messages/[id]', params: { id: threadId } });
        return;
      }
      if (listingId) {
        router.push({ pathname: '/tabs/feed/[id]', params: { id: listingId } });
        return;
      }
      if (orderId) {
        router.push('/tabs/profile/orders');
      }
    },
    [router]
  );

  const markAsReadAndNavigate = useCallback(
    async (n: NotificationRow) => {
      // Best-effort: marquer comme lu sans bloquer la navigation
      if (userId && !n.read_at) {
        setRows((prev) =>
          prev.map((r) => (r.id === n.id ? { ...r, read_at: new Date().toISOString() } : r))
        );
        void supabase
          .from('notifications')
          .update({ read_at: new Date().toISOString() })
          .eq('id', n.id)
          .eq('user_id', userId);
      }

      navigateFromData(n.data);
    },
    [navigateFromData, userId]
  );

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    if (markingAll) return;
    if (unreadCount === 0) return;

    setMarkingAll(true);
    const nowIso = new Date().toISOString();
    try {
      setRows((prev) => prev.map((r) => (!r.read_at ? { ...r, read_at: nowIso } : r)));
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: nowIso })
        .eq('user_id', userId)
        .is('read_at', null);
      if (error) throw error;
    } finally {
      setMarkingAll(false);
    }
  }, [markingAll, unreadCount, userId]);

  const renderItem = useCallback(
    ({ item }: { item: NotificationRow }) => {
      const isUnread = !item.read_at;
      const icon = pickIconName(item.data);
      return (
        <Pressable
          onPress={() => void markAsReadAndNavigate(item)}
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
            {formatRelative(item.created_at)}
          </Text>
        </Pressable>
      );
    },
    [markAsReadAndNavigate]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <HeaderBackButton onPress={() => router.back()} />
        <Text variant="body" style={styles.headerTitle}>
          Notifications
        </Text>
        <View style={styles.headerRight}>
          <Button
            title="Tout marquer comme lu"
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
            Aucune notification pour le moment
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
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

