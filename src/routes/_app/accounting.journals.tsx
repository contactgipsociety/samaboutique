import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { formatXOF } from "@/lib/format";

export const Route = createFileRoute("/_app/accounting/journals")({ component: JournalsPage });

const TYPE_COLORS: Record<string, string> = {
  sales: "bg-emerald-500/10 text-emerald-600",
  purchases: "bg-blue-500/10 text-blue-600",
  cash: "bg-amber-500/10 text-amber-600",
  bank: "bg-purple-500/10 text-purple-600",
  misc: "bg-slate-500/10 text-slate-600",
};

function JournalsPage() {
  const { currentCompany } = useAuth();
  const { data: journals = [] } = useQuery({
    queryKey: ["journals", currentCompany?.id],
    enabled: !!currentCompany,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journals").select("*, journal_entries(count)")
        .eq("company_id", currentCompany!.id).order("code");
      if (error) throw error;

      // get totals per journal
      const ids = data.map((j: any) => j.id);
      const { data: lines } = await supabase
        .from("journal_entry_lines")
        .select("debit, journal_entries!inner(journal_id)")
        .in("journal_entries.journal_id", ids);
      const totals: Record<string, number> = {};
      (lines ?? []).forEach((l: any) => {
        const jid = l.journal_entries.journal_id;
        totals[jid] = (totals[jid] ?? 0) + Number(l.debit);
      });
      return data.map((j: any) => ({ ...j, total: totals[j.id] ?? 0, count: j.journal_entries?.[0]?.count ?? 0 }));
    },
  });

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {journals.map((j: any) => (
        <Link key={j.id} to="/accounting/entries" search={{ journal: j.id } as any}>
          <Card className="p-5 hover:border-primary transition-colors cursor-pointer">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-2xl font-bold font-mono">{j.code}</p>
                <p className="text-sm text-muted-foreground">{j.name}</p>
              </div>
              <span className={`px-2 py-1 rounded-md text-xs font-medium ${TYPE_COLORS[j.type]}`}>{j.type}</span>
            </div>
            <div className="flex justify-between text-sm pt-3 border-t border-border">
              <span className="text-muted-foreground">{j.count} écriture(s)</span>
              <span className="font-semibold">{formatXOF(j.total)}</span>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
