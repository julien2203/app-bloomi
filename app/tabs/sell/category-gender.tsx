import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSafeBottomInset } from '../../../lib/safeArea';
import { Screen } from '../../../components/ui/Screen';
import { Text } from '../../../components/ui/Text';
import { HeaderBackButton } from '../../../components/ui/HeaderBackButton';
import { Button } from '../../../components/ui/Button';
import { theme } from '../../../lib/theme';
import { getRootCategoriesByGender } from '../../../lib/api/filters';
import { useTranslation } from 'react-i18next';
import { translateCategoryLabel } from '../../../lib/categoryI18n';

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

export default function SellCategoryGenderScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const safeBottom = getSafeBottomInset(insets.bottom);
  const params = useLocalSearchParams<{ gender?: string; return_to?: string; edit_id?: string }>();
  const genderParam = params.gender as GenderKey | undefined;
  const gender: GenderKey = genderParam && UI_TO_DB_GENDER[genderParam as GenderKey]
    ? (genderParam as GenderKey)
    : 'Woman';

  const [categories, setCategories] = useState<RootCategory[]>([]);
  const [loading, setLoading] = useState(false);

  const dbGender = UI_TO_DB_GENDER[gender];
  const genderTitleKey =
    gender === 'Woman'
      ? 'filters.woman'
      : gender === 'Men'
        ? 'filters.men'
        : gender === 'Kids'
          ? 'filters.kids'
          : 'filters.baby';

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await getRootCategoriesByGender(dbGender);
        setCategories(
          (data as any[]).map((row) => ({
            id: row.id as number,
            name: row.name as string,
            slug: row.slug as string,
            gender: row.gender as string | null
          }))
        );
      } catch {
        setCategories([]);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [dbGender]);

  const openDetail = (category: RootCategory) => {
    router.push({
      pathname: '/tabs/sell/category-detail',
      params: {
        parentId: String(category.id),
        title: category.name,
        categorySlug: category.slug,
        gender: dbGender,
        ...(typeof params.return_to === 'string' ? { return_to: params.return_to } : {}),
        ...(typeof params.edit_id === 'string' ? { edit_id: params.edit_id } : {})
      }
    });
  };

  const handleShowResult = () => {
    router.back();
  };

  return (
    <Screen noHorizontalPadding style={{ backgroundColor: '#FFFFFF' }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <HeaderBackButton onPress={() => router.back()} />
          <Text variant="body" style={styles.headerTitle}>
            {t(genderTitleKey)}
          </Text>
          <View style={styles.headerRightPlaceholder} />
        </View>

        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.list}>
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
            </ScrollView>
          )}
        </View>

        <View
          style={[
            styles.footer,
            { paddingBottom: safeBottom + 24 }
          ]}
        >
          <Button
            title={t('common.confirm')}
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
  list: {
    paddingBottom: 24
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
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  }
});

