import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../lib/theme';
import { Text } from '../ui/Text';
import {
  buildSearchSuggestions,
  SEARCH_ACTIVE_SUGGESTIONS,
  type SearchSuggestion
} from '../../lib/search/activeSuggestions';
import { fetchDeepSearchSuggestions } from '../../lib/search/fetchSearchSuggestions';
import { SEARCH_COLLECTIONS, type SearchCollection } from '../../lib/search/collections';
import { useSearchHistoryStore } from '../../lib/search/searchHistory';
import { SearchCollectionCard } from './SearchCollectionCard';
import { SearchHistoryRow } from './SearchHistoryRow';

type Props = {
  query: string;
  onSuggestionPress: (suggestion: SearchSuggestion) => void;
  onCollectionPress: (collection: SearchCollection) => void;
  onRecentPress: (query: string) => void;
  bottomInset?: number;
  /** Collections éditoriales : idle discovery uniquement (pas pendant la saisie ni en overlay). */
  showCollections?: boolean;
};

export function SearchActivePanel({
  query,
  onSuggestionPress,
  onCollectionPress,
  onRecentPress,
  bottomInset = 0,
  showCollections = true
}: Props) {
  const { t } = useTranslation();
  const [deepSuggestions, setDeepSuggestions] = useState<SearchSuggestion[] | null>(null);
  const [loadingDeep, setLoadingDeep] = useState(false);
  const reqSeq = useRef(0);
  const historyItems = useSearchHistoryStore((s) => s.items);
  const hydrateHistory = useSearchHistoryStore((s) => s.hydrate);
  const removeHistory = useSearchHistoryStore((s) => s.remove);
  const clearHistory = useSearchHistoryStore((s) => s.clear);

  useEffect(() => {
    void hydrateHistory();
  }, [hydrateHistory]);

  const localSuggestions = useMemo(
    () => buildSearchSuggestions(SEARCH_ACTIVE_SUGGESTIONS, query, (key) => t(key)),
    [query, t]
  );

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setDeepSuggestions(null);
      setLoadingDeep(false);
      return;
    }

    const seq = ++reqSeq.current;
    setLoadingDeep(true);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const rows = await fetchDeepSearchSuggestions(q, t);
          if (seq !== reqSeq.current) return;
          setDeepSuggestions(rows);
        } catch {
          if (seq !== reqSeq.current) return;
          setDeepSuggestions(null);
        } finally {
          if (seq === reqSeq.current) setLoadingDeep(false);
        }
      })();
    }, 280);

    return () => clearTimeout(timer);
  }, [query, t]);

  const suggestions = deepSuggestions ?? localSuggestions;
  const trimmedQuery = query.trim().toLowerCase();
  const recentSearches = useMemo(() => {
    if (!trimmedQuery) return historyItems;
    return historyItems.filter((item) => item.toLowerCase().includes(trimmedQuery));
  }, [historyItems, trimmedQuery]);
  const showCollectionCards = showCollections && query.trim().length === 0;

  const suggestionLabel = (item: SearchSuggestion) => {
    if (item.kind === 'query' && item.queryText) {
      return t('filters.searchForQuery', { query: item.queryText });
    }
    if ((item.kind === 'brand' || item.kind === 'listing') && item.queryText) {
      return item.queryText;
    }
    return item.labelKey ? t(item.labelKey) : item.queryText ?? '';
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset + theme.spacing.gapLg }]}
      keyboardShouldPersistTaps="always"
      keyboardDismissMode="none"
      showsVerticalScrollIndicator={false}
    >
      {recentSearches.length > 0 ? (
        <>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>{t('filters.searchRecentTitle')}</Text>
            <TouchableOpacity
              onPress={clearHistory}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t('common.clearAll')}
            >
              <Text style={styles.clearAllText}>{t('common.clearAll')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.suggestionsBlock}>
            {recentSearches.map((item, index) => (
              <SearchHistoryRow
                key={item}
                query={item}
                onPress={() => onRecentPress(item)}
                onRemove={() => removeHistory(item)}
                showSeparator={index < recentSearches.length - 1}
              />
            ))}
          </View>
        </>
      ) : null}

      <View style={[styles.sectionHeaderRow, recentSearches.length > 0 && styles.sectionHeaderSpaced]}>
        <Text style={styles.sectionLabel}>{t('filters.searchSuggestionsTitle')}</Text>
        {loadingDeep ? (
          <ActivityIndicator size="small" color={theme.colors.sectionLabel} />
        ) : null}
      </View>
      <View style={styles.suggestionsBlock}>
        {suggestions.map((item, index) => (
          <View key={item.id}>
            <TouchableOpacity
              style={styles.suggestionRow}
              onPress={() => onSuggestionPress(item)}
              activeOpacity={0.7}
            >
              <View style={styles.suggestionIconBox}>
                <Ionicons
                  name={item.kind === 'brand' ? 'pricetag-outline' : 'search'}
                  size={16}
                  color={theme.colors.sectionLabel}
                />
              </View>
              <Text style={styles.suggestionLabel} numberOfLines={1}>
                {suggestionLabel(item)}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.sectionLabel} />
            </TouchableOpacity>
            {index < suggestions.length - 1 ? <View style={styles.separator} /> : null}
          </View>
        ))}
      </View>

      {showCollectionCards ? (
        <>
          <Text style={[styles.sectionLabel, styles.collectionsLabel]}>
            {t('filters.searchCollectionsTitle')}
          </Text>
          <View style={styles.collectionsBlock}>
            {SEARCH_COLLECTIONS.map((collection) => (
              <SearchCollectionCard
                key={collection.id}
                title={t(collection.titleKey)}
                subtitle={t(collection.subtitleKey)}
                image={collection.image}
                onPress={() => onCollectionPress(collection)}
              />
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  content: {
    paddingTop: theme.spacing.gapLg
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: theme.spacing.screenPaddingX,
    marginBottom: theme.spacing.gapMd
  },
  sectionHeaderSpaced: {
    marginTop: theme.spacing.gapLg + theme.spacing.gapSm
  },
  sectionLabel: {
    ...theme.typography.captionSm,
    color: theme.colors.sectionLabel,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    fontFamily: theme.fontFamily.medium,
    paddingHorizontal: theme.spacing.screenPaddingX
  },
  clearAllText: {
    ...theme.typography.captionSm,
    color: theme.colors.textPrimary,
    fontFamily: theme.fontFamily.medium
  },
  collectionsLabel: {
    marginTop: theme.spacing.gapLg + theme.spacing.gapSm,
    marginBottom: theme.spacing.gapMd
  },
  suggestionsBlock: {
    paddingHorizontal: theme.spacing.screenPaddingX
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: theme.spacing.gapMd
  },
  suggestionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: theme.colors.muted,
    alignItems: 'center',
    justifyContent: 'center'
  },
  suggestionLabel: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    flex: 1,
    fontSize: 16
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.separator,
    marginLeft: 36 + theme.spacing.gapMd
  },
  collectionsBlock: {
    paddingHorizontal: theme.spacing.screenPaddingX,
    gap: theme.spacing.gapSm
  }
});
