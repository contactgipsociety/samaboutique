import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatXOF } from "@/lib/format";

export const Route = createFileRoute("/_app/accounting/balance")({ component: BalancePage });

function BalancePage() {
  const { currentCompany } = useAuth();
  const { data = [] } = useQuery({
    queryKey: ["balance", currentCompany?.id],
    enabled: !!currentCompany,
    queryFn: async () => {
      const { data: accounts } = await supabase.from("accounts").select("*")
        .eq("company_id", currentCompany!.id).order("code");
      const { data: lines } = await supabase
        .from("journal_entry_lines")
        .select("account_id, debit, credit, journal_entries!inner(company_id)")
        .eq("journal_entries.company_id", currentCompany!.id);

      const totals: Record<string, { debit: number; credit: number }> = {};
      (lines ?? []).forEach((l: any) => {
        const t = totals[l.account_id] ||= { debit: 0, credit: 0 };
        t.debit += Number(l.debit); t.credit += Number(l.credit);
      });
      return (accounts ?? []).map((a: any) => {
        const t = totals[a.id] ?? { debit: 0, credit: 0 };
        const balance = t.debit - t.credit;
        return { ...a, debit: t.debit, credit: t.credit, balance };
      }).filter((a) => a.debit > 0 || a.credit > 0);
    },
  });

  const totalDebit = data.reduce((s, a) => s + a.debit, 0);
  const totalCredit = data.reduce((s, a) => s + a.credit, 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Balance des comptes mouvementés</p>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Compte</TableHead>
              <TableHead>Libellé</TableHead>
              <TableHead className="text-right">Total Débit</TableHead>
              <TableHead className="text-right">Total Crédit</TableHead>
              <TableHead className="text-right">Solde</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucun mouvement</TableCell></TableRow>
            )}
            {data.map((a: any) => (
              <TableRow key={a.id}>
                <TableCell className="font-mono font-semibold">{a.code}</TableCell>
                <TableCell>{a.name}</TableCell>
                <TableCell className="text-right">{formatXOF(a.debit)}</TableCell>
                <TableCell className="text-right">{formatXOF(a.credit)}</TableCell>
                <TableCell className={`text-right font-semibold ${a.balance < 0 ? "text-destructive" : ""}`}>
                  {formatXOF(Math.abs(a.balance))} {a.balance >= 0 ? "D" : "C"}
                </TableCell>
              </TableRow>
            ))}
            {data.length > 0 && (
              <TableRow className="bg-muted/50 font-bold">
                <TableCell colSpan={2}>TOTAUX</TableCell>
                <TableCell className="text-right">{formatXOF(totalDebit)}</TableCell>
                <TableCell className="text-right">{formatXOF(totalCredit)}</TableCell>
                <TableCell className="text-right">{totalDebit === totalCredit ? "✓ Équilibré" : "⚠ Déséquilibre"}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
