import React, { memo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { formatCompactCount } from '../../lib/formatCompactCount';
import type { FeaturedInfluencer } from '../../lib/featuredInfluencers';

import { theme } from '../../lib/theme';
import { GRID_GAP, horizontalCardWidth } from '../../lib/cardLayout';

type SpotlightImagePriority = 'low' | 'normal' | 'high';

const CTA_BORDER_RADIUS = 42.31;

type InfluencerSpotlightCardProps = {
  influencer: FeaturedInfluencer;
  cardWidth: number;
  cardHeight: number;
  onPress: () => void;
  imagePriority?: SpotlightImagePriority;
};

function InfluencerSpotlightCardComponent({
  influencer,
  cardWidth,
  cardHeight,
  onPress,
  imagePriority = 'normal'
}: InfluencerSpotlightCardProps) {
  const { t } = useTranslation();
  const name = (influencer.display_name ?? '').trim() || t('common.seller');
  const articlesLabel = t('feed.influencersSpotlight.articles', {
    count: formatCompactCount(influencer.active_listings_count)
  });

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { width: cardWidth, height: cardHeight }]}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${articlesLabel}`}
    >
      <Image
        source={{ uri: influencer.image_url }}
        style={styles.image}
        contentFit="cover"
        transition={0}
        priority={imagePriority}
      />

      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.82)']}
        locations={[0.35, 0.62, 1]}
        style={styles.gradient}
      />

      <View style={styles.overlay}>
        <Text style={styles.name} numberOfLines={2}>
          {name}
        </Text>
        <Text style={styles.articles} numberOfLines={1}>
          {articlesLabel}
        </Text>
        <View style={styles.cta}>
          <Text style={styles.ctaText}>{t('feed.influencersSpotlight.viewProfile')}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export const InfluencerSpotlightCard = memo(InfluencerSpotlightCardComponent);

const FIGMA_CARD_WIDTH = 342;
const FIGMA_CARD_HEIGHT = 240;

export function influencerSpotlightCardSize(screenWidth: number): {
  width: number;
  height: number;
} {
  const trendCardWidth = horizontalCardWidth(screenWidth);
  const width = trendCardWidth * 2 + GRID_GAP;
  return {
    width,
    height: Math.round(width * (FIGMA_CARD_HEIGHT / FIGMA_CARD_WIDTH))
  };
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E5E5E5',
    borderWidth: 1,
    borderColor: '#E8E8E8'
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%'
  },
  gradient: {
    ...StyleSheet.absoluteFillObject
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 28
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4
  },
  articles: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.92)',
    marginBottom: 12
  },
  cta: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.primary,
    borderRadius: CTA_BORDER_RADIUS,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  ctaText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    fontWeight: '400',
    color: '#111827'
  }
});
