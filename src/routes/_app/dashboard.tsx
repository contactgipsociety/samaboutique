import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatXOF } from "@/lib/format";
import { TrendingUp, ShoppingCart, Package, AlertTriangle, Users } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_app/dashboard")({ component: Dashboard });

function StatCard({ icon: Icon, label, value, sub, color = "primary" }: any) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 hover:shadow-elegant transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold mt-2">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className={`h-11 w-11 rounded-lg bg-${color}/10 flex items-center justify-center`}>
          <Icon className={`h-5 w-5 text-${color}`} />
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const { currentCompany } = useAuth();
  const companyId = currentCompany?.id;

  const { data: stats } = useQuery({
    queryKey: ["dashboard", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const sevenAgo = new Date(); sevenAgo.setDate(sevenAgo.getDate() - 6); sevenAgo.setHours(0, 0, 0, 0);

      const [salesToday, salesMonth, salesWeek, products, customers, pendingSales] = await Promise.all([
        supabase.from("sales").select("total").eq("company_id", companyId!).gte("created_at", today.toISOString()),
        supabase.from("sales").select("total").eq("company_id", companyId!).gte("created_at", monthStart.toISOString()),
        supabase.from("sales").select("total, created_at").eq("company_id", companyId!).gte("created_at", sevenAgo.toISOString()).order("created_at"),
        supabase.from("products").select("id, name, stock_quantity, stock_min").eq("company_id", companyId!),
        supabase.from("customers").select("id", { count: "exact", head: true }).eq("company_id", companyId!),
        supabase.from("sales").select("total, amount_paid").eq("company_id", companyId!).in("status", ["pending", "partial"]),
      ]);

      const todayTotal = (salesToday.data ?? []).reduce((s, r) => s + Number(r.total), 0);
      const monthTotal = (salesMonth.data ?? []).reduce((s, r) => s + Number(r.total), 0);
      const lowStock = (products.data ?? []).filter((p) => Number(p.stock_quantity) <= Number(p.stock_min));
      const unpaid = (pendingSales.data ?? []).reduce((s, r) => s + (Number(r.total) - Number(r.amount_paid)), 0);

      // Build 7-day chart
      const days: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
        days[d.toISOString().slice(0, 10)] = 0;
      }
      (salesWeek.data ?? []).forEach((s) => {
        const k = new Date(s.created_at).toISOString().slice(0, 10);
        if (k in days) days[k] += Number(s.total);
      });
      const chart = Object.entries(days).map(([d, total]) => ({
        date: new Date(d).toLocaleDateString("fr-FR", { weekday: "short" }),
        total,
      }));

      return {
        todayTotal, monthTotal, lowStockCount: lowStock.length, lowStock,
        productCount: (products.data ?? []).length,
        customerCount: customers.count ?? 0,
        unpaid, salesTodayCount: (salesToday.data ?? []).length,
        chart,
      };
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">Vue d'ensemble de votre activité</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={TrendingUp} label="CA aujourd'hui" value={formatXOF(stats?.todayTotal ?? 0)} sub={`${stats?.salesTodayCount ?? 0} ventes`} />
        <StatCard icon={ShoppingCart} label="CA du mois" value={formatXOF(stats?.monthTotal ?? 0)} />
        <StatCard icon={Package} label="Produits" value={stats?.productCount ?? 0} sub={`${stats?.lowStockCount ?? 0} en alerte`} color="warning" />
        <StatCard icon={Users} label="Clients" value={stats?.customerCount ?? 0} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold mb-4">Ventes — 7 derniers jours</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats?.chart ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.01 150)" />
                <XAxis dataKey="date" stroke="oklch(0.5 0.02 160)" fontSize={12} />
                <YAxis stroke="oklch(0.5 0.02 160)" fontSize={12} tickFormatter={(v) => v >= 1000 ? `${v/1000}k` : v} />
                <Tooltip formatter={(v: number) => formatXOF(v)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px" }} />
                <Line type="monotone" dataKey="total" stroke="var(--primary)" strokeWidth={2.5} dot={{ fill: "var(--primary)", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold flex items-center gap-2 mb-4">
            <AlertTriangle className="h-4 w-4 text-warning" /> Stock faible
          </h3>
          {stats?.lowStock?.length ? (
            <ul className="space-y-2 text-sm">
              {stats.lowStock.slice(0, 6).map((p: any) => (
                <li key={p.id} className="flex justify-between border-b border-border pb-2 last:border-0">
                  <span className="truncate">{p.name}</span>
                  <span className="font-medium text-warning">{p.stock_quantity}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun produit en alerte</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold">Impayés</h3>
        <p className="text-2xl font-bold mt-2 text-warning">{formatXOF(stats?.unpaid ?? 0)}</p>
        <p className="text-sm text-muted-foreground mt-1">Montant total restant à encaisser</p>
      </div>
    </div>
  );
}
