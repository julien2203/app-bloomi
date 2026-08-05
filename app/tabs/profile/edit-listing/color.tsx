import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getSafeBottomInset } from '../../../../lib/safeArea';
import { theme } from '../../../../lib/theme';
import { Button } from '../../../../components/ui/Button';
import { Screen } from '../../../../components/ui/Screen';
import { Text } from '../../../../components/ui/Text';
import { useEditListingFormStore } from '../../../../lib/store/editListingForm';
import type { SellColor } from '../../../../lib/store/sellForm';
import { HeaderBackButton } from '../../../../components/ui/HeaderBackButton';
import { getColors } from '../../../../lib/api/filters';
import { sortColorsOtherLast, translateColorName } from '../../../../lib/colorI18n';
import { useTranslation } from 'react-i18next';

type ColorRow = {
  id: number;
  name: string;
  hex: string | null;
};

export default function EditListingColorScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const safeBottom = getSafeBottomInset(insets.bottom);
  const { values, setField } = useEditListingFormStore();
  const [colors, setColors] = useState<ColorRow[]>([]);
  const [selected, setSelected] = useState<SellColor[]>([...(values.color ?? [])]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await getColors();
        const mapped: ColorRow[] = (data as { id: number; name: string; hex?: string | null }[]).map(
          (row) => ({
            id: row.id,
            name: row.name,
            hex: row.hex ?? null
          })
        );
        setColors(sortColorsOtherLast(mapped));
      } catch {
        setColors([]);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  useEffect(() => {
    if (colors.length === 0 || !(values.color?.length)) return;
    setSelected((prev) => {
      if (prev.some((c) => c.id > 0)) return prev;
      return values.color!.map((stored) => {
        const match = colors.find(
          (row) => row.name.trim().toLowerCase() === stored.name.trim().toLowerCase()
        );
        return match ? { id: match.id, name: match.name } : stored;
      });
    });
  }, [colors, values.color]);

  const handleConfirm = () => {
    setField('color', selected);
    router.back();
  };

  return (
    <Screen noHorizontalPadding style={{ backgroundColor: '#FFFFFF' }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <HeaderBackButton onPress={() => router.back()} />
          <Text variant="body" style={styles.headerTitle}>
            {t('sell.color')}
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
                const isSelected = selected.some((c) => c.id === item.id);
                const backgroundColor = item.hex ?? '#E5E5E5';
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.row}
                    activeOpacity={0.7}
                    onPress={() => {
                      const exists = selected.some((c) => c.id === item.id);
                      if (exists) {
                        setSelected((prev) => prev.filter((c) => c.id !== item.id));
                      } else if (selected.length < 3) {
                        setSelected((prev) => [...prev, { id: item.id, name: item.name }]);
                      }
                    }}
                  >
                    <View style={styles.rowLeft}>
                      <View style={[styles.colorCircle, { backgroundColor }]} />
                      <Text variant="body" style={styles.colorLabel} numberOfLines={1}>
                        {translateColorName(item.name, t)}
                      </Text>
                    </View>
                    <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                      {isSelected ? <View style={styles.checkboxInner} /> : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        <View style={[styles.footer, { paddingBottom: safeBottom + 24 }]}>
          <Button
            title={t('common.confirm')}
            onPress={handleConfirm}
            variant="primary"
            disabled={selected.length === 0}
            textStyle={{ fontWeight: '700' }}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.backgroundWhite },
  header: {
    paddingHorizontal: theme.spacing.horizontalPadding,
    paddingTop: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerTitle: {
    ...theme.typography.body,
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.textPrimary
  },
  headerRightPlaceholder: { width: 32 },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
  list: { paddingBottom: 24 },
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
  rowLeft: { flexDirection: 'row', alignItems: 'center', columnGap: 12, flexShrink: 1 },
  colorCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5E5'
  },
  colorLabel: { ...theme.typography.body, color: theme.colors.textPrimary },
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
  checkboxChecked: { borderColor: '#C3EA4F', backgroundColor: '#C3EA4F' },
  checkboxInner: {
    width: 8,
    height: 8,
    borderRadius: 1,
    backgroundColor: '#FFFFFF'
  },
  footer: {
    paddingHorizontal: theme.spacing.horizontalPadding,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.backgroundWhite
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});
