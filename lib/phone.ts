export type SupportedCountryCode = 'CH' | 'FR' | 'DE' | 'IT';

export type NormalizedPhoneResult =
  | { ok: true; value: string; country: SupportedCountryCode }
  | { ok: false; error: string };

/**
 * Normalise un numéro de téléphone vers le format E.164 pour les pays supportés.
 *
 * Pays autorisés :
 * - Suisse : +41 (CH)
 * - France : +33 (FR)
 * - Allemagne : +49 (DE)
 * - Italie : +39 (IT)
 *
 * Formats acceptés :
 * - Avec ou sans espaces / tirets / parenthèses
 * - Préfixes "+", "00" ou code pays sans "+" (ex: 4179...)
 *
 * Remarque : pour éviter les ambiguïtés, les numéros purement locaux
 * (commençant par 0 sans indicatif international) sont rejetés.
 */
export function normalizePhoneToE164(input: string): NormalizedPhoneResult {
  const raw = input.trim();

  if (!raw) {
    return { ok: false, error: 'Please enter a phone number.' };
  }

  // Supprimer les espaces, tirets, parenthèses
  const cleaned = raw.replace(/[\s\-().]/g, '');

  let withPlus = cleaned;

  if (withPlus.startsWith('+')) {
    // déjà en format international potentiel
  } else if (withPlus.startsWith('00')) {
    // 0041... -> +41...
    withPlus = `+${withPlus.substring(2)}`;
  } else if (/^(41|33|49|39)/.test(withPlus)) {
    // 41..., 33..., 49..., 39... -> +41..., etc.
    withPlus = `+${withPlus}`;
  } else if (withPlus.startsWith('0')) {
    // Format local ambigu : on demande un format international explicite
    return {
      ok: false,
      error:
        'Please enter the number in international format, for example +41…, +33…, +49…, or +39….'
    };
  } else {
    // Cas non pris en charge
    return {
      ok: false,
      error:
        'Only Swiss (+41), French (+33), German (+49), and Italian (+39) numbers are accepted.'
    };
  }

  // Identifier le pays à partir de l’indicatif
  let country: SupportedCountryCode | null = null;
  let nationalNumber = '';

  if (withPlus.startsWith('+41')) {
    country = 'CH';
    nationalNumber = withPlus.substring(3);
  } else if (withPlus.startsWith('+33')) {
    country = 'FR';
    nationalNumber = withPlus.substring(3);
  } else if (withPlus.startsWith('+49')) {
    country = 'DE';
    nationalNumber = withPlus.substring(3);
  } else if (withPlus.startsWith('+39')) {
    country = 'IT';
    nationalNumber = withPlus.substring(3);
  } else {
    return {
      ok: false,
      error:
        'Only Swiss (+41), French (+33), German (+49), and Italian (+39) numbers are accepted.'
    };
  }

  // Vérification très basique de longueur pour éviter les entrées manifestement invalides
  if (!/^\d{6,12}$/.test(nationalNumber)) {
    return {
      ok: false,
      error: 'The phone number looks invalid for the selected country.'
    };
  }

  return { ok: true, value: withPlus, country };
}

