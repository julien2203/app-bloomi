import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { HeaderBackButton } from '../../../components/ui/HeaderBackButton';
import { Text } from '../../../components/ui/Text';
import { theme } from '../../../lib/theme';

export default function SettingsScreen() {
  const router = useRouter();

  const rows = useMemo(
    () => [
      { label: 'Profile detail', onPress: () => router.push('/tabs/profile/edit-profile') },
      { label: 'My address', onPress: () => router.push('/tabs/profile/my-address') },
      { label: 'Account settings', onPress: () => router.push('/tabs/profile/account-settings') },
      { label: 'Payment', onPress: () => router.push('/tabs/profile/wallet') }
    ],
    [router]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <HeaderBackButton onPress={() => router.back()} />
        <Text variant="body" style={styles.headerTitle}>
          Settings
        </Text>
        <View style={styles.headerRightPlaceholder} />
      </View>
      <View style={styles.separator} />

      <View>
        {rows.map((row, idx) => (
          <Pressable
            key={row.label}
            onPress={row.onPress}
            style={[styles.row, idx > 0 && styles.rowSeparator]}
          >
            <Text variant="body" style={styles.rowLabel}>
              {row.label}
            </Text>
            <Text variant="body" style={styles.chevron}>
              {'›'}
            </Text>
          </Pressable>
        ))}

        <Text style={styles.notificationsSectionLabel}>Notifications</Text>

        <View style={styles.notificationsBlock}>
          <View style={styles.notificationsSeparator} />
          <Pressable
            onPress={() => router.push('/tabs/profile/notification-settings')}
            style={styles.notificationsRow}
          >
            <Text variant="body" style={styles.rowLabel}>
              Push notifications
            </Text>
            <Text variant="body" style={styles.chevron}>
              {'›'}
            </Text>
          </Pressable>
          <View style={styles.notificationsSeparator} />
        </View>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.settingsPaddingX,
    paddingVertical: theme.spacing.settingsRowPaddingY,
    backgroundColor: theme.colors.background
  },
  rowSeparator: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.separator
  },
  rowLabel: {
    ...theme.typography.body,
    color: theme.colors.appleBlack
  },
  chevron: {
    ...theme.typography.body,
    color: theme.colors.appleBlack
  },
  notificationsSectionLabel: {
    ...theme.typography.settingsSectionLabel,
    color: theme.colors.sectionLabel,
    paddingHorizontal: theme.spacing.settingsPaddingX,
    paddingTop: theme.spacing.settingsSectionTop,
    paddingBottom: theme.spacing.settingsSectionBottom
  },
  notificationsBlock: {
    backgroundColor: theme.colors.background
  },
  notificationsSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.separator
  },
  notificationsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.settingsPaddingX,
    paddingVertical: theme.spacing.settingsRowPaddingY,
    backgroundColor: theme.colors.background
  }
});

