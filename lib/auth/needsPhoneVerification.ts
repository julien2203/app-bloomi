/**
 * La vérification SMS est obligatoire pour toute session authentifiée.
 * On se base uniquement sur auth.users.phone_confirmed_at (Supabase Auth),
 * pas sur profiles.phone (peut contenir un placeholder sans OTP validé).
 *
 * Couvre :
 * - inscription email (phone encore vide)
 * - OTP phone_change démarré mais non confirmé
 * - login / OAuth sans téléphone confirmé
 */
export function needsAuthPhoneVerification(
  user: { phone_confirmed_at?: string | null } | null | undefined
): boolean {
  return Boolean(user) && !user.phone_confirmed_at;
}

export function postAuthDestination(
  user: { phone_confirmed_at?: string | null } | null | undefined
): '/auth/verify-phone' | '/tabs/feed' {
  return needsAuthPhoneVerification(user) ? '/auth/verify-phone' : '/tabs/feed';
}
