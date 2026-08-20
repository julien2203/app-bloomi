import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../components/ui/Screen';
import { Text } from '../../components/ui/Text';
import { Button } from '../../components/ui/Button';
import { theme } from '../../lib/theme';
import { getFilterFooterPaddingBottom, HIT_SLOP_COMFORTABLE } from '../../lib/touchTargets';
import type { FeedSort } from '../../lib/store/feedFilters';
import { useFiltersScreenStore } from '../../lib/store/useFiltersScreenStore';
import {
  useFilterExit,
  type FilterResultsReturnParams
} from '../../lib/navigation/filterExit';
import {
  getColors,
  getDescendantCategoryIds,
  getLuxuryCategoryTreeIds,
  getRootCategoriesByGender,
  getSizes,
  resolveCategoryFilterContext
} from '../../lib/api/filters';
import { getFeedListingsCount } from '../../lib/api';
import { UI_TO_DB_GENDER } from '../../lib/filterGenderParams';
import {
  FILTER_CONDITION_VALUES,
  type FilterConditionValue
} from '../../lib/conditionI18n';
import {
  FILTER_PRICE_SLIDER_MAX,
  FILTER_PRICE_SLIDER_MIN,
  PriceRangeSlider
} from '../../components/filters/PriceRangeSlider';
import { getSafeBottomInset } from '../../lib/safeArea';
import {
  FILTERS_PATH_SEARCH_STACK,
  filtersScreenPath,
  useFiltersStackBase
} from '../../lib/navigation/filterRoutes';
import { translateSizeLabel } from '../../lib/sizeI18n';
import { navigateToBrandFilter } from '../../lib/navigation/brandFilterNav';

type CategoryChipKey = 'Woman' | 'Men' | 'Kids' | 'Luxury';

type SizeChip = 'XS' | 'S' | 'M' | 'L' | 'XL';

type SizeGroup = {
  key: string;
  label: string;
  ids: string[];
};

const SIZE_CHIPS: SizeChip[] = ['XS', 'S', 'M', 'L', 'XL'];
const SHEET_SIZE_PREVIEW = 14;

type SheetColor = {
  key: string;
  hex: string;
  needsBorder?: boolean;
  match: (name: string, hex: string | null) => boolean;
};

/** Labels BDD type `XS (34)`, `M (38–40)` — pas seulement `XS`. */
function matchesSizeChip(label: string, chip: SizeChip): boolean {
  const u = String(label ?? '')
    .trim()
    .toUpperCase();
  if (!u) return false;
  if (u === chip) return true;
  return u.startsWith(`${chip} `) || u.startsWith(`${chip}(`);
}

function buildSizeGroups(
  rows: { id?: number | string; label?: string | null; sort_order?: number | null }[],
  t: (key: string) => string
): SizeGroup[] {
  const byKey = new Map<string, SizeGroup & { sortOrder: number }>();
  for (const row of rows) {
    const raw = String(row.label ?? '').trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    const existing = byKey.get(key);
    const id = String(row.id);
    const sortOrder =
      typeof row.sort_order === 'number' && Number.isFinite(row.sort_order) ? row.sort_order : 0;
    if (existing) {
      existing.ids.push(id);
      continue;
    }
    byKey.set(key, {
      key,
      label: translateSizeLabel(raw, t as any),
      ids: [id],
      sortOrder
    });
  }
  return [...byKey.values()]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(({ key, label, ids }) => ({ key, label, ids }));
}

const SHEET_COLORS: SheetColor[] = [
  {
    key: 'black',
    hex: theme.colors.appleBlack,
    match: (n, h) =>
      n.includes('noir') || n.includes('black') || (h ?? '').toLowerCase() === '#000000'
  },
  {
    key: 'white',
    hex: theme.colors.googleWhite,
    needsBorder: true,
    match: (n, h) =>
      n.includes('blanc') || n.includes('white') || (h ?? '').toLowerCase() === '#ffffff'
  },
  {
    key: 'red',
    hex: theme.colors.danger,
    match: (n) => n.includes('rouge') || n.includes('red')
  },
  {
    key: 'blue',
    hex: theme.colors.facebookBlue,
    match: (n) => n.includes('bleu') || n.includes('blue') || n.includes('navy')
  },
  {
    key: 'green',
    hex: theme.colors.primary,
    match: (n) => n.includes('vert') || n.includes('green') || n.includes('olive')
  },
  {
    key: 'orange',
    hex: theme.colors.textPrimary,
    match: (n) => n.includes('orange')
  },
  {
    key: 'beige',
    hex: theme.colors.sectionLabel,
    match: (n) =>
      n.includes('beige') || n.includes('tan') || n.includes('nude') || n.includes('cream')
  },
  {
    key: 'purple',
    hex: theme.colors.textSecondary,
    match: (n) =>
      n.includes('violet') || n.includes('purple') || n.includes('lilac') || n.includes('lavender')
  }
];

function setsEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((id) => setB.has(id));
}

function FilterChip({
  label,
  selected,
  onPress,
  square,
  disabled
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  square?: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.chip,
        square && styles.chipSquare,
        selected ? styles.chipSelected : styles.chipIdle,
        disabled && styles.chipDisabled
      ]}
    >
      <Text
        variant="caption"
        style={[styles.chipText, selected ? styles.chipTextSelected : styles.chipTextIdle]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function FiltersIndexScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    title?: string;
    from?: string;
    returnTo?: string;
    resultsSection?: string;
    resultsQuery?: string;
    resultsTitle?: string;
  }>();
  const { filters, setFilter, setFilters, resetFilters } = useFiltersScreenStore();
  const { navigateAfterFilterCommit, navigateBackFromFiltersIndex } = useFilterExit();
  const stackBase = useFiltersStackBase();

  const [genderIds, setGenderIds] = useState<Record<'Woman' | 'Men' | 'Kids', string[]>>({
    Woman: [],
    Men: [],
    Kids: []
  });
  const [luxuryIds, setLuxuryIds] = useState<string[]>([]);
  const [sizeGroups, setSizeGroups] = useState<SizeGroup[]>([]);
  const [sizesTruncated, setSizesTruncated] = useState(false);
  const [sizesLoading, setSizesLoading] = useState(false);
  const [colorIdMap, setColorIdMap] = useState<Record<string, string[]>>({});
  const sizeIdsRef = useRef(filters.sizeIds);
  const [catalogReady, setCatalogReady] = useState(false);
  const [sliderDragging, setSliderDragging] = useState(false);

  const [priceMin, setPriceMin] = useState(
    filters.priceMin != null ? filters.priceMin : FILTER_PRICE_SLIDER_MIN
  );
  const [priceMax, setPriceMax] = useState(
    filters.priceMax != null ? filters.priceMax : FILTER_PRICE_SLIDER_MAX
  );

  const [resultCount, setResultCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const countSeq = useRef(0);
  sizeIdsRef.current = filters.sizeIds;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [womanRoots, menRoots, kidsRoots, luxuryTree, colors] = await Promise.all([
          getRootCategoriesByGender(UI_TO_DB_GENDER.Woman),
          getRootCategoriesByGender(UI_TO_DB_GENDER.Men),
          getRootCategoriesByGender(UI_TO_DB_GENDER.Kids),
          getLuxuryCategoryTreeIds(),
          getColors()
        ]);

        const [womanIds, menIds, kidsIds] = await Promise.all([
          getDescendantCategoryIds((womanRoots as any[]).map((r) => r.id)),
          getDescendantCategoryIds((menRoots as any[]).map((r) => r.id)),
          getDescendantCategoryIds((kidsRoots as any[]).map((r) => r.id))
        ]);

        const luxury = luxuryTree;

        const nextColorMap: Record<string, string[]> = {};
        for (const swatch of SHEET_COLORS) {
          nextColorMap[swatch.key] = [];
        }
        for (const row of colors as any[]) {
          const name = String(row.name ?? '')
            .trim()
            .toLowerCase();
          const hex = (row.hex as string | null) ?? null;
          for (const swatch of SHEET_COLORS) {
            if (swatch.match(name, hex)) {
              nextColorMap[swatch.key].push(String(row.id));
            }
          }
        }

        if (cancelled) return;
        setGenderIds({ Woman: womanIds, Men: menIds, Kids: kidsIds });
        setLuxuryIds(luxury);
        setColorIdMap(nextColorMap);
        setCatalogReady(true);
      } catch {
        if (!cancelled) setCatalogReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSizesLoading(true);
      try {
        const ids = (filters.categoryIds ?? []).map((id) => String(id).trim()).filter(Boolean);
        const ctx = ids.length ? await resolveCategoryFilterContext(ids) : null;
        const rows = await getSizes(ctx?.gender ?? undefined, ctx?.type ?? undefined, {
          categoryIdsForCounts: ids.length ? ids : null
        });
        if (cancelled) return;

        let groups = buildSizeGroups(rows as any[], t);
        if (!ctx?.type) {
          const clothing = groups.filter((g) =>
            SIZE_CHIPS.some((chip) => matchesSizeChip(g.label, chip) || matchesSizeChip(g.key, chip))
          );
          if (clothing.length > 0) {
            groups = clothing;
          }
        }

        const validIds = new Set(groups.flatMap((g) => g.ids));
        const current = (sizeIdsRef.current ?? []).map(String);
        if (ctx?.type && current.length > 0) {
          const next = current.filter((id) => validIds.has(id));
          if (next.length !== current.length) {
            setFilter('sizeIds', next);
          }
        } else if (ctx?.type && groups.length === 0 && current.length > 0) {
          setFilter('sizeIds', []);
        }

        setSizesTruncated(groups.length > SHEET_SIZE_PREVIEW);
        setSizeGroups(groups.slice(0, SHEET_SIZE_PREVIEW));
      } catch {
        if (!cancelled) {
          setSizeGroups([]);
          setSizesTruncated(false);
        }
      } finally {
        if (!cancelled) setSizesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filters.categoryIds, setFilter, t]);

  useEffect(() => {
    setPriceMin(filters.priceMin != null ? filters.priceMin : FILTER_PRICE_SLIDER_MIN);
    setPriceMax(filters.priceMax != null ? filters.priceMax : FILTER_PRICE_SLIDER_MAX);
  }, [filters.priceMin, filters.priceMax]);

  const selectedCategoryChip = useMemo((): CategoryChipKey | null => {
    const ids = filters.categoryIds ?? [];
    if (ids.length === 0) return null;
    if (luxuryIds.length > 0 && setsEqual(ids, luxuryIds)) return 'Luxury';
    if (genderIds.Woman.length > 0 && setsEqual(ids, genderIds.Woman)) return 'Woman';
    if (genderIds.Men.length > 0 && setsEqual(ids, genderIds.Men)) return 'Men';
    if (genderIds.Kids.length > 0 && setsEqual(ids, genderIds.Kids)) return 'Kids';
    return null;
  }, [filters.categoryIds, genderIds, luxuryIds]);

  const selectedSizeKeys = useMemo(() => {
    const selected = new Set((filters.sizeIds ?? []).map(String));
    return sizeGroups.filter((group) => group.ids.some((id) => selected.has(id))).map((g) => g.key);
  }, [filters.sizeIds, sizeGroups]);

  const selectedColorKeys = useMemo(() => {
    const selected = new Set(filters.colorIds ?? []);
    return Object.keys(colorIdMap).filter((key) =>
      (colorIdMap[key] ?? []).some((id) => selected.has(id))
    );
  }, [filters.colorIds, colorIdMap]);

  const selectedConditions = useMemo(() => {
    const set = new Set(filters.conditionIds ?? []);
    return FILTER_CONDITION_VALUES.filter((v) => set.has(v));
  }, [filters.conditionIds]);

  const sortBy: FeedSort = (filters.sortBy as FeedSort | undefined) ?? 'recent';

  const filterResultsParams = useMemo<FilterResultsReturnParams>(
    () => ({
      ...(typeof params.resultsSection === 'string' ? { section: params.resultsSection } : {}),
      ...(typeof params.resultsQuery === 'string' ? { query: params.resultsQuery } : {}),
      ...(typeof params.resultsTitle === 'string' ? { title: params.resultsTitle } : {})
    }),
    [params.resultsQuery, params.resultsSection, params.resultsTitle]
  );

  const refreshCount = useCallback(async () => {
    const seq = ++countSeq.current;
    setCountLoading(true);
    const { count } = await getFeedListingsCount(filters);
    if (seq !== countSeq.current) return;
    setResultCount(count);
    setCountLoading(false);
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refreshCount();
    }, 300);
    return () => clearTimeout(timer);
  }, [refreshCount]);

  const toggleCategoryChip = (key: CategoryChipKey) => {
    if (selectedCategoryChip === key) {
      setFilter('categoryIds', []);
      return;
    }
    if (key === 'Luxury') {
      if (luxuryIds.length === 0) return;
      setFilter('categoryIds', [...luxuryIds]);
      return;
    }
    const ids = genderIds[key] ?? [];
    if (ids.length === 0) return;
    setFilter('categoryIds', [...ids]);
  };

  const drillParams = useMemo(
    () => ({
      ...(typeof params.returnTo === 'string' ? { returnTo: params.returnTo } : {}),
      ...(typeof params.resultsSection === 'string' ? { resultsSection: params.resultsSection } : {}),
      ...(typeof params.resultsQuery === 'string' ? { resultsQuery: params.resultsQuery } : {}),
      ...(typeof params.resultsTitle === 'string' ? { resultsTitle: params.resultsTitle } : {})
    }),
    [params.resultsQuery, params.resultsSection, params.resultsTitle, params.returnTo]
  );

  const openCategoryScreen = () => {
    router.push({
      pathname: filtersScreenPath(stackBase, 'category') as any,
      params: drillParams
    });
  };

  const openSizeScreen = () => {
    router.push({
      pathname: filtersScreenPath(stackBase, 'size') as any,
      params: drillParams
    });
  };

  const openBrandScreen = () => {
    const genderHint =
      selectedCategoryChip === 'Woman'
        ? UI_TO_DB_GENDER.Woman
        : selectedCategoryChip === 'Men'
          ? UI_TO_DB_GENDER.Men
          : selectedCategoryChip === 'Kids'
            ? UI_TO_DB_GENDER.Kids
            : undefined;
    void navigateToBrandFilter(
      router,
      stackBase,
      filters.categoryIds ?? [],
      drillParams,
      t('filters.brand'),
      { gender: genderHint }
    );
  };

  const toggleSize = (group: SizeGroup) => {
    if (group.ids.length === 0) return;
    const selected = new Set((filters.sizeIds ?? []).map(String));
    const isOn = group.ids.some((id) => selected.has(id));
    if (isOn) {
      group.ids.forEach((id) => selected.delete(id));
    } else {
      group.ids.forEach((id) => selected.add(id));
    }
    setFilter('sizeIds', Array.from(selected));
  };

  const toggleColor = (key: string) => {
    const ids = colorIdMap[key] ?? [];
    if (ids.length === 0) return;
    const selected = new Set(filters.colorIds ?? []);
    const isOn = ids.some((id) => selected.has(id));
    if (isOn) {
      ids.forEach((id) => selected.delete(id));
    } else {
      ids.forEach((id) => selected.add(id));
    }
    setFilter('colorIds', Array.from(selected));
  };

  const toggleCondition = (value: FilterConditionValue) => {
    const prev = filters.conditionIds ?? [];
    const next = prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value];
    setFilter('conditionIds', next);
  };

  const selectSort = (value: 'recent' | 'price' | 'relevance') => {
    if (value === 'recent') {
      setFilter('sortBy', 'recent');
      return;
    }
    if (value === 'relevance') {
      setFilter('sortBy', 'relevance');
      return;
    }
    if (sortBy === 'price_asc') {
      setFilter('sortBy', 'price_desc');
    } else if (sortBy === 'price_desc') {
      setFilter('sortBy', 'price_asc');
    } else {
      setFilter('sortBy', 'price_asc');
    }
  };

  const commitPrice = useCallback(
    (min: number, max: number) => {
      setFilters({
        priceMin: min <= FILTER_PRICE_SLIDER_MIN ? null : min,
        priceMax: max >= FILTER_PRICE_SLIDER_MAX ? null : max
      });
    },
    [setFilters]
  );

  const handleClearAll = () => {
    resetFilters();
    setPriceMin(FILTER_PRICE_SLIDER_MIN);
    setPriceMax(FILTER_PRICE_SLIDER_MAX);
  };

  const handleShowResult = () => {
    commitPrice(priceMin, priceMax);
    navigateAfterFilterCommit(
      typeof params.returnTo === 'string' ? params.returnTo : undefined,
      filterResultsParams
    );
  };

  const handleCloseFilters = () => {
    navigateBackFromFiltersIndex(
      typeof params.returnTo === 'string' ? params.returnTo : undefined,
      filterResultsParams
    );
  };

  const ctaTitle = useMemo(() => {
    if (countLoading || resultCount == null) {
      return t('filters.seeArticlesLoading');
    }
    if (resultCount >= 500) {
      return t('filters.seeArticlesMany');
    }
    return t('filters.seeArticles', { count: resultCount });
  }, [countLoading, resultCount, t]);

  const conditionLabels: Record<FilterConditionValue, string> = {
    new: t('filters.sheetConditionNew'),
    like_new: t('filters.sheetConditionLikeNew'),
    good: t('filters.sheetConditionGood'),
    fair: t('filters.sheetConditionFair')
  };

  const categoryChips: { key: CategoryChipKey; label: string }[] = [
    { key: 'Woman', label: t('filters.woman') },
    { key: 'Men', label: t('filters.men') },
    { key: 'Kids', label: t('filters.sheetKids') },
    { key: 'Luxury', label: t('filters.sheetLuxury') }
  ];

  const priceSortLabel =
    sortBy === 'price_desc'
      ? `${t('filters.sheetSortPrice')} ↓`
      : sortBy === 'price_asc'
        ? `${t('filters.sheetSortPrice')} ↑`
        : t('filters.sheetSortPrice');

  const footerPaddingBottom =
    stackBase === FILTERS_PATH_SEARCH_STACK
      ? getSafeBottomInset(insets.bottom) + theme.spacing.gapMd
      : getFilterFooterPaddingBottom(insets);

  return (
    <Screen
      noHorizontalPadding
      style={{ backgroundColor: theme.colors.background }}
      edges={['top', 'left', 'right']}
    >
      <View style={styles.container}>
        <View style={styles.handleWrap}>
          <View style={styles.handle} />
        </View>

        <View style={styles.header}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleCloseFilters}
            style={styles.closeButton}
            hitSlop={HIT_SLOP_COMFORTABLE}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <Feather name="x" size={22} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text variant="h2" style={styles.headerTitle}>
            {params.title || t('navigation.filters')}
          </Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleClearAll}
            hitSlop={HIT_SLOP_COMFORTABLE}
            style={styles.clearAllButton}
          >
            <Text variant="caption" style={styles.clearAll}>
              {t('filters.clearAll')}
            </Text>
          </TouchableOpacity>
        </View>

        {!catalogReady ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={theme.colors.appleBlack} />
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={!sliderDragging}
          >
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabelFlush}>{t('filters.sheetCategory')}</Text>
                <TouchableOpacity
                  onPress={openCategoryScreen}
                  hitSlop={HIT_SLOP_COMFORTABLE}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.seeAll')}
                >
                  <Text style={styles.seeAllText}>{t('common.seeAll')}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.chipWrap}>
                {categoryChips.map((chip) => {
                  const disabled =
                    chip.key === 'Luxury'
                      ? luxuryIds.length === 0
                      : (genderIds[chip.key as 'Woman' | 'Men' | 'Kids'] ?? []).length === 0;
                  return (
                    <FilterChip
                      key={chip.key}
                      label={chip.label}
                      selected={selectedCategoryChip === chip.key}
                      disabled={disabled}
                      onPress={() => toggleCategoryChip(chip.key)}
                    />
                  );
                })}
              </View>
            </View>

            <TouchableOpacity
              style={styles.navRow}
              onPress={openBrandScreen}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('filters.brand')}
            >
              <Text style={styles.navRowLabel}>{t('filters.brand')}</Text>
              <Feather name="chevron-right" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>

            {sizesLoading || sizeGroups.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionLabelFlush}>{t('filters.sheetSize')}</Text>
                  <TouchableOpacity
                    onPress={openSizeScreen}
                    hitSlop={HIT_SLOP_COMFORTABLE}
                    accessibilityRole="button"
                    accessibilityLabel={t('common.seeAll')}
                  >
                    <Text style={styles.seeAllText}>{t('common.seeAll')}</Text>
                  </TouchableOpacity>
                </View>
                {sizesLoading ? (
                  <ActivityIndicator color={theme.colors.appleBlack} />
                ) : (
                  <View style={styles.chipWrap}>
                    {sizeGroups.map((group) => (
                      <FilterChip
                        key={group.key}
                        label={group.label}
                        square={group.label.length <= 3}
                        selected={selectedSizeKeys.includes(group.key)}
                        onPress={() => toggleSize(group)}
                      />
                    ))}
                    {sizesTruncated ? (
                      <FilterChip
                        label={t('common.seeAll')}
                        selected={false}
                        onPress={openSizeScreen}
                      />
                    ) : null}
                  </View>
                )}
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t('filters.sheetColor')}</Text>
              <View style={styles.swatchRow}>
                {SHEET_COLORS.map((swatch) => {
                  const selected = selectedColorKeys.includes(swatch.key);
                  const disabled = (colorIdMap[swatch.key] ?? []).length === 0;
                  return (
                    <TouchableOpacity
                      key={swatch.key}
                      activeOpacity={0.7}
                      disabled={disabled}
                      onPress={() => toggleColor(swatch.key)}
                      style={[styles.swatchOuter, selected && styles.swatchOuterSelected]}
                    >
                      <View
                        style={[
                          styles.swatchInner,
                          { backgroundColor: swatch.hex },
                          swatch.needsBorder && styles.swatchInnerBorder,
                          disabled && styles.swatchDisabled
                        ]}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t('filters.sheetPrice')}</Text>
              <PriceRangeSlider
                minValue={priceMin}
                maxValue={priceMax}
                onChange={(min, max) => {
                  setPriceMin(min);
                  setPriceMax(max);
                }}
                onChangeEnd={commitPrice}
                onDragStateChange={setSliderDragging}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t('filters.sheetCondition')}</Text>
              <View style={styles.chipWrap}>
                {FILTER_CONDITION_VALUES.map((value) => (
                  <FilterChip
                    key={value}
                    label={conditionLabels[value]}
                    selected={selectedConditions.includes(value)}
                    onPress={() => toggleCondition(value)}
                  />
                ))}
              </View>
            </View>

            <View style={[styles.section, styles.sectionLast]}>
              <Text style={styles.sectionLabel}>{t('filters.sheetSort')}</Text>
              <View style={styles.chipRow}>
                <FilterChip
                  label={t('filters.sheetSortRecent')}
                  selected={sortBy === 'recent'}
                  onPress={() => selectSort('recent')}
                />
                <FilterChip
                  label={priceSortLabel}
                  selected={sortBy === 'price_asc' || sortBy === 'price_desc'}
                  onPress={() => selectSort('price')}
                />
                <FilterChip
                  label={t('filters.sortRelevance')}
                  selected={sortBy === 'relevance'}
                  onPress={() => selectSort('relevance')}
                />
              </View>
            </View>
          </ScrollView>
        )}

        <View style={[styles.footer, { paddingBottom: footerPaddingBottom }]}>
          <Button
            title={ctaTitle}
            onPress={handleShowResult}
            variant="primary"
            style={styles.ctaButton}
            textStyle={styles.ctaText}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: theme.spacing.gapMd,
    paddingBottom: theme.spacing.gapSm
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingBottom: theme.spacing.gapMd,
    paddingTop: theme.spacing.gapSm,
    gap: theme.spacing.gapSm
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8
  },
  headerTitle: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontFamily: theme.fontFamily.bold,
    textAlign: 'center'
  },
  clearAllButton: {
    minWidth: 40,
    alignItems: 'flex-end',
    justifyContent: 'center'
  },
  clearAll: {
    color: theme.colors.textSecondary
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingBottom: theme.spacing.gapLg
  },
  section: {
    marginBottom: theme.spacing.gapLg
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.gapMd
  },
  sectionLast: {
    marginBottom: theme.spacing.gapMd
  },
  sectionLabel: {
    ...theme.typography.captionSm,
    color: theme.colors.sectionLabel,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.gapMd,
    fontFamily: theme.fontFamily.medium
  },
  sectionLabelFlush: {
    ...theme.typography.captionSm,
    color: theme.colors.sectionLabel,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontFamily: theme.fontFamily.medium,
    flex: 1
  },
  seeAllText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontFamily: theme.fontFamily.medium
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    marginBottom: theme.spacing.gapLg,
    paddingVertical: 4
  },
  navRowLabel: {
    fontSize: 16,
    color: theme.colors.textPrimary,
    fontFamily: theme.fontFamily.medium
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.gapSm
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.gapSm
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth
  },
  chipSquare: {
    minWidth: 48,
    alignItems: 'center',
    paddingHorizontal: 14
  },
  chipSelected: {
    backgroundColor: theme.colors.appleBlack,
    borderColor: theme.colors.appleBlack
  },
  chipIdle: {
    backgroundColor: theme.colors.googleWhite,
    borderColor: theme.colors.border
  },
  chipDisabled: {
    opacity: 0.35
  },
  chipText: {
    fontFamily: theme.fontFamily.medium
  },
  chipTextSelected: {
    color: theme.colors.googleWhite
  },
  chipTextIdle: {
    color: theme.colors.textPrimary
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'center'
  },
  swatchOuter: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: 'transparent'
  },
  swatchOuterSelected: {
    borderColor: theme.colors.appleBlack,
    backgroundColor: theme.colors.googleWhite
  },
  swatchInner: {
    width: 26,
    height: 26,
    borderRadius: 13
  },
  swatchInnerBorder: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border
  },
  swatchDisabled: {
    opacity: 0.35
  },
  footer: {
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingTop: theme.spacing.gapSm,
    backgroundColor: theme.colors.background
  },
  ctaButton: {
    height: theme.spacing.buttonHeight,
    borderRadius: theme.radius.heroCta,
    backgroundColor: theme.colors.primary
  },
  ctaText: {
    ...theme.typography.button,
    fontFamily: theme.fontFamily.bold,
    color: theme.colors.appleBlack,
    textTransform: 'uppercase'
  }
});
