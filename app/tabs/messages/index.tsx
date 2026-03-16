import React, { useEffect, useMemo, useState } from 'react';
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
import { supabase } from '../../../lib/supabase';
import { getInboxThreads, type ThreadListItem } from '../../../lib/api_queries';
import { Text } from '../../../components/ui/Text';
import { theme } from '../../../lib/theme';
import { useAuthStore } from '../../../stores/authStore';

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

  const loadThreads = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await getInboxThreads();
      setThreads(data);
    } catch {
      setError('Impossible de charger vos conversations.');
      setThreads([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadThreads();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('messages:inbox')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        () => {
          void loadThreads();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const hasError = !!error;

  const renderItem = ({ item }: { item: ThreadListItem }) => {
    const lastBody = item.last_message_body ?? '';
    const truncatedBody =
      lastBody.length > 60 ? `${lastBody.slice(0, 57).trimEnd()}...` : lastBody;
    const relativeDate = formatRelativeDate(item.last_message_created_at ?? item.thread_created_at);

    const isUnread =
      item.last_message_sender_id &&
      item.last_message_sender_id !== user?.id &&
      item.last_message_read_at === null;

    const otherName = item.other_participant_name ?? '';
    const avatarUrl = item.other_participant_avatar ?? null;

    const handlePress = () => {
      router.push({
        pathname: '/tabs/messages/[id]',
        params: { id: item.thread_id }
      });
    };

    const initials =
      otherName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join('') || '?';

    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.8}
        onPress={handlePress}
      >
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text variant="body" style={styles.avatarInitials}>
              {initials}
            </Text>
          </View>
        )}

        <View style={styles.rowCenter}>
          <View style={styles.rowHeader}>
            <Text
              variant="body"
              style={styles.nameText}
              numberOfLines={1}
            >
              {otherName || 'Utilisateur'}
            </Text>
            <Text
              variant="captionSm"
              color="textSecondary"
              style={styles.dateText}
            >
              {relativeDate}
            </Text>
          </View>

          <Text
            variant="captionSm"
            color="textSecondary"
            numberOfLines={1}
            style={styles.listingTitle}
          >
            {item.listing_title}
          </Text>

          {truncatedBody ? (
            <Text
              variant="captionSm"
              color="textSecondary"
              numberOfLines={1}
              style={styles.lastMessage}
            >
              {truncatedBody}
            </Text>
          ) : null}
        </View>

        {isUnread && <View style={styles.unreadBadge} />}
      </TouchableOpacity>
    );
  };

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
          <TouchableOpacity onPress={loadThreads} activeOpacity={0.7}>
            <Text variant="captionSm" color="primary">
              Réessayer
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
  }, [loading, hasError, error, threads]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text variant="h2" style={styles.headerTitle}>
          Messages
        </Text>
      </View>
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8
  },
  headerTitle: {
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
  emptyTitle: {
    fontFamily: theme.fontFamily.semiBold,
    marginBottom: 4,
    textAlign: 'center'
  },
  emptyText: {
    textAlign: 'center'
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  avatarInitials: {
    fontFamily: theme.fontFamily.semiBold
  },
  rowCenter: {
    flex: 1
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2
  },
  nameText: {
    flex: 1,
    marginRight: 8
  },
  dateText: {
    minWidth: 60,
    textAlign: 'right'
  },
  listingTitle: {
    marginBottom: 2
  },
  lastMessage: {
    maxWidth: '100%'
  },
  unreadBadge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    marginLeft: 8
  },
  separator: {
    height: 1,
    backgroundColor: '#E5E5E5'
  }
});
