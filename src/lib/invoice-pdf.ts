import jsPDF from "jspdf";
import { formatXOF, formatDateTime } from "./format";
import type { Company } from "./auth-context";

export type InvoiceItem = { product_name: string; quantity: number; unit_price: number; total: number };
export type InvoiceData = {
  reference: string;
  created_at: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  payment_method: string;
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Espèces",
  wave: "Wave",
  orange_money: "Orange Money",
  free_money: "Free Money",
  card: "Carte bancaire",
  credit: "Crédit",
};

export function generateInvoicePDF(company: Company, invoice: InvoiceData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 15;

  // Header
  doc.setFontSize(18).setFont("helvetica", "bold");
  doc.text(company.name, 15, y);
  y += 6;
  doc.setFontSize(9).setFont("helvetica", "normal");
  if (company.address) { doc.text(company.address, 15, y); y += 4; }
  if (company.phone) { doc.text("Tél: " + company.phone, 15, y); y += 4; }
  if (company.ninea) { doc.text("NINEA: " + company.ninea, 15, y); y += 4; }
  if (company.rccm) { doc.text("RCCM: " + company.rccm, 15, y); y += 4; }

  // Title
  doc.setFontSize(16).setFont("helvetica", "bold");
  doc.text("FACTURE", pageW - 15, 20, { align: "right" });
  doc.setFontSize(10).setFont("helvetica", "normal");
  doc.text("N° " + invoice.reference, pageW - 15, 26, { align: "right" });
  doc.text(formatDateTime(invoice.created_at), pageW - 15, 31, { align: "right" });

  y = Math.max(y, 40) + 6;

  // Customer
  if (invoice.customer_name) {
    doc.setFont("helvetica", "bold").text("Client:", 15, y);
    doc.setFont("helvetica", "normal").text(invoice.customer_name, 35, y);
    if (invoice.customer_phone) doc.text(invoice.customer_phone, 35, y + 4);
    y += 12;
  }

  // Table header
  doc.setFillColor(40, 80, 60).setTextColor(255, 255, 255).setFont("helvetica", "bold").setFontSize(10);
  doc.rect(15, y, pageW - 30, 8, "F");
  doc.text("Désignation", 17, y + 5.5);
  doc.text("Qté", 110, y + 5.5, { align: "right" });
  doc.text("P.U.", 145, y + 5.5, { align: "right" });
  doc.text("Total", pageW - 17, y + 5.5, { align: "right" });
  y += 10;

  doc.setTextColor(0, 0, 0).setFont("helvetica", "normal").setFontSize(9);
  invoice.items.forEach((it) => {
    doc.text(it.product_name.substring(0, 50), 17, y);
    doc.text(String(it.quantity), 110, y, { align: "right" });
    doc.text(formatXOF(it.unit_price), 145, y, { align: "right" });
    doc.text(formatXOF(it.total), pageW - 17, y, { align: "right" });
    y += 6;
  });

  y += 4;
  doc.setLineWidth(0.3).line(100, y, pageW - 15, y); y += 5;
  const labelX = 130, valX = pageW - 17;
  doc.setFont("helvetica", "normal");
  doc.text("Sous-total", labelX, y); doc.text(formatXOF(invoice.subtotal), valX, y, { align: "right" }); y += 5;
  if (invoice.discount > 0) { doc.text("Remise", labelX, y); doc.text("-" + formatXOF(invoice.discount), valX, y, { align: "right" }); y += 5; }
  if (invoice.tax_amount > 0) { doc.text("TVA", labelX, y); doc.text(formatXOF(invoice.tax_amount), valX, y, { align: "right" }); y += 5; }
  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text("TOTAL TTC", labelX, y); doc.text(formatXOF(invoice.total), valX, y, { align: "right" }); y += 7;
  doc.setFont("helvetica", "normal").setFontSize(9);
  doc.text("Mode de paiement: " + (PAYMENT_LABELS[invoice.payment_method] ?? invoice.payment_method), 15, y); y += 5;
  doc.text("Montant payé: " + formatXOF(invoice.amount_paid), 15, y);

  // Footer
  doc.setFontSize(8).setTextColor(120, 120, 120);
  doc.text("Merci pour votre confiance — " + company.name, pageW / 2, 285, { align: "center" });

  doc.save(`facture-${invoice.reference}.pdf`);
}
