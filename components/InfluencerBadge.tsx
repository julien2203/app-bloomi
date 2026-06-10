import React from 'react';
import { Image, type StyleProp, type ImageStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

/** Badge « compte vérifié » pour les profils influenceurs (PNG fourni par la marque). */
const BADGE_IMG = require('../assets/icons/influencer-verified-badge.png');

type Props = {
  /** Côté du carré du pictogramme (proportion conservée via contain). */
  size?: number;
  style?: StyleProp<ImageStyle>;
};

export function InfluencerBadge({ size = 18, style }: Props) {
  const { t } = useTranslation();
  const s = typeof size === 'number' && Number.isFinite(size) && size > 0 ? size : 18;
  return (
    <Image
      source={BADGE_IMG}
      style={[{ width: s, height: s }, style]}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel={t('components.influencerBadge.label')}
    />
  );
}
