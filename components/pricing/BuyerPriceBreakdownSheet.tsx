import React, { useMemo } from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Text } from '../ui/Text';
import { Button } from '../ui/Button';
import { theme } from '../../lib/theme';
import { computeBuyerFees } from '../../lib/fees';
import { formatChf, formatPercent } from '../../lib/formatBuyerPrice';

type BuyerPriceBreakdownSheetProps = {
  visible: boolean;
  itemPriceChf: number;
  onClose: () => void;
};

export function BuyerPriceInfoButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={styles.infoButton}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel="Price breakdown"
    >
      <Feather name="info" size={14} color={theme.colors.textSecondary} />
    </TouchableOpacity>
  );
}

export function BuyerPriceBreakdownSheet({
  visible,
  itemPriceChf,
  onClose
}: BuyerPriceBreakdownSheetProps) {
  const { t } = useTranslation();
  const fees = useMemo(() => {
    const n = Number(itemPriceChf);
    if (!Number.isFinite(n) || n <= 0) return null;
    return computeBuyerFees(n);
  }, [itemPriceChf]);

  if (!fees) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.card}>
          <Text variant="body" style={styles.title}>
            {t('feed.pricing.breakdownTitle')}
          </Text>

          <View style={styles.row}>
            <Text variant="captionSm" color="textSecondary">
              {t('feed.pricing.itemPrice')}
            </Text>
            <Text variant="captionSm">{formatChf(fees.itemPriceChf)}</Text>
          </View>

          <View style={styles.row}>
            <Text variant="captionSm" color="textSecondary">
              {t('feed.pricing.buyerProtection', {
                percent: formatPercent(fees.protectionRate)
              })}
            </Text>
            <Text variant="captionSm">{formatChf(fees.protectionChf)}</Text>
          </View>

          <View style={styles.row}>
            <Text variant="captionSm" color="textSecondary">
              {t('feed.pricing.bankingFee', {
                percent: formatPercent(fees.bankingRate)
              })}
            </Text>
            <Text variant="captionSm">{formatChf(fees.bankingChf)}</Text>
          </View>

          <View style={[styles.row, styles.totalRow]}>
            <Text variant="body" style={styles.totalLabel}>
              {t('feed.pricing.finalPrice')}
            </Text>
            <Text variant="body" style={styles.totalValue}>
              {formatChf(fees.finalPriceChf)}
            </Text>
          </View>

          <Text variant="captionSm" color="textSecondary" style={styles.guarantee}>
            {t('feed.pricing.serviceGuarantee')}
          </Text>

          <Button title={t('common.close')} onPress={onClose} variant="google" style={styles.closeBtn} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)'
  },
  card: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingTop: 20,
    paddingBottom: 28
  },
  title: {
    fontFamily: theme.fontFamily.semiBold,
    marginBottom: 16
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border
  },
  totalLabel: {
    fontFamily: theme.fontFamily.semiBold
  },
  totalValue: {
    fontFamily: theme.fontFamily.bold
  },
  guarantee: {
    marginTop: 12,
    marginBottom: 16,
    lineHeight: 18
  },
  closeBtn: {
    marginTop: 4
  },
  infoButton: {
    marginLeft: 6,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
