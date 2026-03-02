/**
 * Design System - Typographie
 * Basé sur les specs Figma
 * Police: Inter (Regular, Medium, SemiBold, Bold)
 */

// Noms des polices Inter selon le poids
export const fontFamily = {
  regular: 'Inter-Regular',
  medium: 'Inter-Medium',
  semiBold: 'Inter-SemiBold',
  bold: 'Inter-Bold'
} as const;

// Styles de typographie selon les specs
export const typography = {
  h1: {
    fontSize: 28,
    fontFamily: fontFamily.semiBold,
    lineHeight: 34
  },
  h2: {
    fontSize: 22,
    fontFamily: fontFamily.semiBold,
    lineHeight: 28
  },
  body: {
    fontSize: 16,
    fontFamily: fontFamily.regular,
    lineHeight: 24
  },
  caption: {
    fontSize: 14,
    fontFamily: fontFamily.regular,
    lineHeight: 20
  },
  button: {
    fontSize: 16,
    fontFamily: fontFamily.semiBold,
    lineHeight: 24
  }
} as const;

export type TypographyVariant = keyof typeof typography;

/**
 * Helper pour obtenir les styles de typographie
 */
export function getTypographyStyle(variant: TypographyVariant) {
  return typography[variant];
}

/**
 * Helper pour obtenir le nom de la police selon le poids
 */
export function getFontFamily(weight: 'regular' | 'medium' | 'semiBold' | 'bold' = 'regular') {
  return fontFamily[weight];
}
