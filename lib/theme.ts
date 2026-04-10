/**
 * Design System Theme - Bloomi App
 * Source unique de vérité pour les tokens
 * Basé sur les specs Figma (iPhone 375px)
 */

// Familles de polices Inter
const fontFamily = {
  regular: 'Inter-Regular',
  medium: 'Inter-Medium',
  semiBold: 'Inter-SemiBold',
  bold: 'Inter-Bold'
} as const;

// Couleurs principales
const colors = {
  primary: '#C3EA4F',
  lime: '#CCFF00',
  appleBlack: '#000000',
  googleWhite: '#FFFFFF',
  facebookBlue: '#425B90',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  separator: '#E5E5E5',
  background: '#FFFFFF',
  muted: '#F3F4F6',
  danger: '#EF4444',
  sectionLabel: '#AAAAAA',
  // Alias pour compatibilité avec le code existant
  backgroundWhite: '#FFFFFF',
  heroCtaBorder: '#14141A'
} as const;

// Typographie Inter
const typography = {
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
  h3: {
    fontSize: 18,
    fontFamily: fontFamily.semiBold,
    lineHeight: 24
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
  captionSm: {
    fontSize: 12,
    fontFamily: fontFamily.regular,
    lineHeight: 16
  },
  button: {
    fontSize: 16,
    fontFamily: fontFamily.semiBold,
    lineHeight: 24
  },
  settingsSectionLabel: {
    fontSize: 13,
    fontFamily: fontFamily.regular,
    lineHeight: 18
  },
  settingsHeaderTitle: {
    fontSize: 16,
    fontFamily: fontFamily.semiBold,
    lineHeight: 24
  }
} as const;

// Espacements
const spacing = {
  screenPaddingX: 16,
  buttonHeight: 56,
  gapSm: 8,
  gapMd: 16,
  gapLg: 24,
  settingsPaddingX: 20,
  settingsRowPaddingY: 16,
  settingsSectionTop: 20,
  settingsSectionBottom: 8,
  settingsHeaderPaddingY: 12,
  settingsHeaderSideWidth: 28,
  // Alias pour compatibilité avec le code existant
  horizontalPadding: 16
} as const;

// Radius
const radius = {
  button: 12,
  card: 12,
  input: 12,
  heroCta: 52,
  // Alias pour compatibilité avec le code existant
  buttonRadius: 12,
  cardRadius: 12
} as const;

// Optionnel: ombres simples pour les cartes / modales
const shadows = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2
  }
} as const;

export const theme = {
  colors,
  typography,
  fontFamily,
  spacing,
  radius,
  shadows,
  // Design width de référence (iPhone)
  designWidth: 375
} as const;

export type Theme = typeof theme;
