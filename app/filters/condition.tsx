import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../components/ui/Screen';
import { Text } from '../../components/ui/Text';
import { Button } from '../../components/ui/Button';
import { HeaderBackButton } from '../../components/ui/HeaderBackButton';
import { theme } from '../../lib/theme';
import { FLOATING_TAB_BAR_BOTTOM_RESERVE, HIT_SLOP_COMFORTABLE } from '../../lib/touchTargets';
import { useFiltersScreenStore } from '../../lib/store/useFiltersScreenStore';
import { getConditions } from '../../lib/api/filters';
import { navigateAfterFilterCommit } from '../../lib/navigation/filterExit';

type ConditionRow = {
  id: number;
  name: string;
  value: string;
  description: string;
};

export default function ConditionFilterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    returnTo?: string;
    resultsSection?: string;
    resultsQuery?: string;
    resultsTitle?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { filters, setFilter } = useFiltersScreenStore();

  const [conditions, setConditions] = useState<ConditionRow[]>([]);
  const [selected, setSelected] = useState<string[]>(filters.conditionIds ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleCondition = (value: string) => {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    );
  };

  const handleClearAll = () => {
    setSelected([]);
  };

  const handleShowResult = () => {
    setFilter('conditionIds', selected);
    navigateAfterFilterCommit(router, typeof params.returnTo === 'string' ? params.returnTo : undefined);
  };

  const loadConditions = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await getConditions();

      const mapped: ConditionRow[] = (data as any[]).map((row) => ({
        id: row.id as number,
        name: row.name as string,
        value: (row.value as string | undefined) ?? (row.name as string),
        description: (row.description as string | undefined) ?? ''
      }));

      setConditions(mapped);
    } catch {
      setError('Unable to load conditions. Please try again.');
      setConditions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadConditions();
  }, []);

  return (
    <Screen noHorizontalPadding style={{ backgroundColor: '#FFFFFF' }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <HeaderBackButton onPress={() => router.back()} />
          <Text variant="body" style={styles.headerTitle}>
            Condition
          </Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleClearAll}
            hitSlop={HIT_SLOP_COMFORTABLE}
            style={styles.clearAllHit}
          >
            <Text variant="body" style={styles.clearAllText}>
              Clear all
            </Text>
          </TouchableOpacity>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text variant="captionSm" color="textSecondary" style={styles.errorText}>
              {error}
            </Text>
            <TouchableOpacity onPress={loadConditions} activeOpacity={0.7}>
              <Text variant="captionSm" color="primary">
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.content}>
          {loading ? (
            <ScrollView contentContainerStyle={styles.list}>
              {Array.from({ length: 5 }).map((_, index) => (
                <View key={index} style={[styles.row, styles.skeletonRow]}>
                  <View style={styles.skeletonTextBlock}>
                    <View style={styles.skeletonTitle} />
                    <View style={styles.skeletonDescription} />
                  </View>
                  <View style={styles.skeletonCheckbox} />
                </View>
              ))}
            </ScrollView>
          ) : (
            <ScrollView contentContainerStyle={styles.list}>
              {conditions.map((cond) => {
                const checked = selected.includes(cond.value);
                return (
                  <TouchableOpacity
                    key={cond.id}
                    style={styles.row}
                    activeOpacity={0.7}
                    onPress={() => toggleCondition(cond.value)}
                  >
                    <View style={styles.textContainer}>
                      <Text variant="body" style={styles.conditionTitle}>
                        {cond.name}
                      </Text>
                      {cond.description.length > 0 && (
                        <Text
                          variant="captionSm"
                          style={styles.description}
                          numberOfLines={2}
                        >
                          {cond.description}
                        </Text>
                      )}
                    </View>
                    <View
                      style={[
                        styles.checkbox,
                        checked && styles.checkboxChecked
                      ]}
                    >
                      {checked && (
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        <View
          style={[
            styles.footer,
            { paddingBottom: insets.bottom + 24 + FLOATING_TAB_BAR_BOTTOM_RESERVE }
          ]}
        >
          <Button
            title="Show result"
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
  clearAllHit: {
    minHeight: 44,
    justifyContent: 'center'
  },
  clearAllText: {
    ...theme.typography.body,
    fontSize: 16,
    color: theme.colors.textPrimary
  },
  errorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  errorText: {
    marginBottom: 4
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
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5'
  },
  textContainer: {
    flex: 1,
    paddingRight: 16
  },
  conditionTitle: {
    ...theme.typography.body,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 4
  },
  description: {
    fontSize: 13,
    color: '#888888',
    lineHeight: 18
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CCCCCC',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkboxChecked: {
    borderColor: '#C3EA4F',
    backgroundColor: '#C3EA4F'
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
  skeletonRow: {
    borderBottomColor: '#F0F0F0'
  },
  skeletonTextBlock: {
    flex: 1,
    paddingRight: 16
  },
  skeletonTitle: {
    width: 120,
    height: 14,
    borderRadius: 4,
    backgroundColor: '#E5E5E5',
    marginBottom: 6
  },
  skeletonDescription: {
    width: 220,
    height: 12,
    borderRadius: 4,
    backgroundColor: '#E5E5E5'
  },
  skeletonCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#E5E5E5'
  }
});

