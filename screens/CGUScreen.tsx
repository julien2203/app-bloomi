import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../lib/theme';
import { normalizeLanguage } from '../lib/i18n';
import { resolveLegalContent } from '../lib/legalContent';
import { CGURenderer } from './cgu/CGURenderer';

function CGUScreen() {
  const { i18n } = useTranslation();
  const language = normalizeLanguage(i18n.language);
  const content = resolveLegalContent(language);

  return (
    <SafeAreaView style={styles.safe}>
      <CGURenderer content={content} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.backgroundWhite
  }
});

export default CGUScreen;
