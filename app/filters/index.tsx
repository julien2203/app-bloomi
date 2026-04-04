import React, { useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../components/ui/Screen';
import { Text } from '../../components/ui/Text';
import { Button } from '../../components/ui/Button';
import { HeaderBackButton } from '../../components/ui/HeaderBackButton';
import { theme } from '../../lib/theme';
import { useFeedFiltersStore, type FeedSort } from '../../lib/store/feedFilters';

export default function FiltersIndexScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ title?: string; from?: string }>();
  const { filters } = useFeedFiltersStore();

  const headerTitle = params.title || 'Filters';

  const sortLabel = useMemo(() => {
    const current: FeedSort = (filters.sort as FeedSort | undefined) ?? 'newest';
    switch (current) {
      case 'price_asc':
        return 'Price low to high';
      case 'price_desc':
        return 'Price high to low';
      case 'relevance':
        return 'Relevance';
      case 'newest':
      default:
        return 'Newest First';
    }
  }, [filters.sort]);

  const formatMultiValue = (values?: string[] | null) => {
    if (!values || values.length === 0) return undefined;
    const joined = values.join(', ');
    if (joined.length <= 24) return joined;
    return `${joined.slice(0, 21)}…`;
  };

  const categoryValue = filters.category ?? undefined;
  const sizeValue = formatMultiValue(filters.sizes);
  const brandValue = formatMultiValue(filters.brands);
  const conditionValue = formatMultiValue(filters.conditions);
  const colorValue = formatMultiValue(filters.colors);

  const priceValue = useMemo(() => {
    if (filters.priceMin == null && filters.priceMax == null) return undefined;
    const min = filters.priceMin;
    const max = filters.priceMax;
    if (min != null && max != null) {
      return `${min} - ${max} CHF`;
    }
    if (min != null) {
      return `From ${min} CHF`;
    }
    if (max != null) {
      return `Up to ${max} CHF`;
    }
    return undefined;
  }, [filters.priceMin, filters.priceMax]);

  const goTo = (route: string) => {
    router.push(route);
  };

  const handleShowResult = () => {
    if (params.from === 'search') {
      router.replace('/tabs/search');
    } else {
      router.replace('/tabs/feed');
    }
  };

  return (
    <Screen noHorizontalPadding style={{ backgroundColor: '#FFFFFF' }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <HeaderBackButton onPress={handleShowResult} />
          <Text variant="body" style={styles.headerTitle}>
            {headerTitle}
          </Text>
          <View style={styles.headerRightPlaceholder} />
        </View>

        <View style={styles.content}>
          <TouchableOpacity style={styles.row} onPress={() => goTo('/filters/sort')}>
            <Text variant="body" style={styles.rowLabel}>
              Sort by
            </Text>
            <View style={styles.rowValueContainer}>
              <View style={styles.pill}>
                <Text variant="captionSm" style={styles.pillText}>
                  {sortLabel}
                </Text>
              </View>
              <Text style={styles.chevron}>{'›'}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.row} onPress={() => goTo('/filters/category')}>
            <Text variant="body" style={styles.rowLabel}>
              Category
            </Text>
            <View style={styles.rowValueContainer}>
              {categoryValue ? (
                <View style={styles.pill}>
                  <Text variant="captionSm" style={styles.pillText} numberOfLines={1}>
                    {categoryValue}
                  </Text>
                </View>
              ) : (
                <Text style={styles.placeholderText}>All</Text>
              )}
              <Text
                style={[
                  styles.chevron,
                  !categoryValue && styles.chevronPlaceholder
                ]}
              >
                {'›'}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.row} onPress={() => goTo('/filters/size')}>
            <Text variant="body" style={styles.rowLabel}>
              Size
            </Text>
            <View style={styles.rowValueContainer}>
              {sizeValue ? (
                <View style={styles.pill}>
                  <Text
                    variant="captionSm"
                    style={styles.pillText}
                    numberOfLines={1}
                  >
                    {sizeValue}
                  </Text>
                </View>
              ) : (
                <Text style={styles.placeholderText}>All</Text>
              )}
              <Text
                style={[styles.chevron, !sizeValue && styles.chevronPlaceholder]}
              >
                {'›'}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.row} onPress={() => goTo('/filters/brand-gender')}>
            <Text variant="body" style={styles.rowLabel}>
              Brand
            </Text>
            <View style={styles.rowValueContainer}>
              {brandValue ? (
                <View style={styles.pill}>
                  <Text
                    variant="captionSm"
                    style={styles.pillText}
                    numberOfLines={1}
                  >
                    {brandValue}
                  </Text>
                </View>
              ) : (
                <Text style={styles.placeholderText}>All</Text>
              )}
              <Text
                style={[styles.chevron, !brandValue && styles.chevronPlaceholder]}
              >
                {'›'}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.row} onPress={() => goTo('/filters/condition')}>
            <Text variant="body" style={styles.rowLabel}>
              Condition
            </Text>
            <View style={styles.rowValueContainer}>
              {conditionValue ? (
                <View style={styles.pill}>
                  <Text
                    variant="captionSm"
                    style={styles.pillText}
                    numberOfLines={1}
                  >
                    {conditionValue}
                  </Text>
                </View>
              ) : (
                <Text style={styles.placeholderText}>All</Text>
              )}
              <Text
                style={[
                  styles.chevron,
                  !conditionValue && styles.chevronPlaceholder
                ]}
              >
                {'›'}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.row} onPress={() => goTo('/filters/color')}>
            <Text variant="body" style={styles.rowLabel}>
              Color
            </Text>
            <View style={styles.rowValueContainer}>
              {colorValue ? (
                <View style={styles.pill}>
                  <Text
                    variant="captionSm"
                    style={styles.pillText}
                    numberOfLines={1}
                  >
                    {colorValue}
                  </Text>
                </View>
              ) : (
                <Text style={styles.placeholderText}>All</Text>
              )}
              <Text
                style={[styles.chevron, !colorValue && styles.chevronPlaceholder]}
              >
                {'›'}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.row} onPress={() => goTo('/filters/price')}>
            <Text variant="body" style={styles.rowLabel}>
              Price
            </Text>
            <View style={styles.rowValueContainer}>
              {priceValue ? (
                <View style={styles.pill}>
                  <Text
                    variant="captionSm"
                    style={styles.pillText}
                    numberOfLines={1}
                  >
                    {priceValue}
                  </Text>
                </View>
              ) : (
                <Text style={styles.placeholderText}>All</Text>
              )}
              <Text
                style={[styles.chevron, !priceValue && styles.chevronPlaceholder]}
              >
                {'›'}
              </Text>
            </View>
          </TouchableOpacity>
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
  headerRightPlaceholder: {
    width: 24
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8
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
  rowLabel: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    fontSize: 16
  },
  rowValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 200
  },
  placeholderText: {
    fontSize: 14,
    color: '#AAAAAA',
    marginRight: 4
  },
  chevron: {
    fontSize: 18,
    color: theme.colors.textPrimary,
    marginLeft: 4
  },
  chevronPlaceholder: {
    color: '#AAAAAA'
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: '#C3EA4F',
    maxWidth: 180
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.appleBlack
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
  }
});

