import React from 'react';
import { ImageBackground, StyleSheet, TextInput, View, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../../lib/theme';
import { images } from '../../lib/assets';
import { useRouter } from 'expo-router';
import { Text } from '../ui/Text';

interface HomeHeroProps {
  backgroundUri: string | null;
}

export function HomeHero({ backgroundUri }: HomeHeroProps) {
  const router = useRouter();

  const handleSellPress = () => {
    router.push('/tabs/sell/index');
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
        resizeMode="cover"
      >
        <View style={styles.overlay} />
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
                placeholder="Adidas shoes"
                placeholderTextColor={theme.colors.textSecondary}
                style={styles.searchInput}
              />
              <Feather
                name="sliders"
                size={20}
                color={theme.colors.textPrimary}
                style={styles.filterIcon}
              />
            </View>
            <View style={styles.actions}>
              <Feather
                name="shopping-cart"
                size={22}
                color={theme.colors.googleWhite}
              />
              <Feather
                name="bell"
                size={22}
                color={theme.colors.googleWhite}
              />
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
    height: 56,
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
  filterIcon: {
    marginLeft: theme.spacing.gapSm
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: theme.spacing.gapMd
  },
  bottomCtaContainer: {
    alignItems: 'center'
  },
  ctaButton: {
    height: 52,
    borderRadius: theme.radius.heroCta,
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

