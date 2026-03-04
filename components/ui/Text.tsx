import React from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleSheet } from 'react-native';
import { theme } from '../../lib/theme';

type TextVariant = 'h1' | 'h2' | 'h3' | 'body' | 'caption' | 'captionSm' | 'button';

type ColorKey = keyof typeof theme.colors;

interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: ColorKey;
}

export function Text({ variant = 'body', color, style, ...props }: TextProps) {
  const baseStyle = styles[variant];
  const colorStyle = {
    color: color ? theme.colors[color] : theme.colors.textPrimary
  };

  return <RNText style={[baseStyle, colorStyle, style]} {...props} />;
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

