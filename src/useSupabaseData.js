import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient.js";

export function useSupabaseData() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [requisitions, setRequisitions] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [itemsRes, catsRes, suppRes, reqsRes, wdRes] = await Promise.all([
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
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (catsRes.error) throw catsRes.error;
      if (suppRes.error) throw suppRes.error;
      if (reqsRes.error) throw reqsRes.error;
      if (wdRes.error) throw wdRes.error;

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
          qty: Number(ri.quantity_requested) || 0,
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
          timeline: [],
        };
      });

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

  return { items, categories, suppliers, requisitions, withdrawals, loading, error, refetch: fetchAll };
}
