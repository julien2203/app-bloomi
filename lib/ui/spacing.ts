/**
 * Design System - Spacing
 * Basé sur les specs Figma
 */

export const spacing = {
  horizontalPadding: 16,
  buttonHeight: 56
} as const;

export type SpacingName = keyof typeof spacing;
