import { supabase } from "./supabaseClient.js";

class StaleStatusError extends Error {
  constructor(entity = "registro") {
    super(`Este ${entity} ya fue procesado desde otro canal. Refrescando datos...`);
    this.name = "StaleStatusError";
  }
}

// ─── Requisition Actions ───

export async function approveRequisition(reqId, itemsWithQtys) {
  // Save approved quantities per item
  if (itemsWithQtys && itemsWithQtys.length > 0) {
    for (const item of itemsWithQtys) {
      const { error } = await supabase
        .from("requisition_items")
        .update({ quantity_approved: item.quantityApproved })
        .eq("id", item.id);
      if (error) throw new Error("Error al guardar cantidad aprobada: " + error.message);
    }
  }

  const { data, error } = await supabase
    .from("requisitions")
    .update({ status: "approved" })
    .eq("id", reqId)
    .in("status", ["pending_approval", "draft"])
    .select();
  if (error) throw new Error("Error al aprobar: " + error.message);
  if (!data || data.length === 0) throw new StaleStatusError("requisición");

  await callEdgeFunction("notify-action", {
    action: "requisition_approved",
    requisition_id: reqId,
  });
}

export async function rejectRequisition(reqId, reason) {
  const { data, error } = await supabase
    .from("requisitions")
    .update({ status: "rejected" })
    .eq("id", reqId)
    .in("status", ["pending_approval", "draft"])
    .select();
  if (error) throw new Error("Error al rechazar: " + error.message);
  if (!data || data.length === 0) throw new StaleStatusError("requisición");

  await callEdgeFunction("notify-action", {
    action: "requisition_rejected",
    requisition_id: reqId,
    reason,
  });
}

export async function returnRequisition(reqId) {
  const { data, error } = await supabase
    .from("requisitions")
    .update({ status: "draft" })
    .eq("id", reqId)
    .in("status", ["pending_approval"])
    .select();
  if (error) throw new Error("Error al devolver: " + error.message);
  if (!data || data.length === 0) throw new StaleStatusError("requisición");

  await callEdgeFunction("notify-action", {
    action: "requisition_returned",
    requisition_id: reqId,
  });
}

// ─── Withdrawal Actions ───

export async function dispatchWithdrawal(withdrawalId) {
  const { data, error } = await supabase
    .from("material_withdrawals")
    .update({ status: "ready", dispatched_at: new Date().toISOString() })
    .eq("id", withdrawalId)
    .eq("status", "requested")
    .select();
  if (error) throw new Error("Error al surtir: " + error.message);
  if (!data || data.length === 0) throw new StaleStatusError("vale");

  await callEdgeFunction("notify-action", {
    action: "withdrawal_dispatched",
    withdrawal_id: withdrawalId,
  });
}

export async function rejectWithdrawal(withdrawalId) {
  const { data, error } = await supabase
    .from("material_withdrawals")
    .update({ status: "rejected" })
    .eq("id", withdrawalId)
    .eq("status", "requested")
    .select();
  if (error) throw new Error("Error al rechazar: " + error.message);
  if (!data || data.length === 0) throw new StaleStatusError("vale");

  await callEdgeFunction("notify-action", {
    action: "withdrawal_rejected",
    withdrawal_id: withdrawalId,
  });
}

export async function markDelivered(withdrawalId) {
  const { data, error } = await supabase
    .from("material_withdrawals")
    .update({ status: "dispatched", delivered_at: new Date().toISOString() })
    .eq("id", withdrawalId)
    .eq("status", "ready")
    .select();
  if (error) throw new Error("Error al marcar entregado: " + error.message);
  if (!data || data.length === 0) throw new StaleStatusError("vale");

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

// ─── Purchase Order Actions ───

async function getManagerId() {
  const { data } = await supabase.from("users").select("id").eq("role", "manager").limit(1).single();
  return data?.id || null;
}

export async function savePOItems(poId, updates, inserts, deletes) {
  for (const del of deletes) {
    const { error } = await supabase.from("purchase_order_items").delete().eq("id", del);
    if (error) throw new Error("Error al eliminar item: " + error.message);
  }
  for (const upd of updates) {
    const { error } = await supabase.from("purchase_order_items")
      .update({ quantity_ordered: upd.qtyOrdered, unit_cost: upd.unitCost })
      .eq("id", upd.id);
    if (error) throw new Error("Error al actualizar item: " + error.message);
  }
  for (const ins of inserts) {
    const { error } = await supabase.from("purchase_order_items")
      .insert({ purchase_order_id: poId, item_id: ins.itemId, quantity_ordered: ins.qtyOrdered, unit_cost: ins.unitCost });
    if (error) throw new Error("Error al agregar item: " + error.message);
  }
  const total = [...updates, ...inserts].reduce((s, i) => s + (i.qtyOrdered * i.unitCost), 0);
  const { error } = await supabase.from("purchase_orders").update({ total_amount: total }).eq("id", poId);
  if (error) throw new Error("Error al actualizar total: " + error.message);
}

export async function approvePO(poId) {
  const userId = await getManagerId();
  const { data, error } = await supabase.from("purchase_orders")
    .update({ status: "approved", approved_by: userId, approved_at: new Date().toISOString() })
    .eq("id", poId).eq("status", "draft").select();
  if (error) throw new Error("Error al aprobar OC: " + error.message);
  if (!data || data.length === 0) throw new StaleStatusError("orden de compra");
}

export async function cancelPO(poId) {
  const { data, error } = await supabase.from("purchase_orders")
    .update({ status: "cancelled" })
    .eq("id", poId).eq("status", "draft").select();
  if (error) throw new Error("Error al cancelar OC: " + error.message);
  if (!data || data.length === 0) throw new StaleStatusError("orden de compra");
}

export async function markPOSent(poId) {
  const { data, error } = await supabase.from("purchase_orders")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", poId).eq("status", "approved").select();
  if (error) throw new Error("Error al marcar enviada: " + error.message);
  if (!data || data.length === 0) throw new StaleStatusError("orden de compra");
}

export async function uploadDocument(entityId, file, docType, entityType = "purchase_order") {
  const ext = file.name.split(".").pop();
  const path = `po/${entityId}/${docType}_${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from("documents").upload(path, file);
  if (uploadError) throw new Error("Error al subir archivo: " + uploadError.message);
  const userId = await getManagerId();
  const { error } = await supabase.from("document_attachments").insert({
    entity_type: entityType, entity_id: entityId, doc_type: docType,
    file_url: path, file_name: file.name, file_size: file.size, mime_type: file.type, uploaded_by: userId,
  });
  if (error) throw new Error("Error al registrar documento: " + error.message);
  return path;
}

export async function uploadQuotation(poId, file) {
  await uploadDocument(poId, file, "quotation");
  const { error } = await supabase.from("purchase_orders")
    .update({ status: "quoted", quoted_at: new Date().toISOString() })
    .eq("id", poId).eq("status", "sent");
  if (error) throw new Error("Error al actualizar estado: " + error.message);
}

export async function authorizePOPayment(poId, quotedAmount) {
  const { error } = await supabase.from("purchase_orders")
    .update({ status: "pending_payment" })
    .eq("id", poId).eq("status", "quoted");
  if (error) throw new Error("Error al autorizar pago: " + error.message);
  const { error: apErr } = await supabase.from("accounts_payable")
    .update({ status: "authorized", authorized_at: new Date().toISOString(), quoted_amount: quotedAmount })
    .eq("purchase_order_id", poId);
  if (apErr) console.warn("accounts_payable update:", apErr.message);
}

export async function registerPOPayment(poId, { paymentMethod, paymentReference, paidAmount, receiptFile }) {
  if (receiptFile) await uploadDocument(poId, receiptFile, "payment_receipt");
  const now = new Date().toISOString();
  const { error } = await supabase.from("purchase_orders")
    .update({ status: "paid", paid_at: now, payment_method: paymentMethod, payment_reference: paymentReference })
    .eq("id", poId).eq("status", "pending_payment");
  if (error) throw new Error("Error al registrar pago: " + error.message);
  const { error: apErr } = await supabase.from("accounts_payable")
    .update({ status: "paid", paid_amount: paidAmount, payment_method: paymentMethod, payment_reference: paymentReference, payment_date: now })
    .eq("purchase_order_id", poId);
  if (apErr) console.warn("accounts_payable update:", apErr.message);
}

export async function markPOPendingDelivery(poId, deliveryMethod) {
  const { error } = await supabase.from("purchase_orders")
    .update({ status: "pending_delivery", delivery_method: deliveryMethod })
    .eq("id", poId).eq("status", "paid");
  if (error) throw new Error("Error al actualizar: " + error.message);
}

export async function receivePOMaterial(poId) {
  const userId = await getManagerId();
  const { data, error } = await supabase.rpc("receive_po_material", { p_purchase_order_id: poId, p_received_by: userId });
  if (error) throw new Error("Error al recibir material: " + error.message);
  if (data && !data.success) throw new Error(data.message || "Error al recibir material");

  if (data?.success) {
    await callEdgeFunction("notify-action", {
      action: "material_received",
      purchase_order_id: poId,
      receipt_data: data,
    });
  }
}

export async function fetchPODocuments(poId) {
  const { data, error } = await supabase.from("document_attachments")
    .select("*").eq("entity_type", "purchase_order").eq("entity_id", poId).order("created_at");
  if (error) throw new Error("Error al cargar documentos: " + error.message);
  return data || [];
}

export async function downloadDocument(fileUrl) {
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(fileUrl, 3600);
  if (error) throw new Error("Error al generar enlace: " + error.message);
  window.open(data.signedUrl);
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
