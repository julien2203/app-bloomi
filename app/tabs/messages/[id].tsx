import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { Text } from '../../../components/ui/Text';
import { Button } from '../../../components/ui/Button';
import { AppIcon } from '../../../components/ui/AppIcon';
import { theme } from '../../../lib/theme';
import { useAuthStore } from '../../../stores/authStore';
import type { ThreadListItem } from '../../../lib/api_queries';

type MessageRow = {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
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
      setError('Impossible de charger cette conversation.');
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!threadId) {
      setLoading(false);
      setError('Conversation introuvable.');
      return;
    }
    void loadThreadMeta();
    void loadMessages();
  }, [threadId]);

  // Temps réel pour ce thread
  useEffect(() => {
    if (!threadId) return;

    const channel = supabase
      .channel(`thread:${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${threadId}`
        },
        (payload) => {
          const newMsg = payload.new as MessageRow;
          setMessages((prev) => [...prev, newMsg].sort((a, b) =>
            a.created_at.localeCompare(b.created_at)
          ));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
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
    return threadMeta.listing_title;
  }, [threadMeta]);

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

        setInput('');
        // Scroll vers le bas
        flatListRef.current?.scrollToEnd({ animated: true });
      }
    } finally {
      setSending(false);
    }
  };

  const renderItem = ({ item }: { item: MessageRow }) => {
    const isMine = item.sender_id === user?.id;
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
            title="Retour"
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
  }, [loading, error, messages]);

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
        <TouchableOpacity
          onPress={handleBack}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <AppIcon name="arrowLeftOutline" size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
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
        <View style={styles.messagesContainer}>{content}</View>

        <View
          style={[
            styles.inputBar,
            { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }
          ]}
        >
          <TextInput
            style={styles.textInput}
            placeholder="Écrire un message..."
            placeholderTextColor={theme.colors.textSecondary}
            value={input}
            onChangeText={setInput}
            multiline
          />
          <Button
            title="Envoyer"
            onPress={handleSend}
            variant="primary"
            style={styles.sendButton}
            disabled={!input.trim() || sending}
            loading={sending}
          />
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
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5E5',
    backgroundColor: theme.colors.backgroundWhite,
    columnGap: 8
  },
  textInput: {
    flex: 1,
    maxHeight: 100,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...theme.typography.body,
    color: theme.colors.textPrimary
  },
  sendButton: {
    minWidth: 88,
    height: 40,
    borderRadius: 20
  }
});

