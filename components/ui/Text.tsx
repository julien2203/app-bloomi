import React from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleSheet, type TextStyle } from 'react-native';
import { theme } from '../../lib/theme';

type TextVariant = 'h1' | 'h2' | 'h3' | 'body' | 'caption' | 'captionSm' | 'button';

type ColorKey = keyof typeof theme.colors;

interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: ColorKey;
}

function resolvePoppinsFamilyFromWeight(fontWeight?: TextStyle['fontWeight']) {
  if (!fontWeight) return undefined;
  if (fontWeight === 'normal') return theme.fontFamily.regular;
  if (fontWeight === 'bold') return theme.fontFamily.bold;
  if (fontWeight === '100' || fontWeight === '200' || fontWeight === '300') {
    return 'Poppins_300Light';
  }
  if (fontWeight === '400') return theme.fontFamily.regular;
  if (fontWeight === '500') return theme.fontFamily.medium;
  if (fontWeight === '600') return theme.fontFamily.semiBold;
  if (fontWeight === '700' || fontWeight === '800' || fontWeight === '900') {
    return theme.fontFamily.bold;
  }
  return undefined;
}

export function Text({ variant = 'body', color, style, ...props }: TextProps) {
  const baseStyle = styles[variant];
  const colorStyle = {
    color: color ? theme.colors[color] : theme.colors.textPrimary
  };
  const flattenedStyle = StyleSheet.flatten(style) as TextStyle | undefined;
  const weightFontFamily = resolvePoppinsFamilyFromWeight(flattenedStyle?.fontWeight);
  const normalizedWeightStyle =
    flattenedStyle?.fontWeight != null || weightFontFamily
      ? {
          ...(flattenedStyle?.fontWeight != null ? { fontWeight: undefined } : {}),
          ...(weightFontFamily ? { fontFamily: weightFontFamily } : {})
        }
      : undefined;

  return <RNText style={[baseStyle, colorStyle, style, normalizedWeightStyle]} {...props} />;
}

const styles = StyleSheet.create({
  h1: {
    ...theme.typography.h1
  },
  h2: {
    ...theme.typography.h2
  },
  h3: {
    ...theme.typography.h3
  },
  body: {
    ...theme.typography.body
  },
  caption: {
    ...theme.typography.caption
  },
  captionSm: {
    ...theme.typography.captionSm
  },
  button: {
    ...theme.typography.button
  }
});

