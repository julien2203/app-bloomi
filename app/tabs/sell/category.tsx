import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../../components/ui/Screen';
import { Text } from '../../../components/ui/Text';
import { Button } from '../../../components/ui/Button';
import { theme } from '../../../lib/theme';
import { HeaderBackButton } from '../../../components/ui/HeaderBackButton';

const GENDERS = ['Woman', 'Men', 'Kids', 'Baby'] as const;

export default function SellCategoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleOpenGender = (gender: (typeof GENDERS)[number]) => {
    router.push({
      pathname: '/tabs/sell/category-gender',
      params: { gender }
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
            Category
          </Text>
          <View style={styles.headerRightPlaceholder} />
        </View>

        <View style={styles.content}>
          {GENDERS.map((gender) => (
            <TouchableOpacity
              key={gender}
              style={styles.row}
              activeOpacity={0.7}
              onPress={() => handleOpenGender(gender)}
            >
              <Text variant="body" style={styles.rowLabel}>
                {gender}
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
            title="Confirmer"
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

