import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });

function SettingsPage() {
  const { currentCompany, refresh } = useAuth();
  const [form, setForm] = useState({
    name: "", phone: "", address: "", ninea: "", rccm: "", tax_rate: "18", email: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentCompany) {
      setForm({
        name: currentCompany.name,
        phone: currentCompany.phone ?? "",
        address: currentCompany.address ?? "",
        ninea: currentCompany.ninea ?? "",
        rccm: currentCompany.rccm ?? "",
        tax_rate: String(currentCompany.tax_rate),
        email: (currentCompany as any).email ?? "",
      });
    }
  }, [currentCompany]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany) return;
    setLoading(true);
    const { error } = await supabase.from("companies").update({
      name: form.name, phone: form.phone || null, address: form.address || null,
      ninea: form.ninea || null, rccm: form.rccm || null, email: form.email || null,
      tax_rate: parseFloat(form.tax_rate) || 18,
    }).eq("id", currentCompany.id);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Paramètres mis à jour");
    refresh();
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Paramètres entreprise</h1>
        <p className="text-sm text-muted-foreground">Informations affichées sur les factures</p>
      </div>
      <form onSubmit={save} className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div><Label>Nom *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Téléphone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        </div>
        <div><Label>Adresse</Label><Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div className="grid grid-cols-3 gap-4">
          <div><Label>NINEA</Label><Input value={form.ninea} onChange={(e) => setForm({ ...form, ninea: e.target.value })} /></div>
          <div><Label>RCCM</Label><Input value={form.rccm} onChange={(e) => setForm({ ...form, rccm: e.target.value })} /></div>
          <div><Label>TVA (%)</Label><Input type="number" step="0.01" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} /></div>
        </div>
        <Button type="submit" disabled={loading}>{loading ? "Enregistrement..." : "Enregistrer"}</Button>
      </form>
    </div>
  );
}
