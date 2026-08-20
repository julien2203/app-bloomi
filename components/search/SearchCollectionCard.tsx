import React from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
  type ImageSourcePropType
} from 'react-native';
import { theme } from '../../lib/theme';
import { Text } from '../ui/Text';

const CARD_HEIGHT = 112;
const IMAGE_FLEX = 0.38;

type Props = {
  title: string;
  subtitle: string;
  image: ImageSourcePropType;
  onPress: () => void;
};

/** Carte éditoriale collection (texte gauche + image droite). */
export function SearchCollectionCard({ title, subtitle, image, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      <View style={styles.imageWrap}>
        <Image source={image} style={styles.image} resizeMode="cover" />
      </View>
    </TouchableOpacity>
  );
}

const editorialSerif = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'Georgia'
});

const styles = StyleSheet.create({
  card: {
    height: CARD_HEIGHT,
    flexDirection: 'row',
    borderRadius: theme.radius.card,
    overflow: 'hidden',
    backgroundColor: theme.colors.muted
  },
  copy: {
    flex: 1 - IMAGE_FLEX,
    paddingHorizontal: theme.spacing.gapMd,
    paddingVertical: theme.spacing.gapMd,
    justifyContent: 'center',
    backgroundColor: theme.colors.muted
  },
  title: {
    fontFamily: editorialSerif,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 6
  },
  subtitle: {
    ...theme.typography.captionSm,
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 16
  },
  imageWrap: {
    flex: IMAGE_FLEX,
    height: '100%',
    backgroundColor: theme.colors.border
  },
  image: {
    width: '100%',
    height: '100%'
  }
});
