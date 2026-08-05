/** Largeur des cartes transactionnelles dans le fil messages (offres, étapes commande). */

export const CHAT_MESSAGE_PADDING_X = 16;

/** Part de la colonne messages — ni pleine largeur, ni trop étroite. */
const WIDTH_RATIO = 0.86;

const MIN_WIDTH = 276;
const MAX_WIDTH_PHONE = 336;
const MAX_WIDTH_TABLET = 392;
const TABLET_BREAKPOINT = 600;

/**
 * Largeur responsive des cartes chat.
 * Ex. iPhone 375 → ~295px ; iPhone 414 → ~306px ; tablette → max 392px.
 */
export function computeChatCardWidth(screenWidth: number): number {
  const contentWidth = screenWidth - CHAT_MESSAGE_PADDING_X * 2;
  const scaled = contentWidth * WIDTH_RATIO;
  const maxWidth = screenWidth >= TABLET_BREAKPOINT ? MAX_WIDTH_TABLET : MAX_WIDTH_PHONE;
  return Math.round(Math.min(maxWidth, Math.max(MIN_WIDTH, scaled)));
}
