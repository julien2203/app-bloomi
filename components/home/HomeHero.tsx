import React, { useCallback } from 'react';
import { ImageBackground, StyleSheet, View, TouchableOpacity, Text as RNText } from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../lib/theme';
import { images } from '../../lib/assets';
import { useRouter, type Href } from 'expo-router';
import { HIT_SLOP_EXTRA } from '../../lib/touchTargets';
import { normalizeLanguage } from '../../lib/i18n';
import type { HomeHeroContent } from '../../lib/api/homeHero';
import { getDefaultHomeHero } from '../../lib/api/homeHero';

export type HomeHeroProps = {
  config?: HomeHeroContent;
  unreadNotificationsCount?: number;
};

export function HomeHero({ config, unreadNotificationsCount: _unread = 0 }: HomeHeroProps) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const fallbackHero = getDefaultHomeHero(normalizeLanguage(i18n.language));
  const hero = config ?? fallbackHero;

  const handleCtaPress = useCallback(() => {
    const route = hero.ctaRoute?.trim() || fallbackHero.ctaRoute;
    router.push(route as Href);
  }, [fallbackHero.ctaRoute, hero.ctaRoute, router]);

  return (
    <View style={styles.container}>
      <ImageBackground
        source={hero.imageUrl ? { uri: hero.imageUrl } : images.hero}
        style={styles.image}
        imageStyle={styles.imageInner}
        resizeMode="cover"
      >
        <View style={styles.overlay} pointerEvents="none" />
        <View style={styles.content}>
          <View style={styles.topLeftBlock}>
            <View style={styles.headlineBlock}>
              <RNText style={styles.headlineLine}>{hero.headlineLine1}</RNText>
              <RNText style={styles.headlineLine}>{hero.headlineLine2}</RNText>
            </View>
            <TouchableOpacity
              onPress={handleCtaPress}
              activeOpacity={0.85}
              style={styles.ctaButton}
              hitSlop={HIT_SLOP_EXTRA}
            >
              <RNText style={styles.ctaText}>{t('feed.hero.cta')}</RNText>
            </TouchableOpacity>
          </View>
        </View>
      </ImageBackground>
    </View>
  );
}

const HERO_HEIGHT = 157;

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden'
  },
  image: {
    width: '100%',
    height: HERO_HEIGHT
  },
  imageInner: {
    borderRadius: 12,
    objectFit: 'cover',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)'
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingTop: 37,
    paddingLeft: 18,
    paddingRight: 22,
    paddingBottom: 11
  },
  topLeftBlock: {
    alignItems: 'flex-start',
    maxWidth: '85%'
  },
  headlineBlock: {
    marginBottom: 8
  },
  headlineLine: {
    fontFamily: theme.fontFamily.semiBold,
    fontSize: 20,
    lineHeight: 25,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4
  },
  ctaButton: {
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8F6F6',
    borderWidth: 0,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  ctaText: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: theme.fontFamily.semiBold,
    color: '#171918'
  }
});
