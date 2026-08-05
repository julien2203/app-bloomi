import type { AppLanguage } from './i18n';
import { CGU_CONTENT_EN } from '../screens/cgu/content.en';
import { CGU_CONTENT_FR } from '../screens/cgu/content.fr';
import type { CGUContent } from '../screens/cgu/types';

/** CGU / mentions légales : FR natif, autres langues sur l'anglais pour l'instant. */
export function resolveLegalContent(language: AppLanguage): CGUContent {
  if (language === 'fr') {
    return CGU_CONTENT_FR;
  }
  return CGU_CONTENT_EN;
}
