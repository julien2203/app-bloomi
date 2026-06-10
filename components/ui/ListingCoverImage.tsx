import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Image, type ImageContentFit, type ImagePriority } from 'expo-image';
import { getListingCoverImageUrl } from '../../lib/listingCoverImageUrl';

type ListingCoverImageProps = {
  uri: string | null | undefined;
  widthDp: number;
  heightDp: number;
  recyclingKey?: string;
  priority?: ImagePriority;
  contentFit?: ImageContentFit;
  style?: StyleProp<ViewStyle>;
};

export function ListingCoverImage({
  uri,
  widthDp,
  heightDp,
  recyclingKey,
  priority = 'normal',
  contentFit = 'cover',
  style
}: ListingCoverImageProps) {
  const originalUri = uri?.trim() || null;
  const optimizedUri = useMemo(
    () => (originalUri ? getListingCoverImageUrl(originalUri, widthDp, heightDp) : null),
    [originalUri, widthDp, heightDp]
  );

  const [activeUri, setActiveUri] = useState<string | null>(optimizedUri ?? originalUri);

  useEffect(() => {
    setActiveUri(optimizedUri ?? originalUri);
  }, [optimizedUri, originalUri]);

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
        if (originalUri && activeUri !== originalUri) {
          setActiveUri(originalUri);
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
