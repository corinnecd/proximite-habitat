"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, Loader2, ArrowLeft, Mail, CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const origin = window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password`,
    });
    if (error) { setError(error.message); } else { setSent(true); }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Panneau gauche : hero brand ───────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[55%] hero-surface animate-hero-entry flex-col justify-between px-16 py-14">
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
            Un mot de passe,<br />
            <span className="text-[#F97316]">et on repart.</span>
          </h1>
          <p className="text-white/60 text-base leading-relaxed max-w-md">
            Nous vous envoyons un lien sécurisé pour choisir un nouveau mot de passe.
            Vérifiez votre boîte mail — parfois le dossier spam.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3 pt-8 border-t border-white/10">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <p className="text-sm text-white/70">Lien valide 1 heure · Session chiffrée</p>
        </div>
      </div>

      {/* ── Panneau droit : formulaire ──────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-[420px]">
          <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
            <div className="w-11 h-11 bg-[#1B2659] rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <p className="text-base font-medium text-foreground">Proximité Habitat</p>
              <p className="text-[11px] tracking-[2px] uppercase text-muted-foreground">Conseil</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="font-heading text-4xl text-foreground mb-2 tracking-tight">Mot de passe oublié</h2>
            <p className="text-sm text-muted-foreground">
              {sent
                ? "Vérifiez votre boîte mail — nous vous avons envoyé un lien."
                : "Renseignez votre email pour recevoir un lien de réinitialisation."}
            </p>
          </div>

          {sent ? (
            <div className="text-center py-6 space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="font-medium text-foreground text-base">Email envoyé</p>
                <p className="text-sm text-muted-foreground mt-1.5">
                  Lien envoyé à <span className="font-medium text-foreground">{email}</span>.<br />
                  Pensez à vérifier vos spams.
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full rounded-xl h-12"
                onClick={() => { setSent(false); setEmail(""); }}
              >
                Renvoyer un lien
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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

              {error && (
                <div className="flex items-start gap-2 text-sm text-destructive bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 p-3 rounded-xl">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-[#F97316] hover:bg-[#EA580C] text-white font-medium rounded-xl gap-2"
              >
                {loading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <>Envoyer le lien<Mail className="w-4 h-4" /></>}
              </Button>
            </form>
          )}

          <div className="mt-8 text-center">
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />Retour à la connexion
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
