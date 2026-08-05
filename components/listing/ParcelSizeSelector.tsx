import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../ui/Text';
import { theme } from '../../lib/theme';
import type { ParcelSizeValue } from '../../lib/store/sellForm';
import { useParcelShippingFees } from '../../lib/useParcelShippingFees';
import { formatChf } from '../../lib/formatBuyerPrice';
import { LetterAplusLabelNote } from './LetterAplusLabelNote';

const PARCEL_SIZE_OPTIONS: { value: ParcelSizeValue; labelKey: string }[] = [
  { value: 'letter_aplus', labelKey: 'sell.parcelSize.letterAplus' },
  { value: 'small', labelKey: 'sell.parcelSize.small' },
  { value: 'large', labelKey: 'sell.parcelSize.large' },
  { value: 'xlarge', labelKey: 'sell.parcelSize.xlarge' }
];

type ParcelSizeSelectorProps = {
  selected?: ParcelSizeValue;
  onSelect: (value: ParcelSizeValue) => void;
  error?: string;
};

export function ParcelSizeSelector({ selected, onSelect, error }: ParcelSizeSelectorProps) {
  const { t } = useTranslation();
  const { quotes, loading } = useParcelShippingFees();

  return (
    <View style={styles.parcelSection}>
      <Text style={styles.parcelSectionTitle}>{t('sell.parcelSize.title')}</Text>
      {PARCEL_SIZE_OPTIONS.map((option, index) => {
        const isSelected = selected === option.value;
        const quote = quotes[option.value];
        const shippingLabel =
          loading && !quote
            ? '…'
            : quote
              ? t('sell.parcelSize.shippingSuffix', {
                  price: formatChf(quote.feeChf)
                })
              : null;

        return (
          <React.Fragment key={option.value}>
            {index > 0 ? <View style={styles.parcelSeparator} /> : null}
            <TouchableOpacity
              style={[styles.parcelOptionRow, isSelected && styles.parcelOptionRowSelected]}
              onPress={() => onSelect(option.value)}
              activeOpacity={0.7}
            >
              <View style={styles.parcelLabelCol}>
                <Text
                  style={[
                    styles.parcelOptionLabel,
                    isSelected && styles.parcelOptionLabelSelected
                  ]}
                >
                  {t(option.labelKey)}
                  {shippingLabel ? (
                    <Text
                      style={[
                        styles.parcelShippingSuffix,
                        isSelected && styles.parcelOptionLabelSelected
                      ]}
                    >
                      {' '}
                      {shippingLabel}
                    </Text>
                  ) : null}
                </Text>
              </View>
              <View style={[styles.parcelRadioOuter, isSelected && styles.parcelRadioOuterSelected]}>
                {isSelected ? <View style={styles.parcelRadioInner} /> : null}
              </View>
            </TouchableOpacity>
          </React.Fragment>
        );
      })}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {selected === 'letter_aplus' ? (
        <LetterAplusLabelNote style={styles.letterAplusNote} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  parcelSection: {
    marginTop: 8,
    marginBottom: 16
  },
  parcelSectionTitle: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    fontFamily: theme.fontFamily.semiBold,
    marginBottom: 8
  },
  parcelOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8
  },
  parcelOptionRowSelected: {
    borderRadius: theme.radius.cardRadius,
    backgroundColor: '#C3EA4F'
  },
  parcelLabelCol: {
    flex: 1,
    marginRight: 12
  },
  parcelOptionLabel: {
    ...theme.typography.body,
    color: theme.colors.textPrimary
  },
  parcelShippingSuffix: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    fontFamily: theme.fontFamily.regular
  },
  parcelOptionLabelSelected: {
    fontFamily: theme.fontFamily.semiBold
  },
  parcelRadioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#CCCCCC',
    alignItems: 'center',
    justifyContent: 'center'
  },
  parcelRadioOuterSelected: {
    borderColor: theme.colors.textPrimary
  },
  parcelRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.textPrimary
  },
  parcelSeparator: {
    height: 1,
    backgroundColor: theme.colors.border
  },
  error: {
    ...theme.typography.caption,
    color: '#EF4444',
    marginTop: 4
  },
  letterAplusNote: {
    marginTop: 10
  }
});
