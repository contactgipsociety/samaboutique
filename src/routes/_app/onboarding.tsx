import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Building2 } from "lucide-react";

export const Route = createFileRoute("/_app/onboarding")({
  component: OnboardingPage,
});

function OnboardingPage() {
  const { user, refresh, setCurrentCompanyId } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", phone: "", address: "", ninea: "", rccm: "", tax_rate: "18",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const { data: company, error } = await supabase
        .from("companies")
        .insert({
          name: form.name,
          phone: form.phone || null,
          address: form.address || null,
          ninea: form.ninea || null,
          rccm: form.rccm || null,
          tax_rate: parseFloat(form.tax_rate) || 18,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;

      const { error: memErr } = await supabase
        .from("company_members")
        .insert({ company_id: company.id, user_id: user.id, role: "owner" });
      if (memErr) throw memErr;

      setCurrentCompanyId(company.id);
      await refresh();
      toast.success("Entreprise créée !");
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err.message ?? "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="h-12 w-12 rounded-xl gradient-primary mx-auto flex items-center justify-center mb-4">
            <Building2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold">Configurez votre entreprise</h1>
          <p className="text-muted-foreground mt-2">Quelques infos pour démarrer. Modifiables à tout moment.</p>
        </div>
        <form onSubmit={submit} className="rounded-xl border border-border bg-card p-8 shadow-elegant space-y-4">
          <div>
            <Label>Nom de l'entreprise *</Label>
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Quincaillerie Diop & Frères" />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Téléphone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+221 77 123 45 67" />
            </div>
            <div>
              <Label>Taux TVA (%)</Label>
              <Input type="number" step="0.01" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Adresse</Label>
            <Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Marché Sandaga, Dakar" />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>NINEA</Label>
              <Input value={form.ninea} onChange={(e) => setForm({ ...form, ninea: e.target.value })} />
            </div>
            <div>
              <Label>RCCM</Label>
              <Input value={form.rccm} onChange={(e) => setForm({ ...form, rccm: e.target.value })} />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Création..." : "Créer mon espace"}
          </Button>
        </form>
      </div>
    </div>
  );
}
