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
      error: 'Test mode is only available in development'
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
        error: `Test code not accepted. Make sure ${phone} is configured as a test number in Supabase (Auth > Phone Auth > Test Phone Numbers) and the test code is "${DEV_TEST_CODE}".`
      };
    }

    if (!data.session) {
      return {
        success: false,
        error: 'Unable to create a test session'
      };
    }

    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: 'Something went wrong during test authentication'
    };
  }
}
