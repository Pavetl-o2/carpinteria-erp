// Supabase Edge Function: notify-action
// Sends Telegram notifications when actions are taken from the ERP dashboard.
//
// Required secrets (set via Supabase Dashboard → Edge Functions → Secrets):
//   TELEGRAM_BOT_TOKEN  — your bot token from @BotFather
//   SUPABASE_SERVICE_ROLE_KEY — for reading user data (telegram_id)
//
// Deploy: supabase functions deploy notify-action

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN not set");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { action } = body;

    let message = "";
    let targetTelegramId: number | null = null;

    // ─── Requisition actions ───
    if (action === "requisition_approved" || action === "requisition_rejected" || action === "requisition_returned") {
      const { data: reqData } = await supabase
        .from("requisitions")
        .select("requisition_number, requested_by, justification, requested_by_user:users!requisitions_requested_by_fkey(telegram_id, name)")
        .eq("id", body.requisition_id)
        .single();

      if (!reqData) throw new Error("Requisition not found");

      targetTelegramId = reqData.requested_by_user?.telegram_id;

      if (action === "requisition_approved") {
        message = `✅ Tu requisición *${reqData.requisition_number}* ha sido *aprobada* desde el ERP.`;
      } else if (action === "requisition_rejected") {
        message = `❌ Tu requisición *${reqData.requisition_number}* fue *rechazada*.\nMotivo: ${body.reason || "Sin especificar"}`;
      } else {
        message = `↩️ Tu requisición *${reqData.requisition_number}* fue *devuelta* para correcciones.`;
      }
    }

    // ─── Withdrawal actions ───
    if (action === "withdrawal_dispatched" || action === "withdrawal_rejected" || action === "withdrawal_delivered" || action === "withdrawal_reminder") {
      const { data: wData } = await supabase
        .from("material_withdrawals")
        .select("withdrawal_number, requested_by, project_name, requested_by_user:users!material_withdrawals_requested_by_fkey(telegram_id, name)")
        .eq("id", body.withdrawal_id)
        .single();

      if (!wData) throw new Error("Withdrawal not found");

      targetTelegramId = wData.requested_by_user?.telegram_id;

      if (action === "withdrawal_dispatched") {
        message = `📦 Tu vale *${wData.withdrawal_number}* ha sido *surtido*. Pasa a recoger tu material.`;
      } else if (action === "withdrawal_rejected") {
        message = `❌ Tu vale *${wData.withdrawal_number}* fue *rechazado*.`;
      } else if (action === "withdrawal_delivered") {
        message = `🤝 El material de *${wData.withdrawal_number}* fue *entregado*. ¿Confirmas recepción completa?`;
      } else if (action === "withdrawal_reminder") {
        message = `📩 *Recordatorio:* Tienes material pendiente de confirmar del vale *${wData.withdrawal_number}*. ¿Recibiste completo?`;
      }
    }

    // ─── Send Telegram message ───
    if (targetTelegramId && message) {
      const telegramUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
      const res = await fetch(telegramUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: targetTelegramId,
          text: message,
          parse_mode: "Markdown",
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error("Telegram API error:", err);
      }
    } else {
      console.warn("No telegram_id found or no message to send", { action, targetTelegramId });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
