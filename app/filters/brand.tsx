import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../components/ui/Screen';
import { Text } from '../../components/ui/Text';
import { Button } from '../../components/ui/Button';
import { HeaderBackButton } from '../../components/ui/HeaderBackButton';
import { theme } from '../../lib/theme';
import { HIT_SLOP_COMFORTABLE } from '../../lib/touchTargets';
import { useFeedFiltersStore } from '../../lib/store/feedFilters';
import { getBrands } from '../../lib/api/filters';

type BrandRow = {
  id: number;
  name: string;
  count: number;
};

export default function BrandFilterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { filters, setFilters } = useFeedFiltersStore();

  const params = useLocalSearchParams<{
    gender?: string;
    type?: string;
    title?: string;
  }>();

  const genderParam = typeof params.gender === 'string' ? params.gender : undefined;
  const typeParam = typeof params.type === 'string' ? params.type : undefined;
  const headerTitle = typeof params.title === 'string' ? params.title : 'Brand';

  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [selectedBrandIds, setSelectedBrandIds] = useState<number[]>(filters.brandIds ?? []);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleBrand = (id: number) => {
    setSelectedBrandIds((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]
    );
  };

  const handleClearAll = () => {
    setSelectedBrandIds([]);
  };

  const handleShowResult = () => {
    const selectedNames = brands
      .filter((b) => selectedBrandIds.includes(b.id))
      .map((b) => b.name);

    setFilters({
      brandIds: selectedBrandIds.length > 0 ? selectedBrandIds : undefined,
      brands: selectedNames.length > 0 ? selectedNames : undefined
    });
    router.back();
  };

  const loadBrands = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await getBrands(genderParam, typeParam);

      const mapped: BrandRow[] = (data as any[]).map((row) => {
        const rawCount = typeof row.items_count === 'number' ? row.items_count : 0;
        const count = rawCount < 0 ? 0 : rawCount;
        return {
          id: row.id as number,
          name: row.name as string,
          count
        };
      });

      mapped.sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
      });

      setBrands(mapped);
    } catch {
      setError('Unable to load brands. Please try again.');
      setBrands([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBrands();
  }, [filters.categoryFilter, filters.sizeIds, filters.colorIds, filters.conditions, filters.priceRange]);

  const filteredBrands = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = brands;
    if (q.length > 0) {
      result = brands.filter((b) => b.name.toLowerCase().includes(q));
    }
    return result;
  }, [brands, search]);

  const hasNoResults = !loading && filteredBrands.length === 0;

  return (
    <Screen noHorizontalPadding style={{ backgroundColor: '#FFFFFF' }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <HeaderBackButton onPress={handleShowResult} />
          <Text variant="body" style={styles.headerTitle}>
            {headerTitle}
          </Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleClearAll}
            hitSlop={HIT_SLOP_COMFORTABLE}
            style={styles.clearAllHit}
          >
            <Text variant="body" style={styles.clearAllText}>
              Clear all
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <Ionicons name="search" size={18} color="#AAAAAA" style={styles.searchIcon} />
            <TextInput
              placeholder="Search for brands"
              placeholderTextColor="#AAAAAA"
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity
                style={styles.clearSearchButton}
                onPress={() => setSearch('')}
                activeOpacity={0.7}
              >
                <Text style={styles.clearSearchText}>×</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text variant="captionSm" color="textSecondary" style={styles.errorText}>
              {error}
            </Text>
            <TouchableOpacity onPress={loadBrands} activeOpacity={0.7}>
              <Text variant="captionSm" color="primary">
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.content}>
          {loading ? (
            <ScrollView contentContainerStyle={styles.list}>
              {Array.from({ length: 8 }).map((_, index) => (
                <View key={index} style={[styles.row, styles.skeletonRow]}>
                  <View style={styles.skeletonLabel} />
                  <View style={styles.skeletonCheckbox} />
                </View>
              ))}
            </ScrollView>
          ) : hasNoResults ? (
            <View style={styles.emptyContainer}>
              <Text variant="body" color="textSecondary">
                No brands found
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.list}>
              {filteredBrands.map((brand) => {
                const checked = selectedBrandIds.includes(brand.id);
                const disabled = brand.count === 0;
                return (
                  <TouchableOpacity
                    key={brand.id}
                    style={[styles.row, disabled && styles.rowDisabled]}
                    activeOpacity={disabled ? 1 : 0.7}
                    disabled={disabled}
                    onPress={() => toggleBrand(brand.id)}
                  >
                    <View style={styles.rowTextContainer}>
                      <Text
                        variant="body"
                        style={[
                          styles.rowLabel,
                          disabled && styles.rowLabelDisabled
                        ]}
                      >
                        {brand.name}
                      </Text>
                      <Text
                        variant="body"
                        style={[
                          styles.rowCount,
                          disabled && styles.rowLabelDisabled
                        ]}
                      >
                        {brand.count > 500 ? ' (500+)' : ` (${brand.count})`}
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
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F2F2F2',
    paddingHorizontal: 8
  },
  searchIcon: {
    marginHorizontal: 4
  },
  searchInput: {
    flex: 1,
    ...theme.typography.body,
    fontSize: 15,
    color: theme.colors.textPrimary
  },
  clearSearchButton: {
    paddingHorizontal: 4,
    paddingVertical: 2
  },
  clearSearchText: {
    fontSize: 18,
    color: '#AAAAAA'
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

