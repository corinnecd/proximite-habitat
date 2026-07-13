"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, Loader2, Eye, EyeOff, CheckCircle2, AlertCircle, Shield, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

function passwordStrength(pwd: string): { score: number; label: string; color: string } {
  if (!pwd) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { score, label: "Faible", color: "bg-red-500" };
  if (score <= 2) return { score, label: "Moyen", color: "bg-orange-400" };
  if (score <= 3) return { score, label: "Bon", color: "bg-yellow-400" };
  return { score, label: "Excellent", color: "bg-emerald-500" };
}

function BrandPanel({ title }: { title: React.ReactNode }) {
  return (
    <div className="hidden lg:flex lg:w-[55%] hero-surface flex-col justify-between px-16 py-14">
      <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full border-[24px] border-emerald-400/10 pointer-events-none" />

      <div className="relative flex items-center gap-3 z-10">
        <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm">
          <Building2 className="w-6 h-6 text-orange-400" />
        </div>
        <div>
          <p className="text-white font-medium text-sm tracking-wide">Proximité Habitat</p>
          <p className="text-white/50 text-[11px] tracking-[2px] uppercase">Conseil</p>
        </div>
      </div>

      <div className="relative z-10">
        <h1 className="font-heading text-[56px] leading-[1.05] text-white mb-6 tracking-tight">
          {title}
        </h1>
        <p className="text-white/60 text-base leading-relaxed max-w-md">
          Choisissez un mot de passe solide. Nous ne le stockons jamais en clair —
          seul un hash chiffré est conservé.
        </p>
      </div>

      <div className="relative z-10 flex items-center gap-3 pt-8 border-t border-white/10">
        <ShieldCheck className="w-5 h-5 text-emerald-400" />
        <p className="text-sm text-white/70">Chiffrement bcrypt · Aucune donnée en clair</p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Le mot de passe doit contenir au moins 8 caractères"); return; }
    if (password !== confirm) { setError("Les mots de passe ne correspondent pas"); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setError(error.message); setLoading(false); return; }
    toast.success("Mot de passe mis à jour");
    router.push("/");
    setLoading(false);
  }

  const pwdStrength = passwordStrength(password);
  const passwordsMatch = confirm.length > 0 && password === confirm;
  const passwordsMismatch = confirm.length > 0 && password !== confirm;

  if (!ready) {
    return (
      <div className="min-h-screen flex">
        <BrandPanel title={<>Vérification<br /><span className="text-[#F97316]">de votre lien…</span></>} />
        <div className="flex-1 flex items-center justify-center bg-background">
          <div className="text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#F97316]" />
            <p className="text-sm text-muted-foreground">Vérification du lien en cours…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <BrandPanel title={<>Un nouveau<br /><span className="text-[#F97316]">départ.</span></>} />

      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-[420px]">
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
            <h2 className="font-heading text-4xl text-foreground mb-2 tracking-tight">Nouveau mot de passe</h2>
            <p className="text-sm text-muted-foreground">Choisissez un mot de passe sécurisé.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase mb-2">Nouveau mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="h-12 pl-11 pr-11 rounded-xl bg-card border-border"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Masquer" : "Afficher"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="space-y-1.5 mt-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= pwdStrength.score ? pwdStrength.color : "bg-muted"}`}
                      />
                    ))}
                  </div>
                  <p className={`text-[11px] font-medium ${pwdStrength.score >= 4 ? "text-emerald-600" : pwdStrength.score >= 3 ? "text-yellow-600" : pwdStrength.score >= 2 ? "text-orange-500" : "text-red-500"}`}>
                    Force du mot de passe : {pwdStrength.label}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase mb-2">Confirmer</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  type={showConfirm ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  className={`h-12 pl-11 pr-11 rounded-xl bg-card transition-colors ${passwordsMismatch ? "border-red-400" : passwordsMatch ? "border-emerald-400" : "border-border"}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  aria-label={showConfirm ? "Masquer" : "Afficher"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordsMatch && (
                <p className="text-[11px] text-emerald-600 flex items-center gap-1 mt-1.5">
                  <CheckCircle2 className="w-3 h-3" />Les mots de passe correspondent
                </p>
              )}
              {passwordsMismatch && (
                <p className="text-[11px] text-red-500 flex items-center gap-1 mt-1.5">
                  <AlertCircle className="w-3 h-3" />Les mots de passe ne correspondent pas
                </p>
              )}
            </div>

            <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-xl">
              <Shield className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                8 caractères minimum. Combinez majuscules, chiffres et symboles pour plus de sécurité.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 p-3 rounded-xl">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || passwordsMismatch}
              className="w-full h-12 bg-[#F97316] hover:bg-[#EA580C] text-white font-medium rounded-xl gap-2"
            >
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <><Lock className="w-4 h-4" />Enregistrer le mot de passe</>}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
