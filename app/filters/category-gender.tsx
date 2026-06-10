import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../components/ui/Screen';
import { Text } from '../../components/ui/Text';
import { Button } from '../../components/ui/Button';
import { HeaderBackButton } from '../../components/ui/HeaderBackButton';
import { theme } from '../../lib/theme';
import { navigateAfterFilterCommit } from '../../lib/navigation/filterExit';
import { getDescendantCategoryIds, getRootCategoriesByGender } from '../../lib/api/filters';
import { filtersScreenPath, useFiltersStackBase } from '../../lib/navigation/filterRoutes';
import { useFiltersScreenStore } from '../../lib/store/useFiltersScreenStore';
import { useTranslation } from 'react-i18next';
import {
  resolveFilterGenderParam,
  UI_TO_DB_GENDER,
  FILTER_GENDER_OPTIONS,
  type FilterGenderKey
} from '../../lib/filterGenderParams';
import { translateCategoryLabel } from '../../lib/categoryI18n';

type RootCategory = {
  id: number;
  name: string;
  slug: string;
  gender: string | null;
};

export default function CategoryGenderScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const stackBase = useFiltersStackBase();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    gender?: string;
    returnTo?: string;
    resultsSection?: string;
    resultsQuery?: string;
    resultsTitle?: string;
  }>();
  const genderParam = typeof params.gender === 'string' ? params.gender : undefined;
  const gender: FilterGenderKey = useMemo(
    () => resolveFilterGenderParam(genderParam),
    [genderParam]
  );

  const [categories, setCategories] = useState<RootCategory[]>([]);
  const [allGenderCategoryIds, setAllGenderCategoryIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { filters, setFilter } = useFiltersScreenStore();

  const dbGender = UI_TO_DB_GENDER[gender];
  const genderTitle = useMemo(() => {
    const opt = FILTER_GENDER_OPTIONS.find((o) => o.genderKey === gender);
    return opt ? t(opt.labelKey) : gender;
  }, [gender, t]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await getRootCategoriesByGender(dbGender);

        const mapped = (data as any[]).map((row) => ({
          id: row.id as number,
          name: row.name as string,
          slug: row.slug as string,
          gender: row.gender as string | null
        }));

        // Ordre spécifique pour Woman, comme dans le doc Word :
        // Clothing, Shoes, Bags, Accessories, Sport, Other
        if (dbGender === 'femme') {
          const WOMAN_ORDER = ['Clothing', 'Shoes', 'Bags', 'Accessories', 'Sport'];
          const normalizedOtherNames = new Set(['other', 'others']);

          mapped.sort((a, b) => {
            const aName = a.name.trim();
            const bName = b.name.trim();
            const aNorm = aName.toLowerCase();
            const bNorm = bName.toLowerCase();
            const aIsOther = normalizedOtherNames.has(aNorm);
            const bIsOther = normalizedOtherNames.has(bNorm);

            if (aIsOther && !bIsOther) return 1;
            if (!aIsOther && bIsOther) return -1;

            const ia = WOMAN_ORDER.indexOf(aName);
            const ib = WOMAN_ORDER.indexOf(bName);

            const aPos = ia === -1 ? WOMAN_ORDER.length + 1 : ia;
            const bPos = ib === -1 ? WOMAN_ORDER.length + 1 : ib;

            if (aPos !== bPos) return aPos - bPos;
            return a.name.localeCompare(b.name);
          });
        }

        setCategories(mapped);
        const rootIds = mapped.map((row) => row.id);
        const descendants = await getDescendantCategoryIds(rootIds);
        setAllGenderCategoryIds(descendants);
      } catch {
        setCategories([]);
        setAllGenderCategoryIds([]);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [dbGender]);

  const handleShowResult = () => {
    navigateAfterFilterCommit(
      router,
      typeof params.returnTo === 'string' ? params.returnTo : undefined
    );
  };

  const openDetail = (category: RootCategory) => {
    router.push({
      pathname: filtersScreenPath(stackBase, 'category-detail') as any,
      params: {
        parentId: String(category.id),
        title: category.name,
        categorySlug: category.slug,
        gender: dbGender,
        ...(params.returnTo ? { returnTo: params.returnTo } : {}),
        ...(typeof params.resultsSection === 'string' ? { resultsSection: params.resultsSection } : {}),
        ...(typeof params.resultsQuery === 'string' ? { resultsQuery: params.resultsQuery } : {}),
        ...(typeof params.resultsTitle === 'string' ? { resultsTitle: params.resultsTitle } : {})
      }
    });
  };

  const handleSelectAllGenderItems = () => {
    setFilter('categoryIds', allGenderCategoryIds);
    navigateAfterFilterCommit(
      router,
      typeof params.returnTo === 'string' ? params.returnTo : undefined
    );
  };

  const allGenderSelected =
    allGenderCategoryIds.length > 0 &&
    allGenderCategoryIds.every((id) => filters.categoryIds.includes(id));

  return (
    <Screen noHorizontalPadding style={{ backgroundColor: '#FFFFFF' }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <HeaderBackButton onPress={() => router.back()} />
          <Text variant="body" style={styles.headerTitle}>
            {genderTitle}
          </Text>
          <View style={styles.headerRightPlaceholder} />
        </View>

        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={styles.row}
                activeOpacity={0.7}
                onPress={handleSelectAllGenderItems}
              >
                <Text variant="body" style={styles.rowLabel}>
                  {t(`filters.allGenderItems.${gender.toLowerCase()}`)}
                </Text>
                {allGenderSelected ? (
                  <View style={[styles.radioOuter, styles.radioOuterSelected]}>
                    <Text style={styles.checkmark}>✓</Text>
                  </View>
                ) : (
                  <Text style={styles.chevron}>{'›'}</Text>
                )}
              </TouchableOpacity>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={styles.row}
                  activeOpacity={0.7}
                  onPress={() => openDetail(cat)}
                >
                  <Text variant="body" style={styles.rowLabel}>
                    {translateCategoryLabel({ name: cat.name, slug: cat.slug }, t)}
                  </Text>
                  <Text style={styles.chevron}>{'›'}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}
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
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5'
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
  checkmark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  },
  rowLabel: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    fontSize: 16
  },
  footer: {
    paddingHorizontal: 16
  },
  chevron: {
    fontSize: 18,
    color: '#AAAAAA'
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
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

