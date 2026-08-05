import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../components/ui/Screen';
import { Text } from '../../components/ui/Text';
import { HeaderBackButton } from '../../components/ui/HeaderBackButton';
import { Button } from '../../components/ui/Button';
import { theme } from '../../lib/theme';
import { getFilterFooterPaddingBottom } from '../../lib/touchTargets';
import { useFilterExit } from '../../lib/navigation/filterExit';
import { filtersScreenPath, useFiltersStackBase } from '../../lib/navigation/filterRoutes';
import { useTranslation } from 'react-i18next';

type GenderSegment = {
  label: string;
  gender: string; // valeur en base: 'femme', 'homme', 'enfant', 'bebe'
};

export default function BrandGenderScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const stackBase = useFiltersStackBase();
  const insets = useSafeAreaInsets();
  const { navigateAfterFilterCommit } = useFilterExit();
  const params = useLocalSearchParams<{
    returnTo?: string;
    resultsSection?: string;
    resultsQuery?: string;
    resultsTitle?: string;
  }>();

  const openGender = (segment: GenderSegment) => {
    router.push({
      pathname: filtersScreenPath(stackBase, 'brand-segment') as any,
      params: {
        gender: segment.gender,
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

  const genderSegments: GenderSegment[] = [
    { label: t('filters.woman'), gender: 'femme' },
    { label: t('filters.men'), gender: 'homme' },
    { label: t('filters.kids'), gender: 'enfant' },
    { label: t('filters.baby'), gender: 'bebe' }
  ];

  return (
    <Screen noHorizontalPadding style={{ backgroundColor: '#FFFFFF' }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <HeaderBackButton onPress={() => router.back()} />
          <Text variant="body" style={styles.headerTitle}>
            {t('filters.brand')}
          </Text>
          <View style={styles.headerRightPlaceholder} />
        </View>

        <View style={styles.content}>
          {genderSegments.map((segment) => (
            <TouchableOpacity
              key={segment.gender}
              style={styles.row}
              activeOpacity={0.7}
              onPress={() => openGender(segment)}
            >
              <Text variant="body" style={styles.rowLabel}>
                {segment.label}
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
    paddingVertical: 16,
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
  }
});

