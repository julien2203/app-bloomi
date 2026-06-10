import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../lib/theme';
import { Text } from '../ui/Text';

interface SectionHeaderProps {
  title: string;
  onPressSeeAll?: () => void;
  titleColor?: string;
}

export function SectionHeader({ title, onPressSeeAll, titleColor }: SectionHeaderProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Text variant="h3" style={[styles.title, titleColor ? { color: titleColor } : null]}>
        {title}
      </Text>
      {onPressSeeAll && (
        <TouchableOpacity onPress={onPressSeeAll} activeOpacity={0.7}>
          <Text variant="caption" color="textSecondary">
            {t('common.seeAll')}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.screenPaddingX,
    marginTop: theme.spacing.gapLg,
    marginBottom: 0
  },
  title: {
    fontFamily: theme.fontFamily.medium,
    color: theme.colors.primary
  }
});

