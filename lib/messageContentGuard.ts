import { orderBlocksAcceptedOfferCheckout } from './messagesOfferCheckout';

/** Code renvoyé par le trigger Postgres (et par le client) si du PII est bloqué. */
export const BLOOMI_PII_BLOCKED_CODE = 'BLOOMI_PII_BLOCKED';

export type BlockedContactReason = 'url' | 'phone' | 'email' | 'address' | 'external_contact';

export type MessageContentGuardResult =
  | { blocked: false }
  | { blocked: true; reason: BlockedContactReason };

/**
 * Une commande active (pending / shipped / completed…) signifie que le paiement
 * Bloomi a bien eu lieu — les coordonnées peuvent alors être échangées.
 */
export function isThreadPaymentConfirmed(
  orderStatus: string | null | undefined,
  paymentStatus?: string | null | undefined
): boolean {
  return orderBlocksAcceptedOfferCheckout(orderStatus, paymentStatus);
}

/** Liens externes (déjà bloqués côté chat). */
const URL_RE = /(https?:\/\/|www\.)[^\s]+/i;

/** Emails. */
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

/**
 * Téléphones CH/FR/DE/IT (local ou international) et longues suites de chiffres.
 * Ex. 079 123 45 67, +41 79…, 06 12 34 56 78
 */
const PHONE_RE =
  /(?:\+|00)?(?:41|33|49|39)[\s./-]?(?:\(?\d\)?[\s./-]?){8,12}|\b0[1-9](?:[\s./-]?\d){8,10}\b/;

/**
 * Adresses approximatives : type de voie + nom + n°, ou NPA suisse + ville.
 */
const STREET_RE =
  /\b(?:rue|avenue|av\.?|chemin|route|boulevard|bd\.?|place|impasse|all[eé]e|quai|strasse|str\.?|weg|gasse|via|viale)\s+[A-Za-zÀ-ÿ0-9'’.\-\s]{2,40}\s+\d{1,4}\b/i;

const SWISS_NPA_CITY_RE =
  /\b[1-9]\d{3}\s+[A-ZÀ-Ÿ][a-zà-ÿ'’\-]+(?:[\s-][A-ZÀ-Ÿ]?[a-zà-ÿ'’\-]+)*\b/;

/** Contournement via apps de messagerie externes. */
const EXTERNAL_CONTACT_RE =
  /\b(?:whats?\s*app|whatsapp|telegram|signal|snapchat|w\.?\s*a\.?)\b/i;

/**
 * Détecte les infos personnelles / canaux hors Bloomi dans un message libre.
 * Ne remplace pas une modération humaine : l’objectif est de freiner le contournement.
 */
export function detectBlockedContactInfo(raw: string): MessageContentGuardResult {
  const body = String(raw ?? '').trim();
  if (!body) return { blocked: false };

  if (URL_RE.test(body)) return { blocked: true, reason: 'url' };
  if (EMAIL_RE.test(body)) return { blocked: true, reason: 'email' };
  if (PHONE_RE.test(body)) return { blocked: true, reason: 'phone' };
  if (STREET_RE.test(body) || SWISS_NPA_CITY_RE.test(body)) {
    return { blocked: true, reason: 'address' };
  }
  if (EXTERNAL_CONTACT_RE.test(body)) {
    return { blocked: true, reason: 'external_contact' };
  }

  return { blocked: false };
}

export function isBloomiPiiBlockedError(error: { message?: string; code?: string } | null | undefined): boolean {
  const msg = String(error?.message ?? '');
  return msg.includes(BLOOMI_PII_BLOCKED_CODE);
}
