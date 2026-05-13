import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { formatXOF } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/products")({ component: ProductsPage });

type Product = {
  id: string; name: string; sku: string | null; barcode: string | null;
  purchase_price: number; sale_price: number; stock_quantity: number; stock_min: number; unit: string;
};

function ProductsPage() {
  const { currentCompany } = useAuth();
  const qc = useQueryClient();
  const companyId = currentCompany?.id;
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const empty = { name: "", sku: "", barcode: "", purchase_price: "0", sale_price: "0", stock_quantity: "0", stock_min: "0", unit: "pièce" };
  const [form, setForm] = useState(empty);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("company_id", companyId!).order("name");
      if (error) throw error;
      return data as Product[];
    },
  });

  const filtered = products.filter((p) =>
    [p.name, p.sku, p.barcode].some((x) => x?.toLowerCase().includes(search.toLowerCase()))
  );

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name, sku: p.sku ?? "", barcode: p.barcode ?? "", unit: p.unit,
      purchase_price: String(p.purchase_price), sale_price: String(p.sale_price),
      stock_quantity: String(p.stock_quantity), stock_min: String(p.stock_min),
    });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    const payload = {
      company_id: companyId,
      name: form.name,
      sku: form.sku || null, barcode: form.barcode || null, unit: form.unit,
      purchase_price: parseFloat(form.purchase_price) || 0,
      sale_price: parseFloat(form.sale_price) || 0,
      stock_quantity: parseFloat(form.stock_quantity) || 0,
      stock_min: parseFloat(form.stock_min) || 0,
    };
    const { error } = editing
      ? await supabase.from("products").update(payload).eq("id", editing.id)
      : await supabase.from("products").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Produit modifié" : "Produit ajouté");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["products", companyId] });
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce produit ?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Supprimé");
    qc.invalidateQueries({ queryKey: ["products", companyId] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Produits</h1>
          <p className="text-sm text-muted-foreground">{products.length} produits</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Nouveau produit</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editing ? "Modifier" : "Nouveau"} produit</DialogTitle></DialogHeader>
            <form onSubmit={save} className="space-y-3">
              <div><Label>Nom *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>SKU</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
                <div><Label>Code-barres</Label><Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Prix achat</Label><Input type="number" step="1" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} /></div>
                <div><Label>Prix vente</Label><Input type="number" step="1" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Stock</Label><Input type="number" step="0.01" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} /></div>
                <div><Label>Stock min</Label><Input type="number" step="0.01" value={form.stock_min} onChange={(e) => setForm({ ...form, stock_min: e.target.value })} /></div>
                <div><Label>Unité</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
              </div>
              <Button type="submit" className="w-full">{editing ? "Modifier" : "Ajouter"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Rechercher nom, SKU, code-barres..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produit</TableHead>
              <TableHead>SKU / Code</TableHead>
              <TableHead className="text-right">Prix vente</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Chargement…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucun produit</TableCell></TableRow>
            ) : filtered.map((p) => {
              const low = Number(p.stock_quantity) <= Number(p.stock_min);
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.sku || p.barcode || "—"}</TableCell>
                  <TableCell className="text-right">{formatXOF(p.sale_price)}</TableCell>
                  <TableCell className={`text-right ${low ? "text-warning font-semibold" : ""}`}>{p.stock_quantity} {p.unit}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
