import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../lib/theme';
import { AppIcon } from '../ui/AppIcon';
import { Button } from '../ui/Button';
import { Text } from '../ui/Text';

type Props = {
  error?: boolean;
  title: string;
  hint?: string;
  showClearFilters?: boolean;
  onClearFilters?: () => void;
  onRetry?: () => void;
  secondaryTitle?: string;
  onSecondary?: () => void;
};

export function ResultsEmptyPanel({
  error = false,
  title,
  hint,
  showClearFilters = false,
  onClearFilters,
  onRetry,
  secondaryTitle,
  onSecondary
}: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.wrap}>
      <AppIcon name="searchOutline" size={48} color="#AAAAAA" />
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={styles.actions}>
        {error && onRetry ? (
          <Button
            title={t('filters.retry')}
            onPress={onRetry}
            variant="primary"
            style={styles.actionBtn}
          />
        ) : null}
        {showClearFilters && onClearFilters ? (
          <Button
            title={t('filters.clearAll')}
            onPress={onClearFilters}
            variant="secondary"
            style={styles.actionBtn}
          />
        ) : null}
        {secondaryTitle && onSecondary ? (
          <Button
            title={secondaryTitle}
            onPress={onSecondary}
            variant="link"
            style={styles.linkBtn}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32
  },
  title: {
    marginTop: 12,
    fontSize: 16,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    fontFamily: theme.fontFamily.medium
  },
  hint: {
    marginTop: 6,
    fontSize: 14,
    color: theme.colors.sectionLabel,
    textAlign: 'center'
  },
  actions: {
    marginTop: 18,
    width: '100%',
    maxWidth: 280,
    alignItems: 'center',
    gap: 10
  },
  actionBtn: {
    width: '100%'
  },
  linkBtn: {
    width: '100%'
  }
});
