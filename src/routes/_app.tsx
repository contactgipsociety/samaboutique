import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { session, loading, memberships, currentCompany } = useAuth();
  const navigate = useNavigate();
  const path = typeof window !== "undefined" ? window.location.pathname : "";

  useEffect(() => {
    if (loading) return;
    if (!session) { navigate({ to: "/login" }); return; }
    if (memberships.length === 0 && path !== "/onboarding") {
      navigate({ to: "/onboarding" });
    }
  }, [loading, session, memberships, navigate, path]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Chargement…</div>;
  }
  if (!session) return null;

  // Onboarding takes the full screen (no sidebar)
  if (!currentCompany) {
    return <Outlet />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 border-b border-border flex items-center px-4 gap-2 bg-card">
            <SidebarTrigger />
            <h1 className="text-sm font-medium text-muted-foreground">{currentCompany.name}</h1>
          </header>
          <main className="flex-1 p-6 overflow-auto"><Outlet /></main>
        </div>
      </div>
    </SidebarProvider>
  );
}
