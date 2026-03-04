import { theme } from '../theme';
import type { Theme } from '../theme';

/**
 * Hook léger pour accéder au thème.
 * Aujourd'hui il retourne simplement l'objet statique,
 * mais il pourra être branché sur un context plus tard.
 */
export function useTheme(): Theme {
  return theme;
}

