import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/ui/Screen';
import { Text } from '../../components/ui/Text';
import { Button } from '../../components/ui/Button';
import { theme } from '../../lib/theme';
import { HIT_SLOP_COMFORTABLE } from '../../lib/touchTargets';
import { HeaderBackButton } from '../../components/ui/HeaderBackButton';
import { useFeedFiltersStore } from '../../lib/store/feedFilters';
import { getSizes } from '../../lib/api/filters';

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

function getSectionTitle(gender?: string | null, type?: string | null): string {
  const g = gender ?? 'all';
  const t = type ?? 'all';

  if (g === 'femme' && t === 'vetements') return "Woman's items";
  if (g === 'femme' && t === 'chaussures') return "Woman's shoes";

  if (g === 'homme' && t === 'vetements') return "Men's clothing";
  if (g === 'homme' && t === 'pantalons') return "Men's pants & jeans";
  if (g === 'homme' && t === 'chemises') return "Men's shirts (collar)";
  if (g === 'homme' && t === 'chaussures') return "Men's shoes";

  if (g === 'enfant' && t === 'vetements') return "Kids";
  if (g === 'enfant' && t === 'chaussures') return "Kids shoes";

  if (g === 'bebe' && t === 'vetements') return 'Baby';
  if (g === 'bebe' && t === 'chaussures') return 'Baby shoes';

  return 'Other';
}

export default function SizeFilterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    returnTo?: string;
    resultsSection?: string;
    resultsQuery?: string;
    resultsTitle?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { filters, setFilters } = useFeedFiltersStore();
  const [sections, setSections] = useState<SizeSection[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<number[]>(filters.sizeIds ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSize = (id: number) => {
    setSelectedSizes((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleClearAll = () => {
    setSelectedSizes([]);
  };

  const handleShowResult = () => {
    setFilters({
      sizeIds: selectedSizes.length > 0 ? selectedSizes : undefined
    });
    if (params.returnTo === 'results') {
      router.replace({
        pathname: '/tabs/results' as any,
        params: {
          section: typeof params.resultsSection === 'string' ? params.resultsSection : undefined,
          query: typeof params.resultsQuery === 'string' ? params.resultsQuery : undefined,
          title: typeof params.resultsTitle === 'string' ? params.resultsTitle : undefined
        }
      });
      return;
    }
    router.back();
  };

  const loadSizes = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await getSizes();

      const bySectionTitle: Record<string, SizeRow[]> = {};

      (data as any[]).forEach((row) => {
        const gender = row.gender as string | null;
        const type = row.type as string | null;
        const title = getSectionTitle(gender, type);

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
        "Woman's items",
        "Woman's shoes",
        "Men's clothing",
        "Men's pants & jeans",
        "Men's shirts (collar)",
        "Men's shoes",
        'Kids',
        'Kids shoes',
        'Baby',
        'Baby shoes',
        'Other'
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
      setError('Unable to load sizes. Please try again.');
      setSections([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSizes();
    // Recharger lorsque d'autres filtres changent pour mettre à jour les counts
  }, [filters.brandIds, filters.categoryFilter, filters.colorIds, filters.conditions, filters.priceRange]);

  return (
    <Screen noHorizontalPadding style={{ backgroundColor: '#FFFFFF' }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <HeaderBackButton onPress={handleShowResult} />
          <Text variant="body" style={styles.headerTitle}>
            Size
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

        {error && (
          <View style={styles.errorContainer}>
            <Text variant="captionSm" color="textSecondary" style={styles.errorText}>
              {error}
            </Text>
            <TouchableOpacity onPress={loadSizes} activeOpacity={0.7}>
              <Text variant="captionSm" color="primary">
                Retry
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
                    const checked = selectedSizes.includes(row.id);
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

