import type { Insets } from 'react-native';

/**
 * Marge tactile autour des petites cibles (flèches, icônes header).
 * ~44pt Apple HIG : 20px icône + 12pt de chaque côté ≈ zone confortable.
 */
export const HIT_SLOP_COMFORTABLE: Insets = { top: 12, bottom: 12, left: 12, right: 12 };

/** Encore plus large pour toolbar / hero superposé à d’autres couches */
export const HIT_SLOP_EXTRA: Insets = { top: 16, bottom: 16, left: 16, right: 16 };

/**
 * Conteneur tactile minimal pour une icône dans un header (centrage visuel conservé).
 */
export const HEADER_ICON_TOUCH_CONTAINER = {
  minWidth: 44,
  minHeight: 44,
  justifyContent: 'center' as const,
  alignItems: 'center' as const
};
