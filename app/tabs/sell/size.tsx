import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getSafeBottomInset } from '../../../lib/safeArea';
import { theme } from '../../../lib/theme';
import { Button } from '../../../components/ui/Button';
import { Screen } from '../../../components/ui/Screen';
import { Text } from '../../../components/ui/Text';
import { useSellFormStore } from '../../../lib/store/sellForm';
import { HeaderBackButton } from '../../../components/ui/HeaderBackButton';
import { getSizes } from '../../../lib/api/filters';
import { useTranslation } from 'react-i18next';
import { translateSizeLabel } from '../../../lib/sizeI18n';

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

export default function SellSizeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const safeBottom = getSafeBottomInset(insets.bottom);
  const { values, setField } = useSellFormStore();
  const [sections, setSections] = useState<SizeSection[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(values.size?.id ?? null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const gender = values.categoryGender ?? values.category?.gender;
        const type = values.categoryType;

        const data = await getSizes(gender, type);

        const bySectionTitle: Record<string, SizeRow[]> = {};

        (data as any[]).forEach((row) => {
          const rowGender = row.gender as string | null;
          const type = row.type as string | null;
          const title = getSectionTitle(rowGender, type, t);

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
          return (a.title ?? '').localeCompare(b.title ?? '');
        });

        setSections(builtSections);
      } catch {
        setSections([]);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [t, values.categoryGender, values.categoryType, values.category]);

  useEffect(() => {
    if (selectedId != null && selectedId > 0) return;
    const label = values.size?.label?.trim();
    if (!label || sections.length === 0) return;

    for (const section of sections) {
      const row = section.rows.find(
        (r) => r.label.trim().toLowerCase() === label.toLowerCase()
      );
      if (row) {
        setSelectedId(row.id);
        break;
      }
    }
  }, [sections, selectedId, values.size?.label]);

  const handleConfirm = () => {
    if (!selectedId) return;

    let foundLabel: string | undefined;
    for (const section of sections) {
      const row = section.rows.find((r) => r.id === selectedId);
      if (row) {
        foundLabel = row.label;
        break;
      }
    }

    if (!foundLabel) return;

    setField('size', {
      id: selectedId,
      label: foundLabel
    });
    router.back();
  };

  return (
    <Screen noHorizontalPadding style={{ backgroundColor: '#FFFFFF' }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <HeaderBackButton onPress={() => router.back()} />
          <Text variant="body" style={styles.headerTitle}>
            {t('sell.size')}
          </Text>
          <View style={styles.headerRightPlaceholder} />
        </View>

        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#C3EA4F" />
            </View>
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
                    const checked = selectedId === row.id;
                    return (
                      <TouchableOpacity
                        key={row.id}
                        style={styles.row}
                        activeOpacity={0.7}
                        onPress={() => setSelectedId(row.id)}
                      >
                        <View style={styles.rowTextContainer}>
                          <Text
                            variant="body"
                            style={styles.rowLabel}
                          >
                            {translateSizeLabel(row.label, t)}
                          </Text>
                          <Text
                            variant="body"
                            style={styles.rowStock}
                          >
                            {row.count > 500 ? ' (500+)' : ` (${row.count})`}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.radioOuter,
                            checked && styles.radioOuterSelected
                          ]}
                        >
                          {checked ? <View style={styles.radioInner} /> : null}
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
            { paddingBottom: safeBottom + 24 }
          ]}
        >
          <Button
            title={t('common.confirm')}
            onPress={handleConfirm}
            variant="primary"
            disabled={!selectedId}
            textStyle={{ fontWeight: '700' }}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgroundWhite
  },
  header: {
    paddingHorizontal: theme.spacing.horizontalPadding,
    paddingTop: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerTitle: {
    ...theme.typography.body,
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.textPrimary
  },
  headerRightPlaceholder: {
    width: 32
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  footer: {
    paddingHorizontal: theme.spacing.horizontalPadding,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.backgroundWhite
  }
});

