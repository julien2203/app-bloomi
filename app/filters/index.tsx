import React, { useMemo } from 'react';
import { useFilterSummaryLabels } from '../../lib/useFilterSummaryLabels';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../components/ui/Screen';
import { Text } from '../../components/ui/Text';
import { Button } from '../../components/ui/Button';
import { HeaderBackButton } from '../../components/ui/HeaderBackButton';
import { theme } from '../../lib/theme';
import type { FeedSort } from '../../lib/store/feedFilters';
import { useFiltersScreenStore } from '../../lib/store/useFiltersScreenStore';
import { navigateAfterFilterCommit } from '../../lib/navigation/filterExit';
import { filtersScreenPath, useFiltersStackBase } from '../../lib/navigation/filterRoutes';

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
  const { filters } = useFiltersScreenStore();
  const stackBase = useFiltersStackBase();
  const { categoryLabel, brandLabel, sizeLabel, colorLabel, conditionLabel } =
    useFilterSummaryLabels(filters);

  const headerTitle = params.title || t('navigation.filters');

  const sortLabel = useMemo(() => {
    const current: FeedSort = (filters.sortBy as FeedSort | undefined) ?? 'recent';
    switch (current) {
      case 'price_asc':
        return t('filters.sortPriceAsc');
      case 'price_desc':
        return t('filters.sortPriceDesc');
      case 'relevance':
        return t('filters.sortRelevance');
      case 'recent':
      default:
        return t('filters.sortRecent');
    }
  }, [filters.sortBy, t]);


  const priceValue = useMemo(() => {
    if (filters.priceMin == null && filters.priceMax == null) return undefined;
    const min = filters.priceMin;
    const max = filters.priceMax;
    if (min != null && max != null) {
      return `${min} - ${max} CHF`;
    }
    if (min != null) {
      return t('filters.fromChf', { value: min });
    }
    if (max != null) {
      return t('filters.upToChf', { value: max });
    }
    return undefined;
  }, [filters.priceMin, filters.priceMax, t]);

  const goToFilterScreen = (segment: string) => {
    router.push({
      pathname: filtersScreenPath(stackBase, segment) as any,
      params: {
        ...(params.returnTo ? { returnTo: params.returnTo } : {}),
        ...(typeof params.resultsSection === 'string' ? { resultsSection: params.resultsSection } : {}),
        ...(typeof params.resultsQuery === 'string' ? { resultsQuery: params.resultsQuery } : {}),
        ...(typeof params.resultsTitle === 'string' ? { resultsTitle: params.resultsTitle } : {})
      }
    });
  };

  const handleShowResult = () => {
    navigateAfterFilterCommit(router, typeof params.returnTo === 'string' ? params.returnTo : undefined);
  };

  return (
    <Screen noHorizontalPadding style={{ backgroundColor: '#FFFFFF' }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <HeaderBackButton
            onPress={() => {
              if (router.canGoBack && router.canGoBack()) {
                router.back();
              } else {
                navigateAfterFilterCommit(
                  router,
                  typeof params.returnTo === 'string' ? params.returnTo : undefined
                );
              }
            }}
          />
          <Text variant="body" style={styles.headerTitle}>
            {headerTitle}
          </Text>
          <View style={styles.headerRightPlaceholder} />
        </View>

        <View style={styles.content}>
          <TouchableOpacity style={styles.row} onPress={() => goToFilterScreen('sort')}>
            <Text variant="body" style={styles.rowLabel}>
              {t('filters.sortBy')}
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

          <TouchableOpacity style={styles.row} onPress={() => goToFilterScreen('category')}>
            <Text variant="body" style={styles.rowLabel}>
              {t('filters.category')}
            </Text>
            <View style={styles.rowValueContainer}>
              {categoryLabel ? (
                <View style={styles.pill}>
                  <Text variant="captionSm" style={styles.pillText} numberOfLines={1}>
                    {categoryLabel}
                  </Text>
                </View>
              ) : (
                <Text style={styles.placeholderText}>{t('common.all')}</Text>
              )}
              <Text
                style={[
                  styles.chevron,
                  !categoryLabel && styles.chevronPlaceholder
                ]}
              >
                {'›'}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.row} onPress={() => goToFilterScreen('size')}>
            <Text variant="body" style={styles.rowLabel}>
              {t('filters.size')}
            </Text>
            <View style={styles.rowValueContainer}>
              {sizeLabel ? (
                <View style={styles.pill}>
                  <Text
                    variant="captionSm"
                    style={styles.pillText}
                    numberOfLines={1}
                  >
                    {sizeLabel}
                  </Text>
                </View>
              ) : (
                <Text style={styles.placeholderText}>{t('common.all')}</Text>
              )}
              <Text
                style={[styles.chevron, !sizeLabel && styles.chevronPlaceholder]}
              >
                {'›'}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.row} onPress={() => goToFilterScreen('brand-gender')}>
            <Text variant="body" style={styles.rowLabel}>
              {t('filters.searchBrands')}
            </Text>
            <View style={styles.rowValueContainer}>
              {brandLabel ? (
                <View style={styles.pill}>
                  <Text
                    variant="captionSm"
                    style={styles.pillText}
                    numberOfLines={1}
                  >
                    {brandLabel}
                  </Text>
                </View>
              ) : (
                <Text style={styles.placeholderText}>{t('common.all')}</Text>
              )}
              <Text
                style={[styles.chevron, !brandLabel && styles.chevronPlaceholder]}
              >
                {'›'}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.row} onPress={() => goToFilterScreen('condition')}>
            <Text variant="body" style={styles.rowLabel}>
              {t('filters.condition')}
            </Text>
            <View style={styles.rowValueContainer}>
              {conditionLabel ? (
                <View style={styles.pill}>
                  <Text
                    variant="captionSm"
                    style={styles.pillText}
                    numberOfLines={1}
                  >
                    {conditionLabel}
                  </Text>
                </View>
              ) : (
                <Text style={styles.placeholderText}>{t('common.all')}</Text>
              )}
              <Text
                style={[
                  styles.chevron,
                  !conditionLabel && styles.chevronPlaceholder
                ]}
              >
                {'›'}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.row} onPress={() => goToFilterScreen('color')}>
            <Text variant="body" style={styles.rowLabel}>
              {t('filters.color')}
            </Text>
            <View style={styles.rowValueContainer}>
              {colorLabel ? (
                <View style={styles.pill}>
                  <Text
                    variant="captionSm"
                    style={styles.pillText}
                    numberOfLines={1}
                  >
                    {colorLabel}
                  </Text>
                </View>
              ) : (
                <Text style={styles.placeholderText}>{t('common.all')}</Text>
              )}
              <Text
                style={[styles.chevron, !colorLabel && styles.chevronPlaceholder]}
              >
                {'›'}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.row} onPress={() => goToFilterScreen('price')}>
            <Text variant="body" style={styles.rowLabel}>
              {t('filters.price')}
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
                <Text style={styles.placeholderText}>{t('common.all')}</Text>
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
            title={t('filters.showResult')}
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

