export type ResendAttachment = {
  filename: string;
  content: string;
};

export type SendResendEmailParams = {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  attachments?: ResendAttachment[];
};

export type SendResendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function sendResendEmail(
  params: SendResendEmailParams,
): Promise<SendResendEmailResult> {
  const to = params.to.trim();
  if (!to) {
    return { ok: false, error: "Destinataire e-mail manquant" };
  }

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: params.from,
      to: [to],
      subject: params.subject,
      html: params.html,
      attachments: params.attachments?.length ? params.attachments : undefined,
    }),
  });

  const raw = await resp.text();
  let json: { id?: string; message?: string; name?: string } = {};
  try {
    json = raw ? (JSON.parse(raw) as typeof json) : {};
  } catch {
    return { ok: false, error: raw.substring(0, 300) || "Réponse Resend invalide" };
  }

  if (!resp.ok || !json.id) {
    return {
      ok: false,
      error: json.message ?? json.name ?? raw.substring(0, 300) ?? "Envoi Resend échoué",
    };
  }

  return { ok: true, id: json.id };
}
