/**
 * Configuration des environnements
 * 
 * Les variables d'environnement sont chargées depuis:
 * - .env.local (prioritaire, pour le développement local)
 * - Variables d'environnement système (pour EAS builds)
 * 
 * Pour Expo, les variables doivent être préfixées par EXPO_PUBLIC_ pour être accessibles côté client.
 */

type Env = 'development' | 'staging' | 'production';

/**
 * Détermine l'environnement actuel
 * - development: lors du développement local avec Expo Go
 * - staging: lors d'un build EAS avec le profile "preview"
 * - production: lors d'un build EAS avec le profile "production"
 */
function getEnv(): Env {
  // En développement local, __DEV__ est true
  if (__DEV__) {
    return 'development';
  }

  // Pour les builds EAS, on utilise EXPO_PUBLIC_ENV
  const env = process.env.EXPO_PUBLIC_ENV;
  
  if (env === 'staging' || env === 'preview') {
    return 'staging';
  }
  
  if (env === 'production' || env === 'prod') {
    return 'production';
  }

  // Par défaut en production si non spécifié
  return 'production';
}

export const ENV = getEnv();

/**
 * URL du projet Supabase
 * - Development: projet Supabase de développement
 * - Staging: projet Supabase de staging
 * - Production: projet Supabase de production
 */
export const SUPABASE_URL = (() => {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error(
      'EXPO_PUBLIC_SUPABASE_URL doit être définie. Vérifiez votre fichier .env ou vos variables EAS.'
    );
  }
  return url;
})();

/**
 * Clé anonyme Supabase
 * - Development: clé du projet Supabase de développement
 * - Staging: clé du projet Supabase de staging
 * - Production: clé du projet Supabase de production
 */
export const SUPABASE_ANON_KEY = (() => {
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      'EXPO_PUBLIC_SUPABASE_ANON_KEY doit être définie. Vérifiez votre fichier .env ou vos variables EAS.'
    );
  }
  return key;
})();

/**
 * Clé publique Stripe
 * Optionnelle, peut être undefined si Stripe n'est pas encore configuré
 */
export const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || undefined;

/**
 * Mode OTP de développement
 * true uniquement en développement pour permettre l'authentification simplifiée
 */
export const DEV_OTP_MODE = ENV === 'development';

/**
 * Code de test à utiliser en mode développement
 * Permet de se connecter sans recevoir de vrai SMS
 */
export const DEV_TEST_CODE = '123456';

// Log de l'environnement en développement pour faciliter le debug
if (__DEV__) {
  console.log(`[ENV] Environnement: ${ENV}`);
  console.log(`[ENV] Supabase URL: ${SUPABASE_URL}`);
  console.log(`[ENV] DEV_OTP_MODE: ${DEV_OTP_MODE}`);
}
