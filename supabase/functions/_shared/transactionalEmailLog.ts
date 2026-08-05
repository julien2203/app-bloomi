import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

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

export async function logTransactionalEmailSent(
  supabaseAdmin: SupabaseClient,
  params: {
    userId: string;
    templateKey: string;
    entityId: string;
    resendId?: string | null;
  },
): Promise<void> {
  const { error } = await supabaseAdmin.from("transactional_email_log").insert({
    user_id: params.userId,
    template_key: params.templateKey,
    entity_id: params.entityId,
    resend_id: params.resendId ?? null,
  });

  if (error && !String(error.message).toLowerCase().includes("duplicate")) {
    console.warn("transactional_email_log insert failed:", error.message);
  }
}
