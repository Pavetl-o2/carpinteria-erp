// ─── STATIC DATA (not yet in Supabase) ───

export const INVOICES = [
  { id: "inv1", supplier: "Maderas del Sureste", invoiceNum: "FAC-4521", date: "2026-02-23", numItems: 5, total: 8450, status: "awaiting_review", confidence: 0.94, uploadedBy: "Pavel" },
  { id: "inv2", supplier: "Herrajes y Más", invoiceNum: "HM-1190", date: "2026-02-22", numItems: 8, total: 3280, status: "saved", confidence: 0.97, uploadedBy: "Pavel" },
  { id: "inv3", supplier: "Acabados Profesionales", invoiceNum: "AP-0782", date: "2026-02-21", numItems: 3, total: 2150, status: "saved", confidence: 0.91, uploadedBy: "Carlos" },
  { id: "inv5", supplier: "Desconocido", invoiceNum: null, date: "2026-02-24", numItems: 0, total: null, status: "processing", confidence: null, uploadedBy: "Carlos" },
];

export const EXTRACTED_ITEMS = [
  { id: "ei1", rawDesc: "Triplay pino 18mm 4x8", match: "Triplay Pino 18mm (4×8ft)", conf: 0.95, qty: 3, unit: "hoja", price: 450, total: 1350, st: "matched" },
  { id: "ei2", rawDesc: "Bisagra oculta 35mm c/base", match: "Bisagra Oculta 35mm", conf: 0.88, qty: 20, unit: "pza", price: 38, total: 760, st: "matched" },
  { id: "ei3", rawDesc: "Torn p/madera 3 pulg", match: "Tornillo Madera 3 pulgadas", conf: 0.72, qty: 2, unit: "caja", price: 90, total: 180, st: "review" },
  { id: "ei4", rawDesc: "Pegamento blanco 1lt", match: "Pegamento Blanco 1L", conf: 0.91, qty: 3, unit: "litro", price: 180, total: 540, st: "matched" },
  { id: "ei5", rawDesc: "Jaladeras acero inox 128mm", match: null, conf: 0, qty: 12, unit: "pza", price: 85, total: 1020, st: "new" },
];
