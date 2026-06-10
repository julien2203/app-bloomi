import React, { useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../../components/ui/Screen';
import { Text } from '../../../components/ui/Text';
import { HeaderBackButton } from '../../../components/ui/HeaderBackButton';
import { theme } from '../../../lib/theme';

type Segment = {
  labelKey: string;
  gender: string;
  type: string | null;
};

export default function SellBrandSegmentScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{ gender?: string }>();
  const genderParam = typeof params.gender === 'string' ? params.gender : 'femme';

  const segments = useMemo<Segment[]>(() => {
    switch (genderParam) {
      case 'femme':
      default:
        return [
          { labelKey: 'filters.segment.womenClothing', gender: 'femme', type: 'vetements' },
          { labelKey: 'filters.segment.womenShoes', gender: 'femme', type: 'chaussures' },
          { labelKey: 'filters.segment.womenBags', gender: 'femme', type: 'sacs' },
          { labelKey: 'filters.segment.womenAccessories', gender: 'femme', type: 'accessoires' }
        ];
      case 'homme':
        return [
          { labelKey: 'filters.segment.menClothing', gender: 'homme', type: 'vetements' },
          { labelKey: 'filters.segment.menShoes', gender: 'homme', type: 'chaussures' },
          { labelKey: 'filters.segment.menAccessories', gender: 'homme', type: 'accessoires' }
        ];
      case 'enfant':
        return [
          { labelKey: 'filters.segment.kidsClothing', gender: 'enfant', type: 'vetements' },
          { labelKey: 'filters.segment.kidsShoes', gender: 'enfant', type: 'chaussures' },
          { labelKey: 'filters.segment.kidsBags', gender: 'enfant', type: 'sacs' },
          { labelKey: 'filters.segment.kidsAccessories', gender: 'enfant', type: 'accessoires' }
        ];
      case 'bebe':
        return [{ labelKey: 'filters.babyClothing', gender: 'bebe', type: 'vetements' }];
    }
  }, [genderParam]);

  const openSegment = (segment: Segment) => {
    const label = t(segment.labelKey);
    router.push({
      pathname: '/tabs/sell/brand',
      params: {
        gender: segment.gender,
        type: segment.type ?? undefined,
        title: label
      }
    });
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <Screen noHorizontalPadding style={{ backgroundColor: '#FFFFFF', paddingBottom: insets.bottom }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <HeaderBackButton onPress={handleBack} />
          <Text variant="body" style={styles.headerTitle}>
            {t('filters.searchBrands')}
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
                {t(segment.labelKey)}
              </Text>
              <Text style={styles.chevron}>{'›'}</Text>
            </TouchableOpacity>
          ))}
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
    borderBottomColor: theme.colors.border
  },
  headerTitle: {
    ...theme.typography.body,
    fontFamily: theme.fontFamily.semiBold,
    color: theme.colors.textPrimary
  },
  headerRightPlaceholder: {
    width: 32
  },
  content: {
    paddingTop: 8
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.horizontalPadding,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border
  },
  rowLabel: {
    color: theme.colors.textPrimary
  },
  chevron: {
    fontSize: 22,
    color: theme.colors.textSecondary,
    lineHeight: 24
  }
});
