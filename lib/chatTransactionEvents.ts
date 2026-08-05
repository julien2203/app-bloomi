/** Payload structuré pour les cartes d'étapes transactionnelles dans le chat. */
export type ChatEventKind =
  | 'offer_accepted'
  | 'offer_declined'
  | 'order_confirmed'
  | 'label_preparing'
  | 'label_ready'
  | 'order_shipped'
  | 'buyer_confirm_prompt'
  | 'transaction_complete'
  | 'payment_released';

export type ChatEventDeliveryMode = 'shipping' | 'pickup';

export type ChatEventPayload = {
  kind: ChatEventKind;
  order_id?: string;
  offer_amount?: number;
  offer_message_id?: string;
  tracking_number?: string;
  delivery_mode?: ChatEventDeliveryMode;
  /** @deprecated Préférer buyer_name / seller_name */
  participant_name?: string;
  buyer_name?: string;
  seller_name?: string;
};

export const CHAT_EVENT_PREFIX = '@@bloomi:event:v1:';

export function encodeChatEventBody(payload: ChatEventPayload): string {
  return `${CHAT_EVENT_PREFIX}${JSON.stringify(payload)}`;
}

export function parseChatEventBody(body: string | null | undefined): ChatEventPayload | null {
  const raw = String(body ?? '').trim();
  if (!raw.startsWith(CHAT_EVENT_PREFIX)) return null;
  try {
    const parsed = JSON.parse(raw.slice(CHAT_EVENT_PREFIX.length)) as ChatEventPayload;
    if (!parsed?.kind) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Reconstruit un événement à partir des anciens messages texte système. */
export function legacyBodyToChatEvent(
  body: string,
  options?: { isSeller?: boolean }
): ChatEventPayload | null {
  const b = body.trim();
  if (!b) return null;

  if (/^Offer accepted\.?$/i.test(b) || /^Offre acceptée\.?$/i.test(b)) {
    return { kind: 'offer_accepted' };
  }
  if (/^Offer declined\.?$/i.test(b) || /^Offre refusée\.?$/i.test(b)) {
    return { kind: 'offer_declined' };
  }

  if (
    /Order placed.*prepare your parcel/i.test(b) ||
    /Commande passée.*prépare (votre|ton) colis/i.test(b) ||
    /Order placed.*local handoff/i.test(b) ||
    /Commande passée.*remise en main propre/i.test(b)
  ) {
    const pickup =
      /local handoff/i.test(b) || /remise en main propre/i.test(b);
    return {
      kind: 'order_confirmed',
      delivery_mode: pickup ? 'pickup' : 'shipping'
    };
  }

  if (/^📦\s*Shipped!/i.test(b) || /^📦\s*Expédié!/i.test(b)) {
    const trackingMatch =
      b.match(/\[([^\]]+)\]/) ?? b.match(/\[([^\]]+)\]/i);
    return {
      kind: 'order_shipped',
      tracking_number: trackingMatch?.[1]?.trim() || undefined
    };
  }

  if (
    /Receipt confirmed/i.test(b) ||
    /Réception confirmée/i.test(b) ||
    (/transaction is complete/i.test(b) && /Thanks for using Bloomi/i.test(b)) ||
    (/transaction est terminée/i.test(b) && /Merci d'utiliser Bloomi/i.test(b)) ||
    /automatically confirmed after 7 days/i.test(b) ||
    /confirmée automatiquement après 7 jours/i.test(b)
  ) {
    return { kind: 'transaction_complete' };
  }

  void options;
  return null;
}

export function resolveChatEvent(
  body: string | null | undefined,
  options?: { isSeller?: boolean }
): ChatEventPayload | null {
  return parseChatEventBody(body) ?? legacyBodyToChatEvent(String(body ?? ''), options);
}

export type ChatEventCardAction = {
  labelKey: string;
  labelParams?: Record<string, string | number>;
  variant: 'primary' | 'secondary';
  action: 'pay_offer' | 'view_order' | 'view_wallet' | 'generate_label' | 'track_parcel' | 'confirm_reception' | 'report_problem' | 'download_label';
};

export type ChatEventCardIcon =
  | 'confetti'
  | 'printer'
  | 'package'
  | 'check'
  | 'clock'
  | 'truck';

export type ChatEventCardModel = {
  icon: ChatEventCardIcon;
  titleKey: string;
  titleParams?: Record<string, string | number>;
  bodyKey?: string;
  bodyParams?: Record<string, string | number>;
  /** Rôle du `{{name}}` dans le corps (repli i18n si nom vide). */
  nameRole?: 'buyer' | 'seller';
  primaryAction?: ChatEventCardAction;
  secondaryAction?: ChatEventCardAction;
};

export function trimEventName(value: string | undefined): string {
  return String(value ?? '').trim();
}

export function mergeEventI18nParams(
  model: Pick<ChatEventCardModel, 'titleParams' | 'bodyParams'>
): Record<string, string | number> {
  return {
    ...(model.titleParams ?? {}),
    ...(model.bodyParams ?? {})
  };
}

export function buildChatEventCardModel(params: {
  event: ChatEventPayload;
  isSeller: boolean;
  isBuyer: boolean;
  offerPayAmount?: number | null;
  hasBlockingOrder?: boolean;
  orderPaymentTransferred?: boolean;
  isLetterAplus?: boolean;
}): ChatEventCardModel | null {
  const {
    event,
    isSeller,
    isBuyer,
    offerPayAmount,
    hasBlockingOrder,
    orderPaymentTransferred,
    isLetterAplus
  } = params;
  const dm = event.delivery_mode ?? 'shipping';
  const isPickup = dm === 'pickup';
  const name = event.participant_name ?? '';
  const buyerName = event.buyer_name ?? name;
  const sellerName = event.seller_name ?? name;

  switch (event.kind) {
    case 'offer_accepted':
      if (isBuyer && offerPayAmount != null && !hasBlockingOrder) {
        return {
          icon: 'confetti',
          titleKey: 'messages.events.offerAcceptedBuyerTitle',
          bodyKey: 'messages.events.offerAcceptedBuyerBody',
          bodyParams: { amount: offerPayAmount.toFixed(2) },
          primaryAction: {
            labelKey: 'messages.events.payNow',
            variant: 'primary',
            action: 'pay_offer'
          }
        };
      }
      if (isSeller && !hasBlockingOrder) {
        return {
          icon: 'clock',
          titleKey: 'messages.events.offerAcceptedSellerTitle',
          titleParams: { amount: event.offer_amount?.toFixed(2) ?? '—' },
          bodyKey: 'messages.events.awaitingPaymentBody'
        };
      }
      return {
        icon: 'confetti',
        titleKey: 'messages.events.offerAcceptedGenericTitle',
        bodyKey: hasBlockingOrder
          ? 'messages.events.offerAcceptedPaidBody'
          : 'messages.events.awaitingPaymentBody'
      };

    case 'offer_declined':
      return {
        icon: 'clock',
        titleKey: 'messages.events.offerDeclinedTitle',
        bodyKey: 'messages.events.offerDeclinedBody'
      };

    case 'order_confirmed':
      if (isSeller) {
        if (isPickup) {
          return {
            icon: 'confetti',
            titleKey: 'messages.events.orderConfirmedSellerTitle',
            bodyKey: 'messages.events.orderConfirmedSellerPickupBody',
            bodyParams: { name: buyerName },
            nameRole: 'buyer',
            primaryAction: {
              labelKey: 'messages.events.viewOrder',
              variant: 'primary',
              action: 'view_order'
            }
          };
        }
        return {
          icon: 'confetti',
          titleKey: 'messages.events.orderConfirmedSellerTitle',
          bodyKey: isLetterAplus
            ? 'messages.events.orderConfirmedSellerLetterAplusBody'
            : 'messages.events.orderConfirmedSellerShippingBody',
          bodyParams: { name: buyerName },
          nameRole: 'buyer',
          primaryAction: {
            labelKey: 'messages.events.generateLabel',
            variant: 'primary',
            action: 'generate_label'
          },
          secondaryAction: {
            labelKey: 'messages.events.viewOrder',
            variant: 'secondary',
            action: 'view_order'
          }
        };
      }
      return {
        icon: 'confetti',
        titleKey: 'messages.events.orderConfirmedBuyerTitle',
        bodyKey: isPickup
          ? 'messages.events.orderConfirmedBuyerPickupBody'
          : 'messages.events.orderConfirmedBuyerShippingBody',
        ...(isPickup
          ? { bodyParams: { name: sellerName }, nameRole: 'seller' as const }
          : {}),
        primaryAction: {
          labelKey: 'messages.events.viewOrder',
          variant: 'primary',
          action: 'view_order'
        }
      };

    case 'label_preparing':
      if (isSeller) {
        return {
          icon: 'package',
          titleKey: 'messages.events.labelPreparingSellerTitle',
          bodyKey: isLetterAplus
            ? 'messages.events.labelPreparingSellerLetterAplusBody'
            : 'messages.events.labelPreparingSellerBody',
          primaryAction: {
            labelKey: 'messages.events.generateLabel',
            variant: 'primary',
            action: 'generate_label'
          },
          secondaryAction: {
            labelKey: 'messages.events.viewOrder',
            variant: 'secondary',
            action: 'view_order'
          }
        };
      }
      return {
        icon: 'package',
        titleKey: 'messages.events.labelPreparingTitle',
        bodyKey: 'messages.events.labelPreparingBody',
        bodyParams: { name: sellerName },
        nameRole: 'seller',
        primaryAction: {
          labelKey: 'messages.events.viewOrder',
          variant: 'primary',
          action: 'view_order'
        }
      };

    case 'label_ready':
      if (isSeller) {
        return {
          icon: 'printer',
          titleKey: 'messages.events.labelReadySellerTitle',
          bodyKey: 'messages.events.labelReadySellerBody',
          primaryAction: {
            labelKey: 'messages.events.downloadLabel',
            variant: 'primary',
            action: 'download_label'
          },
          secondaryAction: {
            labelKey: 'messages.events.viewOrder',
            variant: 'secondary',
            action: 'view_order'
          }
        };
      }
      return {
        icon: 'printer',
        titleKey: 'messages.events.labelReadyBuyerTitle',
        bodyKey: 'messages.events.labelReadyBuyerBody',
        primaryAction: {
          labelKey: 'messages.events.viewOrder',
          variant: 'primary',
          action: 'view_order'
        }
      };

    case 'order_shipped':
      if (isSeller) {
        return {
          icon: 'truck',
          titleKey: 'messages.events.orderShippedSellerTitle',
          bodyKey: 'messages.events.orderShippedSellerBody',
          primaryAction: {
            labelKey: 'messages.events.viewOrder',
            variant: 'primary',
            action: 'view_order'
          }
        };
      }
      return {
        icon: 'truck',
        titleKey: 'messages.events.orderShippedBuyerTitle',
        bodyKey: 'messages.events.orderShippedBuyerBody',
        primaryAction: event.tracking_number
          ? {
              labelKey: 'messages.events.trackParcel',
              variant: 'primary',
              action: 'track_parcel'
            }
          : {
              labelKey: 'messages.events.viewOrder',
              variant: 'primary',
              action: 'view_order'
            },
        secondaryAction: event.tracking_number
          ? {
              labelKey: 'messages.events.viewOrder',
              variant: 'secondary',
              action: 'view_order'
            }
          : undefined
      };

    case 'buyer_confirm_prompt':
      if (orderPaymentTransferred) return null;
      if (isBuyer) {
        return {
          icon: 'package',
          titleKey: 'messages.events.buyerConfirmPromptTitle',
          bodyKey: 'messages.events.buyerConfirmPromptBody',
          primaryAction: {
            labelKey: 'messages.events.allGood',
            variant: 'primary',
            action: 'confirm_reception'
          },
          secondaryAction: {
            labelKey: 'messages.events.reportProblem',
            variant: 'secondary',
            action: 'report_problem'
          }
        };
      }
      return {
        icon: 'clock',
        titleKey: 'messages.events.buyerConfirmPromptSellerTitle',
        bodyKey: 'messages.events.buyerConfirmPromptSellerBody',
        primaryAction: {
          labelKey: 'messages.events.viewOrder',
          variant: 'primary',
          action: 'view_order'
        }
      };

    case 'payment_released':
      if (isBuyer) {
        return {
          icon: 'check',
          titleKey: 'messages.events.paymentReleasedBuyerTitle',
          bodyKey: 'messages.events.paymentReleasedBuyerBody',
          primaryAction: {
            labelKey: 'messages.events.viewOrder',
            variant: 'primary',
            action: 'view_order'
          }
        };
      }
      return {
        icon: 'check',
        titleKey: 'messages.events.paymentReleasedSellerTitle',
        bodyKey: 'messages.events.paymentReleasedSellerBody',
        primaryAction: {
          labelKey: 'messages.events.viewWallet',
          variant: 'primary',
          action: 'view_wallet'
        },
        secondaryAction: {
          labelKey: 'messages.events.viewOrder',
          variant: 'secondary',
          action: 'view_order'
        }
      };

    case 'transaction_complete':
      if (isSeller) {
        return {
          icon: 'check',
          titleKey: 'messages.events.transactionCompleteSellerTitle',
          bodyKey: 'messages.events.transactionCompleteSellerBody',
          primaryAction: {
            labelKey: 'messages.events.viewWallet',
            variant: 'primary',
            action: 'view_wallet'
          },
          secondaryAction: {
            labelKey: 'messages.events.viewOrder',
            variant: 'secondary',
            action: 'view_order'
          }
        };
      }
      return {
        icon: 'check',
        titleKey: 'messages.events.transactionCompleteTitle',
        bodyKey: 'messages.events.transactionCompleteBody',
        primaryAction: {
          labelKey: 'messages.events.viewOrder',
          variant: 'primary',
          action: 'view_order'
        }
      };

    default:
      return null;
  }
}

export function swissPostTrackingUrl(trackingNumber: string): string {
  const code = encodeURIComponent(trackingNumber.trim());
  return `https://www.post.ch/swisspost-tracking?formattedParcelCodes=${code}`;
}

/** Résumé court pour inbox / pastille — jamais le payload technique. */
export function chatEventPreviewI18nKey(
  event: ChatEventPayload,
  options?: { isSeller?: boolean }
): string {
  const isSeller = options?.isSeller === true;
  switch (event.kind) {
    case 'offer_accepted':
      return 'messages.events.previewOfferAccepted';
    case 'offer_declined':
      return 'messages.events.previewOfferDeclined';
    case 'order_confirmed':
      return 'messages.events.previewOrderConfirmed';
    case 'label_preparing':
      return isSeller
        ? 'messages.events.previewLabelPreparingSeller'
        : 'messages.events.previewLabelPreparing';
    case 'label_ready':
      return 'messages.events.previewLabelReady';
    case 'order_shipped':
      return 'messages.events.previewOrderShipped';
    case 'buyer_confirm_prompt':
      return isSeller
        ? 'messages.events.previewBuyerConfirmSeller'
        : 'messages.events.previewBuyerConfirm';
    case 'payment_released':
      return isSeller
        ? 'messages.events.previewPaymentReleasedSeller'
        : 'messages.events.previewPaymentReleased';
    case 'transaction_complete':
      return 'messages.events.previewTransactionComplete';
    default:
      return 'messages.events.previewGeneric';
  }
}
