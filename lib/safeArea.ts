import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Hauteur typique de la barre de navigation système Android (3 boutons), en dp.
 * Utilisée uniquement quand `insets.bottom` remonte 0 alors que l'app dessine
 * en edge-to-edge (comportement par défaut Expo SDK 53+).
 */
const ANDROID_SYSTEM_NAV_FALLBACK = 48;

/**
 * Inset bas fiable pour les footers / CTA / sheets collés en bas.
 * Sur certains Android avec navigation 3 boutons, `useSafeAreaInsets().bottom`
 * peut être 0 et laisser les boutons masqués par la navbar native.
 */
export function getSafeBottomInset(insetBottom: number): number {
  const value = Math.max(0, insetBottom);
  if (Platform.OS === 'android' && value <= 0) {
    return ANDROID_SYSTEM_NAV_FALLBACK;
  }
  return value;
}

/** Hook pratique : inset bas déjà corrigé pour Android. */
export function useSafeBottomInset(): number {
  const insets = useSafeAreaInsets();
  return getSafeBottomInset(insets.bottom);
}
