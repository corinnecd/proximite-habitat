"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Loader2, Eye, EyeOff, CheckCircle2, AlertCircle, Shield, Lock } from "lucide-react";
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

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const supabase = createClient();

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
    toast.success("Mot de passe mis à jour avec succès !");
    router.push("/");
    setLoading(false);
  }

  const pwdStrength = passwordStrength(password);
  const passwordsMatch = confirm.length > 0 && password === confirm;
  const passwordsMismatch = confirm.length > 0 && password !== confirm;

  // ── Vérification du lien ──────────────────────────────────────────────────
  if (!ready) {
    return (
      <div className="min-h-screen flex">
        <div className="hidden lg:flex lg:w-1/2 bg-[#1E3A5F] relative overflow-hidden">
          <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full border-[70px] border-[#F97316]/20 pointer-events-none" />
          <div className="absolute top-16 right-16 w-56 h-56 rounded-full border-[35px] border-[#FB923C]/25 pointer-events-none" />
          <div className="absolute top-12 left-16 flex items-center gap-3 z-10">
            <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Building2 className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-base">Proximité Habitat</p>
              <p className="text-white/50 text-xs">Conseil</p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center bg-background">
          <div className="text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">Vérification du lien en cours…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Panneau gauche ─────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#1E3A5F] relative overflow-hidden flex-col justify-end pb-16 px-16">
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full border-[70px] border-[#F97316]/20 pointer-events-none" />
        <div className="absolute top-16 right-16 w-56 h-56 rounded-full border-[35px] border-[#FB923C]/25 pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#F97316] via-[#FB923C] to-transparent pointer-events-none" />

        <div className="absolute top-12 left-16 flex items-center gap-3 z-10">
          <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <Building2 className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <p className="text-white font-semibold text-base leading-tight">Proximité Habitat</p>
            <p className="text-white/50 text-xs">Conseil</p>
          </div>
        </div>

        <div className="relative z-10">
          <h1 className="font-heading text-[52px] leading-[1.1] text-white mb-5">
            Votre rénovation<br />
            <em className="not-italic text-[#FB923C]">clé en main</em>
          </h1>
          <p className="text-white/60 text-base leading-relaxed max-w-sm mb-12">
            Gérez vos pré-visites, suivez vos fiches et pilotez votre activité
            de rénovation énergétique en toute simplicité.
          </p>
          <div className="flex gap-0">
            <div className="pr-7 border-r border-white/15">
              <p className="text-2xl font-bold text-[#FB923C]">500+</p>
              <p className="text-xs text-white/40 mt-1">Fiches traitées</p>
            </div>
            <div className="px-7 border-r border-white/15">
              <p className="text-2xl font-bold text-[#FB923C]">98%</p>
              <p className="text-xs text-white/40 mt-1">Satisfaction</p>
            </div>
            <div className="pl-7">
              <p className="text-2xl font-bold text-[#FB923C]">30+</p>
              <p className="text-xs text-white/40 mt-1">Experts</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Panneau droit ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">

          {/* Logo mobile */}
          <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <p className="text-lg font-semibold text-primary">Proximité Habitat</p>
              <p className="text-xs text-muted-foreground">Conseil</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="font-heading text-3xl text-foreground mb-2">Nouveau mot de passe</h2>
            <p className="text-muted-foreground">Choisissez un mot de passe sécurisé.</p>
          </div>

          <Card className="border-0 shadow-lg">
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-5">

                {/* Nouveau mot de passe */}
                <div className="space-y-2">
                  <Label>Nouveau mot de passe</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      className="h-12 bg-card pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Masquer" : "Afficher"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {/* Jauge de force */}
                  {password.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= pwdStrength.score ? pwdStrength.color : "bg-muted"}`}
                          />
                        ))}
                      </div>
                      <p className={`text-xs font-medium ${pwdStrength.score >= 4 ? "text-emerald-600" : pwdStrength.score >= 3 ? "text-yellow-600" : pwdStrength.score >= 2 ? "text-orange-500" : "text-red-500"}`}>
                        {pwdStrength.label}
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirmation */}
                <div className="space-y-2">
                  <Label>Confirmer le mot de passe</Label>
                  <div className="relative">
                    <Input
                      type={showConfirm ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      className={`h-12 bg-card pr-12 transition-colors ${passwordsMismatch ? "border-red-400" : passwordsMatch ? "border-emerald-400" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      aria-label={showConfirm ? "Masquer" : "Afficher"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {passwordsMatch && (
                    <p className="text-xs text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />Les mots de passe correspondent
                    </p>
                  )}
                  {passwordsMismatch && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />Les mots de passe ne correspondent pas
                    </p>
                  )}
                </div>

                {/* Note sécurité */}
                <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-xl">
                  <Shield className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    8 caractères minimum. Combinez majuscules, chiffres et symboles pour plus de sécurité.
                  </p>
                </div>

                {error && (
                  <div className="flex items-start gap-2 text-sm text-destructive bg-red-50 dark:bg-red-950/30 p-3 rounded-xl">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading || passwordsMismatch}
                  className="w-full h-12 bg-[#F97316] hover:bg-[#EA580C] text-white font-medium text-base rounded-xl gap-2"
                >
                  {loading
                    ? <Loader2 className="w-5 h-5 animate-spin" />
                    : <><Lock className="w-4 h-4" />Enregistrer le mot de passe</>}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
