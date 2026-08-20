export type NotifLang = "en" | "fr" | "de" | "it";

type LocalizedCopy = Record<NotifLang, string>;

export function normalizeNotifLang(lang: string | null | undefined): NotifLang {
  const code = lang?.trim().toLowerCase().split("-")[0];
  if (code === "fr" || code === "de" || code === "it") return code;
  return "en";
}

function pick(lang: NotifLang, copy: LocalizedCopy): string {
  return copy[lang] ?? copy.en;
}

function someoneName(lang: NotifLang, displayName: string): string {
  if (displayName.trim() !== "") return displayName.trim();
  return pick(lang, {
    fr: "Quelqu'un",
    en: "Someone",
    de: "Jemand",
    it: "Qualcuno",
  });
}

export function newMessagePushText(
  lang: NotifLang,
  displayName: string,
  preview: string,
): { title: string; body: string } {
  const name = someoneName(lang, displayName);
  const title = pick(lang, {
    fr: `💬 Nouveau message de ${name}`,
    en: `💬 New message from ${name}`,
    de: `💬 Neue Nachricht von ${name}`,
    it: `💬 Nuovo messaggio da ${name}`,
  });
  return { title, body: preview };
}

export function interestedInListingPushText(
  lang: NotifLang,
  displayName: string,
): { title: string; body: string } {
  const name = someoneName(lang, displayName);
  return {
    title: pick(lang, {
      fr: "👀 Quelqu'un s'intéresse à ton article",
      en: "👀 Someone is interested in your listing",
      de: "👀 Jemand interessiert sich für deinen Artikel",
      it: "👀 Qualcuno è interessato al tuo articolo",
    }),
    body: pick(lang, {
      fr: `${name} vous a envoyé un message.`,
      en: `${name} sent you a message.`,
      de: `${name} hat dir eine Nachricht gesendet.`,
      it: `${name} ti ha inviato un messaggio.`,
    }),
  };
}

export function questionOnListingPushText(
  lang: NotifLang,
  displayName: string,
  preview: string,
): { title: string; body: string } {
  const name = someoneName(lang, displayName);
  return {
    title: pick(lang, {
      fr: "❓ On te pose une question !",
      en: "❓ You got a question!",
      de: "❓ Du hast eine Frage erhalten!",
      it: "❓ Hai ricevuto una domanda!",
    }),
    body: preview.trim() !== ""
      ? preview
      : pick(lang, {
        fr: `${name} a une question sur ton article.`,
        en: `${name} has a question about your listing.`,
        de: `${name} hat eine Frage zu deinem Artikel.`,
        it: `${name} ha una domanda sul tuo articolo.`,
      }),
  };
}

export function likeListingPushText(lang: NotifLang): { title: string; body: string } {
  return {
    title: pick(lang, {
      fr: "❤️ Ton article a été liké",
      en: "❤️ Your listing was liked",
      de: "❤️ Dein Artikel wurde geliked",
      it: "❤️ Il tuo articolo è stato messo mi piace",
    }),
    body: pick(lang, {
      fr: "Baisse le prix de 1–2 CHF dans l'heure pour vendre plus vite !",
      en: "Drop the price by CHF 1–2 within the hour to sell faster!",
      de: "Senke den Preis innerhalb einer Stunde um 1–2 CHF, um schneller zu verkaufen!",
      it: "Abbassa il prezzo di 1–2 CHF entro un'ora per vendere più in fretta!",
    }),
  };
}

export function listingLikesHotPushText(lang: NotifLang): { title: string; body: string } {
  return {
    title: pick(lang, {
      fr: "🔥 Ton article plaît beaucoup !",
      en: "🔥 Your listing is really popular!",
      de: "🔥 Dein Artikel ist sehr beliebt!",
      it: "🔥 Il tuo articolo piace molto!",
    }),
    body: pick(lang, {
      fr: "Plusieurs personnes l'ont ajouté à leurs favoris. C'est le bon moment pour vendre !",
      en: "Several people saved it. Great time to close a sale!",
      de: "Mehrere Personen haben ihn gespeichert. Jetzt ist ein guter Zeitpunkt zu verkaufen!",
      it: "Diverse persone lo hanno salvato. È il momento giusto per vendere!",
    }),
  };
}

export function urgencySomeoneElsePushText(lang: NotifLang): { title: string; body: string } {
  return {
    title: pick(lang, {
      fr: "⚠️ Quelqu'un d'autre est intéressé par ton article",
      en: "⚠️ Someone else is interested in this listing",
      de: "⚠️ Jemand anderes interessiert sich für diesen Artikel",
      it: "⚠️ Qualcun altro è interessato a questo articolo",
    }),
    body: pick(lang, {
      fr: "Ne tarde pas trop, d'autres personnes le regardent aussi.",
      en: "Don't wait too long — others are looking at it too.",
      de: "Warte nicht zu lange — andere schauen ihn sich ebenfalls an.",
      it: "Non aspettare troppo — anche altre persone lo stanno guardando.",
    }),
  };
}

export function urgencySellingFastPushText(lang: NotifLang): { title: string; body: string } {
  return {
    title: pick(lang, {
      fr: "🔥 Cet article part vite !",
      en: "🔥 This listing is going fast!",
      de: "🔥 Dieser Artikel geht schnell weg!",
      it: "🔥 Questo articolo va a ruba!",
    }),
    body: pick(lang, {
      fr: "Il attire beaucoup d'attention en ce moment.",
      en: "It's getting a lot of attention right now.",
      de: "Er bekommt gerade viel Aufmerksamkeit.",
      it: "Sta attirando molta attenzione in questo momento.",
    }),
  };
}

export function urgencyActNowPushText(lang: NotifLang): { title: string; body: string } {
  return {
    title: pick(lang, {
      fr: "⏳ Si tu le veux… c'est maintenant",
      en: "⏳ If you want it… now's the time",
      de: "⏳ Wenn du es willst… jetzt ist der Moment",
      it: "⏳ Se lo vuoi… è adesso",
    }),
    body: pick(lang, {
      fr: "Quelqu'un vient de commander cet article. Dépêche-toi !",
      en: "Someone just ordered this item. Hurry!",
      de: "Jemand hat diesen Artikel gerade bestellt. Beeil dich!",
      it: "Qualcuno ha appena ordinato questo articolo. Sbrigati!",
    }),
  };
}

export function itemSoldPushText(
  lang: NotifLang,
  options?: { pickup?: boolean },
): { title: string; body: string } {
  const pickup = Boolean(options?.pickup);
  return {
    title: pick(lang, {
      fr: "🎉 Ton article est vendu !",
      en: "🎉 Your item sold!",
      de: "🎉 Dein Artikel wurde verkauft!",
      it: "🎉 Il tuo articolo è stato venduto!",
    }),
    body: pickup
      ? pick(lang, {
        fr: "Un acheteur a payé pour la remise en main propre. Échangez vos coordonnées via la messagerie pour organiser le rendez-vous.",
        en: "A buyer paid for local pickup. Share contact details via messages to arrange the handoff.",
        de: "Ein Käufer hat für die Abholung vor Ort bezahlt. Tauscht Kontaktdaten im Chat aus, um den Termin zu vereinbaren.",
        it: "Un acquirente ha pagato per il ritiro di persona. Scambiate i dati di contatto via messaggi per organizzare l'incontro.",
      })
      : pick(lang, {
        fr: "Un acheteur vient de commander. Prépare ton colis !",
        en: "A buyer just placed an order. Get your parcel ready!",
        de: "Ein Käufer hat gerade bestellt. Bereite dein Paket vor!",
        it: "Un acquirente ha appena ordinato. Prepara il pacco!",
      }),
  };
}

export function pickupReminderPushText(lang: NotifLang): { title: string; body: string } {
  return {
    title: pick(lang, {
      fr: "🤝 Organise la remise en main propre",
      en: "🤝 Arrange the local handoff",
      de: "🤝 Organisiere die Abholung vor Ort",
      it: "🤝 Organizza il ritiro di persona",
    }),
    body: pick(lang, {
      fr: "Échangez vos coordonnées via la messagerie pour convenir d'un rendez-vous (paiement déjà sécurisé).",
      en: "Share contact details via messages to set up a meet-up (payment already secured).",
      de: "Tauscht Kontaktdaten im Chat aus, um einen Termin zu vereinbaren (Zahlung bereits gesichert).",
      it: "Scambiate i dati di contatto via messaggi per fissare un incontro (pagamento già protetto).",
    }),
  };
}

export function orderPlacedSystemMessage(lang: NotifLang, pickup: boolean): string {
  if (pickup) {
    return pick(lang, {
      fr: "🛍️ Commande passée — Le paiement est sécurisé. Vous pouvez échanger vos coordonnées pour organiser la remise en main propre.",
      en: "🛍️ Order placed — Payment is secure. You can share contact details to arrange local pickup.",
      de: "🛍️ Bestellung aufgegeben — Die Zahlung ist gesichert. Ihr könnt Kontaktdaten austauschen, um die Abholung zu organisieren.",
      it: "🛍️ Ordine effettuato — Il pagamento è sicuro. Potete scambiare i dati di contatto per organizzare il ritiro.",
    });
  }
  return pick(lang, {
    fr: "🛍️ Commande passée — Le paiement est sécurisé. Le vendeur prépare votre colis.",
    en: "🛍️ Order placed — Payment is secure. The seller will prepare your parcel.",
    de: "🛍️ Bestellung aufgegeben — Die Zahlung ist gesichert. Der Verkäufer bereitet dein Paket vor.",
    it: "🛍️ Ordine effettuato — Il pagamento è sicuro. Il venditore preparerà il tuo pacco.",
  });
}

export function orderAutoConfirmedSystemMessage(lang: NotifLang, pickup: boolean): string {
  void pickup;
  return pick(lang, {
    fr: "✅ Commande confirmée automatiquement après 7 jours — La transaction est terminée. Merci d'utiliser Bloomi !",
    en: "✅ Order automatically confirmed after 7 days — The transaction is complete. Thanks for using Bloomi!",
    de: "✅ Bestellung nach 7 Tagen automatisch bestätigt — Die Transaktion ist abgeschlossen. Danke, dass du Bloomi nutzt!",
    it: "✅ Ordine confermato automaticamente dopo 7 giorni — La transazione è completata. Grazie per aver usato Bloomi!",
  });
}

export function newOfferPushText(
  lang: NotifLang,
  amount: string,
): { title: string; body: string } {
  return {
    title: pick(lang, {
      fr: "💸 Nouvelle offre reçue",
      en: "💸 New offer received",
      de: "💸 Neues Angebot erhalten",
      it: "💸 Nuova offerta ricevuta",
    }),
    body: pick(lang, {
      fr: `Un acheteur propose ${amount} CHF pour ton article.`,
      en: `A buyer offered ${amount} CHF for your listing.`,
      de: `Ein Käufer bietet ${amount} CHF für deinen Artikel.`,
      it: `Un acquirente offre ${amount} CHF per il tuo articolo.`,
    }),
  };
}

export function orderConfirmedPushText(lang: NotifLang): { title: string; body: string } {
  return {
    title: pick(lang, {
      fr: "✅ Transaction terminée, bien joué !",
      en: "✅ Transaction complete, nice work!",
      de: "✅ Transaktion abgeschlossen, gut gemacht!",
      it: "✅ Transazione completata, ottimo lavoro!",
    }),
    body: pick(lang, {
      fr: "Votre achat est confirmé. Profitez-en !",
      en: "Your purchase is confirmed. Enjoy!",
      de: "Dein Kauf ist bestätigt. Viel Freude damit!",
      it: "Il tuo acquisto è confermato. Buon divertimento!",
    }),
  };
}

export function paymentReceivedPushText(lang: NotifLang): { title: string; body: string } {
  return {
    title: pick(lang, {
      fr: "💰 Paiement reçu, bravo !",
      en: "💰 Payment received, nice work!",
      de: "💰 Zahlung erhalten, gut gemacht!",
      it: "💰 Pagamento ricevuto, ottimo lavoro!",
    }),
    body: pick(lang, {
      fr: "Le paiement a été transféré sur votre compte.",
      en: "The payment has been transferred to your account.",
      de: "Die Zahlung wurde auf dein Konto überwiesen.",
      it: "Il pagamento è stato trasferito sul tuo conto.",
    }),
  };
}

export function shipReminderPushText(lang: NotifLang): { title: string; body: string } {
  return {
    title: pick(lang, {
      fr: "📦 Pense à expédier ton colis 📬",
      en: "📦 Remember to ship your parcel 📬",
      de: "📦 Denk daran, dein Paket zu versenden 📬",
      it: "📦 Ricordati di spedire il pacco 📬",
    }),
    body: pick(lang, {
      fr: "Ton acheteur attend son colis. Expédie-le dès que possible !",
      en: "Your buyer is waiting. Ship as soon as you can!",
      de: "Dein Käufer wartet. Versende so schnell wie möglich!",
      it: "Il tuo acquirente sta aspettando. Spedisci appena puoi!",
    }),
  };
}

export function orderCancelledPushText(lang: NotifLang): { title: string; body: string } {
  return {
    title: pick(lang, {
      fr: "✅ Commande annulée",
      en: "✅ Order cancelled",
      de: "✅ Bestellung storniert",
      it: "✅ Ordine annullato",
    }),
    body: pick(lang, {
      fr: "Votre commande a été annulée et vous serez remboursé(e).",
      en: "Your order has been cancelled and you will be refunded.",
      de: "Deine Bestellung wurde storniert und du erhältst eine Rückerstattung.",
      it: "Il tuo ordine è stato annullato e riceverai un rimborso.",
    }),
  };
}

export function sellerOrderCancelledPushText(lang: NotifLang): { title: string; body: string } {
  return {
    title: pick(lang, {
      fr: "Commande annulée",
      en: "Order cancelled",
      de: "Bestellung storniert",
      it: "Ordine annullato",
    }),
    body: pick(lang, {
      fr: "Une commande a été annulée. Votre article est de nouveau en vente.",
      en: "An order was cancelled. Your item is listed again.",
      de: "Eine Bestellung wurde storniert. Dein Artikel ist wieder zum Verkauf.",
      it: "Un ordine è stato annullato. Il tuo articolo è di nuovo in vendita.",
    }),
  };
}

export function priceDropPushText(
  lang: NotifLang,
  params: { title: string; oldPrice: string; newPrice: string },
): { title: string; body: string } {
  const item = params.title.trim() || pick(lang, { fr: "Un favori", en: "A favorite", de: "Ein Favorit", it: "Un preferito" });
  return {
    title: pick(lang, {
      fr: "📉 Prix baissé",
      en: "📉 Price drop",
      de: "📉 Preis gesenkt",
      it: "📉 Prezzo abbassato",
    }),
    body: pick(lang, {
      fr: `${item} : ${params.oldPrice} → ${params.newPrice} CHF`,
      en: `${item}: ${params.oldPrice} → ${params.newPrice} CHF`,
      de: `${item}: ${params.oldPrice} → ${params.newPrice} CHF`,
      it: `${item}: ${params.oldPrice} → ${params.newPrice} CHF`,
    }),
  };
}

export function followedSellerNewListingPushText(
  lang: NotifLang,
  params: { sellerName: string; listingTitle: string },
): { title: string; body: string } {
  const seller = params.sellerName.trim() || pick(lang, { fr: "Un vendeur", en: "A seller", de: "Ein Verkäufer", it: "Un venditore" });
  const title = params.listingTitle.trim() || pick(lang, { fr: "un nouvel article", en: "a new item", de: "einen neuen Artikel", it: "un nuovo articolo" });
  return {
    title: pick(lang, {
      fr: "✨ Nouvel article",
      en: "✨ New listing",
      de: "✨ Neues Inserat",
      it: "✨ Nuovo annuncio",
    }),
    body: pick(lang, {
      fr: `${seller} a publié : ${title}`,
      en: `${seller} listed: ${title}`,
      de: `${seller} hat veröffentlicht: ${title}`,
      it: `${seller} ha pubblicato: ${title}`,
    }),
  };
}

export function noPurchaseNudgePushText(lang: NotifLang): { title: string; body: string } {
  return {
    title: pick(lang, {
      fr: "−5 CHF dès 30 CHF 🎁",
      en: "−5 CHF from 30 CHF 🎁",
      de: "−5 CHF ab 30 CHF 🎁",
      it: "−5 CHF da 30 CHF 🎁",
    }),
    body: pick(lang, {
      fr: "Votre offre de bienvenue est toujours active. Explorez Bloomi !",
      en: "Your welcome offer is still active. Explore Bloomi!",
      de: "Dein Willkommensangebot ist noch aktiv. Entdecke Bloomi!",
      it: "La tua offerta di benvenuto è ancora attiva. Esplora Bloomi!",
    }),
  };
}

export function sellerNoSaleTipsPushText(
  lang: NotifLang,
  params: { listingTitle: string; tip: string },
): { title: string; body: string } {
  const title = params.listingTitle.trim() || pick(lang, { fr: "Votre annonce", en: "Your listing", de: "Dein Inserat", it: "Il tuo annuncio" });
  return {
    title: pick(lang, {
      fr: "💡 Conseil vendeur",
      en: "💡 Seller tip",
      de: "💡 Verkäufer-Tipp",
      it: "💡 Consiglio venditore",
    }),
    body: pick(lang, {
      fr: `${title} — ${params.tip}`,
      en: `${title} — ${params.tip}`,
      de: `${title} — ${params.tip}`,
      it: `${title} — ${params.tip}`,
    }),
  };
}

export function orderPaidBuyerPushText(lang: NotifLang): { title: string; body: string } {
  return {
    title: pick(lang, {
      fr: "✅ Commande confirmée",
      en: "✅ Order confirmed",
      de: "✅ Bestellung bestätigt",
      it: "✅ Ordine confermato",
    }),
    body: pick(lang, {
      fr: "Votre paiement est sécurisé. Le vendeur prépare votre colis.",
      en: "Your payment is secure. The seller is preparing your parcel.",
      de: "Deine Zahlung ist gesichert. Der Verkäufer bereitet dein Paket vor.",
      it: "Il tuo pagamento è sicuro. Il venditore sta preparando il tuo pacco.",
    }),
  };
}

export function labelReadySellerPushText(lang: NotifLang): { title: string; body: string } {
  return {
    title: pick(lang, {
      fr: "🖨️ Étiquette disponible",
      en: "🖨️ Label ready",
      de: "🖨️ Etikett verfügbar",
      it: "🖨️ Etichetta pronta",
    }),
    body: pick(lang, {
      fr: "Votre étiquette d'expédition est prête.",
      en: "Your shipping label is ready.",
      de: "Dein Versandetikett ist bereit.",
      it: "La tua etichetta di spedizione è pronta.",
    }),
  };
}

export function labelReadyBuyerPushText(lang: NotifLang): { title: string; body: string } {
  return {
    title: pick(lang, {
      fr: "📦 Étiquette générée",
      en: "📦 Label generated",
      de: "📦 Etikett erstellt",
      it: "📦 Etichetta generata",
    }),
    body: pick(lang, {
      fr: "L'étiquette d'expédition a été générée.",
      en: "The shipping label has been generated.",
      de: "Das Versandetikett wurde erstellt.",
      it: "L'etichetta di spedizione è stata generata.",
    }),
  };
}

export function parcelDepositedBuyerPushText(lang: NotifLang): { title: string; body: string } {
  return {
    title: pick(lang, {
      fr: "📦 Colis déposé",
      en: "📦 Parcel dropped off",
      de: "📦 Paket abgegeben",
      it: "📦 Pacco depositato",
    }),
    body: pick(lang, {
      fr: "Le vendeur a déposé le colis à La Poste.",
      en: "The seller dropped off the parcel at the post office.",
      de: "Der Verkäufer hat das Paket bei der Post abgegeben.",
      it: "Il venditore ha depositato il pacco all'ufficio postale.",
    }),
  };
}

export function parcelDepositedSellerPushText(lang: NotifLang): { title: string; body: string } {
  return {
    title: pick(lang, {
      fr: "📦 Colis déposé",
      en: "📦 Parcel dropped off",
      de: "📦 Paket abgegeben",
      it: "📦 Pacco depositato",
    }),
    body: pick(lang, {
      fr: "Merci ! Nous informons l'acheteur que le colis est en route.",
      en: "Thanks! We're letting the buyer know the parcel is on its way.",
      de: "Danke! Wir informieren den Käufer, dass das Paket unterwegs ist.",
      it: "Grazie! Informiamo l'acquirente che il pacco è in viaggio.",
    }),
  };
}

export function paymentReleasedBuyerPushText(lang: NotifLang): { title: string; body: string } {
  return {
    title: pick(lang, {
      fr: "✅ Confirmation enregistrée",
      en: "✅ Confirmation received",
      de: "✅ Bestätigung erhalten",
      it: "✅ Conferma ricevuta",
    }),
    body: pick(lang, {
      fr: "Votre confirmation a été reçue. Le paiement a été débloqué.",
      en: "Your confirmation was received. Payment has been released.",
      de: "Deine Bestätigung wurde erhalten. Die Zahlung wurde freigegeben.",
      it: "La tua conferma è stata ricevuta. Il pagamento è stato sbloccato.",
    }),
  };
}

export function transactionCompleteBuyerPushText(lang: NotifLang): { title: string; body: string } {
  return {
    title: pick(lang, {
      fr: "🎉 Transaction terminée",
      en: "🎉 Transaction complete",
      de: "🎉 Transaktion abgeschlossen",
      it: "🎉 Transazione completata",
    }),
    body: pick(lang, {
      fr: "Merci pour votre confiance !",
      en: "Thanks for your trust!",
      de: "Danke für dein Vertrauen!",
      it: "Grazie per la tua fiducia!",
    }),
  };
}

export async function fetchRecipientLanguage(
  supabaseAdmin: { from: (table: string) => any },
  userId: string,
): Promise<NotifLang> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("language")
    .eq("id", userId)
    .maybeSingle();
  const raw = data && typeof (data as { language?: unknown }).language === "string"
    ? (data as { language: string }).language
    : null;
  return normalizeNotifLang(raw);
}
