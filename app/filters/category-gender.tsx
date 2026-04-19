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
import { getRootCategoriesByGender } from '../../lib/api/filters';
import { filtersScreenPath, useFiltersStackBase } from '../../lib/navigation/filterRoutes';

type GenderKey = 'Woman' | 'Men' | 'Kids' | 'Baby';

type RootCategory = {
  id: number;
  name: string;
  slug: string;
  gender: string | null;
};

const UI_TO_DB_GENDER: Record<GenderKey, string> = {
  Woman: 'femme',
  Men: 'homme',
  Kids: 'enfant',
  Baby: 'bebe'
};

export default function CategoryGenderScreen() {
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
  const genderParam = params.gender as GenderKey | undefined;
  const gender: GenderKey = useMemo(
    () =>
      genderParam && UI_TO_DB_GENDER[genderParam as GenderKey]
        ? (genderParam as GenderKey)
        : 'Woman',
    [genderParam]
  );

  const [categories, setCategories] = useState<RootCategory[]>([]);
  const [loading, setLoading] = useState(false);

  const dbGender = UI_TO_DB_GENDER[gender];

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
      } catch {
        setCategories([]);
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
        gender: dbGender,
        ...(params.returnTo ? { returnTo: params.returnTo } : {}),
        ...(typeof params.resultsSection === 'string' ? { resultsSection: params.resultsSection } : {}),
        ...(typeof params.resultsQuery === 'string' ? { resultsQuery: params.resultsQuery } : {}),
        ...(typeof params.resultsTitle === 'string' ? { resultsTitle: params.resultsTitle } : {})
      }
    });
  };

  return (
    <Screen noHorizontalPadding style={{ backgroundColor: '#FFFFFF' }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <HeaderBackButton onPress={() => router.back()} />
          <Text variant="body" style={styles.headerTitle}>
            {gender}
          </Text>
          <View style={styles.headerRightPlaceholder} />
        </View>

        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
            </View>
          ) : (
            categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={styles.row}
                activeOpacity={0.7}
                onPress={() => openDetail(cat)}
              >
                <Text variant="body" style={styles.rowLabel}>
                  {cat.name}
                </Text>
                <Text style={styles.chevron}>{'›'}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View
          style={[
            styles.footer,
            { paddingBottom: insets.bottom + 24 }
          ]}
        >
          <Button
            title="Show results"
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

