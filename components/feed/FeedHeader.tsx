import React from 'react';
import { Image, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import CartIcon from '../../assets/icons/cart.svg';
import NotificationIcon from '../../assets/icons/notification_icon.svg';
import CoeurIcon from '../../assets/icons/coeur.svg';
import { IconBox } from '../ui/IconBox';
import { theme } from '../../lib/theme';
import { HIT_SLOP_EXTRA, HEADER_ICON_TOUCH_CONTAINER } from '../../lib/touchTargets';
import { Text } from '../ui/Text';

type FeedHeaderProps = {
  searchText: string;
  onSearchTextChange: (text: string) => void;
  onSubmitSearch: () => void;
  unreadNotificationsCount: number;
};

export function FeedHeader({
  searchText,
  onSearchTextChange,
  onSubmitSearch,
  unreadNotificationsCount
}: FeedHeaderProps) {
  const router = useRouter();

  return (
    <View style={styles.stickyHeader}>
      <View style={styles.topHeaderRow}>
        <Image
          source={require('../../assets/brand/logo-bloomi-black.png')}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => router.push('/tabs/profile/favorites')}
            activeOpacity={0.7}
            style={styles.headerIconHit}
            hitSlop={HIT_SLOP_EXTRA}
            accessibilityRole="button"
            accessibilityLabel="Favoris"
          >
            <IconBox Svg={CoeurIcon} boxSize={32} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/tabs/profile/orders')}
            activeOpacity={0.7}
            style={styles.headerIconHit}
            hitSlop={HIT_SLOP_EXTRA}
            accessibilityRole="button"
            accessibilityLabel="Panier"
          >
            <IconBox Svg={CartIcon} boxSize={28} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/tabs/profile/notifications' as any)}
            activeOpacity={0.7}
            style={styles.headerIconHit}
            hitSlop={HIT_SLOP_EXTRA}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <View style={styles.bellWrap}>
              <IconBox Svg={NotificationIcon} boxSize={24} />
              {unreadNotificationsCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadNotificationsCount > 99 ? '99+' : String(unreadNotificationsCount)}
                  </Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.searchBar}>
        <View style={styles.searchInputWrap}>
          <View style={styles.searchIconSlot}>
            <Feather name="search" size={20} color={theme.colors.textSecondary} />
          </View>
          <TextInput
            placeholder="Search for an item"
            placeholderTextColor={theme.colors.textSecondary}
            style={styles.searchInput}
            value={searchText}
            onChangeText={onSearchTextChange}
            returnKeyType="search"
            onSubmitEditing={onSubmitSearch}
            allowFontScaling={false}
            maxFontSizeMultiplier={1}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stickyHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: theme.colors.background
  },
  topHeaderRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  headerLogo: {
    width: 110,
    height: 28
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48
  },
  searchInputWrap: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: theme.colors.googleWhite,
    borderRadius: theme.radius.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.separator
  },
  searchIconSlot: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.gapSm
  },
  searchInput: {
    flex: 1,
    ...theme.typography.body,
    color: theme.colors.textPrimary
  },
  headerIconHit: {
    ...HEADER_ICON_TOUCH_CONTAINER,
    marginLeft: 4
  },
  bellWrap: {
    position: 'relative',
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  badge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'red',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: -4,
    right: -4
  },
  badgeText: {
    textAlign: 'center',
    lineHeight: 18,
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white'
  }
});
