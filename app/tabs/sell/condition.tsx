import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { theme } from '../../../lib/theme';
import { Button } from '../../../components/ui/Button';
import { useSellFormStore } from '../../../lib/store/sellForm';
import { AppIcon } from '../../../components/ui/AppIcon';
import { Screen } from '../../../components/ui/Screen';
import { Text } from '../../../components/ui/Text';

type ConditionValue = 'new' | 'like_new' | 'good' | 'fair' | 'poor';

type ConditionOption = {
  label: string;
  value: ConditionValue;
};

const CONDITION_OPTIONS: ConditionOption[] = [
  { label: 'New with tags', value: 'new' },
  { label: 'New without tags', value: 'like_new' },
  { label: 'Good', value: 'good' },
  { label: 'Fair', value: 'fair' },
  { label: 'Poor', value: 'poor' }
];

export default function SellConditionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { values, setField } = useSellFormStore();
  const [selected, setSelected] = useState<ConditionValue | undefined>(
    values.condition as ConditionValue | undefined
  );

  const handleConfirm = () => {
    setField('condition', selected);
    router.back();
  };

  return (
    <Screen noHorizontalPadding style={{ backgroundColor: '#FFFFFF' }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
            style={styles.backButton}
          >
            <AppIcon name="arrowLeftOutline" size={20} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text variant="body" style={styles.headerTitle}>
            Condition
          </Text>
          <View style={styles.headerRightPlaceholder} />
        </View>

        <View style={styles.content}>
          <FlatList
            data={CONDITION_OPTIONS}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => {
              const isSelected = selected === item.value;
              return (
                <TouchableOpacity
                  style={[styles.optionRow, isSelected && styles.optionRowSelected]}
                  onPress={() => setSelected(item.value)}
                  activeOpacity={0.7}
                >
                  <Text
                    variant="body"
                    style={[
                      styles.optionLabel,
                      isSelected && styles.optionLabelSelected
                    ]}
                  >
                    {item.label}
                  </Text>
                  {isSelected && (
                    <Feather
                      name="check"
                      size={18}
                      color={theme.colors.primary}
                    />
                  )}
                </TouchableOpacity>
              );
            }}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            contentContainerStyle={styles.listContent}
          />
        </View>

        <View
          style={[
            styles.footer,
            { paddingBottom: insets.bottom + 24 }
          ]}
        >
          <Button
            title="Confirmer"
            onPress={handleConfirm}
            variant="primary"
            disabled={!selected}
            textStyle={{ fontWeight: '700' }}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgroundWhite
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
    flex: 1
  },
  listContent: {
    paddingHorizontal: theme.spacing.horizontalPadding,
    paddingTop: 8,
    paddingBottom: 16
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.horizontalPadding
  },
  optionRowSelected: {
    borderRadius: theme.radius.cardRadius,
    backgroundColor: theme.colors.googleWhite,
    paddingHorizontal: 8
  },
  optionLabel: {
    ...theme.typography.body,
    color: theme.colors.textPrimary
  },
  optionLabelSelected: {
    color: theme.colors.textPrimary,
    fontFamily: theme.fontFamily.semiBold
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: -theme.spacing.horizontalPadding
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

