/**
 * Design System - Couleurs
 * Basé sur les specs Figma
 */

export const colors = {
  primary: '#C3EA4F',
  appleBlack: '#000000',
  googleWhite: '#FFFFFF',
  facebookBlue: '#425B90',
  textPrimary: '#111111',
  textSecondary: '#6B7280',
  backgroundWhite: '#FFFFFF'
} as const;

export type ColorName = keyof typeof colors;
