"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, Loader2, Eye, EyeOff, Mail, Lock, ArrowRight, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    if (searchParams.get("error") === "account_disabled") {
      setError("Votre compte a été désactivé. Contactez votre direction.");
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("invalid login credentials") || msg.includes("invalid email or password") || msg.includes("email not confirmed")) {
        setError("Email ou mot de passe incorrect. Vérifiez vos identifiants.");
      } else if (msg.includes("too many requests") || msg.includes("rate limit")) {
        setError("Trop de tentatives. Veuillez patienter quelques minutes avant de réessayer.");
      } else if (msg.includes("user not found")) {
        setError("Aucun compte trouvé avec cet email.");
      } else {
        setError("Une erreur est survenue. Veuillez réessayer.");
      }
      setLoading(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Panneau gauche : hero brand immersif ─────────────────────────── */}
      <div className="hidden lg:flex lg:w-[55%] hero-surface flex-col justify-between px-16 py-14">
        {/* Cercles décoratifs additionnels */}
        <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full border-[24px] border-emerald-400/10 pointer-events-none" />

        {/* Brand */}
        <div className="relative flex items-center gap-3 z-10">
          <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <Building2 className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <p className="text-white font-medium text-sm tracking-wide">Proximité Habitat</p>
            <p className="text-white/50 text-[11px] tracking-[2px] uppercase">Conseil</p>
          </div>
        </div>

        {/* Éditorial central */}
        <div className="relative z-10">
          <h1 className="font-heading text-[64px] leading-[1.05] text-white mb-6 tracking-tight">
            La rénovation<br />
            énergétique,<br />
            <span className="text-[#F97316]">simplifiée.</span>
          </h1>
          <p className="text-white/60 text-base leading-relaxed max-w-md">
            Une plateforme unique pour piloter vos fiches de pré-visite,
            du référent au commercial jusqu&apos;à la signature.
          </p>
        </div>

        {/* Chiffres */}
        <div className="relative z-10 grid grid-cols-3 gap-6 pt-8 border-t border-white/10">
          <div>
            <p className="font-heading text-4xl text-white leading-none">3</p>
            <p className="text-[11px] text-white/50 tracking-[1.2px] uppercase mt-2">Succursales</p>
          </div>
          <div>
            <p className="font-heading text-4xl text-white leading-none">47</p>
            <p className="text-[11px] text-white/50 tracking-[1.2px] uppercase mt-2">Collaborateurs</p>
          </div>
          <div>
            <p className="font-heading text-4xl text-white leading-none">276<span className="text-2xl">K€</span></p>
            <p className="text-[11px] text-white/50 tracking-[1.2px] uppercase mt-2">CA trimestre</p>
          </div>
        </div>
      </div>

      {/* ── Panneau droit : formulaire ──────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-[420px]">
          {/* Brand mobile */}
          <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
            <div className="w-11 h-11 bg-[#0F1E3D] rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <p className="text-base font-medium text-foreground">Proximité Habitat</p>
              <p className="text-[11px] tracking-[2px] uppercase text-muted-foreground">Conseil</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="font-heading text-4xl text-foreground mb-2 tracking-tight">Bon retour</h2>
            <p className="text-sm text-muted-foreground">Connectez-vous pour accéder à votre tableau de bord.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email avec icône intégrée */}
            <div>
              <label htmlFor="email" className="block text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="email"
                  type="email"
                  placeholder="votre@email.fr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 pl-11 rounded-xl bg-card border-border"
                />
              </div>
            </div>

            {/* Password avec icône + reset link */}
            <div>
              <div className="flex justify-between items-baseline mb-2">
                <label htmlFor="password" className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">Mot de passe</label>
                <Link href="/forgot-password" className="text-[11px] font-medium text-[#F97316] hover:text-[#EA580C] transition-colors">
                  Oublié&nbsp;?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 pl-11 pr-11 rounded-xl bg-card border-border"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm text-destructive bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 p-3 rounded-xl">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-[#F97316] hover:bg-[#EA580C] text-white font-medium rounded-xl transition-all duration-200 gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>Se connecter <ArrowRight className="w-4 h-4" /></>
              )}
            </Button>

            {/* Bandeau sécurité rassurant */}
            <div className="flex items-center gap-2 mt-6 px-3 py-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 rounded-xl">
              <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-300 flex-shrink-0" />
              <p className="text-[11px] text-emerald-800 dark:text-emerald-200">
                Connexion sécurisée · Vos données restent en France
              </p>
            </div>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-8">
            Pas de compte&nbsp;? <span className="text-foreground/70">Contactez votre direction</span>
          </p>
        </div>
      </div>
    </div>
  );
}
