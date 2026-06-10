import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../../../components/ui/Screen';
import { Text } from '../../../../components/ui/Text';
import { Button } from '../../../../components/ui/Button';
import { HeaderBackButton } from '../../../../components/ui/HeaderBackButton';
import { theme } from '../../../../lib/theme';
import { getChildCategories } from '../../../../lib/api/filters';
import { useEditListingFormStore } from '../../../../lib/store/editListingForm';
import type { SellCategoryType } from '../../../../lib/store/sellForm';
import { supabase } from '../../../../lib/supabase';
import { useTranslation } from 'react-i18next';
import { translateCategoryLabel } from '../../../../lib/categoryI18n';

type CategoryRow = { id: number; name: string; slug?: string | null };

function inferTypeFromParentSlug(
  parentSlug?: string | null
): SellCategoryType {
  const s = (parentSlug ?? '').toLowerCase();
  if (s.includes('chaussures')) return 'chaussures';
  if (s.includes('pantalons')) return 'pantalons';
  if (s.includes('chemises')) return 'chemises';
  return 'vetements';
}

export default function EditListingCategoryDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    parentId?: string;
    title?: string;
    categorySlug?: string;
    gender?: string;
  }>();
  const parentId = params.parentId ? Number(params.parentId) : NaN;
  const headerTitle =
    translateCategoryLabel(
      { name: String(params.title ?? ''), slug: params.categorySlug },
      t
    ) || t('sell.category');
  const gender = typeof params.gender === 'string' ? params.gender : undefined;

  const { setField } = useEditListingFormStore();
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [parentSlug, setParentSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(parentId)) return;

    const load = async () => {
      try {
        setLoading(true);
        const { data: parentRow } = await supabase
          .from('categories')
          .select('slug')
          .eq('id', parentId)
          .maybeSingle();
        setParentSlug((parentRow as { slug?: string } | null)?.slug ?? null);

        const data = await getChildCategories(parentId);
        setCategories(
          (data as { id: number; name: string; slug?: string }[]).map((row) => ({
            id: row.id,
            name: row.name,
            slug: row.slug ?? null
          }))
        );
      } catch {
        setCategories([]);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [parentId]);

  const handleConfirm = () => {
    if (!selectedId || !gender) return;
    const cat = categories.find((c) => c.id === selectedId);
    if (!cat) return;

    setField('category', { id: cat.id, name: cat.name, gender });
    setField('categoryGender', gender);
    setField('categoryType', inferTypeFromParentSlug(parentSlug));

    router.back();
    router.back();
    router.back();
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

        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.list}>
              {categories.map((cat) => {
                const checked = selectedId === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={styles.row}
                    activeOpacity={0.7}
                    onPress={() => setSelectedId(cat.id)}
                  >
                    <Text variant="body" style={styles.rowLabel}>
                      {translateCategoryLabel({ name: cat.name, slug: cat.slug }, t)}
                    </Text>
                    <View style={[styles.radio, checked && styles.radioChecked]} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
          <Button
            title={t('common.confirm')}
            onPress={handleConfirm}
            variant="primary"
            disabled={!selectedId}
            style={styles.showResultButton}
            textStyle={styles.showResultText}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5'
  },
  headerTitle: {
    ...theme.typography.body,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary
  },
  headerRightPlaceholder: { width: 24 },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
  list: { paddingBottom: 24 },
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
  rowLabel: { ...theme.typography.body, color: theme.colors.textPrimary, fontSize: 16 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#CCCCCC',
    backgroundColor: '#FFFFFF'
  },
  radioChecked: { borderColor: '#C3EA4F', backgroundColor: '#C3EA4F' },
  footer: { paddingHorizontal: 16 },
  showResultButton: { height: 52, borderRadius: 14, backgroundColor: '#C3EA4F' },
  showResultText: { fontSize: 16, fontWeight: '700', color: theme.colors.appleBlack },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' }
});
