/**
 * Composant Button - Design System Bloomi
 * Variants: primary-green, apple-black, google-white, facebook-blue, link
 */

import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { theme } from '../../lib/theme';

type ButtonVariant = 'primary-green' | 'apple-black' | 'google-white' | 'facebook-blue' | 'link';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary-green',
  disabled = false,
  loading = false,
  style,
  textStyle
}: ButtonProps) {
  const variantStyles = getVariantStyles(variant);
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        variantStyles.button,
        isDisabled && styles.disabled,
        style
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={variantStyles.textColor} size="small" />
      ) : (
        <Text style={[styles.text, variantStyles.text, textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

function getVariantStyles(variant: ButtonVariant) {
  switch (variant) {
    case 'primary-green':
      return {
        button: {
          backgroundColor: theme.colors.primary,
          borderWidth: 0
        },
        text: { color: theme.colors.appleBlack },
        textColor: theme.colors.appleBlack
      };
    case 'apple-black':
      return {
        button: {
          backgroundColor: theme.colors.appleBlack,
          borderWidth: 0
        },
        text: { color: theme.colors.googleWhite },
        textColor: theme.colors.googleWhite
      };
    case 'google-white':
      return {
        button: {
          backgroundColor: theme.colors.googleWhite,
          borderWidth: 1,
          borderColor: '#E5E7EB'
        },
        text: { color: theme.colors.textPrimary },
        textColor: theme.colors.textPrimary
      };
    case 'facebook-blue':
      return {
        button: {
          backgroundColor: theme.colors.facebookBlue,
          borderWidth: 0
        },
        text: { color: theme.colors.googleWhite },
        textColor: theme.colors.googleWhite
      };
    case 'link':
      return {
        button: {
          backgroundColor: 'transparent',
          borderWidth: 0,
          height: 'auto',
          paddingVertical: 8
        },
        text: { color: theme.colors.primary },
        textColor: theme.colors.primary
      };
  }
}

const styles = StyleSheet.create({
  button: {
    height: theme.spacing.buttonHeight,
    borderRadius: theme.radius.buttonRadius,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row'
  },
  text: {
    ...theme.typography.button,
    color: theme.colors.textPrimary
  },
  disabled: {
    opacity: 0.5
  }
});
