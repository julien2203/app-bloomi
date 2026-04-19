import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import { getInboxThreads, type ThreadListItem } from '../../../lib/api_queries';
import { refreshUnreadThreadsBadge } from '../../../lib/unreadMessagesBadge';
import { Text } from '../../../components/ui/Text';
import { theme } from '../../../lib/theme';
import { useAuthStore } from '../../../stores/authStore';
import { AppIcon } from '../../../components/ui/AppIcon';
import { HeaderBackButton } from '../../../components/ui/HeaderBackButton';

function formatRelativeDate(dateString: string | null): string {
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

  if (diffMinutes < 1) return 'Just now';
  if (diffHours < 1) return `il y a ${diffMinutes} min`;
  if (diffDays < 1) return `il y a ${diffHours} h`;
  if (diffWeeks < 1) return `il y a ${diffDays} j`;
  if (diffMonths < 1) return `il y a ${diffWeeks} sem`;
  if (diffYears < 1) return `il y a ${diffMonths} mois`;
  return `il y a ${diffYears} an${diffYears > 1 ? 's' : ''}`;
}

export default function MessagesScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [threads, setThreads] = useState<ThreadListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inboxRealtimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadThreads = useCallback(async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setLoading(true);
      setError(null);
      const { data } = await getInboxThreads();
      setThreads(data);
      if (user?.id) {
        await refreshUnreadThreadsBadge(user.id);
      }
    } catch {
      setError('Unable to load your conversations.');
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Premier affichage + retour sur l’écran inbox
  useFocusEffect(
    useCallback(() => {
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
        { event: '*', schema: 'public', table: 'messages' },
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

  const renderItem = useCallback(
    ({ item }: { item: ThreadListItem }) => {
      const lastBody = item.last_message_body ?? '';
      const relativeDate = formatRelativeDate(item.last_message_created_at ?? item.thread_created_at);

      const isUnread = item.has_unread_from_other === true;

      const otherName = item.other_participant_name ?? '';
      const avatarUrl = item.other_participant_avatar ?? null;

      const handlePress = () => {
        router.push({
          pathname: '/tabs/messages/[id]',
          params: { id: item.thread_id }
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
              {otherName || 'Utilisateur'}
            </Text>
            {lastBody ? (
              <Text
                variant="captionSm"
                numberOfLines={1}
                style={[styles.lastMessage, isUnread && styles.lastMessageUnread]}
              >
                {lastBody}
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
    [router]
  );

  const renderContent = useMemo(() => {
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text variant="captionSm" color="textSecondary" style={styles.loadingText}>
            Chargement de vos conversations...
          </Text>
        </View>
      );
    }

    if (hasError) {
      return (
        <View style={styles.center}>
          <Text variant="body" style={styles.errorText}>
            {error}
          </Text>
          <TouchableOpacity onPress={() => void loadThreads()} activeOpacity={0.7}>
            <Text variant="captionSm" color="primary">
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (threads.length === 0) {
      return (
        <View style={styles.center}>
          <Text variant="body" style={styles.emptyTitle}>
            Aucune conversation pour le moment
          </Text>
          <Text variant="captionSm" color="textSecondary" style={styles.emptyText}>
            Vous verrez vos discussions avec les vendeurs ici.
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={threads}
        keyExtractor={(item) => item.thread_id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.listContent}
      />
    );
  }, [loading, hasError, error, threads, renderItem]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <HeaderBackButton onPress={() => router.back()} />
        <Text variant="body" style={styles.headerTitle}>
          Messages
        </Text>
        <View style={styles.headerRightPlaceholder} />
      </View>
      <View style={styles.headerSeparator} />
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
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary
  },
  headerRightPlaceholder: {
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
    alignItems: 'center',
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
    borderRadius: 26
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.muted,
    alignItems: 'center',
    justifyContent: 'center'
  },
  rowCenter: {
    flex: 1,
    paddingHorizontal: 12
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
    alignItems: 'flex-end',
    justifyContent: 'center'
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
    backgroundColor: '#CCFF00',
    marginTop: 6,
    alignSelf: 'flex-end'
  },
  separator: {
    height: 1,
    backgroundColor: '#E5E5E5'
  }
});
