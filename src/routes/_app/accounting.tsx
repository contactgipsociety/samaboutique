import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, Library, FileText, Scale, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/accounting")({ component: AccountingLayout });

const tabs = [
  { to: "/accounting/chart", label: "Plan comptable", icon: Library },
  { to: "/accounting/journals", label: "Journaux", icon: BookOpen },
  { to: "/accounting/entries", label: "Écritures", icon: FileText },
  { to: "/accounting/balance", label: "Balance", icon: Scale },
  { to: "/accounting/ledger", label: "Grand livre", icon: ScrollText },
];

function AccountingLayout() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Comptabilité SYSCOHADA</h1>
        <p className="text-sm text-muted-foreground">Plan comptable, journaux et états financiers</p>
      </div>
      <div className="border-b border-border flex gap-1 overflow-x-auto">
        {tabs.map((t) => {
          const active = path === t.to;
          return (
            <Link key={t.to} to={t.to}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
                active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}>
              <t.icon className="h-4 w-4" /> {t.label}
            </Link>
          );
        })}
      </div>
      <Outlet />
    </div>
  );
}
