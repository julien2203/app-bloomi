import type { ImagePriority } from 'expo-image';

/** Priorise les images visibles en haut de liste pour un affichage plus rapide. */
export function getCardImagePriority(index: number): ImagePriority {
  if (index < 4) return 'high';
  if (index < 12) return 'normal';
  return 'low';
}

export const LIST_IMAGE_PERF_PROPS = {
  initialNumToRender: 6,
  maxToRenderPerBatch: 4,
  windowSize: 5
} as const;
