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
import { FLOATING_TAB_BAR_BOTTOM_RESERVE, HIT_SLOP_COMFORTABLE } from '../../lib/touchTargets';
import { useFiltersScreenStore } from '../../lib/store/useFiltersScreenStore';
import {
  getBrands,
  getBrandNameCountsInCategory,
  getCategoryFilterContext,
  genderDisplayLabelFr
} from '../../lib/api/filters';
import { navigateAfterFilterCommit } from '../../lib/navigation/filterExit';

type BrandRow = {
  id: number;
  name: string;
  count: number;
};

type BrandSection = {
  key: string;
  title: string | null;
  rows: BrandRow[];
};

export default function BrandFilterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { filters, setFilter } = useFiltersScreenStore();

  const params = useLocalSearchParams<{
    gender?: string;
    type?: string;
    title?: string;
    returnTo?: string;
    resultsSection?: string;
    resultsQuery?: string;
    resultsTitle?: string;
  }>();

  const genderParam = typeof params.gender === 'string' ? params.gender : undefined;
  const typeParam = typeof params.type === 'string' ? params.type : undefined;
  const headerTitle = typeof params.title === 'string' ? params.title : 'Brand';

  const [brandSections, setBrandSections] = useState<BrandSection[]>([]);
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>(filters.brandIds ?? []);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleBrand = (id: number) => {
    const nextId = String(id);
    setSelectedBrandIds((prev) =>
      prev.includes(nextId) ? prev.filter((b) => b !== nextId) : [...prev, nextId]
    );
  };

  const handleClearAll = () => {
    setSelectedBrandIds([]);
  };

  const handleShowResult = () => {
    setFilter('brandIds', selectedBrandIds);
    navigateAfterFilterCommit(router, typeof params.returnTo === 'string' ? params.returnTo : undefined);
  };

  const loadBrands = async () => {
    try {
      setLoading(true);
      setError(null);

      const categoryId = filters.categoryId;

      if (!categoryId) {
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
        setBrandSections([{ key: 'all', title: null, rows: mapped }]);
        return;
      }

      const ctx = await getCategoryFilterContext(categoryId);
      const g = ctx?.gender ?? genderParam ?? undefined;
      const t = ctx?.type ?? typeParam ?? undefined;

      const catCounts = await getBrandNameCountsInCategory(String(categoryId));
      const data = await getBrands(g, t, { categoryIdForCounts: String(categoryId) });

      let mapped: BrandRow[] = (data as any[]).map((row) => {
        const rawCount = typeof row.items_count === 'number' ? row.items_count : 0;
        const count = rawCount < 0 ? 0 : rawCount;
        return {
          id: row.id as number,
          name: row.name as string,
          count
        };
      });

      if (!t && catCounts.size > 0) {
        const inCategory = new Set(catCounts.keys());
        mapped = mapped.filter((b) => inCategory.has(b.name));
      }
      const namesOrdered = [...catCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name);
      const byName = new Map(mapped.map((b) => [b.name, b]));

      const popularRows: BrandRow[] = [];
      for (const name of namesOrdered) {
        const b = byName.get(name);
        const c = catCounts.get(name) ?? 0;
        if (b && c > 0) {
          popularRows.push({ ...b, count: c });
        }
      }

      const popularIds = new Set(popularRows.map((r) => r.id));
      const restRows = mapped
        .filter((b) => !popularIds.has(b.id))
        .sort((a, b) => a.name.localeCompare(b.name));

      const genderLabel = genderDisplayLabelFr((ctx?.gender ?? genderParam) ?? null);
      const sections: BrandSection[] = [];

      if (popularRows.length > 0) {
        sections.push({
          key: 'popular',
          title: `Popular for ${genderLabel}`,
          rows: popularRows
        });
      }

      const allRows =
        popularRows.length > 0
          ? restRows
          : [...mapped].sort((a, b) => {
              if (b.count !== a.count) return b.count - a.count;
              return a.name.localeCompare(b.name);
            });

      sections.push({
        key: 'all',
        title: popularRows.length > 0 ? 'All brands' : null,
        rows: allRows
      });

      setBrandSections(sections);
    } catch {
      setError('Unable to load brands. Please try again.');
      setBrandSections([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBrands();
  }, [
    genderParam,
    typeParam,
    filters.categoryId,
    filters.sizeIds,
    filters.colorIds,
    filters.conditionIds,
    filters.priceMin,
    filters.priceMax
  ]);

  const filteredSections = useMemo(() => {
    const q = search.trim().toLowerCase();
    return brandSections.map((sec) => ({
      ...sec,
      rows:
        q.length === 0 ? sec.rows : sec.rows.filter((b) => b.name.toLowerCase().includes(q))
    }));
  }, [brandSections, search]);

  const hasNoResults = !loading && filteredSections.every((s) => s.rows.length === 0);

  return (
    <Screen noHorizontalPadding style={{ backgroundColor: '#FFFFFF' }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <HeaderBackButton onPress={() => router.back()} />
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
              {filteredSections.map((section) => (
                <View key={section.key} style={styles.brandSection}>
                  {section.title ? (
                    <Text variant="captionSm" style={styles.brandSectionTitle}>
                      {section.title}
                    </Text>
                  ) : null}
                  {section.rows.map((brand) => {
                    const checked = selectedBrandIds.includes(String(brand.id));
                    const disabled = brand.count === 0;
                    return (
                      <TouchableOpacity
                        key={`${section.key}-${brand.id}`}
                        style={[styles.row, disabled && styles.rowDisabled]}
                        activeOpacity={disabled ? 1 : 0.7}
                        disabled={disabled}
                        onPress={() => toggleBrand(brand.id)}
                      >
                        <View style={styles.rowTextContainer}>
                          <Text
                            variant="body"
                            style={[styles.rowLabel, disabled && styles.rowLabelDisabled]}
                          >
                            {brand.name}
                          </Text>
                          <Text
                            variant="body"
                            style={[styles.rowCount, disabled && styles.rowLabelDisabled]}
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
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        <View
          style={[
            styles.footer,
            { paddingBottom: insets.bottom + 24 + FLOATING_TAB_BAR_BOTTOM_RESERVE }
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
  brandSection: {
    marginBottom: 8
  },
  brandSectionTitle: {
    color: '#999999',
    fontSize: 13,
    fontWeight: '600',
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 0
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

