import React from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Text } from '../ui/Text';
import { Button } from '../ui/Button';
import { theme } from '../../lib/theme';

type BuyerPriceInfoSheetProps = {
  visible: boolean;
  onClose: () => void;
};

export function BuyerPriceInfoButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={styles.infoButton}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel={t('feed.pricing.infoA11y')}
    >
      <Feather name="info" size={14} color={theme.colors.textSecondary} />
    </TouchableOpacity>
  );
}

/** Infos prix acheteur (sans détail des frais). */
export function BuyerPriceBreakdownSheet({ visible, onClose }: BuyerPriceInfoSheetProps) {
  const { t } = useTranslation();

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.card}>
          <Text variant="body" style={styles.title}>
            {t('feed.pricing.infoTitle')}
          </Text>

          <Text variant="captionSm" color="textSecondary" style={styles.description}>
            {t('feed.pricing.infoDescription')}
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
    marginBottom: 12
  },
  description: {
    lineHeight: 20,
    marginBottom: 20
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
