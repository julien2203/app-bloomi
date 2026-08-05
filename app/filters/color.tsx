import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../components/ui/Screen';
import { Text } from '../../components/ui/Text';
import { Button } from '../../components/ui/Button';
import { HeaderBackButton } from '../../components/ui/HeaderBackButton';
import { theme } from '../../lib/theme';
import { getFilterFooterPaddingBottom, HIT_SLOP_COMFORTABLE } from '../../lib/touchTargets';
import { useFiltersScreenStore } from '../../lib/store/useFiltersScreenStore';
import { getColors } from '../../lib/api/filters';
import { sortColorsOtherLast, translateColorName } from '../../lib/colorI18n';
import { useFilterExit } from '../../lib/navigation/filterExit';
import { useTranslation } from 'react-i18next';

type ColorRow = {
  id: number;
  name: string;
  hex: string | null;
  count: number;
};

export default function ColorFilterScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    returnTo?: string;
    resultsSection?: string;
    resultsQuery?: string;
    resultsTitle?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { filters, setFilter } = useFiltersScreenStore();
  const { navigateAfterFilterCommit } = useFilterExit();

  const [colors, setColors] = useState<ColorRow[]>([]);
  const [selectedColorIds, setSelectedColorIds] = useState<string[]>([...(filters.colorIds ?? [])]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleColor = (id: number) => {
    const nextId = String(id);
    setSelectedColorIds((prev) =>
      prev.includes(nextId) ? prev.filter((c) => c !== nextId) : [...prev, nextId]
    );
  };

  const handleClearAll = () => {
    setSelectedColorIds([]);
  };

  const handleShowResult = () => {
    setFilter('colorIds', selectedColorIds);
    navigateAfterFilterCommit(typeof params.returnTo === 'string' ? params.returnTo : undefined);
  };

  const loadColors = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await getColors({
        categoryIdsForCounts: (filters.categoryIds ?? [])
          .map((id) => String(id).trim())
          .filter(Boolean)
      });

      const mapped: ColorRow[] = (data as any[]).map((row) => {
        const rawCount = typeof row.items_count === 'number' ? row.items_count : 0;
        const count = rawCount < 0 ? 0 : rawCount;
        return {
          id: row.id as number,
          name: row.name as string,
          hex: (row.hex as string | null) ?? null,
          count
        };
      });

      const enabled = mapped.filter((c) => c.count > 0);
      const disabled = mapped.filter((c) => c.count === 0);

      enabled.sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
      });

      disabled.sort((a, b) => a.name.localeCompare(b.name));

      setColors(sortColorsOtherLast([...enabled, ...disabled]));
    } catch {
      setError(t('filters.colorsLoadError'));
      setColors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadColors();
  }, [filters.categoryIds, filters.sizeIds, filters.brandIds, filters.conditionIds, filters.priceMin, filters.priceMax]);

  const hasNoResults = !loading && colors.length === 0;

  return (
    <Screen noHorizontalPadding style={{ backgroundColor: '#FFFFFF' }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <HeaderBackButton onPress={() => router.back()} />
          <Text variant="body" style={styles.headerTitle}>
            {t('filters.color')}
          </Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleClearAll}
            hitSlop={HIT_SLOP_COMFORTABLE}
            style={styles.clearAllHit}
          >
            <Text variant="body" style={styles.clearAllText}>
              {t('filters.clearAll')}
            </Text>
          </TouchableOpacity>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text variant="captionSm" color="textSecondary" style={styles.errorText}>
              {error}
            </Text>
            <TouchableOpacity onPress={loadColors} activeOpacity={0.7}>
              <Text variant="captionSm" color="primary">
                {t('common.retry')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.content}>
          {loading ? (
            <ScrollView contentContainerStyle={styles.list}>
              {Array.from({ length: 10 }).map((_, index) => (
                <View key={index} style={[styles.row, styles.skeletonRow]}>
                  <View style={styles.skeletonLabel} />
                  <View style={styles.skeletonCheckbox} />
                </View>
              ))}
            </ScrollView>
          ) : hasNoResults ? (
            <View style={styles.emptyContainer}>
              <Text variant="body" color="textSecondary">
                {t('filters.noColorsFound')}
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.list}>
              {colors.map((color) => {
                const checked = selectedColorIds.includes(String(color.id));
                const disabled = color.count === 0;
                return (
                  <TouchableOpacity
                    key={color.id}
                    style={[styles.row, disabled && styles.rowDisabled]}
                    activeOpacity={disabled ? 1 : 0.7}
                    disabled={disabled}
                    onPress={() => toggleColor(color.id)}
                  >
                    <View style={styles.rowTextContainer}>
                      <Text
                        variant="body"
                        style={[
                          styles.rowLabel,
                          disabled && styles.rowLabelDisabled
                        ]}
                      >
                        {translateColorName(color.name, t)}
                      </Text>
                      <Text
                        variant="body"
                        style={[
                          styles.rowCount,
                          disabled && styles.rowLabelDisabled
                        ]}
                      >
                        {color.count > 500 ? ' (500+)' : ` (${color.count})`}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.checkbox,
                        checked && styles.checkboxChecked,
                        disabled && styles.checkboxDisabled
                      ]}
                    >
                      {checked && !disabled && (
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        <View
          style={[
            styles.footer,
            { paddingBottom: getFilterFooterPaddingBottom(insets) }
          ]}
        >
          <Button
            title={t('filters.showResult')}
            onPress={handleShowResult}
            variant="primary"
            style={styles.showResultButton}
            textStyle={styles.showResultText}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
    backgroundColor: '#FFFFFF'
  },
  headerTitle: {
    ...theme.typography.body,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary
  },
  clearAllHit: {
    minHeight: 44,
    justifyContent: 'center'
  },
  clearAllText: {
    ...theme.typography.body,
    fontSize: 16,
    color: theme.colors.textPrimary
  },
  errorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  errorText: {
    marginBottom: 4
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 4
  },
  list: {
    paddingBottom: 24
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: -20,
    paddingLeft: 20,
    paddingRight: 32,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5'
  },
  rowDisabled: {
    opacity: 0.4
  },
  rowTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1
  },
  rowLabel: {
    ...theme.typography.body,
    fontSize: 16,
    color: theme.colors.textPrimary
  },
  rowLabelDisabled: {
    color: '#BBBBBB'
  },
  rowCount: {
    ...theme.typography.body,
    fontSize: 16,
    color: '#AAAAAA'
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CCCCCC',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkboxChecked: {
    borderColor: '#C3EA4F',
    backgroundColor: '#C3EA4F'
  },
  checkboxDisabled: {
    borderColor: '#DDDDDD',
    backgroundColor: '#F2F2F2'
  },
  footer: {
    paddingHorizontal: 16
  },
  showResultButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#C3EA4F'
  },
  showResultText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.appleBlack
  },
  skeletonRow: {
    borderBottomColor: '#F0F0F0'
  },
  skeletonLabel: {
    width: 160,
    height: 14,
    borderRadius: 4,
    backgroundColor: '#E5E5E5'
  },
  skeletonCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#E5E5E5'
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  }
});

