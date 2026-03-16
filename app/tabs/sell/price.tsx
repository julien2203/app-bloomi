import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
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
import { AppIcon } from '../../../components/ui/AppIcon';

export default function SellPriceScreen() {
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
            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={0.7}
              style={styles.backButton}
            >
              <AppIcon name="arrowLeftOutline" size={20} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Price</Text>
            <View style={styles.headerRightPlaceholder} />
          </View>

          <View style={styles.content}>
            <Text style={styles.label}>CHF</Text>
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

          <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
            <Button
              title="Confirmer"
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
    paddingTop: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  backButton: {
    padding: 8
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
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.horizontalPadding,
    paddingTop: 24,
    paddingBottom: 80
  },
  label: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    marginBottom: 8
  },
  input: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingVertical: 8
  },
  footer: {
    paddingHorizontal: theme.spacing.horizontalPadding,
    paddingTop: 12,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.backgroundWhite
  }
});

