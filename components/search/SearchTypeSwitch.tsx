import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../lib/theme';
import { Text } from '../ui/Text';

export type SearchResultTab = 'listings' | 'members';

type Props = {
  value: SearchResultTab;
  onChange: (tab: SearchResultTab) => void;
  listingsCount?: string | null;
  membersCount?: string | null;
};

export function SearchTypeSwitch({ value, onChange, listingsCount, membersCount }: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.wrap} accessibilityRole="tablist">
      <View style={styles.track}>
        <Segment
          label={t('filters.searchTabListings')}
          count={listingsCount}
          selected={value === 'listings'}
          onPress={() => onChange('listings')}
        />
        <Segment
          label={t('filters.searchTabMembers')}
          count={membersCount}
          selected={value === 'members'}
          onPress={() => onChange('members')}
        />
      </View>
    </View>
  );
}

function Segment({
  label,
  count,
  selected,
  onPress
}: {
  label: string;
  count?: string | null;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.segment, selected && styles.segmentSelected]}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={count ? `${label}, ${count}` : label}
    >
      <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
        {label}
      </Text>
      {count ? (
        <View style={[styles.badge, selected && styles.badgeSelected]}>
          <Text style={[styles.badgeText, selected && styles.badgeTextSelected]}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    marginTop: 12
  },
  track: {
    flexDirection: 'row',
    backgroundColor: theme.colors.muted,
    borderRadius: 999,
    padding: 4,
    gap: 4
  },
  segment: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    gap: 6
  },
  segmentSelected: {
    backgroundColor: theme.colors.primary
  },
  label: {
    fontSize: 14,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    fontFamily: theme.fontFamily.medium
  },
  labelSelected: {
    color: theme.colors.appleBlack,
    fontFamily: theme.fontFamily.semiBold
  },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.08)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  badgeSelected: {
    backgroundColor: 'rgba(0,0,0,0.12)'
  },
  badgeText: {
    fontSize: 11,
    lineHeight: 14,
    color: theme.colors.textSecondary,
    fontFamily: theme.fontFamily.semiBold
  },
  badgeTextSelected: {
    color: theme.colors.appleBlack
  }
});
