import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/ui/Screen';
import { Text } from '../../components/ui/Text';
import { Button } from '../../components/ui/Button';
import { HeaderBackButton } from '../../components/ui/HeaderBackButton';
import { theme } from '../../lib/theme';
import { useFeedFiltersStore } from '../../lib/store/feedFilters';
import { getChildCategories } from '../../lib/api/filters';

type CategoryRow = {
  id: number;
  name: string;
};

export default function CategoryDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ parentId?: string; title?: string; gender?: string }>();
  const parentId = params.parentId ? Number(params.parentId) : NaN;
  const headerTitle = params.title || 'Category';
  const gender = params.gender as string | undefined;

  const { filters, setFilters } = useFeedFiltersStore();
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>(filters.categoryFilter?.categoryIds ?? []);
  const [loading, setLoading] = useState(false);

  const toggleCategory = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  };

  const handleShowResult = () => {
    setFilters({
      categoryFilter:
        selectedIds.length > 0
          ? {
              gender,
              categoryIds: selectedIds
            }
          : undefined
    });
    router.back();
  };

  useEffect(() => {
    if (!Number.isFinite(parentId)) return;

    const load = async () => {
      try {
        setLoading(true);
        const data = await getChildCategories(parentId);
        setCategories(
          (data as any[]).map((row) => ({
            id: row.id as number,
            name: row.name as string
          }))
        );
      } catch {
        setCategories([]);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [parentId]);

  return (
    <Screen noHorizontalPadding style={{ backgroundColor: '#FFFFFF' }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <HeaderBackButton onPress={() => router.back()} />
          <Text variant="body" style={styles.headerTitle}>
            {headerTitle}
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
              {categories.map((cat) => {
                const checked = selectedIds.includes(cat.id);
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={styles.row}
                    activeOpacity={0.7}
                    onPress={() => toggleCategory(cat.id)}
                  >
                    <Text variant="body" style={styles.rowLabel}>
                      {cat.name}
                    </Text>
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
            { paddingBottom: insets.bottom + 24 }
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
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  }
});

