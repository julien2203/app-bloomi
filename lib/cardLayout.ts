/** Helpers partagés pour largeur / hauteur des cartes produit (feed, résultats, profil). */

export const GRID_PADDING_X = 16;
export const GRID_GAP = 12;
export const GRID_GAP_COMPACT = 8;

export function gridCardWidth(
  screenWidth: number,
  paddingX = GRID_PADDING_X,
  gap = GRID_GAP
): number {
  return (screenWidth - paddingX * 2 - gap) / 2;
}

/** Largeur des cartes dans les carrousels horizontaux du feed. */
export function horizontalCardWidth(screenWidth: number): number {
  return Math.round(Math.min(200, Math.max(148, screenWidth * 0.42)));
}

/** minHeight pour FlatList horizontale (image + zone texte, marge accessibilité). */
export function horizontalCarouselMinHeight(
  cardWidth: number,
  imageRatio = 1.3,
  bodyBuffer = 112
): number {
  return Math.round(cardWidth * imageRatio) + bodyBuffer;
}
