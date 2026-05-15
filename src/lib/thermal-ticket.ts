import { formatXOF, formatDateTime } from "./format";
import type { Company } from "./auth-context";
import type { InvoiceData } from "./invoice-pdf";

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Espèces",
  wave: "Wave",
  orange_money: "Orange Money",
  free_money: "Free Money",
  card: "Carte",
  credit: "Crédit",
  mixed: "Mixte",
};

export type PaymentBreakdown = { method: string; amount: number };

/**
 * Ouvre une fenêtre d'impression avec un ticket de caisse formaté pour
 * imprimante thermique 80mm. L'utilisateur peut imprimer ou enregistrer en PDF.
 */
export function printThermalTicket(
  company: Company,
  invoice: InvoiceData & { payments?: PaymentBreakdown[]; change_due?: number },
) {
  const w = window.open("", "_blank", "width=380,height=700");
  if (!w) return;

  const itemsHtml = invoice.items
    .map(
      (it) => `
      <div class="line">
        <div class="name">${escapeHtml(it.product_name)}</div>
        <div class="row"><span>${it.quantity} × ${formatXOF(it.unit_price)}</span><span>${formatXOF(it.total)}</span></div>
      </div>`,
    )
    .join("");

  const paymentsHtml = (invoice.payments && invoice.payments.length > 0
    ? invoice.payments
    : [{ method: invoice.payment_method, amount: invoice.amount_paid }])
    .map(
      (p) =>
        `<div class="row"><span>${PAYMENT_LABELS[p.method] ?? p.method}</span><span>${formatXOF(p.amount)}</span></div>`,
    )
    .join("");

  w.document.write(`<!doctype html><html><head><meta charset="utf-8" />
<title>Ticket ${invoice.reference}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body { width: 76mm; margin: 0 auto; padding: 4mm 2mm; font-family: 'Courier New', monospace; font-size: 11px; color: #000; }
  .center { text-align: center; }
  .bold { font-weight: 700; }
  .lg { font-size: 13px; }
  .xl { font-size: 15px; }
  hr { border: none; border-top: 1px dashed #000; margin: 4px 0; }
  .row { display: flex; justify-content: space-between; gap: 6px; }
  .line { margin: 2px 0; }
  .line .name { font-weight: 600; }
  .total { font-size: 14px; font-weight: 700; }
  .small { font-size: 10px; color: #333; }
  @media print { body { width: 76mm; } button { display: none; } }
</style>
</head><body>
  <div class="center bold xl">${escapeHtml(company.name)}</div>
  ${company.address ? `<div class="center small">${escapeHtml(company.address)}</div>` : ""}
  ${company.phone ? `<div class="center small">Tél: ${escapeHtml(company.phone)}</div>` : ""}
  ${company.ninea ? `<div class="center small">NINEA: ${escapeHtml(company.ninea)}</div>` : ""}
  <hr/>
  <div class="row"><span>Ticket</span><span class="bold">${escapeHtml(invoice.reference)}</span></div>
  <div class="row small"><span>${formatDateTime(invoice.created_at)}</span></div>
  ${invoice.customer_name ? `<div class="small">Client: ${escapeHtml(invoice.customer_name)}</div>` : ""}
  <hr/>
  ${itemsHtml}
  <hr/>
  <div class="row"><span>Sous-total</span><span>${formatXOF(invoice.subtotal)}</span></div>
  ${invoice.discount > 0 ? `<div class="row"><span>Remise</span><span>-${formatXOF(invoice.discount)}</span></div>` : ""}
  ${invoice.tax_amount > 0 ? `<div class="row"><span>TVA</span><span>${formatXOF(invoice.tax_amount)}</span></div>` : ""}
  <div class="row total"><span>TOTAL</span><span>${formatXOF(invoice.total)}</span></div>
  <hr/>
  ${paymentsHtml}
  <div class="row bold"><span>Payé</span><span>${formatXOF(invoice.amount_paid)}</span></div>
  ${invoice.change_due && invoice.change_due > 0 ? `<div class="row bold"><span>Rendu</span><span>${formatXOF(invoice.change_due)}</span></div>` : ""}
  <hr/>
  <div class="center small">Merci pour votre achat !</div>
  <div class="center small">${escapeHtml(company.name)}</div>
  <div style="height: 20px"></div>
  <div class="center"><button onclick="window.print()">Imprimer</button></div>
  <script>setTimeout(() => window.print(), 250);</script>
</body></html>`);
  w.document.close();
}

function escapeHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
