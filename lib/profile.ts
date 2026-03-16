import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { SupportedCountryCode } from './phone';
import { normalizePhoneToE164 } from './phone';

export type Profile = {
  id: string;
  phone: string | null;
  country: SupportedCountryCode | null;
  display_name?: string | null;
  avatar_url?: string | null;
  created_at: string;
};

function deriveCountryFromPhone(
  phone: string | null | undefined
): SupportedCountryCode | null {
  if (!phone) return null;

  const normalized = normalizePhoneToE164(phone);
  if (!normalized.ok) return null;

  return normalized.country;
}

/**
 * Crée ou met à jour un profil applicatif pour l'utilisateur courant.
 *
 * - id = auth.user.id (clé primaire)
 * - phone = numéro en E.164
 * - country = pays déduit du numéro (CH/FR/DE/IT)
 */
export async function ensureProfileExists(
  session: Session | null,
  opts?: { phone?: string; country?: SupportedCountryCode | null }
): Promise<Profile | null> {
  if (!session?.user) {
    return null;
  }

  const userId = session.user.id;

  const phone = opts?.phone ?? (session.user.phone as string | null | undefined) ?? null;
  const country =
    opts?.country ??
    (phone ? deriveCountryFromPhone(phone) : null);

  const userMeta = (session.user.user_metadata || {}) as Record<string, any>;
  const displayName =
    (userMeta.username as string | undefined) ||
    (userMeta.full_name as string | undefined) ||
    null;

  if (!phone) {
    // On ne bloque pas la connexion si le téléphone n'est pas disponible,
    // on se contente de ne pas créer de profil complet.
    // Par contre, si on a déjà un profil existant, on peut juste mettre à jour le display_name.
    if (displayName) {
      const { data, error } = await supabase
        .from('profiles')
        .upsert(
          {
            id: userId,
            display_name: displayName
          },
          { onConflict: 'id' }
        )
        .select()
        .single();

      if (error) {
        console.warn('ensureProfileExists error (no phone)', error);
        return null;
      }

      return data as Profile;
    }

    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        phone,
        country,
        display_name: displayName
      },
      { onConflict: 'id' }
    )
    .select()
    .single();

  if (error) {
    // On log simplement côté client pour le debug, sans bloquer l'utilisateur.
    console.warn('ensureProfileExists error', error);
    return null;
  }

  return data as Profile;
}

export async function getProfileForUser(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.warn('getProfileForUser error', error);
    return null;
  }

  return data as Profile | null;
}

