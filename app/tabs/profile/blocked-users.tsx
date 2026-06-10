import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { HeaderBackButton } from '../../../components/ui/HeaderBackButton';
import { Text } from '../../../components/ui/Text';
import { theme } from '../../../lib/theme';
import {
  getBlockedUsersForCurrentUser,
  unblockUser,
  type BlockedUserRow
} from '../../../lib/api';
import { bumpBlockedUsersRevision } from '../../../lib/store/blockedUsersSync';
import { SafetyChoiceSheet } from '../../../components/safety/SafetyChoiceSheet';
import { useTranslation } from 'react-i18next';

type UnblockConfirm = { userId: string; displayName: string };

export default function BlockedUsersScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [items, setItems] = useState<BlockedUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);
  const [unblockConfirm, setUnblockConfirm] = useState<UnblockConfirm | null>(null);
  const [feedback, setFeedback] = useState<{ title: string; message: string } | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    const { data, error } = await getBlockedUsersForCurrentUser();
    if (error) {
      setItems([]);
    } else {
      setItems((data ?? []).map((item) => ({ ...item })));
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    void load({ silent: true });
  };

  const performUnblock = async (userId: string) => {
    setUnblockingId(userId);
    try {
      const { error } = await unblockUser(userId);
      if (error) {
        setFeedback({ title: t('profile.blockedUsers.couldNotUnblock'), message: error });
        return;
      }
      bumpBlockedUsersRevision();
      setItems((prev) => prev.filter((row) => row.blocked_id !== userId));
      setUnblockConfirm(null);
    } finally {
      setUnblockingId(null);
    }
  };

  const renderItem = ({ item }: { item: BlockedUserRow }) => {
    const name = item.display_name?.trim() || t('common.bloomiUser');
    const busy = unblockingId === item.blocked_id;

    return (
      <View style={styles.row}>
        <Pressable
          style={styles.userPressable}
          onPress={() =>
            router.push({
              pathname: '/tabs/public-profile',
              params: { user_id: item.blocked_id }
            })
          }
          accessibilityRole="button"
          accessibilityLabel={`View ${name}'s profile`}
        >
          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder} />
          )}
          <View style={styles.userText}>
            <Text variant="body" style={styles.userName} numberOfLines={1}>
              {name}
            </Text>
            <Text variant="caption" color="textSecondary" numberOfLines={1}>
              Blocked account
            </Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => setUnblockConfirm({ userId: item.blocked_id, displayName: name })}
          disabled={busy}
          style={({ pressed }) => [
            styles.unblockBtn,
            pressed && !busy && styles.unblockBtnPressed,
            busy && styles.unblockBtnDisabled
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Unblock ${name}`}
        >
          {busy ? (
            <ActivityIndicator size="small" color={theme.colors.textPrimary} />
          ) : (
            <Text variant="caption" style={styles.unblockBtnText}>
              Unblock
            </Text>
          )}
        </Pressable>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <HeaderBackButton onPress={() => router.back()} />
        <Text variant="body" style={styles.headerTitle}>
          {t('profile.blockedUsers.title')}
        </Text>
        <View style={styles.headerRightPlaceholder} />
      </View>
      <View style={styles.separator} />

      <Text variant="caption" color="textSecondary" style={styles.intro}>
        {t('profile.blockedUsers.intro')}
      </Text>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centered}>
          <Text variant="body" style={styles.emptyTitle}>
            {t('profile.blockedUsers.empty')}
          </Text>
          <Text variant="caption" color="textSecondary" style={styles.emptyMessage}>
            {t('profile.blockedUsers.emptyHint')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.blocked_id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.rowSeparator} />}
        />
      )}

      {unblockConfirm ? (
        <SafetyChoiceSheet
          visible
          onClose={() => {
            if (!unblockingId) setUnblockConfirm(null);
          }}
          title={t('profile.blockedUsers.unblockTitle', {
            name: unblockConfirm.displayName
          })}
          message={t('profile.blockedUsers.unblockMessage')}
          actions={[
            {
              label: t('common.notNow'),
              disabled: Boolean(unblockingId),
              onPress: () => setUnblockConfirm(null)
            },
            {
              label: unblockingId
                ? t('profile.blockedUsers.unblocking')
                : t('profile.blockedUsers.unblock'),
              disabled: Boolean(unblockingId),
              onPress: () => {
                void performUnblock(unblockConfirm.userId);
              }
            }
          ]}
        />
      ) : null}

      {feedback ? (
        <SafetyChoiceSheet
          visible
          onClose={() => setFeedback(null)}
          title={feedback.title}
          message={feedback.message}
          actions={[{ label: t('common.ok'), onPress: () => setFeedback(null) }]}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.settingsPaddingX,
    paddingVertical: theme.spacing.settingsHeaderPaddingY
  },
  headerTitle: {
    ...theme.typography.settingsHeaderTitle,
    color: theme.colors.appleBlack,
    textAlign: 'center',
    flex: 1
  },
  headerRightPlaceholder: {
    width: theme.spacing.settingsHeaderSideWidth
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.separator
  },
  intro: {
    paddingHorizontal: theme.spacing.settingsPaddingX,
    paddingTop: 12,
    paddingBottom: 8,
    lineHeight: 20
  },
  listContent: {
    paddingBottom: 32
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.settingsPaddingX,
    paddingVertical: 14,
    backgroundColor: theme.colors.background
  },
  rowSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.separator,
    marginLeft: theme.spacing.settingsPaddingX
  },
  userPressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.muted
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.muted
  },
  userText: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0
  },
  userName: {
    fontFamily: theme.fontFamily.semiBold
  },
  unblockBtn: {
    marginLeft: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center'
  },
  unblockBtnPressed: {
    backgroundColor: theme.colors.muted
  },
  unblockBtnDisabled: {
    opacity: 0.6
  },
  unblockBtnText: {
    fontFamily: theme.fontFamily.semiBold
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32
  },
  emptyTitle: {
    fontFamily: theme.fontFamily.semiBold,
    marginBottom: 8,
    textAlign: 'center'
  },
  emptyMessage: {
    textAlign: 'center',
    lineHeight: 20
  }
});
