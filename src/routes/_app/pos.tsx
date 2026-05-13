import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Minus, Trash2, Search, ShoppingCart } from "lucide-react";
import { formatXOF } from "@/lib/format";
import { generateInvoicePDF } from "@/lib/invoice-pdf";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/pos")({ component: POSPage });

type Product = { id: string; name: string; sale_price: number; stock_quantity: number; barcode: string | null };
type CartItem = { product_id: string; name: string; quantity: number; unit_price: number };

function POSPage() {
  const { currentCompany, user } = useAuth();
  const qc = useQueryClient();
  const companyId = currentCompany?.id;
  const taxRate = currentCompany ? Number(currentCompany.tax_rate) / 100 : 0;

  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "wave" | "orange_money" | "free_money" | "card" | "credit">("cash");
  const [customerId, setCustomerId] = useState<string>("");
  const [applyTax, setApplyTax] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ["pos-products", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, sale_price, stock_quantity, barcode").eq("company_id", companyId!).eq("is_active", true).order("name");
      if (error) throw error;
      return data as Product[];
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["pos-customers", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id, name, phone").eq("company_id", companyId!).order("name");
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (!search) return products;
    const q = search.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q));
  }, [products, search]);

  const addToCart = (p: Product) => {
    setCart((c) => {
      const existing = c.find((x) => x.product_id === p.id);
      if (existing) return c.map((x) => x.product_id === p.id ? { ...x, quantity: x.quantity + 1 } : x);
      return [...c, { product_id: p.id, name: p.name, quantity: 1, unit_price: Number(p.sale_price) }];
    });
  };
  const updateQty = (id: string, delta: number) =>
    setCart((c) => c.map((x) => x.product_id === id ? { ...x, quantity: Math.max(1, x.quantity + delta) } : x));
  const removeItem = (id: string) => setCart((c) => c.filter((x) => x.product_id !== id));

  const subtotal = cart.reduce((s, it) => s + it.quantity * it.unit_price, 0);
  const discountVal = parseFloat(discount) || 0;
  const afterDiscount = Math.max(0, subtotal - discountVal);
  const taxAmount = applyTax ? Math.round(afterDiscount * taxRate) : 0;
  const total = afterDiscount + taxAmount;

  const checkout = async () => {
    if (!companyId || !user || cart.length === 0) return;
    setSubmitting(true);
    try {
      const reference = "FAC-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + Math.floor(Math.random() * 9000 + 1000);
      const { data: sale, error } = await supabase.from("sales").insert({
        company_id: companyId, reference, customer_id: customerId || null, user_id: user.id,
        subtotal, discount: discountVal, tax_amount: taxAmount, total,
        amount_paid: paymentMethod === "credit" ? 0 : total,
        payment_method: paymentMethod,
        status: paymentMethod === "credit" ? "pending" : "paid",
      }).select().single();
      if (error) throw error;

      const items = cart.map((it) => ({
        sale_id: sale.id, product_id: it.product_id, product_name: it.name,
        quantity: it.quantity, unit_price: it.unit_price, total: it.quantity * it.unit_price,
      }));
      const { error: e2 } = await supabase.from("sale_items").insert(items);
      if (e2) throw e2;

      const customer = customers.find((c: any) => c.id === customerId);
      if (currentCompany) {
        generateInvoicePDF(currentCompany, {
          reference: sale.reference, created_at: sale.created_at,
          customer_name: customer?.name, customer_phone: customer?.phone,
          items: items.map((i) => ({ product_name: i.product_name, quantity: i.quantity, unit_price: i.unit_price, total: i.total })),
          subtotal, discount: discountVal, tax_amount: taxAmount, total,
          amount_paid: Number(sale.amount_paid), payment_method: paymentMethod,
        });
      }

      toast.success("Vente enregistrée — facture téléchargée");
      setCart([]); setDiscount("0"); setCustomerId("");
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_400px] gap-6 h-[calc(100vh-7rem)]">
      {/* Products grid */}
      <div className="flex flex-col">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher / scanner code-barres..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
        </div>
        <ScrollArea className="flex-1 rounded-xl border border-border bg-card">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 p-4">
            {filtered.map((p) => (
              <button key={p.id} onClick={() => addToCart(p)} className="text-left rounded-lg border border-border p-3 hover:border-primary hover:shadow-elegant transition-all bg-background">
                <div className="font-medium text-sm line-clamp-2">{p.name}</div>
                <div className="mt-2 flex justify-between items-end">
                  <span className="text-primary font-bold">{formatXOF(p.sale_price)}</span>
                  <span className={`text-xs ${Number(p.stock_quantity) <= 0 ? "text-destructive" : "text-muted-foreground"}`}>
                    Stock: {p.stock_quantity}
                  </span>
                </div>
              </button>
            ))}
            {filtered.length === 0 && <p className="col-span-full text-center py-8 text-muted-foreground text-sm">Aucun produit</p>}
          </div>
        </ScrollArea>
      </div>

      {/* Cart */}
      <div className="flex flex-col rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border bg-secondary flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Panier ({cart.length})</h3>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {cart.length === 0 ? (
              <p className="text-center py-8 text-sm text-muted-foreground">Cliquez un produit pour l'ajouter</p>
            ) : cart.map((it) => (
              <div key={it.product_id} className="rounded-md border border-border p-2">
                <div className="flex justify-between gap-2">
                  <span className="text-sm font-medium flex-1">{it.name}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeItem(it.product_id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQty(it.product_id, -1)}><Minus className="h-3 w-3" /></Button>
                    <span className="w-8 text-center text-sm">{it.quantity}</span>
                    <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQty(it.product_id, 1)}><Plus className="h-3 w-3" /></Button>
                  </div>
                  <span className="text-sm font-semibold">{formatXOF(it.quantity * it.unit_price)}</span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="border-t border-border p-4 space-y-3">
          <div>
            <Label className="text-xs">Client (optionnel)</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {customers.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Remise</Label>
              <Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Paiement</Label>
              <Select value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Espèces</SelectItem>
                  <SelectItem value="wave">Wave</SelectItem>
                  <SelectItem value="orange_money">Orange Money</SelectItem>
                  <SelectItem value="free_money">Free Money</SelectItem>
                  <SelectItem value="card">Carte bancaire</SelectItem>
                  <SelectItem value="credit">Crédit (à payer)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={applyTax} onChange={(e) => setApplyTax(e.target.checked)} className="rounded" />
            Appliquer TVA ({currentCompany?.tax_rate}%)
          </label>
          <div className="space-y-1 pt-2 border-t border-border text-sm">
            <div className="flex justify-between text-muted-foreground"><span>Sous-total</span><span>{formatXOF(subtotal)}</span></div>
            {discountVal > 0 && <div className="flex justify-between text-muted-foreground"><span>Remise</span><span>-{formatXOF(discountVal)}</span></div>}
            {applyTax && <div className="flex justify-between text-muted-foreground"><span>TVA</span><span>{formatXOF(taxAmount)}</span></div>}
            <div className="flex justify-between font-bold text-lg pt-1"><span>TOTAL</span><span className="text-primary">{formatXOF(total)}</span></div>
          </div>
          <Button onClick={checkout} disabled={cart.length === 0 || submitting} className="w-full h-11 text-base">
            {submitting ? "Validation..." : "Valider la vente"}
          </Button>
        </div>
      </div>
    </div>
  );
}
