import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, Trash2, Search, ShoppingCart, Receipt, FileDown, Printer, Banknote, Smartphone, CreditCard, Clock } from "lucide-react";
import { formatXOF } from "@/lib/format";
import { generateInvoicePDF } from "@/lib/invoice-pdf";
import { printThermalTicket, type PaymentBreakdown } from "@/lib/thermal-ticket";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/pos")({ component: POSPage });

type Product = { id: string; name: string; sale_price: number; stock_quantity: number; barcode: string | null; category_id: string | null };
type CartItem = { product_id: string; name: string; quantity: number; unit_price: number; stock: number };
type Method = "cash" | "wave" | "orange_money" | "free_money" | "card" | "credit";

const METHOD_META: Record<Method, { label: string; icon: typeof Banknote; color: string }> = {
  cash: { label: "Espèces", icon: Banknote, color: "text-emerald-500" },
  wave: { label: "Wave", icon: Smartphone, color: "text-blue-500" },
  orange_money: { label: "Orange Money", icon: Smartphone, color: "text-orange-500" },
  free_money: { label: "Free Money", icon: Smartphone, color: "text-yellow-500" },
  card: { label: "Carte", icon: CreditCard, color: "text-violet-500" },
  credit: { label: "Crédit", icon: Clock, color: "text-rose-500" },
};

function POSPage() {
  const { currentCompany, user } = useAuth();
  const qc = useQueryClient();
  const companyId = currentCompany?.id;
  const taxRate = currentCompany ? Number(currentCompany.tax_rate) / 100 : 0;

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState("0");
  const [customerId, setCustomerId] = useState<string>("");
  const [applyTax, setApplyTax] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [autoTicket, setAutoTicket] = useState(true);
  const [payments, setPayments] = useState<PaymentBreakdown[]>([{ method: "cash", amount: 0 }]);
  const searchRef = useRef<HTMLInputElement>(null);

  const { data: products = [] } = useQuery({
    queryKey: ["pos-products", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, sale_price, stock_quantity, barcode, category_id").eq("company_id", companyId!).eq("is_active", true).order("name");
      if (error) throw error;
      return data as Product[];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["pos-categories", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id, name").eq("company_id", companyId!).order("name");
      return data ?? [];
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

  const { data: todayStats } = useQuery({
    queryKey: ["pos-today", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const { data } = await supabase.from("sales").select("total").eq("company_id", companyId!).gte("created_at", today.toISOString());
      const arr = data ?? [];
      return { count: arr.length, total: arr.reduce((s, x: any) => s + Number(x.total), 0) };
    },
  });

  const filtered = useMemo(() => {
    let list = products;
    if (categoryFilter !== "all") list = list.filter((p) => p.category_id === categoryFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q));
    }
    return list;
  }, [products, search, categoryFilter]);

  const subtotal = cart.reduce((s, it) => s + it.quantity * it.unit_price, 0);
  const discountVal = parseFloat(discount) || 0;
  const afterDiscount = Math.max(0, subtotal - discountVal);
  const taxAmount = applyTax ? Math.round(afterDiscount * taxRate) : 0;
  const total = afterDiscount + taxAmount;

  const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const remainingToPay = Math.max(0, total - totalPaid);
  const changeDue = Math.max(0, totalPaid - total);
  const hasCredit = payments.some((p) => p.method === "credit");
  // Si crédit: amount_paid = total des paiements non-crédit. Sinon: total payé (plafonné au total pour ne pas compter le rendu)
  const creditAmount = payments.filter((p) => p.method === "credit").reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const cashedIn = payments.filter((p) => p.method !== "credit").reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const amountPaidRecorded = hasCredit ? cashedIn : Math.min(totalPaid, total);

  const addToCart = (p: Product) => {
    if (Number(p.stock_quantity) <= 0) { toast.error("Stock épuisé"); return; }
    setCart((c) => {
      const existing = c.find((x) => x.product_id === p.id);
      if (existing) {
        if (existing.quantity + 1 > Number(p.stock_quantity)) { toast.warning("Stock insuffisant"); return c; }
        return c.map((x) => x.product_id === p.id ? { ...x, quantity: x.quantity + 1 } : x);
      }
      return [...c, { product_id: p.id, name: p.name, quantity: 1, unit_price: Number(p.sale_price), stock: Number(p.stock_quantity) }];
    });
  };
  const updateQty = (id: string, delta: number) =>
    setCart((c) => c.map((x) => x.product_id === id ? { ...x, quantity: Math.min(x.stock, Math.max(1, x.quantity + delta)) } : x));
  const removeItem = (id: string) => setCart((c) => c.filter((x) => x.product_id !== id));
  const clearCart = () => { setCart([]); setDiscount("0"); setCustomerId(""); setPayments([{ method: "cash", amount: 0 }]); };

  // Scan code-barres : si exact match → ajout direct + clear search
  useEffect(() => {
    if (!search) return;
    const exact = products.find((p) => p.barcode && p.barcode.toLowerCase() === search.toLowerCase());
    if (exact) {
      addToCart(exact);
      setSearch("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Raccourcis clavier
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F2") { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "F4") { e.preventDefault(); fillExact(); }
      if (e.key === "F9") { e.preventDefault(); checkout(); }
      if (e.key === "Escape") { e.preventDefault(); searchRef.current?.blur(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, payments, total]);

  // Quand le total change, ajuster auto la 1re ligne paiement si vide
  useEffect(() => {
    setPayments((ps) => {
      if (ps.length === 1 && (ps[0].amount === 0 || ps[0].amount === total)) {
        return [{ ...ps[0], amount: total }];
      }
      return ps;
    });
  }, [total]);

  const fillExact = () => setPayments((ps) => {
    if (ps.length === 0) return [{ method: "cash", amount: total }];
    const others = ps.slice(0, -1).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const last = ps[ps.length - 1];
    return [...ps.slice(0, -1), { ...last, amount: Math.max(0, total - others) }];
  });

  const setPaymentMethod = (i: number, method: Method) =>
    setPayments((ps) => ps.map((p, idx) => idx === i ? { ...p, method } : p));
  const setPaymentAmount = (i: number, amount: number) =>
    setPayments((ps) => ps.map((p, idx) => idx === i ? { ...p, amount } : p));
  const addPaymentLine = () => setPayments((ps) => [...ps, { method: "cash", amount: remainingToPay }]);
  const removePaymentLine = (i: number) => setPayments((ps) => ps.length > 1 ? ps.filter((_, idx) => idx !== i) : ps);

  const checkout = async () => {
    if (!companyId || !user || cart.length === 0) { toast.error("Panier vide"); return; }
    if (totalPaid < total && !hasCredit) {
      toast.error(`Manquant ${formatXOF(total - totalPaid)} — ajouter un paiement Crédit ou compléter`);
      return;
    }
    setSubmitting(true);
    try {
      const reference = "FAC-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + Math.floor(Math.random() * 9000 + 1000);
      const validPayments = payments.filter((p) => Number(p.amount) > 0);
      // Méthode principale = la plus grosse (pour la compta) ; "credit" prioritaire si solde restant
      const principalMethod: Method = hasCredit && cashedIn < total
        ? "credit"
        : (validPayments.length > 0 ? validPayments.reduce((a, b) => Number(a.amount) >= Number(b.amount) ? a : b).method as Method : "cash");

      const breakdownNote = validPayments.length > 1
        ? "Paiement mixte: " + validPayments.map((p) => `${METHOD_META[p.method as Method]?.label ?? p.method} ${formatXOF(p.amount)}`).join(" • ")
        : null;

      const { data: sale, error } = await supabase.from("sales").insert({
        company_id: companyId, reference, customer_id: customerId || null, user_id: user.id,
        subtotal, discount: discountVal, tax_amount: taxAmount, total,
        amount_paid: amountPaidRecorded,
        payment_method: principalMethod,
        status: amountPaidRecorded >= total ? "paid" : "pending",
        notes: breakdownNote,
      }).select().single();
      if (error) throw error;

      const items = cart.map((it) => ({
        sale_id: sale.id, product_id: it.product_id, product_name: it.name,
        quantity: it.quantity, unit_price: it.unit_price, total: it.quantity * it.unit_price,
      }));
      const { error: e2 } = await supabase.from("sale_items").insert(items);
      if (e2) throw e2;

      const customer = customers.find((c: any) => c.id === customerId);
      const invoiceData = {
        reference: sale.reference, created_at: sale.created_at,
        customer_name: customer?.name, customer_phone: customer?.phone,
        items: items.map((i) => ({ product_name: i.product_name, quantity: i.quantity, unit_price: i.unit_price, total: i.total })),
        subtotal, discount: discountVal, tax_amount: taxAmount, total,
        amount_paid: amountPaidRecorded, payment_method: principalMethod,
        payments: validPayments,
        change_due: changeDue,
      };

      if (autoTicket && currentCompany) {
        printThermalTicket(currentCompany, invoiceData);
      }

      toast.success(`Vente ${reference} enregistrée`, {
        description: changeDue > 0 ? `Rendu monnaie : ${formatXOF(changeDue)}` : undefined,
        action: currentCompany ? {
          label: "Facture A4",
          onClick: () => generateInvoicePDF(currentCompany, invoiceData),
        } : undefined,
      });
      clearCart();
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_440px] gap-4 h-[calc(100vh-7rem)]">
      {/* Produits */}
      <div className="flex flex-col min-w-0">
        {/* Header stats */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 px-3 py-1.5">
              <span className="text-xs text-muted-foreground">Aujourd'hui</span>
              <span className="ml-2 font-semibold text-primary">{todayStats?.count ?? 0} ventes</span>
              <span className="ml-2 font-bold">{formatXOF(todayStats?.total ?? 0)}</span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground hidden md:block">
            <kbd className="rounded border px-1.5 py-0.5 text-[10px]">F2</kbd> Recherche &nbsp;
            <kbd className="rounded border px-1.5 py-0.5 text-[10px]">F4</kbd> Montant exact &nbsp;
            <kbd className="rounded border px-1.5 py-0.5 text-[10px]">F9</kbd> Valider
          </div>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input ref={searchRef} placeholder="Rechercher / scanner code-barres..." className="pl-10 h-11" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
        </div>

        {/* Filtres catégorie */}
        {categories.length > 0 && (
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
            <Button variant={categoryFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setCategoryFilter("all")}>Tous</Button>
            {categories.map((c: any) => (
              <Button key={c.id} variant={categoryFilter === c.id ? "default" : "outline"} size="sm" onClick={() => setCategoryFilter(c.id)} className="whitespace-nowrap">{c.name}</Button>
            ))}
          </div>
        )}

        <ScrollArea className="flex-1 rounded-xl border border-border bg-card">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 p-4">
            {filtered.map((p) => {
              const out = Number(p.stock_quantity) <= 0;
              return (
                <button key={p.id} disabled={out} onClick={() => addToCart(p)} className="text-left rounded-lg border border-border p-3 hover:border-primary hover:shadow-elegant transition-all bg-background disabled:opacity-50 disabled:cursor-not-allowed">
                  <div className="font-medium text-sm line-clamp-2 min-h-[2.5rem]">{p.name}</div>
                  <div className="mt-2 flex justify-between items-end">
                    <span className="text-primary font-bold">{formatXOF(p.sale_price)}</span>
                    <Badge variant={out ? "destructive" : Number(p.stock_quantity) < 5 ? "secondary" : "outline"} className="text-[10px]">
                      {out ? "Rupture" : `${p.stock_quantity}`}
                    </Badge>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && <p className="col-span-full text-center py-8 text-muted-foreground text-sm">Aucun produit</p>}
          </div>
        </ScrollArea>
      </div>

      {/* Panier */}
      <div className="flex flex-col rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-3 border-b border-border bg-secondary flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Panier ({cart.length})</h3>
          </div>
          {cart.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearCart} className="h-7 text-xs">Vider</Button>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {cart.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingCart className="mx-auto h-10 w-10 opacity-30 mb-2" />
                <p className="text-sm">Panier vide</p>
                <p className="text-xs mt-1">Cliquez ou scannez un produit</p>
              </div>
            ) : cart.map((it) => (
              <div key={it.product_id} className="rounded-md border border-border p-2 bg-background">
                <div className="flex justify-between gap-2">
                  <span className="text-sm font-medium flex-1 line-clamp-1">{it.name}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeItem(it.product_id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQty(it.product_id, -1)}><Minus className="h-3 w-3" /></Button>
                    <span className="w-8 text-center text-sm font-medium">{it.quantity}</span>
                    <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQty(it.product_id, 1)}><Plus className="h-3 w-3" /></Button>
                  </div>
                  <span className="text-sm font-semibold">{formatXOF(it.quantity * it.unit_price)}</span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="border-t border-border p-3 space-y-3 bg-card">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Client</Label>
              <Select value={customerId || "none"} onValueChange={(v) => setCustomerId(v === "none" ? "" : v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Comptoir —</SelectItem>
                  {customers.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Remise (FCFA)</Label>
              <Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} className="h-9" />
            </div>
          </div>

          <label className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2">
              <input type="checkbox" checked={applyTax} onChange={(e) => setApplyTax(e.target.checked)} className="rounded" />
              TVA {currentCompany?.tax_rate}%
            </span>
            <span className="flex items-center gap-2">
              <input type="checkbox" checked={autoTicket} onChange={(e) => setAutoTicket(e.target.checked)} className="rounded" />
              <Printer className="h-3 w-3" /> Ticket auto
            </span>
          </label>

          {/* Totaux */}
          <div className="space-y-1 pt-2 border-t border-border text-sm">
            <div className="flex justify-between text-muted-foreground"><span>Sous-total</span><span>{formatXOF(subtotal)}</span></div>
            {discountVal > 0 && <div className="flex justify-between text-muted-foreground"><span>Remise</span><span>-{formatXOF(discountVal)}</span></div>}
            {applyTax && <div className="flex justify-between text-muted-foreground"><span>TVA</span><span>{formatXOF(taxAmount)}</span></div>}
            <div className="flex justify-between font-bold text-lg pt-1"><span>TOTAL</span><span className="text-primary">{formatXOF(total)}</span></div>
          </div>

          {/* Paiements multi */}
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Paiements</Label>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={fillExact}>Exact</Button>
                <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={addPaymentLine}>+ Ligne</Button>
              </div>
            </div>
            {payments.map((p, i) => {
              const meta = METHOD_META[p.method as Method];
              const Icon = meta?.icon ?? Banknote;
              return (
                <div key={i} className="flex gap-1.5 items-center">
                  <Select value={p.method} onValueChange={(v) => setPaymentMethod(i, v as Method)}>
                    <SelectTrigger className="h-8 w-[140px]">
                      <div className="flex items-center gap-1.5"><Icon className={`h-3.5 w-3.5 ${meta?.color}`} /><SelectValue /></div>
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(METHOD_META) as Method[]).map((m) => (
                        <SelectItem key={m} value={m}>{METHOD_META[m].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input type="number" value={p.amount || ""} onChange={(e) => setPaymentAmount(i, parseFloat(e.target.value) || 0)} className="h-8 flex-1" placeholder="0" />
                  {payments.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removePaymentLine(i)}><Trash2 className="h-3 w-3" /></Button>
                  )}
                </div>
              );
            })}
            <div className="flex justify-between text-xs pt-1">
              <span className="text-muted-foreground">Total payé</span>
              <span className="font-medium">{formatXOF(totalPaid)}</span>
            </div>
            {remainingToPay > 0 && !hasCredit && (
              <div className="flex justify-between text-xs text-destructive font-medium">
                <span>Reste à payer</span><span>{formatXOF(remainingToPay)}</span>
              </div>
            )}
            {changeDue > 0 && (
              <div className="flex justify-between text-sm font-bold text-emerald-600 bg-emerald-500/10 rounded-md px-2 py-1.5">
                <span>Rendu monnaie</span><span>{formatXOF(changeDue)}</span>
              </div>
            )}
            {hasCredit && creditAmount > 0 && (
              <div className="flex justify-between text-xs text-amber-600">
                <span>Crédit client</span><span>{formatXOF(creditAmount)}</span>
              </div>
            )}
          </div>

          <Button onClick={checkout} disabled={cart.length === 0 || submitting} className="w-full h-12 text-base gradient-primary">
            <Receipt className="h-5 w-5" />
            {submitting ? "Validation..." : `Encaisser ${formatXOF(total)}`}
            <kbd className="ml-2 rounded bg-primary-foreground/10 px-1.5 py-0.5 text-[10px]">F9</kbd>
          </Button>
          {cart.length > 0 && currentCompany && (
            <Button variant="outline" size="sm" className="w-full" onClick={() => {
              const customer = customers.find((c: any) => c.id === customerId);
              generateInvoicePDF(currentCompany, {
                reference: "BROUILLON",
                created_at: new Date().toISOString(),
                customer_name: customer?.name, customer_phone: customer?.phone,
                items: cart.map((it) => ({ product_name: it.name, quantity: it.quantity, unit_price: it.unit_price, total: it.quantity * it.unit_price })),
                subtotal, discount: discountVal, tax_amount: taxAmount, total,
                amount_paid: 0, payment_method: payments[0]?.method ?? "cash",
              });
            }}>
              <FileDown className="h-4 w-4" /> Aperçu facture A4
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
