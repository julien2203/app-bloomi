import {
  messagesThreadDeepLink,
  orderDeepLink,
  ordersDeepLink,
  profileHomeDeepLink,
  sellDeepLink,
  walletDeepLink,
} from "./emailDeepLinks.ts";

export type EmailLang = "en" | "fr" | "de" | "it";

export function normalizeEmailLang(lang: string | null | undefined): EmailLang {
  const code = lang?.trim().toLowerCase().split("-")[0];
  if (code === "fr" || code === "de" || code === "it") return code;
  return "en";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function emailButton(href: string, label: string): string {
  return `<p style="margin:24px 0;">
  <a href="${escapeHtml(href)}" style="display:inline-block;background:#C3EA4F;color:#1A1A1A;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px;">
    ${escapeHtml(label)}
  </a>
</p>`;
}

export function wrapEmailHtml(bodyHtml: string, lang: EmailLang): string {
  const signoff =
    lang === "fr"
      ? "— L'équipe Bloomi"
      : lang === "de"
      ? "— Das Bloomi-Team"
      : lang === "it"
      ? "— Il team Bloomi"
      : "— The Bloomi team";

  return `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1A1A1A;line-height:1.5;margin:0;padding:24px;background:#FAFAFA;">
  <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:12px;padding:28px;border:1px solid #E8E8E8;">
    ${bodyHtml}
    <p style="color:#888;font-size:13px;margin-top:32px;">${signoff}</p>
  </div>
</body>
</html>`;
}

function defaultGreeting(lang: EmailLang): string {
  if (lang === "fr") return "Bonjour";
  if (lang === "de") return "Hallo";
  if (lang === "it") return "Ciao";
  return "Hello";
}

function displayNameOrGreeting(lang: EmailLang, displayName: string): string {
  return displayName.trim() || defaultGreeting(lang);
}

export type TransactionalEmailContent = {
  subject: string;
  html: string;
};

export function welcomeEmailContent(
  lang: EmailLang,
  displayName: string,
): TransactionalEmailContent {
  const name = displayName.trim() || (lang === "fr" ? "Bonjour" : "Hello");
  const cta = profileHomeDeepLink();

  if (lang === "fr") {
    return {
      subject: "Bienvenue sur Bloomi",
      html: wrapEmailHtml(`
<p>Bonjour ${escapeHtml(name)},</p>
<p>Bienvenue sur Bloomi ! Voici comment bien démarrer :</p>
<ol>
  <li>Complétez votre profil</li>
  <li>Publiez votre premier article</li>
  <li>Activez votre compte vendeur pour recevoir vos paiements</li>
  <li>Consultez vos notifications pour ne rien manquer</li>
</ol>
${emailButton(cta, "Ouvrir Bloomi")}
<p style="color:#666;font-size:14px;">Des questions ? Répondez à cet e-mail ou écrivez-nous à contact@bloomi.ch</p>
`, lang),
    };
  }

  if (lang === "de") {
    return {
      subject: "Willkommen bei Bloomi",
      html: wrapEmailHtml(`
<p>Hallo ${escapeHtml(name)},</p>
<p>Willkommen bei Bloomi! So startest du richtig:</p>
<ol>
  <li>Vervollständige dein Profil</li>
  <li>Veröffentliche deinen ersten Artikel</li>
  <li>Aktiviere dein Verkäuferkonto für Auszahlungen</li>
  <li>Behalte deine Benachrichtigungen im Blick</li>
</ol>
${emailButton(cta, "Bloomi öffnen")}
`, lang),
    };
  }

  if (lang === "it") {
    return {
      subject: "Benvenuto su Bloomi",
      html: wrapEmailHtml(`
<p>Ciao ${escapeHtml(name)},</p>
<p>Benvenuto su Bloomi! Ecco come iniziare:</p>
<ol>
  <li>Completa il tuo profilo</li>
  <li>Pubblica il tuo primo articolo</li>
  <li>Attiva il conto venditore per i pagamenti</li>
  <li>Controlla le notifiche per non perdere nulla</li>
</ol>
${emailButton(cta, "Apri Bloomi")}
`, lang),
    };
  }

  return {
    subject: "Welcome to Bloomi",
    html: wrapEmailHtml(`
<p>Hi ${escapeHtml(name)},</p>
<p>Welcome to Bloomi! Here's how to get started:</p>
<ol>
  <li>Complete your profile</li>
  <li>List your first item</li>
  <li>Activate your seller account to get paid</li>
  <li>Keep an eye on notifications so you don't miss anything</li>
</ol>
${emailButton(cta, "Open Bloomi")}
`, lang),
  };
}

export function itemSoldEmailContent(
  lang: EmailLang,
  params: { displayName: string; listingTitle: string; orderId: string; pickup: boolean },
): TransactionalEmailContent {
  const name = params.displayName.trim() || (lang === "fr" ? "Bonjour" : "Hello");
  const title = params.listingTitle.trim() || (lang === "fr" ? "votre article" : "your item");
  const cta = orderDeepLink(params.orderId);

  if (lang === "fr") {
    return {
      subject: "Votre article a été vendu — Bloomi",
      html: wrapEmailHtml(`
<p>Bonjour ${escapeHtml(name)},</p>
<p>Bonne nouvelle : <strong>${escapeHtml(title)}</strong> vient d'être vendu.</p>
<p>${params.pickup
        ? "L'acheteur a choisi la remise en main propre. Contactez-le via la messagerie pour organiser le rendez-vous."
        : "Préparez et expédiez le colis dès que possible depuis vos commandes."}</p>
${emailButton(cta, params.pickup ? "Voir la commande" : "Préparer l'expédition")}
`, lang),
    };
  }

  if (lang === "de") {
    return {
      subject: "Dein Artikel wurde verkauft — Bloomi",
      html: wrapEmailHtml(`
<p>Hallo ${escapeHtml(name)},</p>
<p><strong>${escapeHtml(title)}</strong> wurde soeben verkauft.</p>
${emailButton(cta, "Bestellung ansehen")}
`, lang),
    };
  }

  if (lang === "it") {
    return {
      subject: "Il tuo articolo è stato venduto — Bloomi",
      html: wrapEmailHtml(`
<p>Ciao ${escapeHtml(name)},</p>
<p><strong>${escapeHtml(title)}</strong> è stato appena venduto.</p>
${emailButton(cta, "Vedi ordine")}
`, lang),
    };
  }

  return {
    subject: "Your item sold — Bloomi",
    html: wrapEmailHtml(`
<p>Hi ${escapeHtml(name)},</p>
<p>Great news: <strong>${escapeHtml(title)}</strong> has just sold.</p>
<p>${params.pickup
      ? "The buyer chose local pickup. Message them to arrange the handoff."
      : "Prepare and ship the parcel as soon as you can."}</p>
${emailButton(cta, params.pickup ? "View order" : "Prepare shipment")}
`, lang),
  };
}

export function newOfferEmailContent(
  lang: EmailLang,
  params: { displayName: string; listingTitle: string; amount: string; threadId: string },
): TransactionalEmailContent {
  const name = params.displayName.trim() || (lang === "fr" ? "Bonjour" : "Hello");
  const title = params.listingTitle.trim() || (lang === "fr" ? "votre article" : "your listing");
  const cta = messagesThreadDeepLink(params.threadId);

  if (lang === "fr") {
    return {
      subject: "Nouvelle offre reçue — Bloomi",
      html: wrapEmailHtml(`
<p>Bonjour ${escapeHtml(name)},</p>
<p>Un acheteur propose <strong>${escapeHtml(params.amount)} CHF</strong> pour <strong>${escapeHtml(title)}</strong>.</p>
<p>Acceptez, refusez ou faites une contre-offre depuis la messagerie.</p>
${emailButton(cta, "Voir l'offre")}
`, lang),
    };
  }

  if (lang === "de") {
    return {
      subject: "Neues Angebot erhalten — Bloomi",
      html: wrapEmailHtml(`
<p>Hallo ${escapeHtml(name)},</p>
<p>Ein Käufer bietet <strong>${escapeHtml(params.amount)} CHF</strong> für <strong>${escapeHtml(title)}</strong>.</p>
${emailButton(cta, "Angebot ansehen")}
`, lang),
    };
  }

  if (lang === "it") {
    return {
      subject: "Nuova offerta ricevuta — Bloomi",
      html: wrapEmailHtml(`
<p>Ciao ${escapeHtml(name)},</p>
<p>Un acquirente offre <strong>${escapeHtml(params.amount)} CHF</strong> per <strong>${escapeHtml(title)}</strong>.</p>
${emailButton(cta, "Vedi offerta")}
`, lang),
    };
  }

  return {
    subject: "New offer received — Bloomi",
    html: wrapEmailHtml(`
<p>Hi ${escapeHtml(name)},</p>
<p>A buyer offered <strong>${escapeHtml(params.amount)} CHF</strong> for <strong>${escapeHtml(title)}</strong>.</p>
<p>Accept, decline, or counter-offer in messages.</p>
${emailButton(cta, "View offer")}
`, lang),
  };
}

export function shipReminderEmailContent(
  lang: EmailLang,
  params: { displayName: string; listingTitle: string; orderId: string },
): TransactionalEmailContent {
  const name = params.displayName.trim() || (lang === "fr" ? "Bonjour" : "Hello");
  const title = params.listingTitle.trim() || (lang === "fr" ? "votre vente" : "your sale");
  const cta = orderDeepLink(params.orderId);

  if (lang === "fr") {
    return {
      subject: "Rappel : expédiez votre colis — Bloomi",
      html: wrapEmailHtml(`
<p>Bonjour ${escapeHtml(name)},</p>
<p>Votre acheteur attend toujours le colis pour <strong>${escapeHtml(title)}</strong>.</p>
<p>Marquez la commande comme expédiée une fois le colis déposé à La Poste.</p>
${emailButton(cta, "Voir la commande")}
`, lang),
    };
  }

  if (lang === "de") {
    return {
      subject: "Erinnerung: Paket versenden — Bloomi",
      html: wrapEmailHtml(`
<p>Hallo ${escapeHtml(name)},</p>
<p>Dein Käufer wartet noch auf das Paket für <strong>${escapeHtml(title)}</strong>.</p>
${emailButton(cta, "Bestellung ansehen")}
`, lang),
    };
  }

  if (lang === "it") {
    return {
      subject: "Promemoria: spedisci il pacco — Bloomi",
      html: wrapEmailHtml(`
<p>Ciao ${escapeHtml(name)},</p>
<p>L'acquirente attende ancora il pacco per <strong>${escapeHtml(title)}</strong>.</p>
${emailButton(cta, "Vedi ordine")}
`, lang),
    };
  }

  return {
    subject: "Reminder: ship your parcel — Bloomi",
    html: wrapEmailHtml(`
<p>Hi ${escapeHtml(name)},</p>
<p>Your buyer is still waiting for the parcel for <strong>${escapeHtml(title)}</strong>.</p>
<p>Mark the order as shipped once you've dropped it off.</p>
${emailButton(cta, "View order")}
`, lang),
  };
}

export function unreadMessageEmailContent(
  lang: EmailLang,
  params: { displayName: string; senderName: string; preview: string; threadId: string },
): TransactionalEmailContent {
  const name = params.displayName.trim() || (lang === "fr" ? "Bonjour" : "Hello");
  const sender = params.senderName.trim() || (lang === "fr" ? "Quelqu'un" : "Someone");
  const preview = params.preview.trim().slice(0, 200);
  const cta = messagesThreadDeepLink(params.threadId);

  if (lang === "fr") {
    return {
      subject: `Nouveau message de ${sender} — Bloomi`,
      html: wrapEmailHtml(`
<p>Bonjour ${escapeHtml(name)},</p>
<p><strong>${escapeHtml(sender)}</strong> vous a envoyé un message :</p>
<p style="background:#F5F5F5;padding:12px 16px;border-radius:8px;color:#333;">${escapeHtml(preview)}</p>
${emailButton(cta, "Répondre dans Bloomi")}
`, lang),
    };
  }

  if (lang === "de") {
    return {
      subject: `Neue Nachricht von ${sender} — Bloomi`,
      html: wrapEmailHtml(`
<p>Hallo ${escapeHtml(name)},</p>
<p><strong>${escapeHtml(sender)}</strong> hat dir geschrieben:</p>
<p style="background:#F5F5F5;padding:12px 16px;border-radius:8px;">${escapeHtml(preview)}</p>
${emailButton(cta, "In Bloomi antworten")}
`, lang),
    };
  }

  if (lang === "it") {
    return {
      subject: `Nuovo messaggio da ${sender} — Bloomi`,
      html: wrapEmailHtml(`
<p>Ciao ${escapeHtml(name)},</p>
<p><strong>${escapeHtml(sender)}</strong> ti ha scritto:</p>
<p style="background:#F5F5F5;padding:12px 16px;border-radius:8px;">${escapeHtml(preview)}</p>
${emailButton(cta, "Rispondi su Bloomi")}
`, lang),
    };
  }

  return {
    subject: `New message from ${sender} — Bloomi`,
    html: wrapEmailHtml(`
<p>Hi ${escapeHtml(name)},</p>
<p><strong>${escapeHtml(sender)}</strong> sent you a message:</p>
<p style="background:#F5F5F5;padding:12px 16px;border-radius:8px;">${escapeHtml(preview)}</p>
${emailButton(cta, "Reply in Bloomi")}
`, lang),
  };
}

export function orderCancelledEmailContent(
  lang: EmailLang,
  params: { displayName: string; orderId: string; refunded: boolean },
): TransactionalEmailContent {
  const name = displayNameOrGreeting(lang, params.displayName);
  const shortId = params.orderId.slice(0, 8);
  const cta = ordersDeepLink();

  if (lang === "fr") {
    return {
      subject: "Commande annulée — Bloomi",
      html: wrapEmailHtml(`
<p>Bonjour ${escapeHtml(name)},</p>
<p>Votre commande <strong>${escapeHtml(shortId)}</strong> a été annulée.</p>
<p>${params.refunded
        ? "Vous serez remboursé(e) selon les délais de votre banque."
        : "Consultez l'app pour plus de détails."}</p>
${emailButton(cta, "Voir mes commandes")}
`, lang),
    };
  }

  if (lang === "de") {
    return {
      subject: "Bestellung storniert — Bloomi",
      html: wrapEmailHtml(`
<p>Hallo ${escapeHtml(name)},</p>
<p>Deine Bestellung <strong>${escapeHtml(shortId)}</strong> wurde storniert.</p>
<p>${params.refunded
        ? "Die Rückerstattung erfolgt gemäss den Fristen deiner Bank."
        : "Weitere Details findest du in der App."}</p>
${emailButton(cta, "Meine Bestellungen ansehen")}
`, lang),
    };
  }

  if (lang === "it") {
    return {
      subject: "Ordine annullato — Bloomi",
      html: wrapEmailHtml(`
<p>Ciao ${escapeHtml(name)},</p>
<p>Il tuo ordine <strong>${escapeHtml(shortId)}</strong> è stato annullato.</p>
<p>${params.refunded
        ? "Il rimborso avverrà secondo i tempi della tua banca."
        : "Consulta l'app per maggiori dettagli."}</p>
${emailButton(cta, "Vedi i miei ordini")}
`, lang),
    };
  }

  return {
    subject: "Order cancelled — Bloomi",
    html: wrapEmailHtml(`
<p>Hi ${escapeHtml(name)},</p>
<p>Your order <strong>${escapeHtml(shortId)}</strong> has been cancelled.</p>
<p>${params.refunded ? "You will be refunded according to your bank's timeline." : "Check the app for details."}</p>
${emailButton(cta, "View my orders")}
`, lang),
  };
}

export function sellerOrderCancelledEmailContent(
  lang: EmailLang,
  params: { displayName: string; orderId: string },
): TransactionalEmailContent {
  const name = displayNameOrGreeting(lang, params.displayName);
  const shortId = params.orderId.slice(0, 8);
  const cta = orderDeepLink(params.orderId);

  if (lang === "fr") {
    return {
      subject: "Commande annulée — action requise — Bloomi",
      html: wrapEmailHtml(`
<p>Bonjour ${escapeHtml(name)},</p>
<p><strong>Commande annulée</strong></p>
<p>La commande <strong>${escapeHtml(shortId)}</strong> a été annulée. Consultez vos commandes pour plus de détails.</p>
${emailButton(cta, "Voir la commande")}
`, lang),
    };
  }

  if (lang === "de") {
    return {
      subject: "Bestellung storniert — Aktion erforderlich — Bloomi",
      html: wrapEmailHtml(`
<p>Hallo ${escapeHtml(name)},</p>
<p><strong>Bestellung storniert</strong></p>
<p>Die Bestellung <strong>${escapeHtml(shortId)}</strong> wurde storniert. Weitere Details findest du unter deinen Bestellungen.</p>
${emailButton(cta, "Bestellung ansehen")}
`, lang),
    };
  }

  if (lang === "it") {
    return {
      subject: "Ordine annullato — azione richiesta — Bloomi",
      html: wrapEmailHtml(`
<p>Ciao ${escapeHtml(name)},</p>
<p><strong>Ordine annullato</strong></p>
<p>L'ordine <strong>${escapeHtml(shortId)}</strong> è stato annullato. Consulta i tuoi ordini per maggiori dettagli.</p>
${emailButton(cta, "Vedi ordine")}
`, lang),
    };
  }

  return {
    subject: "Order cancelled — action required — Bloomi",
    html: wrapEmailHtml(`
<p>Hi ${escapeHtml(name)},</p>
<p><strong>Order cancelled</strong></p>
<p>Order <strong>${escapeHtml(shortId)}</strong> was cancelled. Check your orders for details.</p>
${emailButton(cta, "View order")}
`, lang),
  };
}

export function orderActionRequiredEmailContent(
  lang: EmailLang,
  params: {
    displayName: string;
    headline: string;
    body: string;
    ctaLabel: string;
    ctaUrl: string;
  },
): TransactionalEmailContent {
  const name = displayNameOrGreeting(lang, params.displayName);

  if (lang === "fr") {
    return {
      subject: `Action requise — ${params.headline}`,
      html: wrapEmailHtml(`
<p>Bonjour ${escapeHtml(name)},</p>
<p><strong>${escapeHtml(params.headline)}</strong></p>
<p>${escapeHtml(params.body)}</p>
${emailButton(params.ctaUrl, params.ctaLabel)}
`, lang),
    };
  }

  if (lang === "de") {
    return {
      subject: `Aktion erforderlich — ${params.headline}`,
      html: wrapEmailHtml(`
<p>Hallo ${escapeHtml(name)},</p>
<p><strong>${escapeHtml(params.headline)}</strong></p>
<p>${escapeHtml(params.body)}</p>
${emailButton(params.ctaUrl, params.ctaLabel)}
`, lang),
    };
  }

  if (lang === "it") {
    return {
      subject: `Azione richiesta — ${params.headline}`,
      html: wrapEmailHtml(`
<p>Ciao ${escapeHtml(name)},</p>
<p><strong>${escapeHtml(params.headline)}</strong></p>
<p>${escapeHtml(params.body)}</p>
${emailButton(params.ctaUrl, params.ctaLabel)}
`, lang),
    };
  }

  return {
    subject: `Action required — ${params.headline}`,
    html: wrapEmailHtml(`
<p>Hi ${escapeHtml(name)},</p>
<p><strong>${escapeHtml(params.headline)}</strong></p>
<p>${escapeHtml(params.body)}</p>
${emailButton(params.ctaUrl, params.ctaLabel)}
`, lang),
  };
}

export function labelReadyEmailCtaBlock(lang: EmailLang): string {
  const cta = ordersDeepLink();
  const label =
    lang === "fr"
      ? "Ouvrir mes commandes"
      : lang === "de"
      ? "Bestellungen öffnen"
      : lang === "it"
      ? "Apri ordini"
      : "Open my orders";
  return emailButton(cta, label);
}

export function stripeOnboardingEmailContent(
  lang: EmailLang,
  displayName: string,
): TransactionalEmailContent {
  const name = displayNameOrGreeting(lang, displayName);
  const cta = walletDeepLink();

  if (lang === "fr") {
    return {
      subject: "Finalisez votre compte vendeur — Bloomi",
      html: wrapEmailHtml(`
<p>Bonjour ${escapeHtml(name)},</p>
<p>Une action est requise pour activer votre compte vendeur et recevoir vos paiements.</p>
${emailButton(cta, "Activer mon compte")}
`, lang),
    };
  }

  if (lang === "de") {
    return {
      subject: "Verkäuferkonto abschliessen — Bloomi",
      html: wrapEmailHtml(`
<p>Hallo ${escapeHtml(name)},</p>
<p>Eine Aktion ist erforderlich, um dein Verkäuferkonto zu aktivieren und Auszahlungen zu erhalten.</p>
${emailButton(cta, "Konto aktivieren")}
`, lang),
    };
  }

  if (lang === "it") {
    return {
      subject: "Completa il tuo account venditore — Bloomi",
      html: wrapEmailHtml(`
<p>Ciao ${escapeHtml(name)},</p>
<p>È richiesta un'azione per attivare il tuo account venditore e ricevere i pagamenti.</p>
${emailButton(cta, "Attiva account")}
`, lang),
    };
  }

  return {
    subject: "Complete your seller account — Bloomi",
    html: wrapEmailHtml(`
<p>Hi ${escapeHtml(name)},</p>
<p>Action is required to activate your seller account and receive payouts.</p>
${emailButton(cta, "Activate account")}
`, lang),
  };
}

export { sellDeepLink, walletDeepLink, ordersDeepLink };
