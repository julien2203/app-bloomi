import React, { useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../components/ui/Screen';
import { Text } from '../../components/ui/Text';
import { Button } from '../../components/ui/Button';
import { theme } from '../../lib/theme';
import { getFilterFooterPaddingBottom } from '../../lib/touchTargets';
import { HeaderBackButton } from '../../components/ui/HeaderBackButton';
import { Ionicons } from '@expo/vector-icons';
import { useFiltersScreenStore } from '../../lib/store/useFiltersScreenStore';
import { useFilterExit } from '../../lib/navigation/filterExit';
import { filtersScreenPath, useFiltersStackBase } from '../../lib/navigation/filterRoutes';
import { FILTER_GENDER_OPTIONS } from '../../lib/filterGenderParams';

export default function CategoryFilterScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const stackBase = useFiltersStackBase();
  const params = useLocalSearchParams<{
    returnTo?: string;
    resultsSection?: string;
    resultsQuery?: string;
    resultsTitle?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { filters, setFilter } = useFiltersScreenStore();
  const { navigateAfterFilterCommit } = useFilterExit();

  const isInitiallyAllSelected = useMemo(
    () => (filters.categoryIds?.length ?? 0) === 0,
    [filters.categoryIds]
  );

  const [isAllSelected, setIsAllSelected] = useState<boolean>(isInitiallyAllSelected);

  const handleSelectAll = () => {
    setIsAllSelected(true);
    setFilter('categoryIds', []);
  };

  const handleOpenGender = (genderKey: (typeof FILTER_GENDER_OPTIONS)[number]['genderKey']) => {
    setIsAllSelected(false);
    router.push({
      pathname: filtersScreenPath(stackBase, 'category-gender') as any,
      params: {
        gender: genderKey,
        ...(params.returnTo ? { returnTo: params.returnTo } : {}),
        ...(typeof params.resultsSection === 'string' ? { resultsSection: params.resultsSection } : {}),
        ...(typeof params.resultsQuery === 'string' ? { resultsQuery: params.resultsQuery } : {}),
        ...(typeof params.resultsTitle === 'string' ? { resultsTitle: params.resultsTitle } : {})
      }
    });
  };

  const handleShowResult = () => {
    navigateAfterFilterCommit(typeof params.returnTo === 'string' ? params.returnTo : undefined);
  };

  return (
    <Screen noHorizontalPadding style={{ backgroundColor: '#FFFFFF' }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <HeaderBackButton onPress={() => router.back()} />
          <Text variant="body" style={styles.headerTitle}>
            {t('filters.category')}
          </Text>
          <View style={styles.headerRightPlaceholder} />
        </View>

        <View style={styles.content}>
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.7}
            onPress={handleSelectAll}
          >
            <Text variant="body" style={styles.rowLabel}>
              {t('common.all')}
            </Text>
            <View
              style={[
                styles.radioOuter,
                isAllSelected && styles.radioOuterSelected
              ]}
            >
              {isAllSelected && (
                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              )}
            </View>
          </TouchableOpacity>

          {FILTER_GENDER_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.genderKey}
              style={styles.row}
              activeOpacity={0.7}
              onPress={() => handleOpenGender(option.genderKey)}
            >
              <Text variant="body" style={styles.rowLabel}>
                {t(option.labelKey)}
              </Text>
              <Text style={styles.chevron}>{'›'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View
          style={[
            styles.footer,
            { paddingBottom: getFilterFooterPaddingBottom(insets) }
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
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5'
  },
  rowLabel: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    fontSize: 16
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#CCCCCC',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center'
  },
  radioOuterSelected: {
    borderColor: '#C3EA4F',
    backgroundColor: '#C3EA4F'
  },
  chevron: {
    fontSize: 18,
    color: '#AAAAAA'
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

