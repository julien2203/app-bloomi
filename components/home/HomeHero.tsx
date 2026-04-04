import React from 'react';
import { ImageBackground, StyleSheet, TextInput, View, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../../lib/theme';
import { images } from '../../lib/assets';
import { useRouter } from 'expo-router';
import { Text } from '../ui/Text';
import { AppIcon } from '../ui/AppIcon';
import { HIT_SLOP_EXTRA, HEADER_ICON_TOUCH_CONTAINER } from '../../lib/touchTargets';

interface HomeHeroProps {
  backgroundUri: string | null;
}

export function HomeHero({ backgroundUri }: HomeHeroProps) {
  const router = useRouter();

  const handleSellPress = () => {
    router.push('/tabs/sell');
  };

  const handleFiltersPress = () => {
    router.push('/filters');
  };

  return (
    <View style={styles.container}>
      <ImageBackground
        source={
          backgroundUri
            ? { uri: backgroundUri }
            : images.hero
        }
        style={styles.image}
        imageStyle={styles.heroImageAlign}
        resizeMode="cover"
      >
        <View style={styles.overlay} pointerEvents="none" />
        <View style={styles.content}>
          <View style={styles.topBar}>
            <View style={styles.searchContainer}>
              <Feather
                name="search"
                size={20}
                color={theme.colors.textSecondary}
                style={styles.searchIcon}
              />
              <TextInput
                placeholder="Rechercher un article"
                placeholderTextColor={theme.colors.textSecondary}
                style={styles.searchInput}
              />
              <TouchableOpacity
                onPress={handleFiltersPress}
                activeOpacity={0.7}
                style={styles.filterHit}
                hitSlop={HIT_SLOP_EXTRA}
                accessibilityRole="button"
                accessibilityLabel="Filtres"
              >
                <AppIcon
                  name="settingsPersonalizeOutline"
                  size={20}
                  color={theme.colors.textPrimary}
                />
              </TouchableOpacity>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity
                onPress={() => router.push('/tabs/profile/orders')}
                activeOpacity={0.7}
                style={styles.heroRoundIconHit}
                hitSlop={HIT_SLOP_EXTRA}
                accessibilityRole="button"
                accessibilityLabel="Commandes"
              >
                <AppIcon name="cartLargeOutline" size={22} color={theme.colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push('/tabs/messages')}
                activeOpacity={0.7}
                style={styles.heroRoundIconHit}
                hitSlop={HIT_SLOP_EXTRA}
                accessibilityRole="button"
                accessibilityLabel="Messages"
              >
                <AppIcon
                  name="notificationsBellOutline"
                  size={22}
                  color={theme.colors.primary}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.bottomCtaContainer}>
            <TouchableOpacity
              onPress={handleSellPress}
              activeOpacity={0.85}
              style={styles.ctaButton}
            >
              <Text variant="button" style={styles.ctaText}>
                Vendre maintenant
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 310,
    overflow: 'hidden'
  },
  image: {
    flex: 1
  },
  /** Décale légèrement vers le haut pour mieux montrer le bas de la photo (cover centre par défaut). */
  heroImageAlign: {
    transform: [{ translateY: 0 }]
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)'
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingTop: 55,
    paddingBottom: 32
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.googleWhite,
    borderRadius: theme.radius.input,
    minHeight: 48,
    paddingVertical: 4,
    paddingHorizontal: theme.spacing.gapSm,
    marginRight: theme.spacing.gapMd,
    ...theme.shadows.card
  },
  searchIcon: {
    marginRight: theme.spacing.gapSm
  },
  searchInput: {
    flex: 1,
    ...theme.typography.body,
    color: theme.colors.textPrimary
  },
  filterHit: {
    ...HEADER_ICON_TOUCH_CONTAINER,
    marginLeft: 4
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4
  },
  heroRoundIconHit: {
    ...HEADER_ICON_TOUCH_CONTAINER
  },
  bottomCtaContainer: {
    alignItems: 'center'
  },
  ctaButton: {
    height: 52,
    borderRadius: theme.radius.button,
    backgroundColor: theme.colors.primary,
    borderWidth: 1,
    borderColor: theme.colors.heroCtaBorder,
    paddingHorizontal: theme.spacing.gapLg,
    alignItems: 'center',
    justifyContent: 'center'
  },
  ctaText: {
    color: theme.colors.appleBlack
  }
});

