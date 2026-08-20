/**
 * Contenus des bottom-sheets de filtres (Condition, Color, Price, Size, Brand, Category).
 * Chaque composant est autonome : il reçoit les filtres courants et un callback onApply.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../lib/theme';
import { Text } from '../ui/Text';
import {
  FILTER_CONDITION_VALUES,
  normalizeConditionFilterSelection,
  translateConditionDescription,
  translateConditionLabel,
  type FilterConditionValue
} from '../../lib/conditionI18n';
import { getColors, getSizes, getBrands, resolveCategoryFilterContext, getDescendantCategoryIds, getRootCategoriesByGender } from '../../lib/api/filters';
import { sortColorsOtherLast, translateColorName } from '../../lib/colorI18n';
import { translateSizeLabel } from '../../lib/sizeI18n';
import { dedupeBrandsByName } from '../../lib/edit-listing/dedupeBrands';
import { translateCategoryLabel } from '../../lib/categoryI18n';
import { UI_TO_DB_GENDER, FILTER_GENDER_OPTIONS, type FilterGenderKey } from '../../lib/filterGenderParams';
import { getPriceBounds } from '../../lib/api';
import type { FeedFilters } from '../../lib/store/feedFilters';
import { HIT_SLOP_COMFORTABLE } from '../../lib/touchTargets';

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function SheetHeader({
  title,
  onClearAll
}: {
  title: string;
  onClearAll: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={shared.header}>
      <Text style={shared.headerTitle}>{title}</Text>
      <TouchableOpacity
        onPress={onClearAll}
        hitSlop={HIT_SLOP_COMFORTABLE}
        activeOpacity={0.7}
      >
        <Text style={shared.clearAllText}>{t('filters.clearAll')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function SheetFooter({ onApply }: { onApply: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={shared.footer}>
      <TouchableOpacity
        style={shared.applyBtn}
        onPress={onApply}
        activeOpacity={0.85}
        accessibilityRole="button"
      >
        <Text style={shared.applyBtnText}>{t('filters.showResult')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function CheckRow({
  label,
  subtitle,
  checked,
  onPress
}: {
  label: string;
  subtitle?: string;
  checked: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={shared.row} onPress={onPress} activeOpacity={0.7}>
      <View style={shared.rowLabels}>
        <Text style={shared.rowLabel} numberOfLines={1}>
          {label}
        </Text>
        {subtitle ? (
          <Text style={shared.rowSubLabel} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={[shared.checkbox, checked && shared.checkboxChecked]}>
        {checked ? <Ionicons name="checkmark" size={14} color={theme.colors.googleWhite} /> : null}
      </View>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// ConditionSheet
// ---------------------------------------------------------------------------

export type ConditionSheetProps = {
  currentConditionIds: string[];
  onApply: (conditionIds: string[]) => void;
};

export function ConditionSheet({ currentConditionIds, onApply }: ConditionSheetProps) {
  const { t } = useTranslation();
  const conditions = useMemo(
    () =>
      FILTER_CONDITION_VALUES.map((value) => ({
        value,
        label: translateConditionLabel(value, t),
        description: translateConditionDescription(value, t)
      })),
    [t]
  );
  const [selected, setSelected] = useState<FilterConditionValue[]>(() =>
    normalizeConditionFilterSelection(currentConditionIds)
  );

  useEffect(() => {
    setSelected(normalizeConditionFilterSelection(currentConditionIds));
  }, [currentConditionIds]);

  const toggle = (value: FilterConditionValue) =>
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    );

  return (
    <>
      <SheetHeader title={t('filters.condition')} onClearAll={() => setSelected([])} />
      <ScrollView style={shared.scroll} contentContainerStyle={shared.scrollContent}>
        {conditions.map((cond) => (
          <CheckRow
            key={cond.value}
            label={cond.label}
            subtitle={cond.description.length > 0 ? cond.description : undefined}
            checked={selected.includes(cond.value)}
            onPress={() => toggle(cond.value)}
          />
        ))}
      </ScrollView>
      <SheetFooter onApply={() => onApply(selected)} />
    </>
  );
}

// ---------------------------------------------------------------------------
// ColorSheet
// ---------------------------------------------------------------------------

type ColorRow = { id: number; name: string; hex: string | null; count: number };

export type ColorSheetProps = {
  currentColorIds: string[];
  categoryIds: string[];
  onApply: (colorIds: string[]) => void;
};

export function ColorSheet({ currentColorIds, categoryIds, onApply }: ColorSheetProps) {
  const { t } = useTranslation();
  const [colors, setColors] = useState<ColorRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([...currentColorIds]);

  useEffect(() => {
    setSelected([...currentColorIds]);
  }, [currentColorIds]);

  // Stable key pour éviter les boucles de useCallback/useEffect sur des tableaux recréés.
  const categoryIdsKey = categoryIds.join(',');

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        const data = await getColors({
          categoryIdsForCounts: categoryIds.map((id) => String(id).trim()).filter(Boolean)
        });
        if (cancelled) return;
        const mapped: ColorRow[] = (data as any[]).map((row) => ({
          id: row.id as number,
          name: row.name as string,
          hex: (row.hex as string | null) ?? null,
          count: typeof row.items_count === 'number' ? Math.max(0, row.items_count) : 0
        }));
        const enabled = mapped.filter((c) => c.count > 0).sort((a, b) => b.count - a.count);
        const disabled = mapped.filter((c) => c.count === 0).sort((a, b) => a.name.localeCompare(b.name));
        setColors(sortColorsOtherLast([...enabled, ...disabled]));
      } catch {
        if (!cancelled) setColors([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryIdsKey]);

  const toggle = (id: number) => {
    const sid = String(id);
    setSelected((prev) => prev.includes(sid) ? prev.filter((c) => c !== sid) : [...prev, sid]);
  };

  return (
    <>
      <SheetHeader title={t('filters.color')} onClearAll={() => setSelected([])} />
      {loading ? (
        <View style={shared.loadingBox}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView style={shared.scroll} contentContainerStyle={shared.scrollContent}>
          {colors.map((color) => (
            <TouchableOpacity
              key={color.id}
              style={shared.row}
              onPress={() => toggle(color.id)}
              activeOpacity={0.7}
            >
              <View style={styles.colorSwatch}>
                {color.hex ? (
                  <View style={[styles.swatchCircle, { backgroundColor: color.hex }]} />
                ) : (
                  <View style={[styles.swatchCircle, styles.swatchNoHex]} />
                )}
              </View>
              <Text style={[shared.rowLabel, { flex: 1 }]} numberOfLines={1}>
                {translateColorName(color.name, t)}
              </Text>
              <View style={[shared.checkbox, selected.includes(String(color.id)) && shared.checkboxChecked]}>
                {selected.includes(String(color.id)) ? (
                  <Ionicons name="checkmark" size={14} color={theme.colors.googleWhite} />
                ) : null}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      <SheetFooter onApply={() => onApply(selected)} />
    </>
  );
}

// ---------------------------------------------------------------------------
// PriceSheet
// ---------------------------------------------------------------------------

export type PriceSheetProps = {
  currentPriceMin: number | null;
  currentPriceMax: number | null;
  filters: FeedFilters;
  onApply: (min: number | null, max: number | null) => void;
};

export function PriceSheet({ currentPriceMin, currentPriceMax, filters, onApply }: PriceSheetProps) {
  const { t } = useTranslation();
  const [min, setMin] = useState(currentPriceMin != null ? String(currentPriceMin) : '');
  const [max, setMax] = useState(currentPriceMax != null ? String(currentPriceMax) : '');
  const [minPh, setMinPh] = useState('0');
  const [maxPh, setMaxPh] = useState('500');

  useEffect(() => {
    setMin(currentPriceMin != null ? String(currentPriceMin) : '');
    setMax(currentPriceMax != null ? String(currentPriceMax) : '');
  }, [currentPriceMin, currentPriceMax]);

  useEffect(() => {
    getPriceBounds(filters)
      .then(({ min: lo, max: hi }) => {
        if (lo != null) setMinPh(String(Math.round(lo)));
        if (hi != null) setMaxPh(String(Math.round(hi)));
      })
      .catch(() => {});
  }, [filters]);

  const PRICE_OPTIONS = useMemo(
    () => [
      { label: t('filters.lessThan50'), min: undefined, max: 50 },
      { label: t('filters.range50to100'), min: 50, max: 100 },
      { label: t('filters.moreThan100'), min: 100, max: undefined }
    ],
    [t]
  );

  const applyPreset = (opt: { min?: number; max?: number }) => {
    setMin(opt.min !== undefined ? String(opt.min) : '');
    setMax(opt.max !== undefined ? String(opt.max) : '');
    Keyboard.dismiss();
  };

  const handleApply = () => {
    const parsedMin = min.trim().length > 0 && Number.isFinite(Number(min)) ? Number(min) : null;
    const parsedMax = max.trim().length > 0 && Number.isFinite(Number(max)) ? Number(max) : null;
    onApply(parsedMin, parsedMax);
  };

  return (
    <>
      <SheetHeader title={t('filters.price')} onClearAll={() => { setMin(''); setMax(''); }} />
      <ScrollView
        style={shared.scroll}
        contentContainerStyle={[shared.scrollContent, { gap: theme.spacing.gapMd }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Presets */}
        <View style={styles.pricePresetsRow}>
          {PRICE_OPTIONS.map((opt) => {
            const isActive =
              (opt.min !== undefined ? String(opt.min) : '') === min &&
              (opt.max !== undefined ? String(opt.max) : '') === max;
            return (
              <TouchableOpacity
                key={opt.label}
                style={[styles.pricePreset, isActive && styles.pricePresetActive]}
                onPress={() => applyPreset(opt)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pricePresetText, isActive && styles.pricePresetTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Min / Max inputs */}
        <View style={styles.priceRow}>
          <View style={styles.priceField}>
            <Text style={styles.priceLabel}>{t('filters.priceFrom')}</Text>
            <TextInput
              style={styles.priceInput}
              keyboardType="numeric"
              value={min}
              onChangeText={setMin}
              placeholder={minPh}
              placeholderTextColor={theme.colors.sectionLabel}
              returnKeyType="next"
            />
          </View>
          <View style={styles.priceDivider} />
          <View style={styles.priceField}>
            <Text style={styles.priceLabel}>{t('filters.priceTo')}</Text>
            <TextInput
              style={styles.priceInput}
              keyboardType="numeric"
              value={max}
              onChangeText={setMax}
              placeholder={maxPh}
              placeholderTextColor={theme.colors.sectionLabel}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />
          </View>
        </View>
      </ScrollView>
      <SheetFooter onApply={handleApply} />
    </>
  );
}

// ---------------------------------------------------------------------------
// SizeSheet
// ---------------------------------------------------------------------------

type SizeRow = { id: number; label: string; count: number; sortOrder: number };
type SizeSection = { title?: string; rows: SizeRow[] };

function getSizeSectionTitle(
  gender: string | null | undefined,
  type: string | null | undefined,
  t: (key: string) => string
): string {
  const g = gender ?? 'all';
  const tp = type ?? 'all';
  if (g === 'femme' && tp === 'vetements') return t('filters.sizeSections.womanItems');
  if (g === 'femme' && tp === 'chaussures') return t('filters.sizeSections.womanShoes');
  if (g === 'homme' && tp === 'vetements') return t('filters.sizeSections.menClothing');
  if (g === 'homme' && tp === 'pantalons') return t('filters.sizeSections.menPants');
  if (g === 'homme' && tp === 'chemises') return t('filters.sizeSections.menShirts');
  if (g === 'homme' && tp === 'chaussures') return t('filters.sizeSections.menShoes');
  if (g === 'enfant' && tp === 'vetements') return t('filters.sizeSections.kids');
  if (g === 'enfant' && tp === 'chaussures') return t('filters.sizeSections.kidsShoes');
  if (g === 'bebe' && tp === 'vetements') return t('filters.sizeSections.baby');
  if (g === 'bebe' && tp === 'chaussures') return t('filters.sizeSections.babyShoes');
  return t('filters.other');
}

export type SizeSheetProps = {
  currentSizeIds: string[];
  categoryIds: string[];
  onApply: (sizeIds: string[]) => void;
};

export function SizeSheet({ currentSizeIds, categoryIds, onApply }: SizeSheetProps) {
  const { t } = useTranslation();
  const [sections, setSections] = useState<SizeSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([...currentSizeIds]);

  useEffect(() => {
    setSelected([...currentSizeIds]);
  }, [currentSizeIds]);

  const categoryIdsKey = categoryIds.join(',');

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        const catIds = categoryIds.map((id) => String(id).trim()).filter(Boolean);
        let gender: string | undefined;
        let type: string | undefined;
        let catForCounts: string[] | undefined;
        if (catIds.length > 0) {
          catForCounts = catIds;
          const ctx = await resolveCategoryFilterContext(catIds);
          if (ctx?.gender) gender = ctx.gender;
          if (ctx?.type) type = ctx.type;
        }
        const data = await getSizes(gender, type, { categoryIdsForCounts: catForCounts ?? null });
        if (cancelled) return;
        const byTitle: Record<string, SizeRow[]> = {};
        (data as any[]).forEach((row) => {
          const title = getSizeSectionTitle(row.gender, row.type, t);
          const count = typeof row.items_count === 'number' ? Math.max(0, row.items_count) : 0;
          if (!byTitle[title]) byTitle[title] = [];
          byTitle[title].push({ id: row.id, label: row.label, count, sortOrder: row.sort_order ?? 0 });
        });
        const ORDER = [
          t('filters.sizeSections.womanItems'), t('filters.sizeSections.womanShoes'),
          t('filters.sizeSections.menClothing'), t('filters.sizeSections.menPants'),
          t('filters.sizeSections.menShirts'), t('filters.sizeSections.menShoes'),
          t('filters.sizeSections.kids'), t('filters.sizeSections.kidsShoes'),
          t('filters.sizeSections.baby'), t('filters.sizeSections.babyShoes'),
          t('filters.other')
        ];
        const built = Object.entries(byTitle)
          .map(([title, rows]) => ({ title, rows: rows.sort((a, b) => a.sortOrder - b.sortOrder) }))
          .sort((a, b) => {
            const ia = ORDER.indexOf(a.title ?? '');
            const ib = ORDER.indexOf(b.title ?? '');
            return (ia === -1 ? ORDER.length : ia) - (ib === -1 ? ORDER.length : ib);
          });
        setSections(built);
      } catch {
        if (!cancelled) setSections([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryIdsKey, t]);

  const toggle = (id: number) => {
    const sid = String(id);
    setSelected((prev) => prev.includes(sid) ? prev.filter((s) => s !== sid) : [...prev, sid]);
  };

  return (
    <>
      <SheetHeader title={t('filters.size')} onClearAll={() => setSelected([])} />
      {loading ? (
        <View style={shared.loadingBox}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView style={shared.scroll} contentContainerStyle={shared.scrollContent}>
          {sections.map((sec) => (
            <View key={sec.title ?? 'default'}>
              {sec.title ? (
                <Text style={styles.sectionTitle}>{sec.title}</Text>
              ) : null}
              {sec.rows.map((row) => (
                <CheckRow
                  key={row.id}
                  label={translateSizeLabel(row.label, t)}
                  checked={selected.includes(String(row.id))}
                  onPress={() => toggle(row.id)}
                />
              ))}
            </View>
          ))}
        </ScrollView>
      )}
      <SheetFooter onApply={() => onApply(selected)} />
    </>
  );
}

// ---------------------------------------------------------------------------
// BrandSheet
// ---------------------------------------------------------------------------

type BrandRow = { id: number; name: string; count: number };
type BrandSection = { key: string; title: string | null; rows: BrandRow[] };

export type BrandSheetProps = {
  currentBrandIds: string[];
  categoryIds: string[];
  onApply: (brandIds: string[]) => void;
};

export function BrandSheet({ currentBrandIds, categoryIds, onApply }: BrandSheetProps) {
  const { t } = useTranslation();
  const [sections, setSections] = useState<BrandSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([...currentBrandIds]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setSelected([...currentBrandIds]);
  }, [currentBrandIds]);

  const categoryIdsKey = categoryIds.join(',');

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        const catIds = categoryIds.map((id) => String(id).trim()).filter(Boolean);
        if (catIds.length === 0) {
          const data = await getBrands(undefined, undefined);
          if (cancelled) return;
          const mapped: BrandRow[] = dedupeBrandsByName(
            (data as { id: number; name: string; items_count?: number }[]).map((row) => ({
              id: row.id,
              name: row.name,
              count: typeof row.items_count === 'number' ? Math.max(0, row.items_count) : 0
            }))
          ).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
          setSections([{ key: 'all', title: null, rows: mapped }]);
          return;
        }
        const ctx = await resolveCategoryFilterContext(catIds);
        const data = await getBrands(ctx?.gender, ctx?.type, { categoryIdsForCounts: catIds });
        if (cancelled) return;
        const mapped: BrandRow[] = dedupeBrandsByName(
          (data as { id: number; name: string; items_count?: number }[]).map((row) => ({
            id: row.id,
            name: row.name,
            count: typeof row.items_count === 'number' ? Math.max(0, row.items_count) : 0
          }))
        )
          .filter((b) => b.count > 0)
          .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
        setSections([{ key: 'available', title: null, rows: mapped }]);
      } catch {
        if (!cancelled) setSections([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryIdsKey]);

  const toggle = (id: number) => {
    const sid = String(id);
    setSelected((prev) => prev.includes(sid) ? prev.filter((b) => b !== sid) : [...prev, sid]);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sections;
    return sections.map((sec) => ({
      ...sec,
      rows: sec.rows.filter((b) => b.name.toLowerCase().includes(q))
    }));
  }, [sections, search]);

  return (
    <>
      <SheetHeader title={t('filters.brand')} onClearAll={() => setSelected([])} />
      {/* Search input */}
      <View style={styles.brandSearch}>
        <Ionicons name="search" size={16} color={theme.colors.sectionLabel} style={styles.brandSearchIcon} />
        <TextInput
          style={styles.brandSearchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={t('filters.searchBrands')}
          placeholderTextColor={theme.colors.sectionLabel}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>
      {loading ? (
        <View style={shared.loadingBox}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView style={shared.scroll} contentContainerStyle={shared.scrollContent} keyboardShouldPersistTaps="handled">
          {filtered.map((sec) =>
            sec.rows.map((brand) => (
              <CheckRow
                key={brand.id}
                label={brand.name}
                checked={selected.includes(String(brand.id))}
                onPress={() => toggle(brand.id)}
              />
            ))
          )}
        </ScrollView>
      )}
      <SheetFooter onApply={() => onApply(selected)} />
    </>
  );
}

// ---------------------------------------------------------------------------
// CategorySheet
// ---------------------------------------------------------------------------

type RootCategory = { id: number; name: string; slug: string };

export type CategorySheetProps = {
  currentCategoryIds: string[];
  onApply: (categoryIds: string[]) => void;
};

export function CategorySheet({ currentCategoryIds, onApply }: CategorySheetProps) {
  const { t } = useTranslation();

  // Step : 'gender' | 'subcategory'
  const [step, setStep] = useState<'gender' | 'subcategory'>('gender');
  const [selectedGender, setSelectedGender] = useState<FilterGenderKey | null>(null);
  const [categories, setCategories] = useState<RootCategory[]>([]);
  const [allGenderIds, setAllGenderIds] = useState<string[]>([]);
  const [loadingCats, setLoadingCats] = useState(false);

  const handleSelectGender = async (genderKey: FilterGenderKey) => {
    setSelectedGender(genderKey);
    setStep('subcategory');
    try {
      setLoadingCats(true);
      const dbGender = UI_TO_DB_GENDER[genderKey];
      const data = await getRootCategoriesByGender(dbGender);
      const mapped: RootCategory[] = (data as any[]).map((row) => ({
        id: row.id as number,
        name: row.name as string,
        slug: row.slug as string
      }));
      setCategories(mapped);
      const ids = await getDescendantCategoryIds(mapped.map((r) => r.id));
      setAllGenderIds(ids);
    } catch {
      setCategories([]);
      setAllGenderIds([]);
    } finally {
      setLoadingCats(false);
    }
  };

  const handleSelectAllGender = () => {
    onApply(allGenderIds);
  };

  const handleSelectCategory = async (cat: RootCategory) => {
    try {
      const ids = await getDescendantCategoryIds([cat.id]);
      onApply(ids.length > 0 ? ids : [String(cat.id)]);
    } catch {
      onApply([String(cat.id)]);
    }
  };

  const handleClearAll = () => {
    onApply([]);
  };

  if (step === 'subcategory' && selectedGender) {
    const genderLabel = FILTER_GENDER_OPTIONS.find((o) => o.genderKey === selectedGender);
    return (
      <>
        <View style={shared.header}>
          <TouchableOpacity
            style={styles.backRow}
            onPress={() => setStep('gender')}
            activeOpacity={0.7}
            hitSlop={HIT_SLOP_COMFORTABLE}
          >
            <Ionicons name="chevron-back" size={18} color={theme.colors.textPrimary} />
            <Text style={shared.headerTitle}>
              {genderLabel ? t(genderLabel.labelKey) : selectedGender}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClearAll} hitSlop={HIT_SLOP_COMFORTABLE} activeOpacity={0.7}>
            <Text style={shared.clearAllText}>{t('filters.clearAll')}</Text>
          </TouchableOpacity>
        </View>
        {loadingCats ? (
          <View style={shared.loadingBox}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : (
          <ScrollView style={shared.scroll} contentContainerStyle={shared.scrollContent}>
            {/* "Tous les articles [genre]" */}
            <TouchableOpacity style={shared.row} onPress={handleSelectAllGender} activeOpacity={0.7}>
              <Text style={[shared.rowLabel, { fontFamily: theme.fontFamily.medium }]} numberOfLines={1}>
                {t(`filters.allGenderItems.${selectedGender.toLowerCase()}`)}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.sectionLabel} />
            </TouchableOpacity>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={shared.row}
                onPress={() => void handleSelectCategory(cat)}
                activeOpacity={0.7}
              >
                <Text style={shared.rowLabel} numberOfLines={1}>
                  {translateCategoryLabel({ name: cat.name, slug: cat.slug }, t)}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.sectionLabel} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </>
    );
  }

  return (
    <>
      <SheetHeader title={t('filters.category')} onClearAll={handleClearAll} />
      <ScrollView style={shared.scroll} contentContainerStyle={shared.scrollContent}>
        {FILTER_GENDER_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.genderKey}
            style={shared.row}
            onPress={() => void handleSelectGender(opt.genderKey)}
            activeOpacity={0.7}
          >
            <Text style={shared.rowLabel} numberOfLines={1}>
              {t(opt.labelKey)}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.sectionLabel} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const shared = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingVertical: theme.spacing.gapMd,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.separator
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: theme.fontFamily.semiBold,
    color: theme.colors.textPrimary
  },
  clearAllText: {
    fontSize: 14,
    fontFamily: theme.fontFamily.medium,
    color: theme.colors.textSecondary,
    textDecorationLine: 'underline'
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: theme.spacing.gapMd
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.separator
  },
  rowLabels: {
    flex: 1,
    marginRight: theme.spacing.gapMd
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.textPrimary,
    fontFamily: theme.fontFamily.regular,
    marginRight: theme.spacing.gapMd
  },
  rowSubLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
    fontFamily: theme.fontFamily.regular
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.googleWhite,
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkboxChecked: {
    backgroundColor: theme.colors.appleBlack,
    borderColor: theme.colors.appleBlack
  },
  footer: {
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingTop: theme.spacing.gapMd
  },
  applyBtn: {
    height: theme.spacing.buttonHeight,
    borderRadius: theme.radius.button,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  applyBtnText: {
    fontSize: 16,
    fontFamily: theme.fontFamily.semiBold,
    color: theme.colors.appleBlack
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40
  }
});

const styles = StyleSheet.create({
  colorSwatch: {
    marginRight: theme.spacing.gapMd
  },
  swatchCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: theme.colors.separator
  },
  swatchNoHex: {
    backgroundColor: theme.colors.muted
  },
  sectionTitle: {
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: theme.colors.sectionLabel,
    fontFamily: theme.fontFamily.medium,
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingTop: theme.spacing.gapMd,
    paddingBottom: 6
  },
  brandSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: theme.spacing.screenPaddingX,
    marginVertical: theme.spacing.gapSm,
    height: 40,
    borderRadius: theme.radius.input,
    backgroundColor: theme.colors.muted,
    paddingHorizontal: theme.spacing.gapSm
  },
  brandSearchIcon: {
    marginRight: 6
  },
  brandSearchInput: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.textPrimary,
    fontFamily: theme.fontFamily.regular,
    padding: 0
  },
  pricePresetsRow: {
    flexDirection: 'row',
    gap: theme.spacing.gapSm,
    flexWrap: 'wrap',
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingTop: theme.spacing.gapMd
  },
  pricePreset: {
    borderWidth: 1,
    borderColor: theme.colors.separator,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: theme.colors.googleWhite
  },
  pricePresetActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  },
  pricePresetText: {
    fontSize: 13,
    color: theme.colors.textPrimary,
    fontFamily: theme.fontFamily.medium
  },
  pricePresetTextActive: {
    color: theme.colors.appleBlack
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.screenPaddingX,
    gap: theme.spacing.gapMd
  },
  priceField: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.input,
    paddingHorizontal: theme.spacing.gapMd,
    paddingVertical: 10
  },
  priceLabel: {
    fontSize: 11,
    color: theme.colors.sectionLabel,
    fontFamily: theme.fontFamily.medium,
    marginBottom: 4
  },
  priceInput: {
    fontSize: 16,
    color: theme.colors.textPrimary,
    fontFamily: theme.fontFamily.regular,
    padding: 0
  },
  priceDivider: {
    width: 16,
    height: 1,
    backgroundColor: theme.colors.separator,
    marginTop: 10
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  }
});
