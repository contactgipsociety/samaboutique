import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/accounting/chart")({ component: ChartPage });

const CLASS_LABELS: Record<string, string> = {
  "1": "Capitaux", "2": "Immobilisations", "3": "Stocks", "4": "Tiers",
  "5": "Trésorerie", "6": "Charges", "7": "Produits", "8": "Autres",
};

function ChartPage() {
  const { currentCompany } = useAuth();
  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts", currentCompany?.id],
    enabled: !!currentCompany,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts").select("*")
        .eq("company_id", currentCompany!.id)
        .order("code");
      if (error) throw error;
      return data;
    },
  });

  const grouped = accounts.reduce<Record<string, typeof accounts>>((acc, a: any) => {
    (acc[a.class] ||= []).push(a); return acc;
  }, {});

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{accounts.length} comptes — Plan SYSCOHADA</p>
      {Object.keys(grouped).sort().map((cls) => (
        <div key={cls} className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 bg-muted/50 border-b border-border">
            <h3 className="font-semibold">Classe {cls} — {CLASS_LABELS[cls]}</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Code</TableHead>
                <TableHead>Libellé</TableHead>
                <TableHead className="text-right">Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grouped[cls].map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono font-semibold">{a.code}</TableCell>
                  <TableCell>{a.name}</TableCell>
                  <TableCell className="text-right"><Badge variant="outline">{a.type}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
    </div>
  );
}
