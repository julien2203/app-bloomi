import React from 'react';
import { Image, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import CartIcon from '../../assets/icons/cart2.svg';
import NotificationIcon from '../../assets/icons/bell2.svg';
import CoeurIcon from '../../assets/icons/heart2.svg';
import SearchIcon from '../../assets/icons/search2.svg';
import { IconBox } from '../ui/IconBox';
import { theme } from '../../lib/theme';
import { HIT_SLOP_EXTRA, HEADER_ICON_TOUCH_CONTAINER } from '../../lib/touchTargets';
import { useFeedFiltersStore } from '../../lib/store/feedFilters';
import { useAuthStore } from '../../stores/authStore';
import { openGuestAuthPrompt } from '../../lib/guestAuthPrompt';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);

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
    <View style={styles.stickyHeader}>
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
                router.push('/tabs/profile/favorites');
              })
            }
            activeOpacity={0.7}
            style={styles.headerIconHit}
            hitSlop={HIT_SLOP_EXTRA}
            accessibilityRole="button"
            accessibilityLabel={t('feed.header.favorites')}
          >
            <IconBox Svg={CoeurIcon} boxSize={topIconBoxSize.heart} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              requireAccount(() => {
                router.push('/tabs/profile/orders');
              })
            }
            activeOpacity={0.7}
            style={styles.headerIconHit}
            hitSlop={HIT_SLOP_EXTRA}
            accessibilityRole="button"
            accessibilityLabel={t('feed.header.orders')}
          >
            <IconBox Svg={CartIcon} boxSize={topIconBoxSize.cart} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              requireAccount(() => {
                router.push({
                  pathname: '/tabs/profile/notifications' as any,
                  params: { from: 'feed' }
                });
              })
            }
            activeOpacity={0.7}
            style={styles.headerIconHit}
            hitSlop={HIT_SLOP_EXTRA}
            accessibilityRole="button"
            accessibilityLabel={t('feed.header.notifications')}
          >
            <View style={styles.bellWrap}>
              <IconBox Svg={NotificationIcon} boxSize={topIconBoxSize.notification} />
              {unreadNotificationsCount > 0 ? (
                <View style={styles.badge} />
              ) : null}
            </View>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.searchBar}>
        <View style={styles.searchInputWrap}>
          <View style={styles.searchIconSlot}>
            <IconBox Svg={SearchIcon} boxSize={16} />
          </View>
          <TextInput
            placeholder={t('feed.header.searchPlaceholder')}
            placeholderTextColor="#AAAAAA"
            style={styles.searchInput}
            value={searchText}
            onChangeText={onSearchTextChange}
            returnKeyType="search"
            onSubmitEditing={onSubmitSearch}
            allowFontScaling={false}
            maxFontSizeMultiplier={1}
          />
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
                  pathname: '/tabs/filters/index' as any,
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
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stickyHeader: {
    paddingLeft: 16,
    paddingRight: 16,
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
    minHeight: 44
  },
  searchInputWrap: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F6',
    borderRadius: 24,
    borderWidth: 0,
    paddingRight: 4
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
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center'
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
