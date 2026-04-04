import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Keyboard,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  BackHandler
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Screen } from '../../../components/ui/Screen';
import { Text } from '../../../components/ui/Text';
import { theme } from '../../../lib/theme';
import { AppIcon } from '../../../components/ui/AppIcon';
import { ProductCard } from '../../../components/ProductCard';
import { supabase } from '../../../lib/supabase';
import type { FeedListing } from '../../../lib/api';
import { useFeedFiltersStore } from '../../../lib/store/feedFilters';
import { HIT_SLOP_COMFORTABLE, HEADER_ICON_TOUCH_CONTAINER } from '../../../lib/touchTargets';

type SearchListing = FeedListing & {
  likes_count?: number | null;
};

const PAGE_SIZE = 20;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_PADDING_X = 16;
const GRID_GAP = 8;
const GRID_CARD_WIDTH = (SCREEN_WIDTH - GRID_PADDING_X * 2 - GRID_GAP) / 2;

type SuggestionType = 'category_with_pill' | 'category' | 'term' | 'search';

type Suggestion = {
  id: string;
  label: string;
  pillLabel?: string;
  type: SuggestionType;
  categorySlug?: string | null;
  parentCategorySlug?: string | null;
};

export default function SearchScreen() {
  const router = useRouter();
  const { filters } = useFeedFiltersStore();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [resultCount, setResultCount] = useState<number | null>(null);

  const pageRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const effectiveFilters = filters;

  const [showSuggestions, setShowSuggestions] = useState(false);

  const isSuggestMode = query.trim().length > 0 && showSuggestions;

  const loadPage = useCallback(
    async (page: number, replace: boolean) => {
      if (page === 0) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        let queryBuilder = supabase
          .from('v_feed_listings')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, to);

        if (query.trim().length > 0) {
          const pattern = `%${query.trim()}%`;
          queryBuilder = queryBuilder.or(
            `title.ilike.${pattern},brand.ilike.${pattern},description.ilike.${pattern}`
          );
        }

        if (effectiveFilters.category) {
          queryBuilder = queryBuilder.eq('category', effectiveFilters.category);
        }
        if (effectiveFilters.conditions && effectiveFilters.conditions.length > 0) {
          queryBuilder = queryBuilder.in('condition', effectiveFilters.conditions);
        }
        if (effectiveFilters.priceMin !== undefined) {
          queryBuilder = queryBuilder.gte('price', effectiveFilters.priceMin);
        }
        if (effectiveFilters.priceMax !== undefined) {
          queryBuilder = queryBuilder.lte('price', effectiveFilters.priceMax);
        }

        const { data, error, count } = await queryBuilder;

        if (error) {
          console.warn('Search error:', error.message);
          if (replace) {
            setResults([]);
            setHasMore(false);
            setResultCount(0);
          }
          return;
        }

        const newItems = (data || []) as SearchListing[];
        setResults((prev) => (replace ? newItems : [...prev, ...newItems]));
        pageRef.current = page;
        setHasMore(newItems.length === PAGE_SIZE);
        setResultCount(typeof count === 'number' ? count : newItems.length);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [query, effectiveFilters]
  );

  const triggerSearch = useCallback(() => {
    pageRef.current = 0;
    void loadPage(0, true);
  }, [loadPage]);

  // Initial load (articles récents)
  useEffect(() => {
    triggerSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chargement suggestions (mode recherche)
  const loadSuggestions = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q) {
        setSuggestions([]);
        return;
      }

      setLoadingSuggestions(true);
      try {
        const pattern = `%${q}%`;

        // 1. Catégories qui matchent le texte (structure minimale: id, name, slug)
        const { data: catData, error: catError } = await supabase
          .from('categories')
          .select('id, name, slug')
          .ilike('name', pattern)
          .limit(10);

        if (catError) {
          console.warn('Search categories error:', catError.message);
        }

        const categories = (catData || []) as any[];

        const catWithoutPill: Suggestion[] = categories.map((c) => ({
          id: `cat-${c.id}`,
          label: c.name as string,
          type: 'category',
          categorySlug: c.slug ?? null
        }));

        // 2. Termes génériques depuis les listings (titres)
        const { data: listingData, error: listingError } = await supabase
          .from('listings')
          .select('id, title, brand, category')
          .or(`title.ilike.${pattern},brand.ilike.${pattern}`)
          .limit(10);

        if (listingError) {
          console.warn('Search listing terms error:', listingError.message);
        }

        const terms: Suggestion[] = (listingData || []).map((l: any) => ({
          id: `term-${l.id}`,
          label: l.title as string,
          type: 'term',
          categorySlug: l.category ?? null
        }));

        const ordered: Suggestion[] = [
          ...catWithoutPill,
          ...terms,
          {
            id: 'search-submit',
            label: `Search "${q}"`,
            type: 'search'
          }
        ];

        setSuggestions(ordered);
      } finally {
        setLoadingSuggestions(false);
      }
    },
    []
  );

  // Debounce sur la saisie: suggestions si texte, sinon recherche normale
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);

    const trimmed = query.trim();

    if (!trimmed) {
      // Retour à l'état par défaut: on vide les suggestions et on recharge la grille
      setSuggestions([]);
      setShowSuggestions(false);
      debounceRef.current = setTimeout(() => {
        triggerSearch();
      }, 300);
    } else if (showSuggestions) {
      // Mode suggestions: pas de requête grid tant que l'utilisateur n'a pas validé
      suggestDebounceRef.current = setTimeout(() => {
        void loadSuggestions(trimmed);
      }, 300);
    } else {
      // Mode résultats direct (après clic sur une suggestion)
      debounceRef.current = setTimeout(() => {
        triggerSearch();
      }, 300);
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    };
  }, [query, triggerSearch, loadSuggestions]);

  // Quand les filtres globaux changent (depuis l'écran Filters), rafraîchir la grille
  useEffect(() => {
    if (!isSuggestMode) {
      triggerSearch();
    }
  }, [effectiveFilters, isSuggestMode, triggerSearch]);

  const handleLoadMore = () => {
    if (loadingMore || loading || !hasMore) return;
    const nextPage = pageRef.current + 1;
    void loadPage(nextPage, false);
  };

  const handleClearQuery = () => {
    setQuery('');
    setShowSuggestions(false);
  };

  const handleClearAll = () => {
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handlePressFilter = (type: 'Filter' | 'Size' | 'Brand' | 'Condition' | 'Color' | 'Price') => {
    switch (type) {
      case 'Filter':
        router.push({ pathname: '/filters', params: { from: 'search' } });
        break;
      case 'Size':
        router.push({
          pathname: '/filters',
          params: { title: 'Size', from: 'search' }
        });
        break;
      case 'Brand':
        router.push({
          pathname: '/filters/brand',
          params: { from: 'search' }
        });
        break;
      case 'Condition':
        router.push({
          pathname: '/filters',
          params: { title: 'Condition', from: 'search' }
        });
        break;
      case 'Color':
        router.push({
          pathname: '/filters',
          params: { title: 'Color', from: 'search' }
        });
        break;
      case 'Price':
        router.push({
          pathname: '/filters',
          params: { title: 'Price', from: 'search' }
        });
        break;
      default:
        break;
    }
  };

  const handlePressBookmark = () => {
    // Placeholder: écran de recherches sauvegardées
    console.log('Open saved searches');
  };

  const renderItem = ({ item }: { item: SearchListing }) => (
    <View style={styles.cardWrapper}>
      <ProductCard
        listingId={item.id}
        title={item.title}
        price={item.price}
        currency="CHF"
        brand={item.brand ?? undefined}
        size={(item as any).size ?? undefined}
        condition={item.condition ?? undefined}
        imageUrl={item.cover_photo_url}
        onPress={() => router.push(`/tabs/feed/${item.id}`)}
        cardWidth={GRID_CARD_WIDTH}
        imageRatio={1}
      />
    </View>
  );

  const keyExtractor = (item: SearchListing) => item.id;

  const showEmpty = !loading && results.length === 0;

  const resultLabel = useMemo(() => {
    if (resultCount == null) return '';
    if (resultCount >= 500) return '500+ result.';
    if (resultCount === 1) return '1 result.';
    return `${resultCount} result.`;
  }, [resultCount]);

  const handlePressSuggestion = (s: Suggestion) => {
    switch (s.type) {
      case 'category_with_pill':
      case 'category': {
        // Rester sur la page Search: utiliser le label comme requête et basculer en mode résultats
        setQuery(s.label);
        setShowSuggestions(false);
        setSuggestions([]);
        pageRef.current = 0;
        triggerSearch();
        Keyboard.dismiss();
        break;
      }
      case 'term': {
        // Utiliser le terme comme requête de recherche sur cette page
        setQuery(s.label);
        setShowSuggestions(false);
        setSuggestions([]);
        pageRef.current = 0;
        triggerSearch();
        Keyboard.dismiss();
        break;
      }
      case 'search': {
        // Lancer la recherche textuelle complète dans la grille locale
        setShowSuggestions(false);
        setSuggestions([]);
        triggerSearch();
        Keyboard.dismiss();
        break;
      }
      default:
        break;
    }
  };

  // Empêcher le bouton retour Android de quitter l'onglet Search
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => {
        sub.remove();
      };
    }, [])
  );

  return (
    <Screen noHorizontalPadding scroll={false}>
      <View style={styles.root} onTouchStart={() => Keyboard.dismiss()}>
        {/* Barre de recherche */}
        <View style={styles.searchRow}>
          <View style={styles.searchContainer}>
            <View style={styles.searchLeadingIcon} pointerEvents="none">
              <AppIcon name="searchOutline" size={18} color="#AAAAAA" />
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder="Search for items or members"
              placeholderTextColor="#AAAAAA"
              value={query}
              onChangeText={(text) => {
                setQuery(text);
                setShowSuggestions(text.trim().length > 0);
              }}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={handleClearQuery}
                hitSlop={HIT_SLOP_COMFORTABLE}
                style={styles.searchTrailingIconButton}
                accessibilityRole="button"
                accessibilityLabel="Effacer la recherche"
              >
                <Text style={styles.clearText}>×</Text>
              </TouchableOpacity>
            )}
          </View>
          {isSuggestMode ? (
            <TouchableOpacity
              style={styles.clearAllButton}
              onPress={handleClearAll}
              hitSlop={HIT_SLOP_COMFORTABLE}
              accessibilityRole="button"
              accessibilityLabel="Tout effacer"
            >
              <Text style={styles.clearAllText}>Clear all</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.bookmarkButton}
              onPress={handlePressBookmark}
              hitSlop={HIT_SLOP_COMFORTABLE}
              accessibilityRole="button"
              accessibilityLabel="Favoris"
            >
              <Text style={styles.bookmarkIcon}>🔖</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Mode suggestions vs mode résultats */}
        {isSuggestMode ? (
          <>
            {/* Label "Items" + séparateur */}
            <View style={styles.suggestionsHeader}>
              <Text style={styles.suggestionsLabel}>Items</Text>
            </View>
            <View style={styles.suggestionsSeparator} />

            {loadingSuggestions ? (
              <View style={styles.skeletonContainer}>
                {[0, 1, 2, 3].map((i) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <View key={i} style={styles.skeletonBox} />
                ))}
              </View>
            ) : (
              <FlatList
                key="suggestions-list"
                data={suggestions}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.suggestionRow}
                    onPress={() => handlePressSuggestion(item)}
                  >
                    <Text style={styles.suggestionText}>{item.label}</Text>
                    {item.pillLabel && (
                      <View style={styles.suggestionPill}>
                        <Text style={styles.suggestionPillText}>{item.pillLabel}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <View style={styles.suggestionSeparator} />}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              />
            )}
          </>
        ) : (
          <>
            {/* Filtres rapides */}
            <View style={styles.filtersRow}>
              <FlatList
                data={['Filter', 'Size', 'Brand', 'Condition', 'Color', 'Price']}
                keyExtractor={(item) => item}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filtersContent}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.filterPill}
                    onPress={() =>
                      handlePressFilter(
                        item as 'Filter' | 'Size' | 'Brand' | 'Condition' | 'Color' | 'Price'
                      )
                    }
                    activeOpacity={0.8}
                  >
                    {item === 'Filter' && (
                      <View style={styles.filterIconRow}>
                        <Text style={styles.filterIconText}>≡</Text>
                        <Text style={styles.filterText}>Filter</Text>
                      </View>
                    )}
                    {item !== 'Filter' && <Text style={styles.filterText}>{item}</Text>}
                  </TouchableOpacity>
                )}
              />
            </View>

            {/* Compteur de résultats */}
            {resultLabel ? (
              <Text variant="body" style={styles.resultCountText}>
                {resultLabel}
              </Text>
            ) : null}

            {/* Contenu résultats */}
            {loading && results.length === 0 ? (
              <View style={styles.skeletonContainer}>
                {[0, 1, 2, 3].map((i) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <View key={i} style={styles.skeletonBox} />
                ))}
              </View>
            ) : showEmpty ? (
              <View style={styles.emptyContainer}>
                <AppIcon name="searchOutline" size={48} color="#AAAAAA" />
                <Text style={styles.emptyTitle}>No results found</Text>
                <Text style={styles.emptySubtitle}>Try different keywords or filters</Text>
              </View>
            ) : (
              <FlatList
                key="results-grid-2"
                data={results}
                keyExtractor={keyExtractor}
                numColumns={2}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                columnWrapperStyle={styles.listRow}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={
                  loadingMore ? (
                    <View style={styles.footerLoading}>
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                    </View>
                  ) : null
                }
                showsVerticalScrollIndicator={false}
              />
            )}
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.backgroundWhite
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 12
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F2',
    borderRadius: 24,
    minHeight: 48,
    paddingVertical: 4,
    paddingHorizontal: 10,
    columnGap: 6
  },
  searchLeadingIcon: {
    ...HEADER_ICON_TOUCH_CONTAINER
  },
  searchTrailingIconButton: {
    ...HEADER_ICON_TOUCH_CONTAINER
  },
  searchInput: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 15
  },
  clearText: {
    fontSize: 18,
    color: '#AAAAAA'
  },
  bookmarkButton: {
    marginLeft: 4,
    ...HEADER_ICON_TOUCH_CONTAINER
  },
  bookmarkIcon: {
    fontSize: 20
  },
  clearAllButton: {
    marginLeft: 4,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 8
  },
  clearAllText: {
    fontSize: 15,
    color: theme.colors.textPrimary
  },
  filtersRow: {
    marginTop: 12
  },
  filtersContent: {
    paddingHorizontal: 16,
    columnGap: 8
  },
  filterPill: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: theme.colors.googleWhite,
    marginRight: 8
  },
  filterIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6
  },
  filterIconText: {
    fontSize: 16,
    color: theme.colors.textPrimary
  },
  filterText: {
    fontSize: 14,
    color: theme.colors.textPrimary
  },
  resultCountText: {
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    fontSize: 14,
    color: theme.colors.textPrimary
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24
  },
  listRow: {
    columnGap: 8,
    marginBottom: 12
  },
  cardWrapper: {
    flex: 1
  },
  skeletonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 16,
    rowGap: 12,
    columnGap: 8
  },
  skeletonBox: {
    width: '48%',
    height: 220,
    backgroundColor: '#E5E5E5',
    borderRadius: 12
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 16,
    color: '#888888'
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#AAAAAA',
    textAlign: 'center'
  },
  footerLoading: {
    paddingVertical: 12
  },
  suggestionsHeader: {
    marginTop: 16,
    alignItems: 'center'
  },
  suggestionsLabel: {
    fontSize: 14,
    color: '#888888'
  },
  suggestionsSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5E5',
    marginTop: 8
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: theme.colors.backgroundWhite
  },
  suggestionText: {
    fontSize: 16,
    color: theme.colors.textPrimary
  },
  suggestionPill: {
    borderRadius: 20,
    backgroundColor: '#CCFF00',
    paddingHorizontal: 12,
    paddingVertical: 4
  },
  suggestionPillText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.textPrimary
  },
  suggestionSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5E5'
  }
});

