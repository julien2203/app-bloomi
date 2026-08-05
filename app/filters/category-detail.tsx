import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/ui/Screen';
import { Text } from '../../components/ui/Text';
import { Button } from '../../components/ui/Button';
import { HeaderBackButton } from '../../components/ui/HeaderBackButton';
import { theme } from '../../lib/theme';
import { getFilterFooterPaddingBottom } from '../../lib/touchTargets';
import { useFiltersScreenStore } from '../../lib/store/useFiltersScreenStore';
import { getChildCategories, getDescendantCategoryIds } from '../../lib/api/filters';
import { useFilterExit } from '../../lib/navigation/filterExit';
import { translateCategoryLabel } from '../../lib/categoryI18n';
import { useTranslation } from 'react-i18next';

type CategoryRow = {
  id: string | number;
  name: string;
  slug?: string | null;
};

function buildAllParentLabel(
  parentTitle: string,
  parentSlug: string | undefined,
  t: (key: string, options?: any) => string
): string {
  const trimmed = parentTitle.trim();
  if (!trimmed) return t('filters.allItems');
  const lower = trimmed.toLowerCase();
  if (lower === 'women' || lower === 'woman') return t('filters.allGenderItems.woman');
  if (lower === 'men' || lower === 'man') return t('filters.allGenderItems.men');
  if (lower === 'kids' || lower === 'kid') return t('filters.allGenderItems.kids');
  if (lower === 'baby' || lower === 'babies') return t('filters.allGenderItems.baby');
  const label = translateCategoryLabel({ name: trimmed, slug: parentSlug }, t);
  return t('filters.allFor', { value: label });
}

export default function CategoryDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    parentId?: string;
    title?: string;
    categorySlug?: string;
    gender?: string;
    returnTo?: string;
    resultsSection?: string;
    resultsQuery?: string;
    resultsTitle?: string;
  }>();
  const parentKey =
    typeof params.parentId === 'string' && params.parentId.trim() !== ''
      ? params.parentId.trim()
      : undefined;
  const headerTitle = translateCategoryLabel(
    { name: String(params.title ?? ''), slug: params.categorySlug },
    t
  ) || t('filters.category');
  const gender = params.gender as string | undefined;

  const { filters, setFilter } = useFiltersScreenStore();
  const { navigateAfterFilterCommit } = useFilterExit();
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [allParentCategoryIds, setAllParentCategoryIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([...(filters.categoryIds ?? [])]);
  const [loading, setLoading] = useState(false);

  const toggleCategory = (id: string | number) => {
    const next = String(id);
    setSelectedIds((prev) =>
      prev.includes(next) ? prev.filter((v) => v !== next) : [...prev, next]
    );
  };

  const handleShowResult = () => {
    setFilter('categoryIds', selectedIds);
    navigateAfterFilterCommit(typeof params.returnTo === 'string' ? params.returnTo : undefined);
  };

  const handleSelectAllParentItems = () => {
    const allSelected =
      allParentCategoryIds.length > 0 &&
      allParentCategoryIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !allParentCategoryIds.includes(id)));
      return;
    }
    setSelectedIds((prev) => Array.from(new Set([...prev, ...allParentCategoryIds])));
  };

  useEffect(() => {
    if (!parentKey) return;

    const load = async () => {
      try {
        setLoading(true);
        const data = await getChildCategories(parentKey);
        let mapped = (data as any[]).map((row) => ({
          id: row.id as number,
          name: row.name as string,
          slug: (row.slug as string | undefined) ?? null
        }));

        const normalizedHeader = String(params.title ?? '').trim().toLowerCase();
        const isWomenOthers =
          gender === 'femme' && (normalizedHeader === 'other' || normalizedHeader === 'others');

        if (isWomenOthers) {
          mapped = mapped.filter((cat) => cat.name.trim().toLowerCase() !== 'influencers picks');
        }

        setCategories(mapped);
        const descendants = await getDescendantCategoryIds([parentKey]);
        setAllParentCategoryIds(descendants);
      } catch {
        setCategories([]);
        setAllParentCategoryIds([]);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [parentKey]);

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

        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.list}>
              <TouchableOpacity
                style={styles.row}
                activeOpacity={0.7}
                onPress={handleSelectAllParentItems}
              >
                <Text variant="body" style={styles.rowLabel}>
                  {buildAllParentLabel(String(params.title ?? ''), params.categorySlug, t)}
                </Text>
                <View
                  style={[
                    styles.checkbox,
                    allParentCategoryIds.length > 0 &&
                    allParentCategoryIds.every((id) => selectedIds.includes(id))
                      ? styles.checkboxChecked
                      : null
                  ]}
                >
                  {allParentCategoryIds.length > 0 &&
                  allParentCategoryIds.every((id) => selectedIds.includes(id)) ? (
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  ) : null}
                </View>
              </TouchableOpacity>
              {categories.map((cat) => {
                const checked = selectedIds.includes(String(cat.id));
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={styles.row}
                    activeOpacity={0.7}
                    onPress={() => toggleCategory(cat.id)}
                  >
                    <Text variant="body" style={styles.rowLabel}>
                      {translateCategoryLabel({ name: cat.name, slug: cat.slug }, t)}
                    </Text>
                    <View
                      style={[
                        styles.checkbox,
                        checked && styles.checkboxChecked
                      ]}
                    >
                      {checked && (
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
  headerRightPlaceholder: {
    width: 24
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8
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
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5'
  },
  rowLabel: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    fontSize: 16
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  }
});

