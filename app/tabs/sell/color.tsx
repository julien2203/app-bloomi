import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../lib/theme';
import { Button } from '../../../components/ui/Button';
import { Screen } from '../../../components/ui/Screen';
import { Text } from '../../../components/ui/Text';
import { useSellFormStore, type SellColor } from '../../../lib/store/sellForm';
import { AppIcon } from '../../../components/ui/AppIcon';
import { getColors } from '../../../lib/api/filters';

type ColorRow = {
  id: number;
  name: string;
  hex: string | null;
};

export default function SellColorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { values, setField } = useSellFormStore();
  const [colors, setColors] = useState<ColorRow[]>([]);
  const [selected, setSelected] = useState<SellColor | null>(values.color ?? null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await getColors();
        const mapped: ColorRow[] = (data as any[]).map((row) => ({
          id: row.id,
          name: row.name as string,
          hex: (row.hex as string | null) ?? null
        }));
        setColors(mapped);
      } catch {
        setColors([]);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const handleConfirm = () => {
    setField('color', selected);
    router.back();
  };

  return (
    <Screen noHorizontalPadding style={{ backgroundColor: '#FFFFFF' }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
            style={styles.backButton}
          >
            <AppIcon name="arrowLeftOutline" size={20} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text variant="body" style={styles.headerTitle}>
            Color
          </Text>
          <View style={styles.headerRightPlaceholder} />
        </View>

        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#C3EA4F" />
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.list}>
              {colors.map((item) => {
                const isSelected = selected?.id === item.id;
                const backgroundColor = item.hex ?? '#E5E5E5';
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.row}
                    activeOpacity={0.7}
                    onPress={() =>
                      setSelected({
                        id: item.id,
                        name: item.name
                      })
                    }
                  >
                    <View style={styles.rowLeft}>
                      <View
                        style={[
                          styles.colorCircle,
                          { backgroundColor }
                        ]}
                      />
                      <Text
                        variant="body"
                        style={styles.colorLabel}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.checkbox,
                        isSelected && styles.checkboxChecked
                      ]}
                    >
                      {isSelected && (
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
            title="Confirmer"
            onPress={handleConfirm}
            variant="primary"
            disabled={!selected}
            textStyle={{ fontWeight: '700' }}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgroundWhite
  },
  header: {
    paddingHorizontal: theme.spacing.horizontalPadding,
    paddingTop: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  backButton: {
    padding: 8
  },
  headerTitle: {
    ...theme.typography.body,
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.textPrimary
  },
  headerRightPlaceholder: {
    width: 32
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5'
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    flexShrink: 1
  },
  colorCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5E5'
  },
  colorLabel: {
    ...theme.typography.body,
    color: theme.colors.textPrimary
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
    paddingHorizontal: theme.spacing.horizontalPadding,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.backgroundWhite
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  }
});

