import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { formatXOF, formatDateTime } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/purchases")({ component: PurchasesPage });

function PurchasesPage() {
  const { currentCompany, user } = useAuth();
  const qc = useQueryClient();
  const companyId = currentCompany?.id;
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState<string>("");
  const [items, setItems] = useState<{ product_id: string; product_name: string; quantity: string; unit_cost: string }[]>([]);

  const { data: purchases = [] } = useQuery({
    queryKey: ["purchases", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("purchases").select("*, suppliers(name)").eq("company_id", companyId!).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase.from("suppliers").select("id, name").eq("company_id", companyId!).order("name");
      return data ?? [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-list", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name, purchase_price").eq("company_id", companyId!).order("name");
      return data ?? [];
    },
  });

  const addItem = () => setItems([...items, { product_id: "", product_name: "", quantity: "1", unit_cost: "0" }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, patch: any) => setItems(items.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const total = items.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_cost) || 0), 0);

  const save = async () => {
    if (!companyId || !user || items.length === 0) { toast.error("Ajoutez au moins une ligne"); return; }
    const ref = "ACH-" + Date.now().toString().slice(-8);
    const { data: purchase, error } = await supabase.from("purchases").insert({
      company_id: companyId, reference: ref, supplier_id: supplierId || null,
      user_id: user.id, total, amount_paid: total, status: "paid",
    }).select().single();
    if (error) { toast.error(error.message); return; }

    const lines = items.map((it) => ({
      purchase_id: purchase.id, product_id: it.product_id || null, product_name: it.product_name,
      quantity: parseFloat(it.quantity), unit_cost: parseFloat(it.unit_cost),
      total: parseFloat(it.quantity) * parseFloat(it.unit_cost),
    }));
    const { error: e2 } = await supabase.from("purchase_items").insert(lines);
    if (e2) { toast.error(e2.message); return; }
    toast.success("Achat enregistré (stock mis à jour)");
    setOpen(false); setItems([]); setSupplierId("");
    qc.invalidateQueries({ queryKey: ["purchases", companyId] });
    qc.invalidateQueries({ queryKey: ["products"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Achats fournisseurs</h1>
          <p className="text-sm text-muted-foreground">Mise à jour automatique du stock</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={() => { setItems([]); addItem(); }}><Plus className="h-4 w-4 mr-2" />Nouvel achat</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Nouvel achat</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Fournisseur</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                {items.map((it, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      <Select value={it.product_id} onValueChange={(v) => {
                        const p: any = products.find((p: any) => p.id === v);
                        updateItem(i, { product_id: v, product_name: p?.name ?? "", unit_cost: String(p?.purchase_price ?? 0) });
                      }}>
                        <SelectTrigger><SelectValue placeholder="Produit" /></SelectTrigger>
                        <SelectContent>
                          {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2"><Input type="number" placeholder="Qté" value={it.quantity} onChange={(e) => updateItem(i, { quantity: e.target.value })} /></div>
                    <div className="col-span-3"><Input type="number" placeholder="P.U." value={it.unit_cost} onChange={(e) => updateItem(i, { unit_cost: e.target.value })} /></div>
                    <div className="col-span-2 flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => removeItem(i)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" />Ligne</Button>
              </div>
              <div className="flex justify-between items-center pt-4 border-t">
                <span className="font-semibold">Total</span>
                <span className="text-xl font-bold">{formatXOF(total)}</span>
              </div>
              <Button onClick={save} className="w-full">Enregistrer</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Référence</TableHead><TableHead>Date</TableHead><TableHead>Fournisseur</TableHead><TableHead className="text-right">Total</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {purchases.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Aucun achat</TableCell></TableRow>
            ) : purchases.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-sm">{p.reference}</TableCell>
                <TableCell className="text-sm">{formatDateTime(p.created_at)}</TableCell>
                <TableCell>{p.suppliers?.name ?? "—"}</TableCell>
                <TableCell className="text-right font-semibold">{formatXOF(p.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
