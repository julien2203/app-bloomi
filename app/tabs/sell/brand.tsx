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
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../../components/ui/Screen';
import { Text } from '../../../components/ui/Text';
import { Button } from '../../../components/ui/Button';
import { HeaderBackButton } from '../../../components/ui/HeaderBackButton';
import { theme } from '../../../lib/theme';
import { useSellFormStore, type SellBrand } from '../../../lib/store/sellForm';
import { getBrands } from '../../../lib/api/filters';
import { supabase } from '../../../lib/supabase';
import { useTranslation } from 'react-i18next';

type BrandRow = {
  id: number;
  name: string;
  count: number;
};

function formatGenderLabel(g: string | null | undefined, t: (key: string) => string): string {
  switch ((g ?? '').toLowerCase()) {
    case 'femme':
      return t('filters.woman');
    case 'homme':
      return t('filters.men');
    case 'enfant':
      return t('filters.kids');
    case 'bebe':
      return t('filters.baby');
    default:
      return g ? String(g) : t('common.dash');
  }
}

export default function SellBrandScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { values, setField } = useSellFormStore();
  const gender = values.categoryGender ?? values.category?.gender;
  const type = values.categoryType;
  const headerTitle = t('sell.brand');

  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [selected, setSelected] = useState<SellBrand | null>(values.brand ?? null);

  useEffect(() => {
    const current = values.brand;
    if (!current?.name) return;
    if (typeof current.id === 'number' && current.id > 0) {
      setSelected(current);
      return;
    }
    const byName = brands.find(
      (b) => b.name.toLowerCase() === current.name.trim().toLowerCase()
    );
    if (byName) {
      setSelected({ id: byName.id, name: byName.name });
    }
  }, [brands, values.brand]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [popularBrandNames, setPopularBrandNames] = useState<Set<string>>(new Set());

  const loadBrands = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await getBrands(gender, type);

      const mapped: BrandRow[] = (data as any[]).map((row) => {
        const rawCount = typeof row.items_count === 'number' ? row.items_count : 0;
        const count = rawCount < 0 ? 0 : rawCount;
        return {
          id: row.id as number,
          name: row.name as string,
          count
        };
      });

      setBrands(mapped);
    } catch {
      setError(t('filters.brandsLoadError'));
      setBrands([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBrands();
  }, [t]);

  useEffect(() => {
    const loadPopular = async () => {
      const categoryId = values.category?.id;
      if (!categoryId) {
        setPopularBrandNames(new Set());
        return;
      }

      try {
        const { data, error: listingsError } = await supabase
          .from('listings')
          .select('brand')
          .eq('status', 'published')
          .eq('category_id', categoryId);

        if (listingsError) {
          setPopularBrandNames(new Set());
          return;
        }

        const counts: Record<string, number> = {};
        for (const row of (data ?? []) as any[]) {
          const name = (row?.brand as string | null)?.trim();
          if (!name) continue;
          counts[name] = (counts[name] ?? 0) + 1;
        }

        const ranked = Object.entries(counts)
          .sort((a, b) => {
            if (b[1] !== a[1]) return b[1] - a[1];
            return a[0].localeCompare(b[0]);
          })
          .slice(0, 12)
          .map(([name]) => name);

        setPopularBrandNames(new Set(ranked));
      } catch {
        setPopularBrandNames(new Set());
      }
    };

    void loadPopular();
  }, [values.category?.id]);

  const filteredBrands = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = brands;
    if (q.length > 0) {
      result = brands.filter((b) => b.name.toLowerCase().includes(q));
    }
    return result;
  }, [brands, search]);

  const popularBrands = useMemo(() => {
    if (search.trim().length > 0) return [];
    const picked = brands.filter((b) => popularBrandNames.has(b.name));
    picked.sort((a, b) => {
      // ordre popular: par count desc puis alpha
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });
    return picked;
  }, [brands, popularBrandNames, search]);

  const allBrands = useMemo(() => {
    const q = search.trim();
    const base = q.length > 0 ? filteredBrands : brands.filter((b) => !popularBrandNames.has(b.name));
    const copy = [...base];
    copy.sort((a, b) => a.name.localeCompare(b.name));
    return copy;
  }, [brands, filteredBrands, popularBrandNames, search]);

  const hasNoResults = !loading && filteredBrands.length === 0;

  const handleConfirm = () => {
    if (selected) {
      setField('brand', selected);
    }
    const canGoBack =
      typeof (router as { canGoBack?: () => boolean }).canGoBack === 'function'
        ? (router as { canGoBack: () => boolean }).canGoBack()
        : true;
    if (canGoBack) {
      router.back();
    } else {
      router.replace('/tabs/sell');
    }
  };

  return (
    <Screen noHorizontalPadding style={{ backgroundColor: '#FFFFFF' }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <HeaderBackButton onPress={() => router.back()} />
          <Text variant="body" style={styles.headerTitle}>
            {headerTitle}
          </Text>
          <View style={styles.headerRightPlaceholder} />
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
              {search.trim().length === 0 && popularBrands.length > 0 && (
                <Text variant="captionSm" style={styles.sectionTitle}>
                  {t('filters.popularForGender', { gender: formatGenderLabel(gender, t) })}
                </Text>
              )}

              {search.trim().length === 0 &&
                popularBrands.map((brand) => {
                  const checked = selected?.id === brand.id;
                  return (
                    <TouchableOpacity
                      key={`popular-${brand.id}`}
                      style={styles.row}
                      activeOpacity={0.7}
                      onPress={() =>
                        setSelected({
                          id: brand.id,
                          name: brand.name
                        })
                      }
                    >
                      <View style={styles.rowTextContainer}>
                        <Text variant="body" style={styles.rowLabel}>
                          {brand.name}
                        </Text>
                        <Text variant="body" style={styles.rowCount}>
                          {brand.count > 500 ? ' (500+)' : ` (${brand.count})`}
                        </Text>
                      </View>
                      <View style={[styles.radioOuter, checked && styles.radioOuterSelected]}>
                        {checked ? <View style={styles.radioInner} /> : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}

              {search.trim().length === 0 && (
                <Text variant="captionSm" style={[styles.sectionTitle, { marginTop: popularBrands.length ? 16 : 0 }]}>
                  {t('filters.allBrands')}
                </Text>
              )}

              {allBrands.map((brand) => {
                const checked = selected?.id === brand.id;
                return (
                  <TouchableOpacity
                    key={brand.id}
                    style={styles.row}
                    activeOpacity={0.7}
                    onPress={() =>
                      setSelected({
                        id: brand.id,
                        name: brand.name
                      })
                    }
                  >
                    <View style={styles.rowTextContainer}>
                      <Text variant="body" style={styles.rowLabel}>
                        {brand.name}
                      </Text>
                      <Text variant="body" style={styles.rowCount}>
                        {brand.count > 500 ? ' (500+)' : ` (${brand.count})`}
                      </Text>
                    </View>
                    <View style={[styles.radioOuter, checked && styles.radioOuterSelected]}>
                      {checked ? <View style={styles.radioInner} /> : null}
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
            title={t('common.confirm')}
            onPress={handleConfirm}
            variant="primary"
            style={styles.showResultButton}
            textStyle={styles.showResultText}
            disabled={!selected}
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
  headerRightPlaceholder: {
    width: 24
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
  sectionTitle: {
    marginTop: 12,
    marginBottom: 8,
    color: '#999999',
    marginHorizontal: -20,
    paddingHorizontal: 20
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#CCCCCC',
    alignItems: 'center',
    justifyContent: 'center'
  },
  radioOuterSelected: {
    borderColor: '#C3EA4F'
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
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


