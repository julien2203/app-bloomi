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
import { useTranslation } from 'react-i18next';
import { Screen } from '../../components/ui/Screen';
import { Text } from '../../components/ui/Text';
import { Button } from '../../components/ui/Button';
import { HeaderBackButton } from '../../components/ui/HeaderBackButton';
import { theme } from '../../lib/theme';
import { getFilterFooterPaddingBottom, HIT_SLOP_COMFORTABLE } from '../../lib/touchTargets';
import { useFiltersScreenStore } from '../../lib/store/useFiltersScreenStore';
import {
  getBrands,
  getBrandNameCountsInCategory,
  getEmptyBrandCountInCategories,
  resolveCategoryFilterContext
} from '../../lib/api/filters';
import { translateFilterGenderDb } from '../../lib/filterGenderParams';
import { useFilterExit } from '../../lib/navigation/filterExit';
import { dedupeBrandsByName } from '../../lib/edit-listing/dedupeBrands';

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

const OTHER_BRAND_FILTER_ID = '__other__';

export default function BrandFilterScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { filters, setFilter } = useFiltersScreenStore();
  const { navigateAfterFilterCommit } = useFilterExit();

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
  const headerTitle = typeof params.title === 'string' ? params.title : t('filters.searchBrands');

  const [brandSections, setBrandSections] = useState<BrandSection[]>([]);
  const [otherBrandCount, setOtherBrandCount] = useState(0);
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([...(filters.brandIds ?? [])]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleBrand = (id: number | string) => {
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
    navigateAfterFilterCommit(typeof params.returnTo === 'string' ? params.returnTo : undefined);
  };

  const loadBrands = async () => {
    try {
      setLoading(true);
      setError(null);

      const selectedCategoryIds = (filters.categoryIds ?? [])
        .map((id) => String(id).trim())
        .filter(Boolean);

      if (selectedCategoryIds.length === 0) {
        setOtherBrandCount(0);
        const data = await getBrands(genderParam, typeParam);
        let mapped: BrandRow[] = dedupeBrandsByName(
          (data as { id: number; name: string; items_count?: number }[]).map((row) => {
            const rawCount = typeof row.items_count === 'number' ? row.items_count : 0;
            return {
              id: row.id,
              name: row.name,
              count: rawCount < 0 ? 0 : rawCount
            };
          })
        );
        mapped.sort((a, b) => {
          if (b.count !== a.count) return b.count - a.count;
          return a.name.localeCompare(b.name);
        });
        setBrandSections([{ key: 'all', title: null, rows: mapped }]);
        return;
      }

      const ctx = await resolveCategoryFilterContext(selectedCategoryIds);
      const g = ctx?.gender ?? genderParam ?? undefined;
      const productType = ctx?.type ?? typeParam ?? undefined;

      const [data, listingBrandCounts, emptyBrandCount] = await Promise.all([
        getBrands(g, productType, { categoryIdsForCounts: selectedCategoryIds }),
        getBrandNameCountsInCategory(selectedCategoryIds),
        getEmptyBrandCountInCategories(selectedCategoryIds)
      ]);

      let mapped: BrandRow[] = dedupeBrandsByName(
        (data as { id: number; name: string; items_count?: number }[]).map((row) => {
          const rawCount = typeof row.items_count === 'number' ? row.items_count : 0;
          return {
            id: row.id,
            name: row.name,
            count: rawCount < 0 ? 0 : rawCount
          };
        })
      );

      const catalogNames = new Set(mapped.map((b) => b.name.trim().toLowerCase()));
      let unknownBrandCount = 0;
      for (const [name, count] of listingBrandCounts.entries()) {
        if (count <= 0) continue;
        if (!catalogNames.has(name.trim().toLowerCase())) {
          unknownBrandCount += count;
        }
      }

      mapped = mapped.filter((b) => b.count > 0);
      mapped.sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
      });

      setOtherBrandCount(emptyBrandCount + unknownBrandCount);

      const genderLabel = translateFilterGenderDb((ctx?.gender ?? genderParam) ?? null, t);
      const sections: BrandSection[] = [];

      if (mapped.length > 0) {
        sections.push({
          key: 'available',
          title:
            mapped.length > 0
              ? t('filters.popularForGender', { gender: genderLabel })
              : null,
          rows: mapped
        });
      }

      setBrandSections(sections);
    } catch {
      setError(t('filters.brandsLoadError'));
      setBrandSections([]);
      setOtherBrandCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBrands();
  }, [
    genderParam,
    typeParam,
    filters.categoryIds,
    filters.sizeIds,
    filters.colorIds,
    filters.conditionIds,
    filters.priceMin,
    filters.priceMax,
    t
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
  const showOtherOption = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return t('filters.other').toLowerCase().includes(q) || 'other'.includes(q);
  }, [search, t]);

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
              {t('filters.clearAll')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <Ionicons name="search" size={18} color="#AAAAAA" style={styles.searchIcon} />
            <TextInput
              placeholder={t('filters.searchBrands')}
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
                {t('common.retry')}
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
                {t('filters.noBrandsFound')}
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
              {showOtherOption ? (
                <TouchableOpacity
                  key="brand-other"
                  style={styles.row}
                  activeOpacity={0.7}
                  onPress={() => toggleBrand(OTHER_BRAND_FILTER_ID)}
                >
                  <View style={styles.rowTextContainer}>
                    <Text variant="body" style={styles.rowLabel}>
                      {t('filters.other')}
                    </Text>
                    {otherBrandCount > 0 ? (
                      <Text variant="body" style={styles.rowCount}>
                        {otherBrandCount > 500 ? ' (500+)' : ` (${otherBrandCount})`}
                      </Text>
                    ) : null}
                  </View>
                  <View
                    style={[
                      styles.checkbox,
                      selectedBrandIds.includes(OTHER_BRAND_FILTER_ID) && styles.checkboxChecked
                    ]}
                  >
                    {selectedBrandIds.includes(OTHER_BRAND_FILTER_ID) ? (
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    ) : null}
                  </View>
                </TouchableOpacity>
              ) : null}
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

