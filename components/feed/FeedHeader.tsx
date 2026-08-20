import React, { useRef } from 'react';
import { Image, StyleSheet, TextInput, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import CartIcon from '../../assets/icons/cart2.svg';
import NotificationIcon from '../../assets/icons/bell2.svg';
import CoeurIcon from '../../assets/icons/heart2.svg';
import SearchIcon from '../../assets/icons/search2.svg';
import { IconBox } from '../ui/IconBox';
import { theme } from '../../lib/theme';
import { HIT_SLOP_EXTRA, HIT_SLOP_COMFORTABLE, HEADER_ICON_TOUCH_CONTAINER } from '../../lib/touchTargets';
import { useFeedFiltersStore } from '../../lib/store/feedFilters';
import { useAuthStore } from '../../stores/authStore';
import { openGuestAuthPrompt } from '../../lib/guestAuthPrompt';
import { openProfileShortcutFromFeed } from '../../lib/navigation/feedShortcutNav';
import { useTranslation } from 'react-i18next';

type FeedHeaderProps = {
  searchText: string;
  onSearchTextChange: (text: string) => void;
  onSubmitSearch: () => void;
  onSearchFocus?: () => void;
  searchActive?: boolean;
  onClearSearch?: () => void;
  onDismissSearch?: () => void;
  unreadNotificationsCount: number;
};

export function FeedHeader({
  searchText,
  onSearchTextChange,
  onSubmitSearch,
  onSearchFocus,
  searchActive = false,
  onClearSearch,
  onDismissSearch,
  unreadNotificationsCount
}: FeedHeaderProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useAuthStore((s) => s.session);
  const searchInputRef = useRef<TextInput>(null);

  const handleDismissSearch = () => {
    searchInputRef.current?.blur();
    onDismissSearch?.();
  };

  const requireAccount = (go: () => void) => {
    if (!session?.user) {
      openGuestAuthPrompt();
      return;
    }
    go();
  };
  const topIconBoxSize = {
    heart: 27,
    cart: 30,
    notification: 36
  };

  return (
    <View style={[styles.stickyHeader, { paddingTop: insets.top + 8 }]}>
      <View style={styles.topHeaderRow}>
        <Image
          source={require('../../assets/brand/logo-bloomi-black.png')}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() =>
              requireAccount(() => {
                openProfileShortcutFromFeed(router, '/tabs/profile/favorites');
              })
            }
            activeOpacity={0.7}
            style={styles.headerIconHit}
            hitSlop={HIT_SLOP_EXTRA}
            accessibilityRole="button"
            accessibilityLabel={t('feed.header.favorites')}
          >
            <IconBox Svg={CoeurIcon} boxSize={topIconBoxSize.heart} color="#000000" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              requireAccount(() => {
                openProfileShortcutFromFeed(router, '/tabs/profile/orders');
              })
            }
            activeOpacity={0.7}
            style={styles.headerIconHit}
            hitSlop={HIT_SLOP_EXTRA}
            accessibilityRole="button"
            accessibilityLabel={t('feed.header.orders')}
          >
            <IconBox Svg={CartIcon} boxSize={topIconBoxSize.cart} color="#000000" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              requireAccount(() => {
                openProfileShortcutFromFeed(router, '/tabs/profile/notifications');
              })
            }
            activeOpacity={0.7}
            style={styles.headerIconHit}
            hitSlop={HIT_SLOP_EXTRA}
            accessibilityRole="button"
            accessibilityLabel={t('feed.header.notifications')}
          >
            <View style={styles.bellWrap}>
              <IconBox Svg={NotificationIcon} boxSize={topIconBoxSize.notification} color="#000000" />
              {unreadNotificationsCount > 0 ? (
                <View style={styles.badge} />
              ) : null}
            </View>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.searchBar}>
        <View
          style={[styles.searchInputWrap, searchActive && styles.searchInputWrapFocused]}
        >
          <View style={styles.searchIconSlot}>
            <IconBox Svg={SearchIcon} boxSize={16} color="#000000" />
          </View>
          <TextInput
            ref={searchInputRef}
            placeholder={t('feed.header.searchPlaceholder')}
            placeholderTextColor="#AAAAAA"
            style={styles.searchInput}
            value={searchText}
            onChangeText={onSearchTextChange}
            onFocus={onSearchFocus}
            returnKeyType="search"
            onSubmitEditing={onSubmitSearch}
            allowFontScaling={false}
            maxFontSizeMultiplier={1}
          />
          {searchText.length > 0 && onClearSearch ? (
            <TouchableOpacity
              onPress={onClearSearch}
              hitSlop={HIT_SLOP_COMFORTABLE}
              style={styles.clearButton}
              accessibilityRole="button"
              accessibilityLabel={t('filters.clearSearch')}
            >
              <Text style={styles.clearText}>×</Text>
            </TouchableOpacity>
          ) : null}
          {!searchActive ? (
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.filterButton}
              onPress={() =>
                {
                  // Sécurité: le feed ne doit jamais rester filtré par ce bouton.
                  useFeedFiltersStore.getState().resetFilters();
                  // Filtres au niveau onglets (pas la pile Search) : évite un modal
                  // slide_from_bottom qui reste sur l’onglet Search et se referme au tap Search.
                  router.push({
                    pathname: '/tabs/filters' as any,
                    params: {
                      returnTo: 'search',
                      scope: 'search',
                      from: 'feed-search-filters',
                      resultsSection: 'search'
                    }
                  });
                }
              }
              accessibilityRole="button"
              accessibilityLabel={t('feed.header.openFilters')}
            >
              <Feather name="menu" size={18} color="#000000" />
            </TouchableOpacity>
          ) : null}
        </View>
        {searchActive && onDismissSearch ? (
          <TouchableOpacity
            onPress={handleDismissSearch}
            activeOpacity={0.7}
            style={styles.cancelButton}
            hitSlop={HIT_SLOP_COMFORTABLE}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
          >
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stickyHeader: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingBottom: 8,
    backgroundColor: theme.colors.background,
    zIndex: 10,
    elevation: 4
  },
  topHeaderRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  headerLogo: {
    width: 166,
    height: 32,
    marginLeft: -10
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    gap: 8
  },
  searchInputWrap: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F6',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingRight: 4
  },
  searchInputWrapFocused: {
    borderColor: theme.colors.appleBlack
  },
  searchIconSlot: {
    paddingLeft: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#000000',
    paddingVertical: 0,
    paddingRight: 8
  },
  clearButton: {
    width: 28,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  clearText: {
    fontSize: 22,
    lineHeight: 24,
    color: theme.colors.sectionLabel,
    fontWeight: '400'
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center'
  },
  cancelButton: {
    minHeight: 44,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.appleBlack
  },
  headerIconHit: {
    ...HEADER_ICON_TOUCH_CONTAINER,
    marginLeft: 2
  },
  bellWrap: {
    position: 'relative',
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  badge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#C3EA4F',
    position: 'absolute',
    top: 4,
    right: 4
  }
});
