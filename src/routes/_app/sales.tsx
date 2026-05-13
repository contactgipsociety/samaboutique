import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatXOF, formatDateTime } from "@/lib/format";
import { generateInvoicePDF } from "@/lib/invoice-pdf";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_app/sales")({ component: SalesList });

const PAY_LABELS: Record<string, string> = {
  cash: "Espèces", wave: "Wave", orange_money: "OM", free_money: "Free", card: "Carte", credit: "Crédit",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default", pending: "secondary", partial: "outline", cancelled: "destructive",
};

function SalesList() {
  const { currentCompany } = useAuth();
  const companyId = currentCompany?.id;

  const { data: sales = [] } = useQuery({
    queryKey: ["sales-list", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*, customers(name, phone), sale_items(*)")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const downloadPDF = (sale: any) => {
    if (!currentCompany) return;
    generateInvoicePDF(currentCompany, {
      reference: sale.reference,
      created_at: sale.created_at,
      customer_name: sale.customers?.name,
      customer_phone: sale.customers?.phone,
      items: sale.sale_items.map((i: any) => ({
        product_name: i.product_name, quantity: Number(i.quantity),
        unit_price: Number(i.unit_price), total: Number(i.total),
      })),
      subtotal: Number(sale.subtotal),
      discount: Number(sale.discount),
      tax_amount: Number(sale.tax_amount),
      total: Number(sale.total),
      amount_paid: Number(sale.amount_paid),
      payment_method: sale.payment_method,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ventes</h1>
        <p className="text-sm text-muted-foreground">{sales.length} ventes (100 dernières)</p>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Référence</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Paiement</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucune vente</TableCell></TableRow>
            ) : sales.map((s: any) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-sm">{s.reference}</TableCell>
                <TableCell className="text-sm">{formatDateTime(s.created_at)}</TableCell>
                <TableCell>{s.customers?.name ?? "—"}</TableCell>
                <TableCell>{PAY_LABELS[s.payment_method]}</TableCell>
                <TableCell><Badge variant={STATUS_VARIANT[s.status]}>{s.status}</Badge></TableCell>
                <TableCell className="text-right font-semibold">{formatXOF(s.total)}</TableCell>
                <TableCell><Button variant="ghost" size="icon" onClick={() => downloadPDF(s)}><Download className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
