import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient.js";

export function useSupabaseData() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [requisitions, setRequisitions] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [projectConsumption, setProjectConsumption] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // First day of current month for filtering
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const [itemsRes, catsRes, suppRes, reqsRes, wdRes, txRes, projConRes] = await Promise.all([
        supabase
          .from("items")
          .select("*, categories(name), suppliers(name)")
          .eq("is_active", true)
          .order("sku"),
        supabase
          .from("categories")
          .select("*")
          .order("display_order"),
        supabase
          .from("suppliers")
          .select("*")
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("requisitions")
          .select(
            `*, requested_by_user:users!requisitions_requested_by_fkey(name), approved_by_user:users!requisitions_approved_by_fkey(name), requisition_items(quantity_requested, quantity_approved, estimated_unit_cost, item_description, item:items(name, sku, unit, unit_cost))`
          )
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("material_withdrawals")
          .select(
            `*, requested_by_user:users!material_withdrawals_requested_by_fkey(name), dispatched_by_user:users!material_withdrawals_dispatched_by_fkey(name), project:projects(name), withdrawal_items(quantity_requested, quantity_dispatched, item:items(name, sku, unit, unit_cost, current_stock, location))`
          )
          .order("created_at", { ascending: false })
          .limit(50),
        // Recent inventory transactions for activity feed
        supabase
          .from("inventory_transactions")
          .select("*, item:items(name, sku), performed_by_user:users!inventory_transactions_performed_by_fkey(name)")
          .order("created_at", { ascending: false })
          .limit(20),
        // Withdrawals this month for project consumption
        supabase
          .from("material_withdrawals")
          .select(
            `id, project_name, project:projects(name), status, withdrawal_items(quantity_dispatched, item:items(unit_cost))`
          )
          .gte("requested_at", monthStart.toISOString())
          .in("status", ["ready", "dispatched", "received", "partial", "self_service"]),
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (catsRes.error) throw catsRes.error;
      if (suppRes.error) throw suppRes.error;
      if (reqsRes.error) throw reqsRes.error;
      if (wdRes.error) throw wdRes.error;
      // Non-critical queries: don't throw, just log
      if (txRes.error) console.warn("inventory_transactions:", txRes.error.message);
      if (projConRes.error) console.warn("project consumption:", projConRes.error.message);

      // Map items to UI-compatible format
      const mappedItems = (itemsRes.data || []).map((i) => ({
        id: i.id,
        sku: i.sku || "",
        name: i.name || "",
        category: i.categories?.name || "",
        subcategory: i.subcategory || "",
        unit: i.unit || "pza",
        unitCost: Number(i.unit_cost) || 0,
        supplier: i.suppliers?.name || "",
        minStock: Number(i.min_stock) || 0,
        currentStock: Number(i.current_stock) || 0,
        notes: i.notes || "",
        location: i.location || "",
        model_code: i.model_code || "",
      }));

      // Map categories
      const mappedCats = (catsRes.data || []).map((c) => ({
        id: c.id,
        name: c.name,
      }));

      // Map suppliers to UI-compatible format
      const mappedSuppliers = (suppRes.data || []).map((s) => ({
        id: s.id,
        company: s.name || "",
        contact: s.contact_name || "",
        email: s.email || "",
        phone: s.phone || "",
        payment: s.payment_terms || "",
        active: s.is_active,
        address: s.address || "",
        notes: s.notes || "",
      }));

      // Map requisitions
      const mappedReqs = (reqsRes.data || []).map((r) => {
        const rItems = (r.requisition_items || []).map((ri, idx) => ({
          id: ri.id || `ri-${idx}`,
          itemId: ri.item?.sku || null,
          name: ri.item?.name || ri.item_description || "",
          qtyRequested: Number(ri.quantity_requested) || 0,
          qtyApproved: ri.quantity_approved != null ? Number(ri.quantity_approved) : null,
          qty: ri.quantity_approved != null ? Number(ri.quantity_approved) : (Number(ri.quantity_requested) || 0),
          unit: ri.item?.unit || "pza",
          estCost: Number(ri.estimated_unit_cost) || (ri.item ? Number(ri.item.unit_cost) : null) || null,
          type: ri.item ? "catalog" : "free_text",
          notes: "",
        }));
        const estCost = rItems.reduce(
          (s, i) => s + (i.estCost || 0) * i.qty,
          0
        );
        return {
          id: r.id,
          number: r.requisition_number || "",
          title: r.justification || r.requisition_number || "",
          project: "",
          requester: r.requested_by_user?.name || "",
          priority: r.priority || "medium",
          status: r.status || "draft",
          neededBy: "",
          items: rItems,
          estimatedCost: estCost,
          createdAt: r.created_at
            ? new Date(r.created_at).toLocaleDateString("es-MX")
            : "",
        };
      });

      // Build timeline from withdrawal timestamps
      const buildTimeline = (w, wItems) => {
        const tl = [];
        const fmtT = (d) => {
          if (!d) return "";
          const dt = new Date(d);
          return dt.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
        };
        const fmtDT = (d) => {
          if (!d) return "";
          const dt = new Date(d);
          const now = new Date();
          const diff = now - dt;
          if (diff < 86400000) return fmtT(d);
          if (diff < 172800000) return "Ayer " + fmtT(d);
          return dt.toLocaleDateString("es-MX") + " " + fmtT(d);
        };
        const requester = w.requested_by_user?.name || "Usuario";
        const dispatcher = w.dispatched_by_user?.name || "Almacenista";
        const itemsList = (wItems || []).map((i) => `${i.qtyReq} ${i.unit} — ${i.name}`).join(", ");

        if (w.requested_at) {
          tl.push({ t: fmtDT(w.requested_at), who: requester, icon: "📤", text: `Solicitó: ${itemsList}${w.project_name || w.project?.name ? ` para ${w.project_name || w.project?.name}` : ""}`, type: "request" });
        }

        if (w.status === "rejected") {
          tl.push({ t: fmtDT(w.dispatched_at || w.requested_at), who: "Sistema", icon: "❌", text: "Vale rechazado.", type: "alert" });
        } else if (w.status === "self_service") {
          tl.push({ t: fmtDT(w.received_at || w.requested_at), who: requester, icon: "🔓", text: "Auto-servicio. Almacenista ausente.", type: "self" });
          tl.push({ t: fmtDT(w.received_at || w.requested_at), who: "Sistema", icon: "📊", text: "Stock descontado.", type: "system" });
        } else {
          if (w.dispatched_at) {
            const hasPartial = (wItems || []).some((i) => i.qtyDisp != null && i.qtyDisp < i.qtyReq);
            if (hasPartial) {
              tl.push({ t: fmtDT(w.dispatched_at), who: dispatcher, icon: "⚠️", text: `Surtido parcial: ${(wItems || []).map((i) => `${i.qtyDisp != null ? i.qtyDisp : "?"}/${i.qtyReq} ${i.unit} — ${i.name}`).join(", ")}`, type: "partial" });
            } else {
              tl.push({ t: fmtDT(w.dispatched_at), who: dispatcher, icon: "✅", text: "Surtido completo.", type: "dispatch" });
            }
          }

          if (w.delivered_at) {
            tl.push({ t: fmtDT(w.delivered_at), who: dispatcher, icon: "🤝", text: `Entregado a ${requester}.`, type: "handoff" });
          }

          if (w.received_at) {
            tl.push({ t: fmtDT(w.received_at), who: requester, icon: "✅", text: "Confirmó recepción.", type: "confirm" });
            tl.push({ t: fmtDT(w.received_at), who: "Sistema", icon: "📊", text: "Stock descontado.", type: "system" });
          } else if (w.delivered_at && !w.received_at) {
            tl.push({ t: "", who: "Sistema", icon: "⏳", text: `Esperando confirmación de ${requester}.`, type: "waiting" });
          }
        }

        return tl;
      };

      // Map withdrawals
      const mappedWd = (wdRes.data || []).map((w) => {
        const wItems = (w.withdrawal_items || []).map((wi, idx) => ({
          id: wi.id || `wi-${idx}`,
          name: wi.item?.name || "",
          qtyReq: Number(wi.quantity_requested) || 0,
          qtyDisp: wi.quantity_dispatched != null ? Number(wi.quantity_dispatched) : null,
          unit: wi.item?.unit || "pza",
          cost: Number(wi.item?.unit_cost) || 0,
          loc: wi.item?.location || "",
          stock: Number(wi.item?.current_stock) || 0,
        }));

        const fmtDate = (d) => {
          if (!d) return "";
          const dt = new Date(d);
          const now = new Date();
          const diff = now - dt;
          if (diff < 86400000) {
            return dt.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
          }
          if (diff < 172800000) {
            return "Ayer " + dt.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
          }
          return dt.toLocaleDateString("es-MX");
        };

        return {
          id: w.id,
          number: w.withdrawal_number || "",
          status: w.status || "requested",
          requestedBy: w.requested_by_user?.name || "",
          dispatchedBy: w.dispatched_by_user?.name || null,
          project: w.project_name || w.project?.name || "",
          items: wItems,
          requestedAt: fmtDate(w.requested_at),
          dispatchedAt: fmtDate(w.dispatched_at),
          receivedAt: fmtDate(w.received_at),
          notes: w.notes || "",
          channel: w.channel || "telegram",
          timeline: buildTimeline(w, wItems),
        };
      });

      // Build recent activity from multiple sources
      const activity = [];
      const fmtAgo = (d) => {
        if (!d) return "";
        const diff = Date.now() - new Date(d).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return "Ahora";
        if (mins < 60) return `${mins} min`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h`;
        const days = Math.floor(hrs / 24);
        return `${days}d`;
      };

      // Activity from withdrawals
      (wdRes.data || []).slice(0, 15).forEach((w) => {
        const who = w.requested_by_user?.name || "Usuario";
        const proj = w.project_name || w.project?.name || "";
        const itemCount = (w.withdrawal_items || []).length;
        if (w.requested_at) {
          activity.push({ id: `w-req-${w.id}`, text: `${who} solicitó ${itemCount} material${itemCount !== 1 ? "es" : ""} para ${proj || "proyecto"}`, type: "req", time: fmtAgo(w.requested_at), at: new Date(w.requested_at) });
        }
        if (w.dispatched_at) {
          const dispatcher = w.dispatched_by_user?.name || "Almacenista";
          activity.push({ id: `w-dis-${w.id}`, text: `${dispatcher} surtió vale ${w.withdrawal_number || ""}`, type: "ok", time: fmtAgo(w.dispatched_at), at: new Date(w.dispatched_at) });
        }
        if (w.received_at) {
          activity.push({ id: `w-rec-${w.id}`, text: `${who} confirmó recepción de ${w.withdrawal_number || ""}`, type: "ok", time: fmtAgo(w.received_at), at: new Date(w.received_at) });
        }
      });

      // Activity from requisitions
      (reqsRes.data || []).slice(0, 10).forEach((r) => {
        const who = r.requested_by_user?.name || "Usuario";
        if (r.created_at) {
          if (r.status === "pending_approval") {
            activity.push({ id: `r-new-${r.id}`, text: `${who} creó requisición ${r.requisition_number || ""}`, type: "req", time: fmtAgo(r.created_at), at: new Date(r.created_at) });
          } else if (r.status === "approved") {
            activity.push({ id: `r-apr-${r.id}`, text: `Requisición ${r.requisition_number || ""} aprobada`, type: "ok", time: fmtAgo(r.updated_at || r.created_at), at: new Date(r.updated_at || r.created_at) });
          } else if (r.status === "rejected") {
            activity.push({ id: `r-rej-${r.id}`, text: `Requisición ${r.requisition_number || ""} rechazada`, type: "alert", time: fmtAgo(r.updated_at || r.created_at), at: new Date(r.updated_at || r.created_at) });
          }
        }
      });

      // Activity from inventory transactions
      (txRes.data || []).forEach((tx) => {
        const who = tx.performed_by_user?.name || "Sistema";
        const itemName = tx.item?.name || tx.item?.sku || "item";
        const qty = Math.abs(Number(tx.quantity) || 0);
        if (tx.type === "withdrawal" || tx.type === "out") {
          activity.push({ id: `tx-${tx.id}`, text: `Salida: ${qty} ${itemName}`, type: "del", time: fmtAgo(tx.created_at), at: new Date(tx.created_at) });
        } else if (tx.type === "receipt" || tx.type === "in") {
          activity.push({ id: `tx-${tx.id}`, text: `Entrada: ${qty} ${itemName}`, type: "inv", time: fmtAgo(tx.created_at), at: new Date(tx.created_at) });
        } else if (tx.type === "adjustment") {
          activity.push({ id: `tx-${tx.id}`, text: `Ajuste inventario: ${itemName} (${tx.previous_stock}→${tx.new_stock})`, type: "alert", time: fmtAgo(tx.created_at), at: new Date(tx.created_at) });
        }
      });

      // Low stock alerts
      mappedItems.filter((i) => i.currentStock > 0 && i.currentStock <= i.minStock).slice(0, 3).forEach((i) => {
        activity.push({ id: `low-${i.id}`, text: `Stock bajo: ${i.name} (${i.currentStock} ${i.unit})`, type: "alert", time: "", at: new Date() });
      });

      activity.sort((a, b) => b.at - a.at);
      setRecentActivity(activity.slice(0, 10));

      // Build project consumption for current month
      const projMap = {};
      (projConRes.data || []).forEach((w) => {
        const projName = w.project_name || w.project?.name || "Sin proyecto";
        if (!projMap[projName]) projMap[projName] = { project: projName, cost: 0, vales: 0 };
        projMap[projName].vales += 1;
        (w.withdrawal_items || []).forEach((wi) => {
          const qty = Number(wi.quantity_dispatched) || 0;
          const cost = Number(wi.item?.unit_cost) || 0;
          projMap[projName].cost += qty * cost;
        });
      });
      const projArr = Object.values(projMap).sort((a, b) => b.cost - a.cost);
      setProjectConsumption(projArr);

      setItems(mappedItems);
      setCategories(mappedCats);
      setSuppliers(mappedSuppliers);
      setRequisitions(mappedReqs);
      setWithdrawals(mappedWd);
    } catch (err) {
      console.error("Supabase fetch error:", err);
      setError(err.message || "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { items, categories, suppliers, requisitions, withdrawals, recentActivity, projectConsumption, loading, error, refetch: fetchAll };
}
