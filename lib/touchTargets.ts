import type { Insets } from 'react-native';
import { getSafeBottomInset } from './safeArea';

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

/** Espace de base au-dessus de la tab bar fixe pour ne pas masquer les boutons pied de page des écrans filtres */
export const FLOATING_TAB_BAR_BOTTOM_RESERVE = 84;

/** Padding bas du pied de page « Show result » sur les écrans filtres (tab bar flottante visible). */
export function getFilterFooterPaddingBottom(insets: Insets): number {
  return getSafeBottomInset(insets.bottom) + 24 + FLOATING_TAB_BAR_BOTTOM_RESERVE;
}
