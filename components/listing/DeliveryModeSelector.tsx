import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../ui/Text';
import { theme } from '../../lib/theme';
import type { ListingDeliveryMode } from '../../lib/deliveryMode';

const DELIVERY_OPTIONS: { value: ListingDeliveryMode; labelKey: string; hintKey: string }[] = [
  { value: 'both', labelKey: 'sell.deliveryMode.both', hintKey: 'sell.deliveryMode.bothHint' },
  { value: 'shipping', labelKey: 'sell.deliveryMode.shipping', hintKey: 'sell.deliveryMode.shippingHint' },
  { value: 'pickup', labelKey: 'sell.deliveryMode.pickup', hintKey: 'sell.deliveryMode.pickupHint' }
];

type DeliveryModeSelectorProps = {
  selected: ListingDeliveryMode;
  onSelect: (value: ListingDeliveryMode) => void;
  error?: string;
};

export function DeliveryModeSelector({ selected, onSelect, error }: DeliveryModeSelectorProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('sell.deliveryMode.title')}</Text>
      {DELIVERY_OPTIONS.map((option, index) => {
        const isSelected = selected === option.value;
        return (
          <React.Fragment key={option.value}>
            {index > 0 ? <View style={styles.separator} /> : null}
            <TouchableOpacity
              style={[styles.optionRow, isSelected && styles.optionRowSelected]}
              onPress={() => onSelect(option.value)}
              activeOpacity={0.7}
            >
              <View style={styles.labelCol}>
                <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                  {t(option.labelKey)}
                </Text>
                <Text style={styles.optionHint}>{t(option.hintKey)}</Text>
              </View>
              <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                {isSelected ? <View style={styles.radioInner} /> : null}
              </View>
            </TouchableOpacity>
          </React.Fragment>
        );
      })}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 8,
    marginBottom: 16
  },
  sectionTitle: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    fontFamily: theme.fontFamily.semiBold,
    marginBottom: 8
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8
  },
  optionRowSelected: {
    borderRadius: theme.radius.cardRadius,
    backgroundColor: '#C3EA4F'
  },
  labelCol: {
    flex: 1,
    marginRight: 12
  },
  optionLabel: {
    ...theme.typography.body,
    color: theme.colors.textPrimary
  },
  optionLabelSelected: {
    fontFamily: theme.fontFamily.semiBold
  },
  optionHint: {
    ...theme.typography.captionSm,
    color: theme.colors.textSecondary,
    marginTop: 2
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#CCCCCC',
    alignItems: 'center',
    justifyContent: 'center'
  },
  radioOuterSelected: {
    borderColor: theme.colors.textPrimary
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.textPrimary
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border
  },
  error: {
    ...theme.typography.caption,
    color: '#EF4444',
    marginTop: 4
  }
});
