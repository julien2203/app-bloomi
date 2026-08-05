import React from 'react';
import { ImageBackground, StyleSheet, View, Text as RNText } from 'react-native';
import { theme } from '../../lib/theme';
import { images } from '../../lib/assets';
import type { HomeHeroContent } from '../../lib/api/homeHero';

export type HomeHeroProps = {
  config: HomeHeroContent;
  unreadNotificationsCount?: number;
};

export function HomeHero({ config, unreadNotificationsCount: _unread = 0 }: HomeHeroProps) {
  const line1 = config.headlineLine1.trim();
  const line2 = config.headlineLine2.trim();
  const hasHeadlines = Boolean(line1 || line2);

  return (
    <View style={styles.container}>
      <ImageBackground
        source={config.imageUrl ? { uri: config.imageUrl } : images.hero}
        style={styles.image}
        imageStyle={styles.imageInner}
        resizeMode="cover"
      >
        <View style={styles.overlay} pointerEvents="none" />
        <View style={styles.content}>
          <View style={styles.topLeftBlock}>
            {hasHeadlines ? (
              <View>
                {line1 ? <RNText style={styles.headlineLine}>{line1}</RNText> : null}
                {line2 ? <RNText style={styles.headlineLine}>{line2}</RNText> : null}
              </View>
            ) : null}
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
    top: 0,
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
  headlineLine: {
    fontFamily: theme.fontFamily.semiBold,
    fontSize: 20,
    lineHeight: 25,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4
  }
});
