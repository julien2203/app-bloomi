import React from 'react';
import { ImageBackground, StyleSheet, View, TouchableOpacity } from 'react-native';
import { theme } from '../../lib/theme';
import { images } from '../../lib/assets';
import { useRouter } from 'expo-router';
import { Text } from '../ui/Text';
import { HIT_SLOP_EXTRA } from '../../lib/touchTargets';

interface HomeHeroProps {
  backgroundUri: string | null;
  unreadNotificationsCount?: number;
}

export function HomeHero({ backgroundUri, unreadNotificationsCount = 0 }: HomeHeroProps) {
  const router = useRouter();

  const handleSellPress = () => {
    router.push('/tabs/sell');
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
        imageStyle={styles.imageInner}
        resizeMode="cover"
      >
        <View style={styles.overlay} pointerEvents="none" />
        <View style={styles.content}>
          <View style={styles.bottomCtaContainer}>
            <TouchableOpacity
              onPress={handleSellPress}
              activeOpacity={0.85}
              style={styles.ctaButton}
              hitSlop={HIT_SLOP_EXTRA}
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
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden'
  },
  image: {
    width: '100%',
    height: 220
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
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 16
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

