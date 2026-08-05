import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { translateCategoryLabel } from './categoryI18n';
import { translateColorName } from './colorI18n';
import { normalizeConditionFilterSelection, translateConditionLabel } from './conditionI18n';
import { translateSizeLabel } from './sizeI18n';
import { supabase } from './supabase';
import type { FeedFilters } from './store/feedFilters';

function truncateJoined(values: string[], maxLen = 24): string {
  const joined = values.join(', ');
  if (joined.length <= maxLen) return joined;
  return `${joined.slice(0, maxLen - 1)}…`;
}

export function useFilterSummaryLabels(filters: FeedFilters) {
  const { t } = useTranslation();
  const [categoryLabel, setCategoryLabel] = useState<string | undefined>();
  const [brandLabel, setBrandLabel] = useState<string | undefined>();
  const [sizeLabel, setSizeLabel] = useState<string | undefined>();
  const [colorLabel, setColorLabel] = useState<string | undefined>();

  useEffect(() => {
    const ids = filters.categoryIds ?? [];
    if (ids.length === 0) {
      setCategoryLabel(undefined);
      return;
    }
    if (ids.length > 1) {
      setCategoryLabel(t('filters.categoriesCount', { count: ids.length }));
      return;
    }

    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from('categories')
        .select('name, slug')
        .eq('id', ids[0])
        .maybeSingle();
      if (cancelled) return;
      const row = data as { name?: string; slug?: string | null } | null;
      const name = row?.name?.trim();
      setCategoryLabel(
        name ? translateCategoryLabel({ name, slug: row?.slug }, t) : ids[0]
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [filters.categoryIds, t]);

  useEffect(() => {
    const ids = filters.brandIds ?? [];
    if (ids.length === 0) {
      setBrandLabel(undefined);
      return;
    }
    let cancelled = false;
    void (async () => {
      const nums = ids.map((id) => Number(id)).filter((n) => Number.isFinite(n));
      const { data } = await supabase
        .from('brands')
        .select('id, name')
        .in('id', nums.length ? nums : [-1]);
      if (cancelled) return;
      const byId = new Map<string, string>();
      for (const row of (data ?? []) as { id: number; name: string }[]) {
        byId.set(String(row.id), row.name);
      }
      const names = ids
        .map((id) => {
          if (id === '__other__') return t('filters.other');
          return byId.get(String(id));
        })
        .filter((n): n is string => Boolean(n));
      setBrandLabel(names.length > 0 ? truncateJoined(names) : truncateJoined(ids));
    })();
    return () => {
      cancelled = true;
    };
  }, [filters.brandIds, t]);

  useEffect(() => {
    const ids = filters.sizeIds ?? [];
    if (ids.length === 0) {
      setSizeLabel(undefined);
      return;
    }
    let cancelled = false;
    void (async () => {
      const nums = ids.map((id) => Number(id)).filter((n) => Number.isFinite(n));
      const { data } = await supabase
        .from('sizes')
        .select('id, label')
        .in('id', nums.length ? nums : [-1]);
      if (cancelled) return;
      const byId = new Map<string, string>();
      for (const row of (data ?? []) as { id: number; label: string }[]) {
        byId.set(String(row.id), row.label);
      }
      const labels = ids
        .map((id) => byId.get(String(id)))
        .filter((l): l is string => Boolean(l))
        .map((l) => translateSizeLabel(l, t));
      setSizeLabel(labels.length > 0 ? truncateJoined(labels) : truncateJoined(ids));
    })();
    return () => {
      cancelled = true;
    };
  }, [filters.sizeIds, t]);

  useEffect(() => {
    const ids = filters.colorIds ?? [];
    if (ids.length === 0) {
      setColorLabel(undefined);
      return;
    }
    let cancelled = false;
    void (async () => {
      const nums = ids.map((id) => Number(id)).filter((n) => Number.isFinite(n));
      const { data } = await supabase
        .from('colors')
        .select('id, name')
        .in('id', nums.length ? nums : [-1]);
      if (cancelled) return;
      const byId = new Map<string, string>();
      for (const row of (data ?? []) as { id: number; name: string }[]) {
        byId.set(String(row.id), row.name);
      }
      const names = ids.map((id) => byId.get(String(id))).filter((n): n is string => Boolean(n));
      const labels = names.map((n) => translateColorName(n, t));
      setColorLabel(labels.length > 0 ? truncateJoined(labels) : truncateJoined(ids));
    })();
    return () => {
      cancelled = true;
    };
  }, [filters.colorIds, t]);

  const conditionLabel = useMemo(() => {
    const ids = normalizeConditionFilterSelection(filters.conditionIds ?? []);
    if (ids.length === 0) return undefined;
    const labels = ids.map((v) => translateConditionLabel(v, t));
    return truncateJoined(labels);
  }, [filters.conditionIds, t]);

  return { categoryLabel, brandLabel, sizeLabel, colorLabel, conditionLabel };
}
