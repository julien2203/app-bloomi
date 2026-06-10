import React, { useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../components/ui/Screen';
import { Text } from '../../components/ui/Text';
import { HeaderBackButton } from '../../components/ui/HeaderBackButton';
import { Button } from '../../components/ui/Button';
import { theme } from '../../lib/theme';
import { navigateAfterFilterCommit } from '../../lib/navigation/filterExit';
import { filtersScreenPath, useFiltersStackBase } from '../../lib/navigation/filterRoutes';
import { useTranslation } from 'react-i18next';

type Segment = {
  label: string;
  gender: string;
  type: string | null;
};

export default function BrandSegmentScreen() {
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
  const genderParam = typeof params.gender === 'string' ? params.gender : 'femme';

  const segments = useMemo<Segment[]>(() => {
    switch (genderParam) {
      case 'femme':
      default:
        return [
          {
            label: t('filters.segment.womenClothing'),
            gender: 'femme',
            type: 'vetements'
          },
          {
            label: t('filters.segment.womenShoes'),
            gender: 'femme',
            type: 'chaussures'
          },
          {
            label: t('filters.segment.womenBags'),
            gender: 'femme',
            type: 'sacs'
          },
          {
            label: t('filters.segment.womenAccessories'),
            gender: 'femme',
            type: 'accessoires'
          }
        ];
      case 'homme':
        return [
          {
            label: t('filters.segment.menClothing'),
            gender: 'homme',
            type: 'vetements'
          },
          {
            label: t('filters.segment.menShoes'),
            gender: 'homme',
            type: 'chaussures'
          },
          {
            label: t('filters.segment.menAccessories'),
            gender: 'homme',
            type: 'accessoires'
          }
        ];
      case 'enfant':
        return [
          {
            label: t('filters.segment.kidsClothing'),
            gender: 'enfant',
            type: 'vetements'
          },
          {
            label: t('filters.segment.kidsShoes'),
            gender: 'enfant',
            type: 'chaussures'
          },
          {
            label: t('filters.segment.kidsBags'),
            gender: 'enfant',
            type: 'sacs'
          },
          {
            label: t('filters.segment.kidsAccessories'),
            gender: 'enfant',
            type: 'accessoires'
          }
        ];
      case 'bebe':
        return [
          {
            label: t('filters.segment.babyClothing'),
            gender: 'bebe',
            type: 'vetements'
          }
        ];
    }
  }, [genderParam, t]);

  const openSegment = (segment: Segment) => {
    router.push({
      pathname: filtersScreenPath(stackBase, 'brand') as any,
      params: {
        gender: segment.gender,
        type: segment.type ?? undefined,
        title: segment.label,
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
          <HeaderBackButton onPress={() => router.back()} />
          <Text variant="body" style={styles.headerTitle}>
            {t('filters.brand')}
          </Text>
          <View style={styles.headerRightPlaceholder} />
        </View>

        <View style={styles.content}>
          {segments.map((segment) => (
            <TouchableOpacity
              key={`${segment.gender}-${segment.type ?? 'all'}`}
              style={styles.row}
              activeOpacity={0.7}
              onPress={() => openSegment(segment)}
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

