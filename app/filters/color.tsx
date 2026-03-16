import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../components/ui/Screen';
import { Text } from '../../components/ui/Text';
import { Button } from '../../components/ui/Button';
import { AppIcon } from '../../components/ui/AppIcon';
import { theme } from '../../lib/theme';
import { useFeedFiltersStore } from '../../lib/store/feedFilters';
import { getColors } from '../../lib/api/filters';

type ColorRow = {
  id: number;
  name: string;
  hex: string | null;
  count: number;
};

export default function ColorFilterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { filters, setFilters } = useFeedFiltersStore();

  const [colors, setColors] = useState<ColorRow[]>([]);
  const [selectedColorIds, setSelectedColorIds] = useState<number[]>(filters.colorIds ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleColor = (id: number) => {
    setSelectedColorIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleClearAll = () => {
    setSelectedColorIds([]);
  };

  const handleShowResult = () => {
    const selectedNames = colors
      .filter((c) => selectedColorIds.includes(c.id))
      .map((c) => c.name);

    setFilters({
      colorIds: selectedColorIds.length > 0 ? selectedColorIds : undefined,
      colors: selectedNames.length > 0 ? selectedNames : undefined
    });
    router.back();
  };

  const loadColors = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await getColors();

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

      setColors([...enabled, ...disabled]);
    } catch {
      setError('Unable to load colors. Please try again.');
      setColors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadColors();
  }, [filters.categoryFilter, filters.sizeIds, filters.brandIds, filters.conditions, filters.priceRange]);

  const hasNoResults = !loading && colors.length === 0;

  return (
    <Screen noHorizontalPadding style={{ backgroundColor: '#FFFFFF' }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleShowResult}
            activeOpacity={0.7}
          >
            <AppIcon name="arrowLeftOutline" size={20} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text variant="body" style={styles.headerTitle}>
            Color
          </Text>
          <TouchableOpacity activeOpacity={0.7} onPress={handleClearAll}>
            <Text variant="body" style={styles.clearAllText}>
              Clear all
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
                Retry
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
                No colors found
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.list}>
              {colors.map((color) => {
                const checked = selectedColorIds.includes(color.id);
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
                        {color.name}
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
            { paddingBottom: insets.bottom + 24 }
          ]}
        >
          <Button
            title="Show result"
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
  backButton: {
    padding: 4
  },
  headerTitle: {
    ...theme.typography.body,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary
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
    paddingHorizontal: 20,
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

