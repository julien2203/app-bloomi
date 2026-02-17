import { supabase } from './supabase';
import { DEV_OTP_MODE, DEV_TEST_CODE } from './env';

/**
 * Vérifie si le code fourni est le code de test en mode développement
 */
export function isDevTestCode(code: string): boolean {
  return DEV_OTP_MODE && code.trim() === DEV_TEST_CODE;
}

/**
 * Authentifie l'utilisateur avec le code de test en mode développement
 * Crée une session de test en utilisant Supabase avec le code magique
 */
export async function verifyDevTestCode(phone: string): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!DEV_OTP_MODE) {
    return {
      success: false,
      error: 'Le mode de test n\'est disponible qu\'en développement'
    };
  }

  try {
    // En mode développement, Supabase accepte souvent le code "123456" comme code de test
    // si configuré dans le dashboard Supabase (Auth > Phone Auth > Test Phone Numbers)
    // Sinon, on peut utiliser une autre méthode selon votre configuration Supabase
    
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token: DEV_TEST_CODE,
      type: 'sms'
    });

    if (error) {
      // Si Supabase n'accepte pas le code de test, on retourne une erreur explicative
      return {
        success: false,
        error: `Code de test non accepté. Vérifiez que le numéro ${phone} est configuré comme numéro de test dans Supabase (Auth > Phone Auth > Test Phone Numbers) et que le code de test est "${DEV_TEST_CODE}".`
      };
    }

    if (!data.session) {
      return {
        success: false,
        error: 'Impossible de créer une session de test'
      };
    }

    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: 'Une erreur est survenue lors de l\'authentification de test'
    };
  }
}
