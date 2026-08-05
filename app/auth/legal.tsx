import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { HeaderBackButton } from '../../components/ui/HeaderBackButton';
import { theme } from '../../lib/theme';
import { normalizeLanguage } from '../../lib/i18n';
import { resolveLegalContent } from '../../lib/legalContent';
import { CGURenderer } from '../../screens/cgu/CGURenderer';

export default function AuthLegalScreen() {
  const router = useRouter();
  const { i18n } = useTranslation();
  const language = normalizeLanguage(i18n.language);
  const content = resolveLegalContent(language);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <HeaderBackButton onPress={() => router.back()} />
      </View>
      <CGURenderer content={content} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.backgroundWhite
  },
  header: {
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingTop: 8,
    paddingBottom: 4
  }
});
