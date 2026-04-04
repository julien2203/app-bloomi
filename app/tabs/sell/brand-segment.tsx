import React, { useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../../components/ui/Screen';
import { Text } from '../../../components/ui/Text';
import { HeaderBackButton } from '../../../components/ui/HeaderBackButton';
import { theme } from '../../../lib/theme';

type Segment = {
  label: string;
  gender: string;
  type: string | null;
};

export default function SellBrandSegmentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{ gender?: string }>();
  const genderParam = typeof params.gender === 'string' ? params.gender : 'femme';

  const segments = useMemo<Segment[]>(() => {
    switch (genderParam) {
      case 'femme':
      default:
        return [
          {
            label: "Women's clothing",
            gender: 'femme',
            type: 'vetements'
          },
          {
            label: "Women's shoes",
            gender: 'femme',
            type: 'chaussures'
          },
          {
            label: "Women's bags",
            gender: 'femme',
            type: 'sacs'
          },
          {
            label: "Women's accessories",
            gender: 'femme',
            type: 'accessoires'
          }
        ];
      case 'homme':
        return [
          {
            label: "Men's clothing",
            gender: 'homme',
            type: 'vetements'
          },
          {
            label: "Men's shoes",
            gender: 'homme',
            type: 'chaussures'
          },
          {
            label: "Men's accessories",
            gender: 'homme',
            type: 'accessoires'
          }
        ];
      case 'enfant':
        return [
          {
            label: "Kids' clothing",
            gender: 'enfant',
            type: 'vetements'
          },
          {
            label: "Kids' shoes",
            gender: 'enfant',
            type: 'chaussures'
          },
          {
            label: "Kids' bags",
            gender: 'enfant',
            type: 'sacs'
          },
          {
            label: "Kids' accessories",
            gender: 'enfant',
            type: 'accessoires'
          }
        ];
      case 'bebe':
        return [
          {
            label: 'Baby clothing',
            gender: 'bebe',
            type: 'vetements'
          }
        ];
    }
  }, [genderParam]);

  const openSegment = (segment: Segment) => {
    router.push({
      pathname: '/tabs/sell/brand',
      params: {
        gender: segment.gender,
        type: segment.type ?? undefined,
        title: segment.label
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
            Brand
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

