import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, type StyleProp } from 'react-native';
import { Image, type ImageContentFit, type ImageStyle } from 'expo-image';
import { toListingCardImageUrl, toListingFullImageUrl } from '../../lib/listingPhotoUtils';

type ListingCoverImageProps = {
  uri: string | null | undefined;
  widthDp: number;
  heightDp: number;
  recyclingKey?: string;
  priority?: 'low' | 'normal' | 'high' | number;
  contentFit?: ImageContentFit;
  style?: StyleProp<ImageStyle>;
  /** `card` (défaut) = variante légère feed ; `full` = original. */
  variant?: 'card' | 'full';
};

/** Origins known to lack a `.card.jpg` sibling (avoids repeat 404s this session). */
const missingCardOrigins = new Set<string>();

/**
 * Affiche une cover depuis Storage public.
 * Préfère `*.card.jpg` (upload + backfill) pour le feed ; fallback full si absent.
 */
export function ListingCoverImage({
  uri,
  widthDp: _widthDp,
  heightDp: _heightDp,
  recyclingKey,
  priority = 'normal',
  contentFit = 'cover',
  style,
  variant = 'card'
}: ListingCoverImageProps) {
  const fullUri = useMemo(() => toListingFullImageUrl(uri), [uri]);
  const cardUri = useMemo(() => toListingCardImageUrl(fullUri), [fullUri]);

  const preferredUri = useMemo(() => {
    if (!fullUri) return null;
    if (variant === 'full') return fullUri;
    if (missingCardOrigins.has(fullUri)) return fullUri;
    return cardUri ?? fullUri;
  }, [fullUri, cardUri, variant]);

  const [activeUri, setActiveUri] = useState<string | null>(preferredUri);

  useEffect(() => {
    setActiveUri(preferredUri);
  }, [preferredUri]);

  if (!activeUri) return null;

  return (
    <Image
      source={activeUri}
      style={[styles.image, style]}
      contentFit={contentFit}
      cachePolicy="memory-disk"
      recyclingKey={recyclingKey}
      priority={priority}
      onError={() => {
        if (
          variant === 'card' &&
          fullUri &&
          activeUri !== fullUri &&
          cardUri &&
          activeUri === cardUri
        ) {
          missingCardOrigins.add(fullUri);
          setActiveUri(fullUri);
        }
      }}
    />
  );
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F5F5F5'
  }
});
