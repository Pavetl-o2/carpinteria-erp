import { jsPDF } from "jspdf";

const BLUE = [44, 62, 120];
const BLACK = [0, 0, 0];
const GRAY = [100, 100, 100];
const WHITE = [255, 255, 255];
const LIGHT_BLUE = [220, 228, 240];

const COMPANY = {
  name: "Carpintería ERP",
  address: "Av. Principal #123",
  city: "Cancún, QR 77500",
  phone: "(998) 123-4567",
  email: "contacto@carpinteria-erp.com",
};

const SHIP_TO = {
  name: "Carpintería ERP — Almacén",
  company: "Carpintería ERP",
  address: "Av. Principal #123",
  city: "Cancún, QR 77500",
  phone: "(998) 123-4567",
};

export function generatePurchaseOrderPDF(po) {
  const doc = new jsPDF("p", "mm", "letter");
  const W = 216;
  const margin = 16;
  const innerW = W - margin * 2;
  let y = 16;

  // ─── HEADER ───
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...BLACK);
  doc.text(COMPANY.name, margin, y + 2);

  doc.setFontSize(22);
  doc.setTextColor(...BLUE);
  doc.text("ORDEN DE COMPRA", W - margin, y + 2, { align: "right" });

  y += 8;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  doc.text(COMPANY.address, margin, y);
  doc.text(COMPANY.city, margin, y + 4);
  doc.text(`Tel: ${COMPANY.phone}`, margin, y + 8);
  doc.text(`Email: ${COMPANY.email}`, margin, y + 12);

  // DATE & PO# boxes
  const boxX = W - margin - 72;
  doc.setFillColor(...LIGHT_BLUE);
  doc.rect(boxX, y - 2, 32, 7, "F");
  doc.rect(boxX, y + 6, 32, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BLUE);
  doc.text("FECHA", boxX + 2, y + 3);
  doc.text("OC #", boxX + 2, y + 11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BLACK);
  doc.text(po.date || "", boxX + 34, y + 3);
  doc.text(po.number || "", boxX + 34, y + 11);
  doc.rect(boxX + 32, y - 2, 40, 7);
  doc.rect(boxX + 32, y + 6, 40, 7);

  y += 22;

  // ─── PROVEEDOR & ENVIAR A ───
  const gap = 6;
  const halfW = (innerW - gap) / 2;
  const leftX = margin;
  const rightX = margin + halfW + gap;

  // Proveedor header
  doc.setFillColor(...BLUE);
  doc.rect(leftX, y, halfW, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...WHITE);
  doc.text("PROVEEDOR", leftX + 3, y + 5);

  // Enviar A header
  doc.rect(rightX, y, halfW, 7, "F");
  doc.text("ENVIAR A", rightX + 3, y + 5);

  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...BLACK);

  // Vendor info
  const vendorLines = [
    po.supplier || "",
    po.supplierContact || "",
    po.supplierAddress || "",
    po.supplierPhone ? `Tel: ${po.supplierPhone}` : "",
    po.supplierEmail ? `Email: ${po.supplierEmail}` : "",
  ].filter(Boolean);

  // Ship To info
  const shipLines = [
    SHIP_TO.name,
    SHIP_TO.company,
    SHIP_TO.address,
    SHIP_TO.city,
    `Tel: ${SHIP_TO.phone}`,
  ];

  const maxLines = Math.max(vendorLines.length, shipLines.length);
  const boxH = Math.max(maxLines * 5 + 4, 25);

  vendorLines.forEach((line, i) => {
    doc.text(line, leftX + 3, y + 3 + i * 5);
  });
  doc.rect(leftX, y, halfW, boxH);

  shipLines.forEach((line, i) => {
    doc.text(line, rightX + 3, y + 3 + i * 5);
  });
  doc.rect(rightX, y, halfW, boxH);

  y += boxH + 6;

  // ─── SOLICITANTE / ENVÍO VÍA / F.O.B. / TÉRMINOS DE ENVÍO ───
  const qW = innerW / 4;
  const labels4 = ["SOLICITANTE", "ENVÍO VÍA", "F.O.B.", "TÉRMINOS ENVÍO"];
  const vals4 = [po.createdBy || "—", "—", "—", "—"];

  doc.setFillColor(...BLUE);
  labels4.forEach((l, i) => {
    doc.rect(margin + i * qW, y, qW, 7, "F");
  });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...WHITE);
  labels4.forEach((l, i) => {
    doc.text(l, margin + i * qW + 2, y + 5);
  });

  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...BLACK);
  vals4.forEach((v, i) => {
    doc.rect(margin + i * qW, y, qW, 7);
    doc.text(v, margin + i * qW + 2, y + 5);
  });

  y += 14;

  // ─── TABLA DE ARTÍCULOS ───
  const colWidths = [30, innerW - 30 - 22 - 28 - 30, 22, 28, 30];
  const colHeaders = ["ARTÍCULO", "DESCRIPCIÓN", "CANT.", "P. UNITARIO", "TOTAL"];
  const colAligns = ["left", "left", "center", "right", "right"];

  // Header
  doc.setFillColor(...BLUE);
  doc.rect(margin, y, innerW, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...WHITE);
  let cx = margin;
  colHeaders.forEach((h, i) => {
    const align = colAligns[i];
    const tx = align === "right" ? cx + colWidths[i] - 2 : align === "center" ? cx + colWidths[i] / 2 : cx + 2;
    doc.text(h, tx, y + 5, { align: align === "left" ? undefined : align });
    cx += colWidths[i];
  });

  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...BLACK);

  const items = po.items || [];
  const maxRows = Math.max(items.length, 8);
  const rowH = 6;

  for (let r = 0; r < maxRows; r++) {
    const item = items[r];
    if (r % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, y, innerW, rowH, "F");
    }

    if (item) {
      let cx2 = margin;
      const vals = [
        item.sku || "",
        item.name || "",
        String(item.qtyOrdered || 0),
        fmtNum(item.unitCost || 0),
        fmtNum((item.qtyOrdered || 0) * (item.unitCost || 0)),
      ];
      vals.forEach((v, i) => {
        const align = colAligns[i];
        const tx = align === "right" ? cx2 + colWidths[i] - 2 : align === "center" ? cx2 + colWidths[i] / 2 : cx2 + 2;
        doc.text(v, tx, y + 4, { align: align === "left" ? undefined : align });
        cx2 += colWidths[i];
      });
    }

    // Row borders
    doc.setDrawColor(200, 200, 200);
    doc.rect(margin, y, innerW, rowH);
    y += rowH;
  }

  // Column borders
  doc.setDrawColor(...BLUE);
  const tableTop = y - maxRows * rowH;
  let bx = margin;
  colWidths.forEach((w) => {
    doc.line(bx, tableTop, bx, y);
    bx += w;
  });
  doc.line(bx, tableTop, bx, y);

  y += 4;

  // ─── TOTALES ───
  const subtotal = items.reduce((s, i) => s + (i.qtyOrdered || 0) * (i.unitCost || 0), 0);
  const totalsX = margin + innerW - 60;
  const totalsValX = margin + innerW - 2;

  const totalsRows = [
    { label: "SUBTOTAL", value: fmtNum(subtotal), bold: false },
    { label: "IMPUESTO", value: "", bold: false },
    { label: "ENVÍO", value: "", bold: false },
    { label: "OTRO", value: "", bold: false },
  ];

  // Comments box
  const commentsX = margin;
  const commentsW = totalsX - margin - 10;
  doc.setFillColor(245, 248, 220);
  doc.rect(commentsX, y, commentsW, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...BLUE);
  doc.text("Comentarios o instrucciones especiales", commentsX + 2, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...BLACK);
  doc.rect(commentsX, y + 7, commentsW, 20);
  if (po.notes) {
    const lines = doc.splitTextToSize(po.notes, commentsW - 4);
    doc.text(lines, commentsX + 2, y + 12);
  }

  // Totals
  doc.setFontSize(9);
  totalsRows.forEach((row) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BLUE);
    doc.text(row.label, totalsX, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BLACK);
    doc.text(row.value, totalsValX, y + 5, { align: "right" });
    doc.rect(totalsValX - 28, y + 1, 30, 6);
    y += 7;
  });

  // TOTAL row
  doc.setFillColor(...BLUE);
  doc.rect(totalsX - 2, y, totalsValX - totalsX + 4, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...WHITE);
  doc.text("TOTAL", totalsX, y + 6);
  doc.text("$", totalsValX - 30, y + 6);
  doc.text(fmtNum(subtotal), totalsValX, y + 6, { align: "right" });

  y += 20;

  // ─── PIE DE PÁGINA ───
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...BLUE);
  doc.text(
    "Si tiene alguna pregunta sobre esta orden de compra, por favor contacte a",
    W / 2,
    y,
    { align: "center" }
  );
  doc.setFont("helvetica", "bold");
  doc.text(
    `${COMPANY.name} — ${COMPANY.phone} — ${COMPANY.email}`,
    W / 2,
    y + 5,
    { align: "center" }
  );

  // Save
  const filename = `OC_${po.number || "sin-numero"}.pdf`;
  doc.save(filename);
}

function fmtNum(n) {
  return n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
