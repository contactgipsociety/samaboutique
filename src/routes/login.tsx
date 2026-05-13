import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Building2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({ mode: (s.mode as string) === "signup" ? "signup" : "login" }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { mode } = Route.useSearch();
  const [isSignup, setIsSignup] = useState(mode === "signup");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin + "/onboarding" },
        });
        if (error) throw error;
        toast.success("Compte créé !");
        navigate({ to: "/onboarding" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Connecté");
        navigate({ to: "/dashboard" });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="h-10 w-10 rounded-md gradient-primary flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold">GestCom</span>
        </Link>
        <div className="rounded-xl border border-border bg-card p-8 shadow-elegant">
          <h1 className="text-2xl font-semibold">{isSignup ? "Créer un compte" : "Connexion"}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isSignup ? "Rejoignez GestCom en quelques secondes." : "Bon retour parmi nous !"}
          </p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            {isSignup && (
              <div>
                <Label htmlFor="name">Nom complet</Label>
                <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="pwd">Mot de passe</Label>
              <Input id="pwd" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Patientez..." : isSignup ? "Créer mon compte" : "Se connecter"}
            </Button>
          </form>
          <button onClick={() => setIsSignup(!isSignup)} className="mt-4 w-full text-sm text-muted-foreground hover:text-primary">
            {isSignup ? "Déjà un compte ? Se connecter" : "Pas de compte ? Créer un compte"}
          </button>
        </div>
      </div>
    </div>
  );
}
