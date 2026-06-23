"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Loader2, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-[#1E3A5F] relative overflow-hidden flex-col justify-center px-16">
        {/* Quadrillage de points blancs — CSS pur, 0 JS */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,.18) 1.5px, transparent 1.5px)",
            backgroundSize: "24px 24px",
          }}
        />
        {/* Rectangle orange bas-droite — ombre portée */}
        <div className="absolute -bottom-10 -right-10 w-64 h-64 rounded-3xl bg-[#F97316]/20 rotate-12 pointer-events-none shadow-[0_8px_40px_rgba(249,115,22,0.25)]" />
        {/* Petit carré orange décalé */}
        <div className="absolute bottom-20 right-24 w-28 h-28 rounded-2xl bg-[#F97316]/30 rotate-6 pointer-events-none shadow-[0_4px_20px_rgba(249,115,22,0.3)]" />

        {/* Brand en haut */}
        <div className="absolute top-12 left-16 flex items-center gap-3 z-10">
          <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <Building2 className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <p className="text-white font-semibold text-base leading-tight">Proximité Habitat</p>
            <p className="text-white/50 text-xs">Conseil</p>
          </div>
        </div>

        {/* Contenu principal centré */}
        <div className="relative z-10">
          <h1 className="font-heading text-[62px] leading-[1.08] text-white mb-6">
            Votre rénovation<br />
            <em className="not-italic text-[#F97316]">clé en main</em>
          </h1>
          <p className="text-white/60 text-lg leading-relaxed max-w-sm mb-14">
            Gérez vos pré-visites, suivez vos fiches et pilotez votre activité
            de rénovation énergétique en toute simplicité.
          </p>
          <div className="flex gap-0">
            <div className="pr-8 border-r border-white/15">
              <p className="text-3xl font-bold text-[#F97316]">500+</p>
              <p className="text-sm text-white/40 mt-1">Fiches traitées</p>
            </div>
            <div className="px-8 border-r border-white/15">
              <p className="text-3xl font-bold text-[#F97316]">98%</p>
              <p className="text-sm text-white/40 mt-1">Satisfaction</p>
            </div>
            <div className="pl-8">
              <p className="text-3xl font-bold text-[#F97316]">30+</p>
              <p className="text-sm text-white/40 mt-1">Experts</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-primary">Proximité Habitat</h2>
              <p className="text-xs text-muted-foreground">Conseil</p>
            </div>
          </div>
          <div className="mb-8">
            <h2 className="font-heading text-3xl text-foreground mb-2">Connexion</h2>
            <p className="text-muted-foreground">Accédez à votre espace de gestion</p>
          </div>
          <Card className="border-0 shadow-lg">
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email">Adresse email</Label>
                  <Input id="email" type="email" placeholder="votre@email.fr" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-12 bg-card" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe</Label>
                  <div className="relative">
                    <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-12 bg-card pr-12" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                {error && <p className="text-sm text-destructive bg-red-50 dark:bg-red-950/30 p-3 rounded-lg">{error}</p>}
                <Button type="submit" disabled={loading} className="w-full h-12 bg-[#F97316] hover:bg-[#EA580C] text-white font-medium text-base rounded-xl transition-all duration-200">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Se connecter"}
                </Button>
              </form>
            </CardContent>
          </Card>
          <div className="mt-6 text-center space-y-2">
            <Link href="/forgot-password" className="text-sm text-muted-foreground hover:text-foreground transition-colors block">
              Mot de passe oublié ?
            </Link>
            <p className="text-xs text-muted-foreground">Contactez votre direction pour obtenir vos identifiants</p>
          </div>
        </div>
      </div>
    </div>
  );
}
