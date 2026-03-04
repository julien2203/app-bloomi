/**
 * Design System - Couleurs
 * Délégué à lib/theme.ts (source de vérité)
 */

import { theme } from '../theme';

export const colors = theme.colors;

export type ColorName = keyof typeof colors;
