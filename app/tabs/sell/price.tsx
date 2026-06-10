import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { theme } from '../../../lib/theme';
import { Button } from '../../../components/ui/Button';
import { useSellFormStore } from '../../../lib/store/sellForm';
import { HeaderBackButton } from '../../../components/ui/HeaderBackButton';
import { useTranslation } from 'react-i18next';

export default function SellPriceScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { values, setField } = useSellFormStore();
  const [priceText, setPriceText] = useState<string>(
    typeof values.price === 'number' ? String(values.price) : ''
  );

  const handleConfirm = () => {
    const trimmed = priceText.trim();
    const numeric = trimmed ? Number(trimmed.replace(',', '.')) : NaN;
    const value = Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
    setField('price', value);
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.inner}>
          <View style={styles.header}>
            <HeaderBackButton onPress={() => router.back()} />
            <Text style={styles.headerTitle}>{t('sell.price')}</Text>
            <View style={styles.headerRightPlaceholder} />
          </View>

          <View style={styles.body}>
            <Text style={styles.label}>{t('common.chf')}</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor={theme.colors.textSecondary}
              value={priceText}
              onChangeText={(text) => {
                setPriceText(text.replace(/[^0-9.,]/g, ''));
              }}
              keyboardType="numeric"
            />
          </View>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
            <Button
              title={t('common.confirm')}
              onPress={handleConfirm}
              variant="primary"
              textStyle={{ fontWeight: '700' }}
            />
          </View>
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
  inner: {
    flex: 1
  },
  header: {
    paddingHorizontal: theme.spacing.horizontalPadding,
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerTitle: {
    ...theme.typography.body,
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.textPrimary
  },
  headerRightPlaceholder: {
    width: 32
  },
  body: {
    paddingHorizontal: theme.spacing.horizontalPadding,
    paddingTop: 8,
    paddingBottom: 4
  },
  label: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    marginBottom: 6
  },
  input: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    paddingVertical: 6
  },
  footer: {
    paddingHorizontal: theme.spacing.horizontalPadding,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.backgroundWhite
  }
});
