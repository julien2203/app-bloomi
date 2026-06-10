import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/ui/Screen';
import { Text } from '../../components/ui/Text';
import { Button } from '../../components/ui/Button';
import { theme } from '../../lib/theme';
import { FLOATING_TAB_BAR_BOTTOM_RESERVE, HIT_SLOP_COMFORTABLE } from '../../lib/touchTargets';
import { HeaderBackButton } from '../../components/ui/HeaderBackButton';
import { useFiltersScreenStore } from '../../lib/store/useFiltersScreenStore';
import { getCategoryFilterContext, getSizes } from '../../lib/api/filters';
import { navigateAfterFilterCommit } from '../../lib/navigation/filterExit';
import { useTranslation } from 'react-i18next';

type SizeRow = {
  id: number;
  label: string;
  count: number;
  sortOrder: number;
};

type SizeSection = {
  title?: string;
  rows: SizeRow[];
};

function getSectionTitle(
  gender: string | null | undefined,
  type: string | null | undefined,
  t: (key: string) => string
): string {
  const g = gender ?? 'all';
  const typeKey = type ?? 'all';

  if (g === 'femme' && typeKey === 'vetements') return t('filters.sizeSections.womanItems');
  if (g === 'femme' && typeKey === 'chaussures') return t('filters.sizeSections.womanShoes');

  if (g === 'homme' && typeKey === 'vetements') return t('filters.sizeSections.menClothing');
  if (g === 'homme' && typeKey === 'pantalons') return t('filters.sizeSections.menPants');
  if (g === 'homme' && typeKey === 'chemises') return t('filters.sizeSections.menShirts');
  if (g === 'homme' && typeKey === 'chaussures') return t('filters.sizeSections.menShoes');

  if (g === 'enfant' && typeKey === 'vetements') return t('filters.sizeSections.kids');
  if (g === 'enfant' && typeKey === 'chaussures') return t('filters.sizeSections.kidsShoes');

  if (g === 'bebe' && typeKey === 'vetements') return t('filters.sizeSections.baby');
  if (g === 'bebe' && typeKey === 'chaussures') return t('filters.sizeSections.babyShoes');

  return t('filters.other');
}

export default function SizeFilterScreen() {
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
  const [sections, setSections] = useState<SizeSection[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([...(filters.sizeIds ?? [])]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSize = (id: number) => {
    const nextId = String(id);
    setSelectedSizes((prev) =>
      prev.includes(nextId) ? prev.filter((s) => s !== nextId) : [...prev, nextId]
    );
  };

  const handleClearAll = () => {
    setSelectedSizes([]);
  };

  const handleShowResult = () => {
    setFilter('sizeIds', selectedSizes);
    navigateAfterFilterCommit(router, typeof params.returnTo === 'string' ? params.returnTo : undefined);
  };

  const loadSizes = async () => {
    try {
      setLoading(true);
      setError(null);

      let gender: string | undefined;
      let type: string | undefined;
      let categoryIdForCounts: string | undefined;

      const categoryId = filters.categoryIds?.[0];
      if (categoryId) {
        categoryIdForCounts = String(categoryId);
        const ctx = await getCategoryFilterContext(categoryId);
        if (ctx?.gender) gender = ctx.gender;
        if (ctx?.type) type = ctx.type;
      }

      const data = await getSizes(gender, type, {
        categoryIdForCounts: categoryIdForCounts ?? null
      });

      const bySectionTitle: Record<string, SizeRow[]> = {};

      (data as any[]).forEach((row) => {
        const gender = row.gender as string | null;
        const type = row.type as string | null;
        const title = getSectionTitle(gender, type, t);

        // Si aucun count n'est fourni, considérer 0 par défaut (non cliquable)
        const rawCount = typeof row.items_count === 'number' ? row.items_count : 0;
        const count = rawCount < 0 ? 0 : rawCount;
        const sortOrder =
          typeof row.sort_order === 'number' && Number.isFinite(row.sort_order)
            ? row.sort_order
            : 0;

        if (!bySectionTitle[title]) {
          bySectionTitle[title] = [];
        }

        bySectionTitle[title].push({
          id: row.id as number,
          label: row.label as string,
          count,
          sortOrder
        });
      });

      const builtSections: SizeSection[] = Object.entries(bySectionTitle).map(
        ([title, rows]) => ({
          title,
          rows: rows.sort((a, b) => a.sortOrder - b.sortOrder)
        })
      );

      const SECTION_ORDER = [
        t('filters.sizeSections.womanItems'),
        t('filters.sizeSections.womanShoes'),
        t('filters.sizeSections.menClothing'),
        t('filters.sizeSections.menPants'),
        t('filters.sizeSections.menShirts'),
        t('filters.sizeSections.menShoes'),
        t('filters.sizeSections.kids'),
        t('filters.sizeSections.kidsShoes'),
        t('filters.sizeSections.baby'),
        t('filters.sizeSections.babyShoes'),
        t('filters.other')
      ];

      builtSections.sort((a, b) => {
        const ia = SECTION_ORDER.indexOf(a.title ?? '');
        const ib = SECTION_ORDER.indexOf(b.title ?? '');
        const aPos = ia === -1 ? SECTION_ORDER.length + 1 : ia;
        const bPos = ib === -1 ? SECTION_ORDER.length + 1 : ib;
        if (aPos !== bPos) return aPos - bPos;
        // fallback alphabétique pour les titres inconnus
        return (a.title ?? '').localeCompare(b.title ?? '');
      });

      setSections(builtSections);
    } catch (e) {
      setError(t('filters.sizesLoadError'));
      setSections([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSizes();
    // Recharger lorsque d'autres filtres changent pour mettre à jour les counts
  }, [filters.brandIds, filters.categoryIds, filters.colorIds, filters.conditionIds, filters.priceMin, filters.priceMax]);

  return (
    <Screen noHorizontalPadding style={{ backgroundColor: '#FFFFFF' }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <HeaderBackButton onPress={() => router.back()} />
          <Text variant="body" style={styles.headerTitle}>
            {t('filters.size')}
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
            <TouchableOpacity onPress={loadSizes} activeOpacity={0.7}>
              <Text variant="captionSm" color="primary">
                {t('common.retry')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.content}>
          {loading ? (
            <ScrollView contentContainerStyle={styles.list}>
              {Array.from({ length: 6 }).map((_, index) => (
                <View key={index} style={[styles.row, styles.skeletonRow]}>
                  <View style={styles.skeletonLabel} />
                  <View style={styles.skeletonCheckbox} />
                </View>
              ))}
            </ScrollView>
          ) : (
            <ScrollView contentContainerStyle={styles.list}>
              {sections.map((section, index) => (
                <View
                  key={`${section.title ?? 'section'}-${index}`}
                  style={[
                    styles.section,
                    index > 0 && styles.sectionSpacing
                  ]}
                >
                  {section.title && (
                    <Text
                      variant="captionSm"
                      style={styles.sectionTitle}
                    >
                      {section.title}
                    </Text>
                  )}
                  {section.rows.map((row) => {
                    const disabled = row.count === 0;
                    const checked = selectedSizes.includes(String(row.id));
                    return (
                      <TouchableOpacity
                        key={row.id}
                        style={[styles.row, disabled && styles.rowDisabled]}
                        activeOpacity={disabled ? 1 : 0.7}
                        disabled={disabled}
                        onPress={() => toggleSize(row.id)}
                      >
                        <View style={styles.rowTextContainer}>
                          <Text
                            variant="body"
                            style={[
                              styles.rowLabel,
                              disabled && styles.rowLabelDisabled
                            ]}
                          >
                            {row.label}
                          </Text>
                          <Text
                            variant="body"
                            style={[
                              styles.rowStock,
                              disabled && styles.rowLabelDisabled
                            ]}
                          >
                            {row.count > 500 ? ' (500+)' : ` (${row.count})`}
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8
  },
  list: {
    paddingBottom: 24
  },
  section: {},
  sectionSpacing: {
    marginTop: 12
  },
  sectionTitle: {
    color: '#999999',
    fontSize: 13,
    paddingTop: 20,
    paddingBottom: 8
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
  rowStock: {
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
  errorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  errorText: {
    marginBottom: 4
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
  }
});

