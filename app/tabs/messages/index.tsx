import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../../lib/supabase';
import {
  attachUnreadFlagsForInboxThreads,
  getInboxThreadsBase,
  type ThreadListItem
} from '../../../lib/api_queries';

function cloneThreads(threads: ThreadListItem[]): ThreadListItem[] {
  return threads.map((thread) => ({ ...thread }));
}

function sortThreadsByRecency(threads: ThreadListItem[]): ThreadListItem[] {
  return [...threads].sort((a, b) => {
    const aTs = a.last_message_at ?? a.thread_created_at ?? '';
    const bTs = b.last_message_at ?? b.thread_created_at ?? '';
    return bTs.localeCompare(aTs);
  });
}
import { refreshUnreadThreadsBadge } from '../../../lib/unreadMessagesBadge';
import { Text } from '../../../components/ui/Text';
import { theme } from '../../../lib/theme';
import { useAuthStore } from '../../../stores/authStore';
import { AppIcon } from '../../../components/ui/AppIcon';
import { getFixedTabBarHeight } from '../../../components/navigation/FloatingTabBar';
import { translateChatSystemMessage } from '../../../lib/messagesSystemI18n';
import { MessagesSafetyBanner } from '../../../components/messages/MessagesSafetyBanner';

function formatRelativeDate(dateString: string | null, t: (key: string, opts?: any) => string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  if (Number.isNaN(diffMs) || diffMs < 0) {
    return date.toLocaleDateString();
  }

  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffMinutes < 1) return t('feed.listingDetail.justNow');
  if (diffHours < 1) return t('feed.listingDetail.minutesAgo', { count: diffMinutes });
  if (diffDays < 1) return t('feed.listingDetail.hoursAgo', { count: diffHours });
  if (diffWeeks < 1) return t('feed.listingDetail.daysAgo', { count: diffDays });
  if (diffMonths < 1) return t('feed.listingDetail.weeksAgo', { count: diffWeeks });
  if (diffYears < 1) return t('feed.listingDetail.monthsAgo', { count: diffMonths });
  return t('feed.listingDetail.yearsAgo', { count: diffYears });
}

export default function MessagesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [threads, setThreads] = useState<ThreadListItem[]>([]);
  const [previousThreads, setPreviousThreads] = useState<ThreadListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const inboxRealtimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeqRef = useRef(0);
  const skipFirstFocusReload = useRef(true);
  const hasLoadedThreadsRef = useRef(false);

  const mergeThreads = useCallback((current: ThreadListItem[], next: ThreadListItem[]) => {
    const byId = new Map<string, ThreadListItem>();
    for (const item of current) byId.set(item.thread_id, item);
    for (const item of next) byId.set(item.thread_id, item);
    return sortThreadsByRecency(Array.from(byId.values()));
  }, []);

  const loadThreads = useCallback(async (opts?: { silent?: boolean; page?: number; append?: boolean }) => {
    const requestedPage = opts?.page ?? 1;
    const append = opts?.append === true && requestedPage > 1;
    const requestId = ++requestSeqRef.current;
    try {
      if (append) {
        setLoadingMore(true);
      } else if (!opts?.silent) {
        setLoading(true);
        if (!hasLoadedThreadsRef.current) {
          setInitialLoading(true);
        }
      }
      setError(null);
      const base = await getInboxThreadsBase({
        page: requestedPage,
        pageSize: 20
      });

      if (requestId !== requestSeqRef.current) return;

      const baseThreads = cloneThreads(base.data as ThreadListItem[]);

      if (append) {
        setThreads((prev) => mergeThreads(prev, baseThreads));
      } else {
        setThreads(baseThreads);
        setPreviousThreads(baseThreads);
        hasLoadedThreadsRef.current = baseThreads.length > 0;
      }

      setPage(requestedPage);
      setHasMore(base.hasMore);

      // Enrichissement non bloquant: badges + flags unread en parallèle
      void Promise.all([
        base.userId
          ? attachUnreadFlagsForInboxThreads(baseThreads, base.userId)
          : Promise.resolve(baseThreads),
        user?.id ? refreshUnreadThreadsBadge(user.id) : Promise.resolve()
      ]).then(([withUnread]) => {
        if (requestId !== requestSeqRef.current) return;
        const unreadThreads = cloneThreads(withUnread as ThreadListItem[]);
        if (append) {
          setThreads((prev) => mergeThreads(prev, unreadThreads));
        } else {
          setThreads(unreadThreads);
          setPreviousThreads(unreadThreads);
        }
      });
    } catch {
      setError(t('messages.loadError'));
      if (!hasLoadedThreadsRef.current) {
        setThreads([]);
      }
    } finally {
      if (!append) {
        setLoading(false);
        setInitialLoading(false);
      }
      setLoadingMore(false);
    }
  }, [user?.id, mergeThreads, t]);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  // Premier affichage + retour sur l’écran inbox
  useFocusEffect(
    useCallback(() => {
      if (skipFirstFocusReload.current) {
        skipFirstFocusReload.current = false;
        return;
      }
      void loadThreads({ silent: true });
    }, [loadThreads])
  );

  useEffect(() => {
    if (!user?.id) return;

    const scheduleReload = () => {
      if (inboxRealtimeDebounceRef.current) {
        clearTimeout(inboxRealtimeDebounceRef.current);
      }
      inboxRealtimeDebounceRef.current = setTimeout(() => {
        inboxRealtimeDebounceRef.current = null;
        void loadThreads({ silent: true });
      }, 350);
    };

    const ch = supabase
      .channel(`messages:inbox-list:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        scheduleReload
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
      if (inboxRealtimeDebounceRef.current) {
        clearTimeout(inboxRealtimeDebounceRef.current);
        inboxRealtimeDebounceRef.current = null;
      }
    };
  }, [user?.id, loadThreads]);

  const hasError = !!error;
  const inboxBottomPadding = getFixedTabBarHeight(insets.bottom) + 28;
  const visibleThreads = threads.length > 0 ? threads : previousThreads;
  const showInitialSkeleton = initialLoading && visibleThreads.length === 0;

  const renderItem = useCallback(
    ({ item }: { item: ThreadListItem }) => {
      const lastBody = item.last_message_body ?? '';
      const lastBodyDisplay = lastBody
        ? translateChatSystemMessage(lastBody, t, {
            isSeller: item.seller_id === user?.id
          })
        : '';
      const relativeDate = formatRelativeDate(item.last_message_created_at ?? item.thread_created_at, t);

      const isUnread = item.has_unread_from_other === true;

      const otherName = item.other_participant_name ?? '';
      const avatarUrl = item.other_participant_avatar ?? null;

      const handlePress = () => {
        setThreads((prev) =>
          prev.map((row) =>
            row.thread_id === item.thread_id ? { ...row, has_unread_from_other: false } : row
          )
        );
        setPreviousThreads((prev) =>
          prev.map((row) =>
            row.thread_id === item.thread_id ? { ...row, has_unread_from_other: false } : row
          )
        );
        router.push({
          pathname: '/tabs/messages/[id]',
          params: { id: item.thread_id, from_inbox: '1' }
        });
      };

      return (
        <TouchableOpacity
          style={[styles.row, isUnread && styles.rowUnread]}
          activeOpacity={0.8}
          onPress={handlePress}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <AppIcon name="userOutline" size={24} color={theme.colors.textSecondary} />
            </View>
          )}

          <View style={styles.rowCenter}>
            <Text
              variant="body"
              numberOfLines={1}
              style={[
                styles.nameText,
                isUnread ? styles.nameTextUnread : styles.nameTextRead
              ]}
            >
              {otherName || t('common.bloomiUser')}
            </Text>
            {lastBodyDisplay ? (
              <Text
                variant="body"
                numberOfLines={2}
                ellipsizeMode="tail"
                style={[styles.lastMessage, isUnread && styles.lastMessageUnread]}
              >
                {lastBodyDisplay}
              </Text>
            ) : null}
          </View>

          <View style={styles.rowRight}>
            <Text style={[styles.dateText, isUnread && styles.dateTextUnread]}>{relativeDate}</Text>
            {isUnread ? <View style={styles.unreadDot} /> : null}
          </View>
        </TouchableOpacity>
      );
    },
    [router, t]
  );

  const handleLoadMore = useCallback(() => {
    if (loadingMore || loading || !hasMore) return;
    void loadThreads({ silent: true, page: page + 1, append: true });
  }, [hasMore, loadThreads, loading, loadingMore, page]);

  const renderSkeleton = useCallback(() => {
    return (
      <View style={styles.skeletonContainer}>
        {Array.from({ length: 8 }).map((_, index) => (
          <View key={`sk-${index}`} style={styles.skeletonRow}>
            <View style={styles.skeletonAvatar} />
            <View style={styles.skeletonTextCol}>
              <View style={styles.skeletonName} />
              <View style={styles.skeletonLine} />
            </View>
            <View style={styles.skeletonDate} />
          </View>
        ))}
      </View>
    );
  }, []);

  const renderContent = useMemo(() => {
    if (showInitialSkeleton) return renderSkeleton();

    if (hasError && visibleThreads.length === 0) {
      return (
        <View style={styles.center}>
          <Text variant="body" style={styles.errorText}>
            {error}
          </Text>
          <TouchableOpacity onPress={() => void loadThreads()} activeOpacity={0.7}>
            <Text variant="captionSm" color="primary">
              {t('common.retry')}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (visibleThreads.length === 0) {
      return (
        <View style={styles.center}>
          <Text variant="body" style={styles.emptyTitle}>
            {t('messages.noConversationsYet')}
          </Text>
          <Text variant="captionSm" color="textSecondary" style={styles.emptyText}>
            {t('messages.emptyHint')}
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={visibleThreads}
        keyExtractor={(item) => item.thread_id}
        renderItem={renderItem}
        removeClippedSubviews={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={[styles.listContent, { paddingBottom: inboxBottomPadding }]}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          <>
            {loadingMore ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator color={theme.colors.primary} />
              </View>
            ) : null}
            <View style={styles.bottomSpacer} />
          </>
        }
      />
    );
  }, [
    showInitialSkeleton,
    renderSkeleton,
    hasError,
    error,
    loadThreads,
    visibleThreads,
    renderItem,
    inboxBottomPadding,
    handleLoadMore,
    loadingMore
  ]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.headerSidePlaceholder} />
        <Text variant="body" style={styles.headerTitle}>
          {t('messages.title')}
        </Text>
        <View style={styles.headerSidePlaceholder} />
      </View>
      <View style={styles.headerSeparator} />
      <MessagesSafetyBanner />
      {renderContent}
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
    fontFamily: theme.fontFamily.semiBold,
    color: theme.colors.textPrimary
  },
  headerSidePlaceholder: {
    width: 28
  },
  headerSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5E5'
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
  skeletonContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
    paddingVertical: 12
  },
  skeletonAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E8E8E8'
  },
  skeletonTextCol: {
    flex: 1,
    paddingHorizontal: 12
  },
  skeletonName: {
    width: '48%',
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E8E8E8',
    marginBottom: 8
  },
  skeletonLine: {
    width: '75%',
    height: 10,
    borderRadius: 6,
    backgroundColor: '#EFEFEF'
  },
  skeletonDate: {
    width: 44,
    height: 10,
    borderRadius: 6,
    backgroundColor: '#EFEFEF'
  },
  errorText: {
    textAlign: 'center',
    marginBottom: 8
  },
  emptyTitle: {
    fontFamily: theme.fontFamily.semiBold,
    marginBottom: 4,
    textAlign: 'center'
  },
  emptyText: {
    textAlign: 'center'
  },
  listContent: {
    paddingBottom: 16
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 72,
    backgroundColor: theme.colors.backgroundWhite
  },
  rowUnread: {
    backgroundColor: 'rgba(204, 255, 0, 0.12)'
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginTop: 2
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginTop: 2,
    backgroundColor: theme.colors.muted,
    alignItems: 'center',
    justifyContent: 'center'
  },
  rowCenter: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingTop: 2
  },
  nameText: {
    fontSize: 16
  },
  nameTextUnread: {
    fontWeight: '700',
    color: theme.colors.textPrimary
  },
  nameTextRead: {
    fontWeight: '400',
    color: theme.colors.textPrimary
  },
  rowRight: {
    minWidth: 56,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    paddingTop: 2
  },
  dateText: {
    fontSize: 13,
    color: '#AAAAAA'
  },
  dateTextUnread: {
    fontWeight: '600',
    color: theme.colors.textPrimary
  },
  lastMessage: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: '#888888',
    fontWeight: '400'
  },
  lastMessageUnread: {
    fontWeight: '700',
    color: theme.colors.textPrimary
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#C3EA4F',
    marginTop: 6,
    alignSelf: 'flex-end'
  },
  separator: {
    height: 1,
    backgroundColor: '#E5E5E5'
  },
  bottomSpacer: {
    height: 12
  },
  footerLoading: {
    paddingVertical: 10,
    alignItems: 'center'
  }
});
