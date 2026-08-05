import type { TFunction } from 'i18next';
import {
  CHAT_EVENT_PREFIX,
  chatEventPreviewI18nKey,
  resolveChatEvent
} from './chatTransactionEvents';

type SystemMessageMatch = {
  i18nKey: string;
  params?: Record<string, string>;
};

export type OrderPlacedSystemMessageKind = 'parcel' | 'pickup';

export type TranslateChatSystemMessageOptions = {
  isSeller?: boolean;
};

/**
 * Les messages système commande/offre sont insérés en base dans la langue de l'acheteur
 * au moment de l'événement. On les retraduit à l'affichage selon la langue de l'app.
 */
export function getOrderPlacedSystemMessageKind(
  body: string
): OrderPlacedSystemMessageKind | null {
  const b = body.trim();
  if (!b) return null;

  if (
    /Order placed.*prepare your parcel/i.test(b) ||
    /Commande passée.*prépare votre colis/i.test(b) ||
    /Commande passée.*prépare ton colis/i.test(b)
  ) {
    return 'parcel';
  }

  if (
    /Order placed.*local handoff/i.test(b) ||
    /Commande passée.*remise en main propre/i.test(b)
  ) {
    return 'pickup';
  }

  return null;
}

function matchSystemMessage(
  body: string,
  options?: TranslateChatSystemMessageOptions
): SystemMessageMatch | null {
  const b = body.trim();
  if (!b) return null;

  const orderPlacedKind = getOrderPlacedSystemMessageKind(b);
  if (orderPlacedKind === 'parcel') {
    return {
      i18nKey: options?.isSeller
        ? 'messages.system.orderPlacedParcelSeller'
        : 'messages.system.orderPlacedParcel'
    };
  }

  if (orderPlacedKind === 'pickup') {
    return {
      i18nKey: options?.isSeller
        ? 'messages.system.orderPlacedPickupSeller'
        : 'messages.system.orderPlacedPickup'
    };
  }

  if (
    /automatically confirmed after 7 days/i.test(b) ||
    /confirmée automatiquement après 7 jours/i.test(b)
  ) {
    return { i18nKey: 'messages.system.orderAutoConfirmed' };
  }

  if (
    /Receipt confirmed/i.test(b) ||
    /Réception confirmée/i.test(b) ||
    (/transaction is complete/i.test(b) && /Thanks for using Bloomi/i.test(b)) ||
    (/transaction est terminée/i.test(b) && /Merci d'utiliser Bloomi/i.test(b))
  ) {
    return { i18nKey: 'messages.system.orderReceiptConfirmed' };
  }

  const shippedTracking =
    b.match(/^📦\s*Shipped!\s*\[([^\]]+)\]/i) ??
    b.match(/^📦\s*Expédié!\s*\[([^\]]+)\]/i);
  if (shippedTracking) {
    return {
      i18nKey: 'messages.system.orderShippedTracking',
      params: { tracking: shippedTracking[1].trim() }
    };
  }

  if (/^📦\s*Shipped!/i.test(b) || /^📦\s*Expédié!/i.test(b)) {
    return { i18nKey: 'messages.system.orderShipped' };
  }

  if (/^Offer accepted\.?$/i.test(b) || /^Offre acceptée\.?$/i.test(b)) {
    return { i18nKey: 'messages.offerAcceptedSystem' };
  }

  if (/^Offer declined\.?$/i.test(b) || /^Offre refusée\.?$/i.test(b)) {
    return { i18nKey: 'messages.offerDeclinedSystem' };
  }

  return null;
}

export function translateChatSystemMessage(
  body: string,
  t: TFunction,
  options?: TranslateChatSystemMessageOptions
): string {
  const raw = String(body ?? '').trim();
  if (!raw) return '';

  // Jamais afficher le payload technique @@bloomi:event:v1:...
  if (raw.startsWith(CHAT_EVENT_PREFIX)) {
    const event = resolveChatEvent(raw, options);
    if (event) {
      const key = chatEventPreviewI18nKey(event, options);
      const translated = t(key);
      return translated === key ? t('messages.events.previewGeneric') : translated;
    }
    return t('messages.events.previewGeneric');
  }

  const match = matchSystemMessage(raw, options);
  if (!match) return raw;
  const translated = t(match.i18nKey, match.params ?? {});
  return translated === match.i18nKey ? raw : translated;
}
