import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSafeBottomInset } from '../../../lib/safeArea';
import { Screen } from '../../../components/ui/Screen';
import { Text } from '../../../components/ui/Text';
import { HeaderBackButton } from '../../../components/ui/HeaderBackButton';
import { theme } from '../../../lib/theme';
import { useTranslation } from 'react-i18next';

type GenderSegment = {
  labelKey: string;
  gender: string;
};

const GENDER_SEGMENTS: GenderSegment[] = [
  { labelKey: 'filters.woman', gender: 'femme' },
  { labelKey: 'filters.man', gender: 'homme' },
  { labelKey: 'filters.kids', gender: 'enfant' },
  { labelKey: 'filters.baby', gender: 'bebe' }
];

export default function SellBrandGenderScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const safeBottom = getSafeBottomInset(insets.bottom);

  const openGender = (segment: GenderSegment) => {
    router.push({
      pathname: '/tabs/sell/brand-segment',
      params: {
        gender: segment.gender
      }
    });
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <Screen noHorizontalPadding style={{ backgroundColor: '#FFFFFF', paddingBottom: safeBottom }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <HeaderBackButton onPress={handleBack} />
          <Text variant="body" style={styles.headerTitle}>
            {t('filters.searchBrands')}
          </Text>
          <View style={styles.headerRightPlaceholder} />
        </View>

        <View style={styles.content}>
          {GENDER_SEGMENTS.map((segment) => (
            <TouchableOpacity
              key={segment.gender}
              style={styles.row}
              activeOpacity={0.7}
              onPress={() => openGender(segment)}
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
});

