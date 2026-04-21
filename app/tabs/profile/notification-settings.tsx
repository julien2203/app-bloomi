import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { HeaderBackButton } from '../../../components/ui/HeaderBackButton';
import { Text } from '../../../components/ui/Text';
import { theme } from '../../../lib/theme';
import { useAuthStore } from '../../../stores/authStore';
import { supabase } from '../../../lib/supabase';

type NotificationPrefs = {
  enabled: boolean;
  newMessage: boolean;
  newFeedback: boolean;
  favoriteItems: boolean;
  newFollowers: boolean;
  newItems: boolean;
};

const DEFAULT_PREFS: NotificationPrefs = {
  enabled: true,
  newMessage: true,
  newFeedback: true,
  favoriteItems: true,
  newFollowers: true,
  newItems: true
};

function normalizePrefs(value: unknown): NotificationPrefs {
  const raw = (value ?? {}) as Partial<NotificationPrefs>;
  return {
    enabled: raw.enabled ?? DEFAULT_PREFS.enabled,
    newMessage: raw.newMessage ?? DEFAULT_PREFS.newMessage,
    newFeedback: raw.newFeedback ?? DEFAULT_PREFS.newFeedback,
    favoriteItems: raw.favoriteItems ?? DEFAULT_PREFS.favoriteItems,
    newFollowers: raw.newFollowers ?? DEFAULT_PREFS.newFollowers,
    newItems: raw.newItems ?? DEFAULT_PREFS.newItems
  };
}

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);
  const userId = useMemo(() => user?.id ?? null, [user?.id]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!userId) {
        if (mounted) {
          setPrefs(DEFAULT_PREFS);
          setLoading(false);
        }
        return;
      }
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('push_notification_settings')
          .eq('id', userId)
          .maybeSingle();
        if (error) throw error;
        if (!mounted) return;
        const profilePrefs = (data as any)?.push_notification_settings;
        setPrefs(normalizePrefs(profilePrefs));
      } catch {
        if (mounted) setPrefs(DEFAULT_PREFS);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [userId]);

  const persistPrefs = async (next: NotificationPrefs) => {
    setPrefs(next);
    if (!userId) return;
    setSaving(true);
    try {
      await supabase
        .from('profiles')
        .update({ push_notification_settings: next as any })
        .eq('id', userId);
    } catch {
      // no-op: UI keeps latest state in memory
    } finally {
      setSaving(false);
    }
  };

  const toggleMaster = (value: boolean) => {
    const next: NotificationPrefs = {
      ...prefs,
      enabled: value
    };
    void persistPrefs(next);
  };

  const toggleItem = (
    key: 'newMessage' | 'newFeedback' | 'favoriteItems' | 'newFollowers' | 'newItems',
    value: boolean
  ) => {
    const next: NotificationPrefs = {
      ...prefs,
      [key]: value
    };
    void persistPrefs(next);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <HeaderBackButton onPress={() => router.back()} />
        <Text variant="body" style={styles.headerTitle}>
          Push notifications
        </Text>
        <View style={styles.headerRightPlaceholder} />
      </View>
      <View style={styles.separator} />

      <View style={styles.content}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : (
          <>
            <View style={styles.groupTopSeparator} />
            <View style={styles.row}>
              <Text variant="body" style={styles.rowLabel}>
                Enable push notifications
              </Text>
              <Switch
                value={prefs.enabled}
                onValueChange={toggleMaster}
                trackColor={{ false: '#E8E8E8', true: '#C3EA4F' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#E8E8E8"
                disabled={saving}
              />
            </View>
            <View style={styles.groupBottomSeparator} />

            <Text style={styles.sectionLabel}>High-priority notifications</Text>
            <View style={styles.groupTopSeparator} />

            <View style={styles.row}>
              <Text variant="body" style={styles.rowLabel}>
                New message
              </Text>
              <Switch
                value={prefs.newMessage}
                onValueChange={(v) => toggleItem('newMessage', v)}
                trackColor={{ false: '#E8E8E8', true: '#C3EA4F' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#E8E8E8"
                disabled={!prefs.enabled || saving}
              />
            </View>
            <View style={styles.rowSeparator} />

            <View style={styles.row}>
              <Text variant="body" style={styles.rowLabel}>
                New feedback
              </Text>
              <Switch
                value={prefs.newFeedback}
                onValueChange={(v) => toggleItem('newFeedback', v)}
                trackColor={{ false: '#E8E8E8', true: '#C3EA4F' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#E8E8E8"
                disabled={!prefs.enabled || saving}
              />
            </View>
            <View style={styles.groupBottomSeparator} />

            <View style={styles.largeSpacer} />

            <Text style={styles.sectionLabel}>Other notifications</Text>
            <View style={styles.groupTopSeparator} />

            <View style={styles.row}>
              <Text variant="body" style={styles.rowLabel}>
                Favorite items
              </Text>
              <Switch
                value={prefs.favoriteItems}
                onValueChange={(v) => toggleItem('favoriteItems', v)}
                trackColor={{ false: '#E8E8E8', true: '#C3EA4F' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#E8E8E8"
                disabled={!prefs.enabled || saving}
              />
            </View>
            <View style={styles.rowSeparator} />

            <View style={styles.row}>
              <Text variant="body" style={styles.rowLabel}>
                New followers
              </Text>
              <Switch
                value={prefs.newFollowers}
                onValueChange={(v) => toggleItem('newFollowers', v)}
                trackColor={{ false: '#E8E8E8', true: '#C3EA4F' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#E8E8E8"
                disabled={!prefs.enabled || saving}
              />
            </View>
            <View style={styles.rowSeparator} />

            <View style={styles.row}>
              <Text variant="body" style={styles.rowLabel}>
                New items
              </Text>
              <Switch
                value={prefs.newItems}
                onValueChange={(v) => toggleItem('newItems', v)}
                trackColor={{ false: '#E8E8E8', true: '#C3EA4F' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#E8E8E8"
                disabled={!prefs.enabled || saving}
              />
            </View>
            <View style={styles.groupBottomSeparator} />
          </>
        )}
      </View>
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
  content: {
    paddingTop: 0
  },
  loadingWrap: {
    paddingTop: theme.spacing.gapLg,
    alignItems: 'center'
  },
  sectionLabel: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    fontSize: 13,
    fontWeight: '400',
    color: '#AAAAAA'
  },
  groupTopSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5E5'
  },
  groupBottomSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5E5'
  },
  row: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  rowSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5E5'
  },
  rowLabel: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '400',
    paddingRight: 16,
    flex: 1
  },
  largeSpacer: {
    height: 60
  }
});

