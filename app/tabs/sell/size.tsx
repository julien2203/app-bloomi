import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../lib/theme';
import { Button } from '../../../components/ui/Button';
import { Screen } from '../../../components/ui/Screen';
import { Text } from '../../../components/ui/Text';
import { useSellFormStore } from '../../../lib/store/sellForm';
import { HeaderBackButton } from '../../../components/ui/HeaderBackButton';
import { getSizes } from '../../../lib/api/filters';

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

  if (g === 'enfant' && t === 'vetements') return 'Kids';
  if (g === 'enfant' && t === 'chaussures') return 'Kids shoes';

  if (g === 'bebe' && t === 'vetements') return 'Baby';
  if (g === 'bebe' && t === 'chaussures') return 'Baby shoes';

  return 'Other';
}

export default function SellSizeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
          const title = getSectionTitle(rowGender, type);

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
  }, [values.categoryGender, values.categoryType, values.category]);

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
            Size
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
                            {row.label}
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
            title="Confirmer"
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

