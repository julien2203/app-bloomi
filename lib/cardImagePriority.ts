import { Platform } from 'react-native';

export type CardImagePriority = 'low' | 'normal' | 'high' | number;

/** Priorise les images visibles en haut de liste pour un affichage plus rapide. */
export function getCardImagePriority(index: number): CardImagePriority {
  if (index < 4) return 'high';
  if (index < 12) return 'normal';
  return 'low';
}

export const LIST_IMAGE_PERF_PROPS = {
  initialNumToRender: 6,
  maxToRenderPerBatch: 4,
  windowSize: 5
} as const;

/** Grille feed « tous les articles » (2 colonnes, scroll vertical). */
export const FEED_GRID_PERF_PROPS = {
  initialNumToRender: Platform.OS === 'android' ? 6 : 8,
  maxToRenderPerBatch: Platform.OS === 'android' ? 4 : 6,
  windowSize: Platform.OS === 'android' ? 5 : 7,
  removeClippedSubviews: true
} as const;
