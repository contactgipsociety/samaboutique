import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Company = {
  id: string;
  name: string;
  ninea: string | null;
  rccm: string | null;
  phone: string | null;
  address: string | null;
  currency: string;
  tax_rate: number;
  logo_url: string | null;
};

export type Membership = {
  company_id: string;
  role: "owner" | "admin" | "cashier" | "accountant" | "stock_manager";
  companies: Company;
};

type AuthCtx = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  memberships: Membership[];
  currentCompany: Company | null;
  currentRole: Membership["role"] | null;
  setCurrentCompanyId: (id: string) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

const STORAGE_KEY = "gestcom_current_company";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [currentCompanyId, setCurrentCompanyIdState] = useState<string | null>(
    typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null
  );

  const loadMemberships = async (uid: string) => {
    const { data, error } = await supabase
      .from("company_members")
      .select("company_id, role, companies(*)")
      .eq("user_id", uid);
    if (error) {
      console.error(error);
      setMemberships([]);
      return;
    }
    const list = (data ?? []) as unknown as Membership[];
    setMemberships(list);
    if (list.length > 0 && !list.find((m) => m.company_id === currentCompanyId)) {
      setCurrentCompanyId(list[0].company_id);
    }
  };

  const setCurrentCompanyId = (id: string) => {
    setCurrentCompanyIdState(id);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, id);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => loadMemberships(s.user.id), 0);
      } else {
        setMemberships([]);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) loadMemberships(data.session.user.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = memberships.find((m) => m.company_id === currentCompanyId) ?? null;

  const value: AuthCtx = {
    session,
    user: session?.user ?? null,
    loading,
    memberships,
    currentCompany: current?.companies ?? null,
    currentRole: current?.role ?? null,
    setCurrentCompanyId,
    refresh: async () => {
      if (session?.user) await loadMemberships(session.user.id);
    },
    signOut: async () => {
      await supabase.auth.signOut();
      if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
