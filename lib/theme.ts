/**
 * Design System Theme - Bloomi App
 * Basé sur les specs Figma (iPhone 375px)
 */

import { colors } from './ui/colors';
import { typography, fontFamily } from './ui/typography';
import { spacing } from './ui/spacing';
import { radius } from './ui/radius';

export const theme = {
  colors,
  typography,
  fontFamily,
  spacing,
  radius,
  // Design width de référence (iPhone)
  designWidth: 375
} as const;

export type Theme = typeof theme;
