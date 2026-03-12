import { supabase } from "./supabaseClient.js";

// ─── Requisition Actions ───

export async function approveRequisition(reqId) {
  const { error } = await supabase
    .from("requisitions")
    .update({ status: "approved" })
    .eq("id", reqId);
  if (error) throw new Error("Error al aprobar: " + error.message);

  await callEdgeFunction("notify-action", {
    action: "requisition_approved",
    requisition_id: reqId,
  });
}

export async function rejectRequisition(reqId, reason) {
  const { error } = await supabase
    .from("requisitions")
    .update({ status: "rejected" })
    .eq("id", reqId);
  if (error) throw new Error("Error al rechazar: " + error.message);

  await callEdgeFunction("notify-action", {
    action: "requisition_rejected",
    requisition_id: reqId,
    reason,
  });
}

export async function returnRequisition(reqId) {
  const { error } = await supabase
    .from("requisitions")
    .update({ status: "draft" })
    .eq("id", reqId);
  if (error) throw new Error("Error al devolver: " + error.message);

  await callEdgeFunction("notify-action", {
    action: "requisition_returned",
    requisition_id: reqId,
  });
}

// ─── Withdrawal Actions ───

export async function dispatchWithdrawal(withdrawalId) {
  const { error } = await supabase
    .from("material_withdrawals")
    .update({ status: "ready", dispatched_at: new Date().toISOString() })
    .eq("id", withdrawalId);
  if (error) throw new Error("Error al surtir: " + error.message);

  await callEdgeFunction("notify-action", {
    action: "withdrawal_dispatched",
    withdrawal_id: withdrawalId,
  });
}

export async function rejectWithdrawal(withdrawalId) {
  const { error } = await supabase
    .from("material_withdrawals")
    .update({ status: "rejected" })
    .eq("id", withdrawalId);
  if (error) throw new Error("Error al rechazar: " + error.message);

  await callEdgeFunction("notify-action", {
    action: "withdrawal_rejected",
    withdrawal_id: withdrawalId,
  });
}

export async function markDelivered(withdrawalId) {
  const { error } = await supabase
    .from("material_withdrawals")
    .update({ status: "dispatched", delivered_at: new Date().toISOString() })
    .eq("id", withdrawalId);
  if (error) throw new Error("Error al marcar entregado: " + error.message);

  await callEdgeFunction("notify-action", {
    action: "withdrawal_delivered",
    withdrawal_id: withdrawalId,
  });
}

export async function sendReminder(withdrawalId) {
  await callEdgeFunction("notify-action", {
    action: "withdrawal_reminder",
    withdrawal_id: withdrawalId,
  });
}

// ─── Edge Function caller ───

async function callEdgeFunction(fnName, body) {
  try {
    const { error } = await supabase.functions.invoke(fnName, { body });
    if (error) console.warn("Edge function error (non-blocking):", error.message);
  } catch (e) {
    // Non-blocking: if the edge function doesn't exist yet or fails,
    // the DB update already happened, so we just log
    console.warn("Edge function not available:", e.message);
  }
}
