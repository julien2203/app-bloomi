import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  captureAndTransferOrder,
  type ConfirmOrderRow,
} from "../_shared/confirmOrderPayment.ts";

function jsonResponse(payload: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

function isAuthorizedCronOrServiceRole(req: Request, serviceRoleKey: string): boolean {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader === `Bearer ${serviceRoleKey}`) return true;

  const cronSecret = Deno.env.get("CRON_SECRET");
  const cronHeader = req.headers.get("x-cron-secret");
  if (cronSecret && cronHeader === cronSecret) return true;

  return false;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

  if (!supabaseUrl || !supabaseServiceRoleKey || !stripeSecretKey) {
    return jsonResponse({ error: "Configuration manquante côté serveur" }, { status: 500 });
  }

  if (!isAuthorizedCronOrServiceRole(req, supabaseServiceRoleKey)) {
    return jsonResponse({ error: "Non autorisé" }, { status: 403 });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    const { error: markErr } = await supabaseAdmin.rpc("auto_confirm_shipped_orders");
    if (markErr) {
      return jsonResponse(
        {
          error: "auto_confirm_shipped_orders a échoué",
          details: markErr.message,
        },
        { status: 500 },
      );
    }

    const { data: orders, error: ordersErr } = await supabaseAdmin
      .from("orders")
      .select(
        "id, listing_id, buyer_id, seller_id, stripe_payment_intent_id, seller_amount, seller_commission_chf, seller_fee_rate, seller_profile_type, listing_price, stripe_seller_account_id, status, payment_status, confirmed_at, listing:listings(price)",
      )
      .eq("status", "completed")
      .eq("payment_status", "pending")
      .not("stripe_payment_intent_id", "is", null);

    if (ordersErr) {
      return jsonResponse(
        { error: "Impossible de charger les commandes à transférer", details: ordersErr.message },
        { status: 500 },
      );
    }

    const rows = (orders ?? []) as ConfirmOrderRow[];
    const results: Array<{
      order_id: string;
      success: boolean;
      error?: string;
      details?: string;
      stripe_transfer_id?: string;
    }> = [];

    for (const row of rows) {
      const outcome = await captureAndTransferOrder({
        supabaseAdmin,
        stripeSecretKey,
        order: row,
        supabaseUrl,
        supabaseServiceRoleKey,
        sendNotifications: true,
        systemMessage:
          "✅ Order automatically confirmed after 7 days — The transaction is complete. Thanks for using Bloomi!",
      });

      if (outcome.success) {
        results.push({
          order_id: row.id,
          success: true,
          stripe_transfer_id: outcome.stripe_transfer_id || undefined,
        });
      } else {
        results.push({
          order_id: row.id,
          success: false,
          error: outcome.error,
          details: outcome.details,
        });
      }
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return jsonResponse({
      success: failed === 0,
      marked_by_sql: true,
      processed: results.length,
      succeeded,
      failed,
      results,
    });
  } catch (e) {
    return jsonResponse(
      {
        error: "Erreur auto-confirm-orders",
        details: typeof e === "object" && e !== null ? JSON.stringify(e) : String(e),
      },
      { status: 500 },
    );
  }
});
