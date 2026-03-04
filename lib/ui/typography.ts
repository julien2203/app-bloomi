/**
 * Design System - Typographie
 * Délégué à lib/theme.ts (source de vérité)
 */

import { theme } from '../theme';

export const fontFamily = theme.fontFamily;
export const typography = theme.typography;

export type TypographyVariant = keyof typeof typography;

export function getTypographyStyle(variant: TypographyVariant) {
  return typography[variant];
}

export function getFontFamily(weight: 'regular' | 'medium' | 'semiBold' | 'bold' = 'regular') {
  return fontFamily[weight];
}
