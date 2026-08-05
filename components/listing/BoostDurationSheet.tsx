import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../lib/theme';
import { Text } from '../ui/Text';
import { Button } from '../ui/Button';
import { BOOST_OPTIONS, type BoostSponsorType } from '../../lib/fees';

type BoostDurationSheetProps = {
  visible: boolean;
  sponsorType: BoostSponsorType;
  paying: boolean;
  onClose: () => void;
  onConfirm: (durationDays: 3 | 7) => void;
  titleKey?: string;
};

export function BoostDurationSheet({
  visible,
  sponsorType,
  paying,
  onClose,
  onConfirm,
  titleKey
}: BoostDurationSheetProps) {
  const { t } = useTranslation();
  const [selectedDays, setSelectedDays] = useState<3 | 7 | null>(null);

  const options = BOOST_OPTIONS.filter((option) => option.sponsorType === sponsorType);

  useEffect(() => {
    if (visible) {
      setSelectedDays(null);
    }
  }, [visible, sponsorType]);

  const title = titleKey
    ? t(titleKey)
    : sponsorType === 'listing'
      ? t('profile.publicProfile.boostListingTitle')
      : t('profile.publicProfile.boostDressingTitle');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.container}>
          <View style={styles.handle} />
          <Text variant="body" style={styles.title}>
            {title}
          </Text>

          {options.map((option) => {
            const isSelected = selectedDays === option.durationDays;
            const labelKey =
              option.sponsorType === 'listing'
                ? option.durationDays === 3
                  ? 'sell.boostListing3d'
                  : 'sell.boostListing7d'
                : option.durationDays === 3
                ? 'sell.boostDressing3d'
                : 'sell.boostDressing7d';

            return (
              <TouchableOpacity
                key={`${option.sponsorType}-${option.durationDays}`}
                style={[styles.card, isSelected && styles.cardSelected]}
                activeOpacity={0.8}
                onPress={() => setSelectedDays(option.durationDays)}
              >
                <View style={styles.cardHeader}>
                  <Text variant="body" style={styles.cardTitle}>
                    {t(labelKey)}
                  </Text>
                  <Text variant="body" style={styles.cardPrice}>
                    {option.priceChf.toFixed(2)} CHF
                  </Text>
                </View>
                <Text variant="captionSm" color="textSecondary">
                  {option.sponsorType === 'listing'
                    ? t('sell.payToFeatureItem')
                    : t('sell.payToFeatureCloset')}
                </Text>
              </TouchableOpacity>
            );
          })}

          <Text variant="captionSm" color="textSecondary" style={styles.note}>
            {t('sell.boostDuration')}
          </Text>

          <Button
            title={
              paying
                ? t('common.loading')
                : selectedDays
                ? `${t('feed.checkout.pay')} ${options.find((o) => o.durationDays === selectedDays)?.priceChf.toFixed(2)} CHF`
                : t('sell.chooseOption')
            }
            onPress={() => {
              if (!paying && selectedDays) onConfirm(selectedDays);
            }}
            variant="primary"
            disabled={paying || !selectedDays}
            loading={paying}
            style={styles.payButton}
          />

          <Button
            title={t('common.cancel')}
            onPress={onClose}
            variant="secondary"
            disabled={paying}
            style={styles.cancelButton}
            textStyle={styles.cancelButtonText}
          />
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
    backgroundColor: 'rgba(0,0,0,0.35)'
  },
  container: {
    backgroundColor: theme.colors.backgroundWhite,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 8
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginBottom: 12
  },
  title: {
    fontFamily: theme.fontFamily.semiBold,
    marginBottom: 12,
    textAlign: 'center'
  },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10
  },
  cardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(195, 234, 79, 0.12)'
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  cardTitle: {
    flex: 1,
    fontFamily: theme.fontFamily.semiBold,
    marginRight: 8
  },
  cardPrice: {
    fontFamily: theme.fontFamily.semiBold
  },
  note: {
    marginBottom: 12,
    textAlign: 'center'
  },
  payButton: {
    marginBottom: 8
  },
  cancelButton: {
    borderWidth: 0,
    backgroundColor: 'transparent'
  },
  cancelButtonText: {
    color: theme.colors.textSecondary
  }
});
