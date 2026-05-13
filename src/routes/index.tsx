import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  ScanBarcode, Package, Users, BarChart3, Shield, Smartphone, CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b border-border">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-md gradient-primary" />
            <span className="text-xl font-bold">GestCom</span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost"><Link to="/login">Connexion</Link></Button>
            <Button asChild><Link to="/login" search={{ mode: "signup" }}>Démarrer gratuitement</Link></Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="inline-block rounded-full bg-accent px-4 py-1 text-xs font-medium text-accent-foreground mb-6">
          Conçu pour les PME sénégalaises 🇸🇳
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight max-w-4xl mx-auto">
          La gestion commerciale <span className="text-primary">simple et puissante</span> pour votre entreprise.
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
          Ventes, stock, caisse, clients, fournisseurs et comptabilité SYSCOHADA — le tout en un.
          Compatible Wave, Orange Money, Free Money.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg"><Link to="/login" search={{ mode: "signup" }}>Créer mon compte</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/login">Se connecter</Link></Button>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16 grid md:grid-cols-3 gap-6">
        {[
          { icon: ScanBarcode, title: "Caisse moderne (POS)", desc: "Ventes rapides, factures PDF, ticket thermique, multi-paiements." },
          { icon: Package, title: "Stock & Produits", desc: "Codes-barres, alertes stock faible, mise à jour automatique." },
          { icon: Users, title: "Clients & Fournisseurs", desc: "Fiches complètes, historique, crédit client, dettes fournisseurs." },
          { icon: BarChart3, title: "Tableau de bord", desc: "Chiffre d'affaires, top produits, rapports en temps réel." },
          { icon: Shield, title: "Multi-entreprises sécurisé", desc: "Données isolées par entreprise, gestion des rôles." },
          { icon: Smartphone, title: "Mobile, tablette, desktop", desc: "Interface responsive, utilisable partout." },
        ].map((f) => (
          <div key={f.title} className="rounded-xl border border-border bg-card p-6 hover:shadow-elegant transition-shadow">
            <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center mb-4">
              <f.icon className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold text-lg">{f.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-20">
        <div className="rounded-2xl gradient-primary p-12 text-center text-primary-foreground shadow-elegant">
          <h2 className="text-3xl md:text-4xl font-bold">Prêt à digitaliser votre commerce ?</h2>
          <p className="mt-3 opacity-90">Créez votre compte en 2 minutes. Sans carte bancaire.</p>
          <Button asChild size="lg" variant="secondary" className="mt-6">
            <Link to="/login" search={{ mode: "signup" }}>Commencer maintenant</Link>
          </Button>
          <ul className="mt-8 flex flex-wrap justify-center gap-6 text-sm">
            {["Conforme SYSCOHADA", "Wave, OM, Free Money", "Multi-utilisateurs", "Données sécurisées"].map((x) => (
              <li key={x} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> {x}</li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} GestCom — Made in Sénégal
      </footer>
    </div>
  );
}
