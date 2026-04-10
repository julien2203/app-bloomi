import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { HeaderBackButton } from '../../../components/ui/HeaderBackButton';
import { Text } from '../../../components/ui/Text';
import { theme } from '../../../lib/theme';

export default function ShippingScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <HeaderBackButton onPress={() => router.back()} />
        <Text variant="body" style={styles.headerTitle}>
          Shipping
        </Text>
        <View style={styles.headerRightPlaceholder} />
      </View>
      <View style={styles.separator} />

      <View style={styles.content}>
        <Text variant="body" color="textSecondary">
          {/* Écran vide pour l’instant */}
        </Text>
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
    paddingHorizontal: theme.spacing.settingsPaddingX,
    paddingTop: theme.spacing.gapMd
  }
});

