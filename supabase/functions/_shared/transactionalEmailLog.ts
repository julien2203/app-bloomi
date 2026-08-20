import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

function isDuplicateKeyError(error: { code?: string; message?: string }): boolean {
  const code = error.code ?? "";
  const msg = String(error.message ?? "").toLowerCase();
  return code === "23505" || msg.includes("duplicate") || msg.includes("unique");
}

export async function wasTransactionalEmailSent(
  supabaseAdmin: SupabaseClient,
  params: { userId: string; templateKey: string; entityId: string },
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("transactional_email_log")
    .select("id")
    .eq("user_id", params.userId)
    .eq("template_key", params.templateKey)
    .eq("entity_id", params.entityId)
    .maybeSingle();

  if (error) {
    console.warn("transactional_email_log read failed:", error.message);
    return false;
  }
  return Boolean(data?.id);
}

/** Réserve l'envoi (insert atomique) avant l'appel Resend — évite les doublons en concurrence. */
export async function claimTransactionalEmailSend(
  supabaseAdmin: SupabaseClient,
  params: { userId: string; templateKey: string; entityId: string },
): Promise<{ claimed: boolean; logId?: string }> {
  const { data, error } = await supabaseAdmin
    .from("transactional_email_log")
    .insert({
      user_id: params.userId,
      template_key: params.templateKey,
      entity_id: params.entityId,
      resend_id: null,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (isDuplicateKeyError(error)) {
      return { claimed: false };
    }
    console.warn("transactional_email_log claim failed:", error.message);
    return { claimed: false };
  }

  const logId = typeof data?.id === "string" ? data.id : undefined;
  return logId ? { claimed: true, logId } : { claimed: false };
}

export async function releaseTransactionalEmailClaim(
  supabaseAdmin: SupabaseClient,
  logId: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("transactional_email_log")
    .delete()
    .eq("id", logId);

  if (error) {
    console.warn("transactional_email_log release failed:", error.message);
  }
}

export async function logTransactionalEmailSent(
  supabaseAdmin: SupabaseClient,
  params: {
    userId: string;
    templateKey: string;
    entityId: string;
    resendId?: string | null;
    logId?: string | null;
  },
): Promise<void> {
  if (params.logId) {
    const { error } = await supabaseAdmin
      .from("transactional_email_log")
      .update({ resend_id: params.resendId ?? null })
      .eq("id", params.logId);

    if (error) {
      console.warn("transactional_email_log update failed:", error.message);
    }
    return;
  }

  const { error } = await supabaseAdmin.from("transactional_email_log").insert({
    user_id: params.userId,
    template_key: params.templateKey,
    entity_id: params.entityId,
    resend_id: params.resendId ?? null,
  });

  if (error && !isDuplicateKeyError(error)) {
    console.warn("transactional_email_log insert failed:", error.message);
  }
}
