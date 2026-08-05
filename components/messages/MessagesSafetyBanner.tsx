import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../ui/Text';
import { AppIcon } from '../ui/AppIcon';
import { theme } from '../../lib/theme';

/** Bandeau permanent de vigilance en haut de la messagerie. */
export function MessagesSafetyBanner() {
  const { t } = useTranslation();

  return (
    <View style={styles.banner} accessibilityRole="text">
      <View style={styles.iconWrap}>
        <AppIcon name="shieldCheckBold" size={16} color="#B45309" />
      </View>
      <Text variant="captionSm" style={styles.text}>
        {t('messages.safetyBanner')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFBEB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#FDE68A'
  },
  iconWrap: {
    marginTop: 1
  },
  text: {
    flex: 1,
    color: '#92400E',
    lineHeight: 18
  }
});
