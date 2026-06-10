export type NotifLang = "en" | "fr";

export function normalizeNotifLang(lang: string | null | undefined): NotifLang {
  const code = lang?.trim().toLowerCase().split("-")[0];
  return code === "fr" ? "fr" : "en";
}

export function newMessagePushText(
  lang: NotifLang,
  displayName: string,
  preview: string,
): { title: string; body: string } {
  const name =
    displayName.trim() !== ""
      ? displayName.trim()
      : lang === "fr"
        ? "Quelqu'un"
        : "Someone";
  const title =
    lang === "fr"
      ? `💬 Nouveau message de ${name}`
      : `💬 New message from ${name}`;
  return { title, body: preview };
}

export function likeListingPushText(lang: NotifLang): { title: string; body: string } {
  if (lang === "fr") {
    return {
      title: "❤️ Quelqu'un a aimé votre annonce !",
      body:
        "Quelqu'un s'intéresse à votre article. C'est peut-être le bon moment pour ajuster le prix !",
    };
  }
  return {
    title: "❤️ Someone liked your listing!",
    body: "Someone is interested in your item. It might be a good time to adjust the price!",
  };
}

export function orderConfirmedPushText(lang: NotifLang): { title: string; body: string } {
  if (lang === "fr") {
    return {
      title: "✅ Transaction terminée, bravo !",
      body: "Votre achat est confirmé. Profitez-en !",
    };
  }
  return {
    title: "✅ Transaction complete, nice work!",
    body: "Your purchase is confirmed. Enjoy!",
  };
}

export function paymentReceivedPushText(lang: NotifLang): { title: string; body: string } {
  if (lang === "fr") {
    return {
      title: "💰 Paiement reçu !",
      body: "Le paiement a été transféré sur votre compte.",
    };
  }
  return {
    title: "💰 Payment received!",
    body: "The payment has been transferred to your account.",
  };
}

export function shipReminderPushText(lang: NotifLang): { title: string; body: string } {
  if (lang === "fr") {
    return {
      title: "📦 N'oubliez pas d'expédier votre colis 📬",
      body: "Vous avez une nouvelle vente ! Préparez votre colis.",
    };
  }
  return {
    title: "📦 Remember to ship your parcel 📬",
    body: "You have a new sale! Pack your parcel.",
  };
}

export function orderCancelledPushText(lang: NotifLang): { title: string; body: string } {
  if (lang === "fr") {
    return {
      title: "✅ Commande annulée",
      body: "Votre commande a été annulée et vous serez remboursé(e).",
    };
  }
  return {
    title: "✅ Order cancelled",
    body: "Your order has been cancelled and you will be refunded.",
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
