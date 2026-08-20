import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../lib/theme';
import { Text } from '../ui/Text';
import { HIT_SLOP_COMFORTABLE } from '../../lib/touchTargets';

export type SearchFilterShortcut = {
  id: string;
  label: string;
  active: boolean;
  onPress: () => void;
};

export type SearchFilterChip = {
  id: string;
  label: string;
  onPress: () => void;
  onClear: () => void;
};

type Props = {
  /** Pills de la barre rapide horizontale (Catégorie, Marque, État, Couleur, Prix, Taille). */
  quickFilters: SearchFilterShortcut[];
  activeChips: SearchFilterChip[];
  onClearAll: () => void;
  /** Gardé pour réactivation future — actuellement masqué. */
  onPressFilters?: () => void;
  filtersCount?: number;
};

export function SearchFiltersBar({
  quickFilters,
  activeChips,
  onClearAll
}: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.wrap}>
      {/* Barre horizontale scrollable */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillsContent}
        style={styles.pillsScroll}
      >
        {quickFilters.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.pill, item.active && styles.pillActive]}
            onPress={item.onPress}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={item.label}
          >
            <Text style={[styles.pillText, item.active && styles.pillTextActive]} numberOfLines={1}>
              {item.label}
            </Text>
            {item.active ? <Text style={styles.pillCaret}> ▾</Text> : null}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Active chips */}
      {activeChips.length > 0 ? (
        <View style={styles.chipsWrap}>
          {activeChips.map((chip) => (
            <View key={chip.id} style={styles.activeChip}>
              <TouchableOpacity onPress={chip.onPress} activeOpacity={0.8} style={styles.activeChipLabelHit}>
                <Text style={styles.chipText} numberOfLines={1}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={chip.onClear}
                hitSlop={HIT_SLOP_COMFORTABLE}
                accessibilityRole="button"
                accessibilityLabel={t('common.delete')}
                style={styles.activeChipClear}
              >
                <Text style={styles.activeChipClearText}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity onPress={onClearAll} activeOpacity={0.7} style={styles.clearAllHit}>
            <Text style={styles.clearAllText}>{t('common.clearAll')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    marginBottom: 4,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.separator,
    paddingBottom: 12
  },
  pillsScroll: {
    flexGrow: 0
  },
  pillsContent: {
    paddingHorizontal: theme.spacing.screenPaddingX,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center'
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.separator,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: theme.colors.googleWhite
  },
  pillActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  },
  pillText: {
    fontSize: 14,
    color: theme.colors.textPrimary,
    fontFamily: theme.fontFamily.medium
  },
  pillTextActive: {
    color: theme.colors.appleBlack
  },
  pillCaret: {
    fontSize: 10,
    color: theme.colors.appleBlack
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: theme.spacing.screenPaddingX
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    paddingLeft: 12,
    paddingRight: 4,
    paddingVertical: 6,
    maxWidth: '100%'
  },
  activeChipLabelHit: {
    flexShrink: 1,
    paddingVertical: 2
  },
  activeChipClear: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center'
  },
  activeChipClearText: {
    fontSize: 18,
    lineHeight: 20,
    color: theme.colors.appleBlack
  },
  chipText: {
    fontSize: 14,
    color: theme.colors.textPrimary
  },
  clearAllHit: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 4
  },
  clearAllText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontFamily: theme.fontFamily.medium,
    textDecorationLine: 'underline'
  }
});
