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
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1E3A5F] via-[#2A4A6F] to-[#1E3A5F]" />
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Building2 className="w-7 h-7 text-orange-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Proximité Habitat</h2>
              <p className="text-sm text-white/60">Conseil</p>
            </div>
          </div>
          <h1 className="font-heading text-5xl leading-tight mb-6">
            Votre rénovation<br />
            <span className="text-orange-400">clé en main</span>
          </h1>
          <p className="text-lg text-white/70 max-w-md leading-relaxed">
            Gérez vos pré-visites, suivez vos fiches et pilotez votre activité
            de rénovation énergétique en toute simplicité.
          </p>
          <div className="mt-16 flex gap-8">
            <div><p className="text-3xl font-bold text-orange-400">500+</p><p className="text-sm text-white/50">Fiches traitées</p></div>
            <div><p className="text-3xl font-bold text-orange-400">98%</p><p className="text-sm text-white/50">Satisfaction</p></div>
            <div><p className="text-3xl font-bold text-orange-400">30+</p><p className="text-sm text-white/50">Experts</p></div>
          </div>
        </div>
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full border border-white/5" />
        <div className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full border border-white/10" />
        <div className="absolute top-16 -right-8 w-32 h-32 rounded-full bg-orange-400/10" />
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-[#FAF9F6]">
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
                  <Input id="email" type="email" placeholder="votre@email.fr" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-12 bg-white" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe</Label>
                  <div className="relative">
                    <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-12 bg-white pr-12" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                {error && <p className="text-sm text-destructive bg-red-50 p-3 rounded-lg">{error}</p>}
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
            <p className="text-xs text-muted-foreground">Contactez votre administrateur pour obtenir vos identifiants</p>
          </div>
        </div>
      </div>
    </div>
  );
}
