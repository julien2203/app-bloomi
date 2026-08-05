export type ShippingLabelEmailLang = "en" | "fr" | "de" | "it";

export function normalizeShippingLabelEmailLang(
  lang: string | null | undefined,
): ShippingLabelEmailLang {
  const code = lang?.trim().toLowerCase().split("-")[0];
  if (code === "fr" || code === "de" || code === "it") return code;
  return "en";
}

export function shippingLabelEmailContent(params: {
  lang: ShippingLabelEmailLang;
  sellerName: string;
  listingTitle: string;
  trackingNumber: string | null;
  orderId: string;
  ctaHtml?: string;
}): { subject: string; html: string; attachmentFilename: string } {
  const name = params.sellerName.trim() || (params.lang === "fr" ? "Bonjour" : "Hello");
  const title = params.listingTitle.trim() ||
    (params.lang === "fr" ? "votre vente" : "your sale");
  const tracking = params.trackingNumber?.trim() || null;
  const shortOrderId = params.orderId.slice(0, 8);
  const cta = params.ctaHtml ?? "";

  if (params.lang === "fr") {
    const trackingBlock = tracking
      ? `<p><strong>N° de suivi :</strong> ${escapeHtml(tracking)}</p>`
      : "";
    return {
      subject: "Votre étiquette La Poste — Bloomi",
      html: `
<p>Bonjour ${escapeHtml(name)},</p>
<p>Votre étiquette d'expédition La Poste pour <strong>${escapeHtml(title)}</strong> est en pièce jointe.</p>
${trackingBlock}
<p>Imprimez l'étiquette, collez-la sur le colis et déposez-le à La Poste. Puis marquez la commande comme expédiée dans l'app Bloomi.</p>
${cta}
<p style="color:#666;font-size:13px;">Réf. commande : ${escapeHtml(shortOrderId)}</p>
<p>— L'équipe Bloomi</p>
`.trim(),
      attachmentFilename: `etiquette-bloomi-${shortOrderId}.pdf`,
    };
  }

  if (params.lang === "de") {
    const trackingBlock = tracking
      ? `<p><strong>Sendungsnummer:</strong> ${escapeHtml(tracking)}</p>`
      : "";
    return {
      subject: "Ihr Swiss Post Etikett — Bloomi",
      html: `
<p>Hallo ${escapeHtml(name)},</p>
<p>Ihr Swiss Post Versandetikett für <strong>${escapeHtml(title)}</strong> finden Sie im Anhang.</p>
${trackingBlock}
<p>Drucken Sie das Etikett, bringen Sie es am Paket an und geben Sie es bei der Post ab. Markieren Sie die Bestellung anschliessend in der Bloomi-App als versendet.</p>
${cta}
<p style="color:#666;font-size:13px;">Bestellreferenz: ${escapeHtml(shortOrderId)}</p>
<p>— Das Bloomi-Team</p>
`.trim(),
      attachmentFilename: `etiquette-bloomi-${shortOrderId}.pdf`,
    };
  }

  if (params.lang === "it") {
    const trackingBlock = tracking
      ? `<p><strong>N° di tracciamento:</strong> ${escapeHtml(tracking)}</p>`
      : "";
    return {
      subject: "La tua etichetta Swiss Post — Bloomi",
      html: `
<p>Ciao ${escapeHtml(name)},</p>
<p>L'etichetta di spedizione Swiss Post per <strong>${escapeHtml(title)}</strong> è in allegato.</p>
${trackingBlock}
<p>Stampa l'etichetta, applicala sul pacco e consegnalo alla Posta. Poi segna l'ordine come spedito nell'app Bloomi.</p>
${cta}
<p style="color:#666;font-size:13px;">Rif. ordine: ${escapeHtml(shortOrderId)}</p>
<p>— Il team Bloomi</p>
`.trim(),
      attachmentFilename: `etiquette-bloomi-${shortOrderId}.pdf`,
    };
  }

  const trackingBlock = tracking
    ? `<p><strong>Tracking number:</strong> ${escapeHtml(tracking)}</p>`
    : "";
  return {
    subject: "Your Swiss Post shipping label — Bloomi",
    html: `
<p>Hi ${escapeHtml(name)},</p>
<p>Your Swiss Post shipping label for <strong>${escapeHtml(title)}</strong> is attached.</p>
${trackingBlock}
<p>Print the label, attach it to the parcel, and drop it off at the post office. Then mark the order as shipped in the Bloomi app.</p>
${cta}
<p style="color:#666;font-size:13px;">Order ref: ${escapeHtml(shortOrderId)}</p>
<p>— The Bloomi team</p>
`.trim(),
    attachmentFilename: `etiquette-bloomi-${shortOrderId}.pdf`,
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
