import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatXOF, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_app/accounting/ledger")({ component: LedgerPage });

function LedgerPage() {
  const { currentCompany } = useAuth();
  const [accountId, setAccountId] = useState<string>("");

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts-list", currentCompany?.id],
    enabled: !!currentCompany,
    queryFn: async () => {
      const { data } = await supabase.from("accounts").select("id, code, name")
        .eq("company_id", currentCompany!.id).order("code");
      return data ?? [];
    },
  });

  const { data: lines = [] } = useQuery({
    queryKey: ["ledger", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_entry_lines")
        .select("*, journal_entries(reference, entry_date, description, journals(code))")
        .eq("account_id", accountId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  let running = 0;
  const rows = lines.map((l: any) => {
    running += Number(l.debit) - Number(l.credit);
    return { ...l, running };
  });

  return (
    <div className="space-y-4">
      <Select value={accountId} onValueChange={setAccountId}>
        <SelectTrigger className="w-96"><SelectValue placeholder="Choisir un compte..." /></SelectTrigger>
        <SelectContent>
          {accounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}
        </SelectContent>
      </Select>

      {accountId && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Journal</TableHead>
                <TableHead>Pièce</TableHead>
                <TableHead>Libellé</TableHead>
                <TableHead className="text-right">Débit</TableHead>
                <TableHead className="text-right">Crédit</TableHead>
                <TableHead className="text-right">Solde</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun mouvement</TableCell></TableRow>
              )}
              {rows.map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell>{formatDate(l.journal_entries.entry_date)}</TableCell>
                  <TableCell>{l.journal_entries.journals.code}</TableCell>
                  <TableCell className="font-mono text-sm">{l.journal_entries.reference}</TableCell>
                  <TableCell className="text-sm">{l.label || l.journal_entries.description}</TableCell>
                  <TableCell className="text-right">{Number(l.debit) > 0 ? formatXOF(l.debit) : "—"}</TableCell>
                  <TableCell className="text-right">{Number(l.credit) > 0 ? formatXOF(l.credit) : "—"}</TableCell>
                  <TableCell className="text-right font-semibold">{formatXOF(Math.abs(l.running))} {l.running >= 0 ? "D" : "C"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
