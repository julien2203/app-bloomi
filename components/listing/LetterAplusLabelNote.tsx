import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../ui/Text';

type Props = {
  style?: object;
};

/** Note affichée quand le format Lettre A+ est utilisé. */
export function LetterAplusLabelNote({ style }: Props) {
  const { t } = useTranslation();

  return (
    <View style={[styles.wrap, style]} accessibilityRole="text">
      <Text variant="captionSm" style={styles.text}>
        {t('sell.parcelSize.letterAplusLabelNote')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FDE68A'
  },
  text: {
    color: '#92400E',
    lineHeight: 18
  }
});
