import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatXOF, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_app/accounting/entries")({
  component: EntriesPage,
  validateSearch: (s: Record<string, unknown>) => ({ journal: (s.journal as string) ?? "all" }),
});

function EntriesPage() {
  const { currentCompany } = useAuth();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: journals = [] } = useQuery({
    queryKey: ["journals-list", currentCompany?.id],
    enabled: !!currentCompany,
    queryFn: async () => {
      const { data } = await supabase.from("journals").select("id, code, name")
        .eq("company_id", currentCompany!.id).order("code");
      return data ?? [];
    },
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["entries", currentCompany?.id, search.journal],
    enabled: !!currentCompany,
    queryFn: async () => {
      let q = supabase.from("journal_entries")
        .select("*, journals(code, name), journal_entry_lines(*, accounts(code, name))")
        .eq("company_id", currentCompany!.id)
        .order("entry_date", { ascending: false }).limit(200);
      if (search.journal !== "all") q = q.eq("journal_id", search.journal);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <Select value={search.journal} onValueChange={(v) => navigate({ search: { journal: v } as any })}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les journaux</SelectItem>
            {journals.map((j: any) => <SelectItem key={j.id} value={j.id}>{j.code} — {j.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{entries.length} écriture(s)</span>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Journal</TableHead>
              <TableHead>Référence</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Débit</TableHead>
              <TableHead className="text-right">Crédit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucune écriture</TableCell></TableRow>
            )}
            {entries.map((e: any) => {
              const total = e.journal_entry_lines.reduce((s: number, l: any) => s + Number(l.debit), 0);
              const isOpen = expanded === e.id;
              return (
                <>
                  <TableRow key={e.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setExpanded(isOpen ? null : e.id)}>
                    <TableCell>{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                    <TableCell>{formatDate(e.entry_date)}</TableCell>
                    <TableCell><Badge variant="outline">{e.journals.code}</Badge></TableCell>
                    <TableCell className="font-mono text-sm">{e.reference}</TableCell>
                    <TableCell className="text-sm">{e.description}</TableCell>
                    <TableCell className="text-right font-semibold">{formatXOF(total)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatXOF(total)}</TableCell>
                  </TableRow>
                  {isOpen && e.journal_entry_lines.map((l: any) => (
                    <TableRow key={l.id} className="bg-muted/30">
                      <TableCell></TableCell>
                      <TableCell colSpan={2}></TableCell>
                      <TableCell className="font-mono text-xs">{l.accounts.code}</TableCell>
                      <TableCell className="text-sm">{l.accounts.name} {l.label && <span className="text-muted-foreground">— {l.label}</span>}</TableCell>
                      <TableCell className="text-right text-sm">{Number(l.debit) > 0 ? formatXOF(l.debit) : "—"}</TableCell>
                      <TableCell className="text-right text-sm">{Number(l.credit) > 0 ? formatXOF(l.credit) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
