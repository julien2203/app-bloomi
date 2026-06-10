import React from 'react';
import { View, Image, ImageSourcePropType, StyleSheet } from 'react-native';
import type { SvgProps } from 'react-native-svg';

type SvgIconComponent = React.ComponentType<SvgProps>;

export type IconBoxProps =
  | { boxSize: number; source: ImageSourcePropType; Svg?: undefined; color?: string }
  | { boxSize: number; Svg: SvgIconComponent; source?: undefined; color?: string };

/**
 * Cadre fixe + contenu en « contain » pour harmoniser le rendu visuel entre icônes
 * (même fichier SVG, glyphes de tailles différentes dans le viewBox).
 * Pour les PNG/JPEG : pattern Image + resizeMode="contain".
 * Pour les SVG (transformés en composants par Metro) : équivalent avec largeur/hauteur 100 %.
 */
export function IconBox(props: IconBoxProps) {
  const { boxSize, color } = props;

  if ('source' in props && props.source) {
    return (
      <View style={[styles.outer, { width: boxSize, height: boxSize }]} pointerEvents="none">
        <Image source={props.source} style={styles.fill} resizeMode="contain" />
      </View>
    );
  }

  const Svg = props.Svg;
  return (
    <View style={[styles.outer, { width: boxSize, height: boxSize }]} pointerEvents="none">
      <View style={styles.fill}>
        <Svg
          width="100%"
          height="100%"
          pointerEvents="none"
          preserveAspectRatio="xMidYMid meet"
          color={color}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  fill: {
    width: '100%',
    height: '100%'
  }
});
