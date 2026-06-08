"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Loader2, ArrowLeft, Mail, CheckCircle2, AlertCircle } from "lucide-react";

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

      {/* ── Panneau gauche — identique à la page login ───────────────────── */}
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

      {/* ── Panneau droit ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">

          {/* Logo mobile uniquement */}
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
            <h2 className="font-heading text-3xl text-foreground mb-2">Mot de passe oublié</h2>
            <p className="text-muted-foreground">
              {sent
                ? "Vérifiez votre boîte mail."
                : "Renseignez votre email pour recevoir un lien de réinitialisation."}
            </p>
          </div>

          <Card className="border-0 shadow-lg">
            <CardContent className="pt-6">
              {sent ? (
                <div className="text-center py-6 space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Email envoyé !</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Un lien de réinitialisation a été envoyé à{" "}
                      <span className="font-medium text-foreground">{email}</span>.
                      Pensez à vérifier vos spams.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full rounded-xl h-11"
                    onClick={() => { setSent(false); setEmail(""); }}
                  >
                    Renvoyer un lien
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email">Adresse email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="votre@email.fr"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="h-12 bg-card pl-10"
                      />
                    </div>
                  </div>
                  {error && (
                    <div className="flex items-start gap-2 text-sm text-destructive bg-red-50 dark:bg-red-950/30 p-3 rounded-xl">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      {error}
                    </div>
                  )}
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 bg-[#F97316] hover:bg-[#EA580C] text-white font-medium text-base rounded-xl"
                  >
                    {loading
                      ? <Loader2 className="w-5 h-5 animate-spin" />
                      : <><Mail className="w-4 h-4 mr-2" />Envoyer le lien</>}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          <div className="mt-6 text-center">
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
