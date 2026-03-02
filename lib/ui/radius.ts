/**
 * Design System - Border Radius
 * Basé sur les specs Figma
 */

export const radius = {
  buttonRadius: 12,
  cardRadius: 12
} as const;

export type RadiusName = keyof typeof radius;
