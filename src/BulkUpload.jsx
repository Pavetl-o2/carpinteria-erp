import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "./supabaseClient.js";

// ─── Template columns: what the user fills in the Excel ───
const TEMPLATE_COLS = [
  { key: "sku", label: "SKU", example: "MAD-001", required: true },
  { key: "name", label: "Nombre", example: "Triplay Pino 18mm", required: true },
  { key: "category", label: "Categoría", example: "Maderas", required: true },
  { key: "subcategory", label: "Subcategoría", example: "Triplay", required: false },
  { key: "model_code", label: "Código Modelo", example: "TP18-4x8", required: false },
  { key: "unit", label: "Unidad", example: "hoja", required: true },
  { key: "unit_cost", label: "Costo Unitario", example: "450", required: true },
  { key: "supplier", label: "Proveedor", example: "Maderas del Sureste", required: false },
  { key: "current_stock", label: "Stock Actual", example: "10", required: false },
  { key: "min_stock", label: "Stock Mínimo", example: "5", required: false },
  { key: "location", label: "Ubicación", example: "Rack A1", required: false },
  { key: "notes", label: "Notas", example: "", required: false },
];

const C = { bg:"#F7F5F2",card:"#FFF",sb:"#1C1917",ac:"#B45309",acL:"#FEF3C7",tx:"#1C1917",txM:"#78716C",txL:"#A8A29E",bd:"#E7E5E4",ok:"#15803D",okBg:"#DCFCE7",warn:"#A16207",warnBg:"#FEF9C3",err:"#DC2626",errBg:"#FEE2E2",info:"#1D4ED8",infoBg:"#DBEAFE" };

// ─── Download template ───
export function downloadTemplate() {
  const headers = TEMPLATE_COLS.map((c) => c.label);
  const example = TEMPLATE_COLS.map((c) => c.example);
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);

  // Column widths
  ws["!cols"] = TEMPLATE_COLS.map((c) => ({ wch: Math.max(c.label.length, c.example.length, 14) + 2 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Items");

  // Instructions sheet
  const instrData = [
    ["Instrucciones para llenar la plantilla"],
    [""],
    ["Campo", "Requerido", "Descripción", "Valores válidos"],
    ...TEMPLATE_COLS.map((c) => [
      c.label,
      c.required ? "SÍ" : "No",
      getDescription(c.key),
      getValidValues(c.key),
    ]),
    [""],
    ["NOTAS:"],
    ["- La primera fila de la hoja 'Items' son los encabezados, NO la modifiques."],
    ["- La segunda fila es un ejemplo, puedes borrarla o reemplazarla."],
    ["- SKU debe ser único para cada artículo."],
    ["- Si la Categoría no existe, se creará automáticamente."],
    ["- Si el Proveedor no existe, se creará automáticamente."],
    ["- Stock Actual y Stock Mínimo por defecto son 0."],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instrData);
  wsInstr["!cols"] = [{ wch: 20 }, { wch: 12 }, { wch: 40 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsInstr, "Instrucciones");

  XLSX.writeFile(wb, "plantilla_items.xlsx");
}

function getDescription(key) {
  const m = {
    sku: "Código único del artículo",
    name: "Nombre completo del artículo",
    category: "Categoría principal (ej: Maderas, Herrajes)",
    subcategory: "Subcategoría (ej: Triplay, Bisagras)",
    model_code: "Código o modelo del fabricante",
    unit: "Unidad de medida",
    unit_cost: "Costo por unidad en pesos (número)",
    supplier: "Nombre del proveedor",
    current_stock: "Cantidad actual en almacén (número)",
    min_stock: "Cantidad mínima para alerta (número)",
    location: "Ubicación en almacén (ej: Rack A1)",
    notes: "Notas adicionales",
  };
  return m[key] || "";
}

function getValidValues(key) {
  const m = {
    unit: "pza, hoja, litro, kg, m, caja, par, rollo, galón, pieza",
    unit_cost: "Número (ej: 450, 38.50)",
    current_stock: "Número entero (ej: 10)",
    min_stock: "Número entero (ej: 5)",
  };
  return m[key] || "Texto libre";
}

// ─── Parse uploaded file ───
function parseFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { defval: "" });

        // Map Spanish headers back to keys
        const headerMap = {};
        TEMPLATE_COLS.forEach((c) => {
          headerMap[c.label.toLowerCase()] = c.key;
        });

        const rows = raw.map((row, idx) => {
          const mapped = {};
          Object.entries(row).forEach(([header, val]) => {
            const key = headerMap[header.toLowerCase().trim()];
            if (key) mapped[key] = typeof val === "string" ? val.trim() : val;
          });
          return { ...mapped, _row: idx + 2 };
        });

        resolve(rows);
      } catch (err) {
        reject(new Error("No se pudo leer el archivo: " + err.message));
      }
    };
    reader.onerror = () => reject(new Error("Error al leer el archivo"));
    reader.readAsArrayBuffer(file);
  });
}

// ─── Validate rows ───
function validateRows(rows) {
  return rows.map((row) => {
    const errors = [];
    if (!row.sku) errors.push("SKU vacío");
    if (!row.name) errors.push("Nombre vacío");
    if (!row.category) errors.push("Categoría vacía");
    if (!row.unit) errors.push("Unidad vacía");
    if (row.unit_cost === "" || row.unit_cost === undefined) errors.push("Costo vacío");
    else if (isNaN(Number(row.unit_cost))) errors.push("Costo no es número");
    if (row.current_stock && isNaN(Number(row.current_stock))) errors.push("Stock no es número");
    if (row.min_stock && isNaN(Number(row.min_stock))) errors.push("Stock mín no es número");
    return { ...row, _errors: errors, _valid: errors.length === 0 };
  });
}

// ─── Upload Modal Component ───
export function BulkUploadModal({ open, onClose, onDone, categories, suppliers }) {
  const [step, setStep] = useState("upload"); // upload | preview | uploading | done
  const [rows, setRows] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  if (!open) return null;

  const reset = () => { setStep("upload"); setRows([]); setResult(null); setError(null); };
  const close = () => { reset(); onClose(); };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError(null);
    try {
      const parsed = await parseFile(file);
      if (parsed.length === 0) { setError("El archivo no tiene datos."); return; }
      const validated = validateRows(parsed);
      setRows(validated);
      setStep("preview");
    } catch (err) {
      setError(err.message);
    }
  };

  const validRows = rows.filter((r) => r._valid);
  const invalidRows = rows.filter((r) => !r._valid);

  const handleUpload = async () => {
    if (validRows.length === 0) return;
    setStep("uploading");
    setError(null);

    try {
      // 1. Resolve categories: find existing or create new
      const uniqueCats = [...new Set(validRows.map((r) => r.category))];
      const catMap = {};
      for (const catName of uniqueCats) {
        const existing = categories.find((c) => c.name.toLowerCase() === catName.toLowerCase());
        if (existing) {
          catMap[catName.toLowerCase()] = existing.id;
        } else {
          const { data, error: catErr } = await supabase
            .from("categories")
            .insert({ name: catName })
            .select("id")
            .single();
          if (catErr) throw new Error(`Error creando categoría "${catName}": ${catErr.message}`);
          catMap[catName.toLowerCase()] = data.id;
        }
      }

      // 2. Resolve suppliers: find existing or create new
      const uniqueSupps = [...new Set(validRows.filter((r) => r.supplier).map((r) => r.supplier))];
      const suppMap = {};
      for (const suppName of uniqueSupps) {
        const existing = suppliers.find((s) => s.company.toLowerCase() === suppName.toLowerCase());
        if (existing) {
          suppMap[suppName.toLowerCase()] = existing.id;
        } else {
          const { data, error: suppErr } = await supabase
            .from("suppliers")
            .insert({ name: suppName, is_active: true })
            .select("id")
            .single();
          if (suppErr) throw new Error(`Error creando proveedor "${suppName}": ${suppErr.message}`);
          suppMap[suppName.toLowerCase()] = data.id;
        }
      }

      // 3. Build items for insert
      const itemsToInsert = validRows.map((r) => ({
        sku: r.sku,
        name: r.name,
        category_id: catMap[r.category.toLowerCase()],
        subcategory: r.subcategory || null,
        model_code: r.model_code || null,
        unit: r.unit,
        unit_cost: Number(r.unit_cost) || 0,
        supplier_id: r.supplier ? suppMap[r.supplier.toLowerCase()] || null : null,
        current_stock: Number(r.current_stock) || 0,
        min_stock: Number(r.min_stock) || 0,
        location: r.location || null,
        notes: r.notes || null,
        is_active: true,
      }));

      // 4. Insert in batches of 50
      let inserted = 0;
      let errors = [];
      for (let i = 0; i < itemsToInsert.length; i += 50) {
        const batch = itemsToInsert.slice(i, i + 50);
        const { data, error: insErr } = await supabase.from("items").insert(batch).select("id");
        if (insErr) {
          errors.push(`Lote ${Math.floor(i / 50) + 1}: ${insErr.message}`);
        } else {
          inserted += data.length;
        }
      }

      setResult({ inserted, total: validRows.length, skipped: invalidRows.length, errors });
      setStep("done");
    } catch (err) {
      setError(err.message);
      setStep("preview");
    }
  };

  const Overlay = ({ children }) => (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={close}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.card, borderRadius: 16, padding: 28, width: 720, maxWidth: "95vw", maxHeight: "85vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>📤 Carga Masiva de Items</h3>
          <button onClick={close} style={{ background: "none", border: "none", cursor: "pointer", color: C.txM, fontSize: 20 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );

  // ─── Step: Upload ───
  if (step === "upload") {
    return (
      <Overlay>
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📁</div>
          <p style={{ fontSize: 14, color: C.txM, marginBottom: 24 }}>
            Descarga la plantilla, llénala con tus artículos, y súbela aquí.
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 24 }}>
            <button onClick={downloadTemplate} style={{ padding: "10px 20px", borderRadius: 8, border: `1px solid ${C.ac}`, background: C.acL, color: C.ac, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              ⬇ Descargar Plantilla .xlsx
            </button>
          </div>

          <div
            onClick={() => fileRef.current?.click()}
            style={{ border: `2px dashed ${C.bd}`, borderRadius: 12, padding: "40px 20px", cursor: "pointer", transition: "border-color .2s" }}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = C.ac; }}
            onDragLeave={(e) => { e.currentTarget.style.borderColor = C.bd; }}
            onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = C.bd; const f = e.dataTransfer.files[0]; if (f) handleFile({ target: { files: [f] } }); }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>📤</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Click o arrastra tu archivo aquí</div>
            <div style={{ fontSize: 12, color: C.txM }}>.xlsx, .xls o .csv</div>
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} style={{ display: "none" }} />

          {error && <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: C.errBg, color: C.err, fontSize: 13 }}>{error}</div>}

          <div style={{ marginTop: 24, padding: 16, borderRadius: 8, background: "#FAFAF9", textAlign: "left" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.txM, marginBottom: 8 }}>CAMPOS REQUERIDOS</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {TEMPLATE_COLS.filter((c) => c.required).map((c) => (
                <span key={c.key} style={{ padding: "3px 10px", borderRadius: 6, background: C.acL, color: C.ac, fontSize: 12, fontWeight: 600 }}>{c.label}</span>
              ))}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.txM, marginBottom: 8, marginTop: 12 }}>CAMPOS OPCIONALES</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {TEMPLATE_COLS.filter((c) => !c.required).map((c) => (
                <span key={c.key} style={{ padding: "3px 10px", borderRadius: 6, background: "#F5F5F4", color: C.txM, fontSize: 12 }}>{c.label}</span>
              ))}
            </div>
          </div>
        </div>
      </Overlay>
    );
  }

  // ─── Step: Preview ───
  if (step === "preview") {
    return (
      <Overlay>
        <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
          <div style={{ padding: "8px 16px", borderRadius: 8, background: C.okBg, color: C.ok, fontSize: 13, fontWeight: 600 }}>
            ✓ {validRows.length} válidos
          </div>
          {invalidRows.length > 0 && (
            <div style={{ padding: "8px 16px", borderRadius: 8, background: C.errBg, color: C.err, fontSize: 13, fontWeight: 600 }}>
              ✕ {invalidRows.length} con errores
            </div>
          )}
          <div style={{ padding: "8px 16px", borderRadius: 8, background: "#F5F5F4", color: C.txM, fontSize: 13 }}>
            {rows.length} filas totales
          </div>
        </div>

        {error && <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: C.errBg, color: C.err, fontSize: 13 }}>{error}</div>}

        <div style={{ overflowX: "auto", borderRadius: 10, border: `1px solid ${C.bd}`, maxHeight: 400 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#FAFAF9", position: "sticky", top: 0 }}>
                <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, color: C.txM, borderBottom: `1px solid ${C.bd}`, fontSize: 11 }}>#</th>
                {["SKU", "Nombre", "Categoría", "Unidad", "Costo", "Stock", "Proveedor", "Estado"].map((h) => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, color: C.txM, borderBottom: `1px solid ${C.bd}`, fontSize: 11, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.bd}`, background: r._valid ? "transparent" : "#FEF2F2" }}>
                  <td style={{ padding: "7px 10px", color: C.txL }}>{r._row}</td>
                  <td style={{ padding: "7px 10px", fontFamily: "monospace" }}>{r.sku || "—"}</td>
                  <td style={{ padding: "7px 10px", fontWeight: 600 }}>{r.name || "—"}</td>
                  <td style={{ padding: "7px 10px" }}>{r.category || "—"}</td>
                  <td style={{ padding: "7px 10px" }}>{r.unit || "—"}</td>
                  <td style={{ padding: "7px 10px", fontFamily: "monospace" }}>{r.unit_cost ?? "—"}</td>
                  <td style={{ padding: "7px 10px" }}>{r.current_stock || "0"}</td>
                  <td style={{ padding: "7px 10px" }}>{r.supplier || "—"}</td>
                  <td style={{ padding: "7px 10px" }}>
                    {r._valid ? (
                      <span style={{ color: C.ok, fontWeight: 600 }}>✓</span>
                    ) : (
                      <span style={{ color: C.err, fontSize: 11 }}>{r._errors.join(", ")}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={reset} style={{ padding: "9px 16px", borderRadius: 8, border: `1px solid ${C.bd}`, background: C.card, color: C.tx, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            ← Cambiar archivo
          </button>
          <button onClick={handleUpload} disabled={validRows.length === 0} style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: validRows.length > 0 ? C.ok : C.bd, color: "#FFF", fontWeight: 600, fontSize: 13, cursor: validRows.length > 0 ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
            Subir {validRows.length} items
          </button>
        </div>
      </Overlay>
    );
  }

  // ─── Step: Uploading ───
  if (step === "uploading") {
    return (
      <Overlay>
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <div style={{ width: 40, height: 40, border: `4px solid ${C.bd}`, borderTopColor: C.ac, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
          <div style={{ fontSize: 14, color: C.txM }}>Subiendo {validRows.length} items...</div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </Overlay>
    );
  }

  // ─── Step: Done ───
  if (step === "done" && result) {
    return (
      <Overlay>
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>
            {result.errors.length > 0 ? "⚠️" : "✅"}
          </div>
          <h3 style={{ margin: "0 0 16px", fontSize: 18 }}>
            {result.errors.length > 0 ? "Carga parcial" : "Carga completada"}
          </h3>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 20 }}>
            <div style={{ padding: "12px 20px", borderRadius: 8, background: C.okBg }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.ok }}>{result.inserted}</div>
              <div style={{ fontSize: 12, color: C.ok }}>insertados</div>
            </div>
            {result.skipped > 0 && (
              <div style={{ padding: "12px 20px", borderRadius: 8, background: C.warnBg }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: C.warn }}>{result.skipped}</div>
                <div style={{ fontSize: 12, color: C.warn }}>omitidos (errores)</div>
              </div>
            )}
          </div>
          {result.errors.length > 0 && (
            <div style={{ textAlign: "left", padding: 12, borderRadius: 8, background: C.errBg, marginBottom: 16 }}>
              {result.errors.map((e, i) => (
                <div key={i} style={{ fontSize: 12, color: C.err, marginBottom: 4 }}>{e}</div>
              ))}
            </div>
          )}
          <button onClick={() => { close(); if (onDone) onDone(); }} style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: C.ac, color: "#FFF", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
            Cerrar
          </button>
        </div>
      </Overlay>
    );
  }

  return null;
}
