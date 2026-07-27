"use client";

import { useState, useEffect, useLayoutEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Topbar } from "@/components/layout/Topbar";
import { ExportPdfButton } from "@/components/ui/export-pdf-button";
import { ExportCsvButton } from "@/components/ui/export-csv-button";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/use-profile";
import { ROLE_LABELS } from "@/lib/permissions";
import { toast } from "sonner";
import {
  User, Lock, Loader2, Eye, EyeOff, Mail, Phone,
  CheckCircle2, AlertCircle, Shield, Clock, Bell, BellOff,
} from "lucide-react";
import { usePushSubscription } from "@/lib/hooks/use-push-subscription";

// ── Palette rôle ─────────────────────────────────────────────────────────────


// ── Indicateur de force du mot de passe ──────────────────────────────────────

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

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilPage() {
  const { profile, loading } = useProfile();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [lastLogin, setLastLogin] = useState<string | null>(null);
  const { status: pushStatus, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = usePushSubscription(profile?.id ?? null);

  const supabase = useMemo(() => createClient(), []);

  useLayoutEffect(() => {
    try {
      const raw = localStorage.getItem("ph_profile_v1");
      if (!raw) return;
      const cached = JSON.parse(raw);
      if (cached.first_name) setFirstName(cached.first_name);
      if (cached.last_name) setLastName(cached.last_name);
      if (cached.phone) setPhone(cached.phone);
    } catch {}
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const signIn = data.session?.user?.last_sign_in_at;
      if (signIn) setLastLogin(signIn);
    });
  }, []);

  useEffect(() => {
    if (profile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFirstName(profile.first_name);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLastName(profile.last_name);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhone(profile.phone || "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({ first_name: firstName.trim(), last_name: lastName.trim(), phone: phone.trim() || null })
      .eq("id", profile.id);
    if (error) {
      toast.error("Erreur : " + error.message);
    } else {
      toast.success("Profil mis à jour");
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    }
    setSavingProfile(false);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) { toast.error("8 caractères minimum"); return; }
    if (newPassword !== confirmPassword) { toast.error("Les mots de passe ne correspondent pas"); return; }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error("Erreur : " + error.message);
    } else {
      toast.success("Mot de passe modifié avec succès");
      setNewPassword("");
      setConfirmPassword("");
    }
    setSavingPassword(false);
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  const isProspecteur = profile?.role === "PROSPECTEUR";
  const initials = profile ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase() : "";
  const pwdStrength = passwordStrength(newPassword);
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  return (
    <>
      <Topbar title="Mon profil" actions={!isProspecteur && profile ? <div className="flex items-center gap-2"><ExportPdfButton title="Mon profil" filename="profil" /><ExportCsvButton filename="profil" getData={() => ({
          columns: [
            { key: "champ", label: "Champ" },
            { key: "valeur", label: "Valeur" },
          ] as { key: keyof { champ: string; valeur: string }; label: string }[],
          rows: [
            { champ: "Nom", valeur: profile?.last_name || "" },
            { champ: "Prénom", valeur: profile?.first_name || "" },
            { champ: "Email", valeur: profile?.email || "" },
            { champ: "Rôle", valeur: profile ? ROLE_LABELS[profile.role] || profile.role : "" },
          ],
        })} /></div> : undefined} />
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">

        {/* ── Hero navy signature ─────────────────────────────────────────── */}
        <div className="hero-surface hero-surface-sm rounded-3xl p-6 sm:p-8">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-[#F97316] flex items-center justify-center text-3xl sm:text-4xl font-heading text-white shrink-0 select-none tracking-tight">
              {initials || <User className="w-10 h-10 text-white/60" />}
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] tracking-[1.2px] uppercase text-white/50 font-medium">
                {profile ? ROLE_LABELS[profile.role] : "Mon compte"}
              </span>
              <h1 className="font-heading text-3xl sm:text-4xl text-white leading-none tracking-tight mt-1.5 mb-3">
                {profile ? `${profile.first_name} ${profile.last_name}` : "Mon profil"}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                {profile?.email && (
                <div className="flex items-center gap-1.5 text-white/70">
                  <Mail className="w-3.5 h-3.5 shrink-0 text-[#F97316]" />
                  <span className="truncate">{profile.email}</span>
                </div>
                )}
                {profile?.phone && (
                  <div className="flex items-center gap-1.5 text-white/70">
                    <Phone className="w-3.5 h-3.5 shrink-0 text-[#F97316]" />
                    <span>{profile.phone}</span>
                  </div>
                )}
              </div>
              {lastLogin && (
                <div className="mt-3 inline-flex items-center gap-2 bg-white/10 rounded-xl px-3 py-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#F97316] shrink-0" />
                  <span className="text-xs text-white font-medium">
                    Dernière connexion : {new Date(lastLogin).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })} à {new Date(lastLogin).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Statistiques — masquées pour les référents (info connexion déjà dans le hero) */}

        {/* ── Informations personnelles ──────────────────────────────────── */}
        <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-primary" />
            </div>
            <h3 className="font-semibold text-sm">Informations personnelles</h3>
          </div>

          <Separator />

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prénom</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="bg-background h-11 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required className="bg-background h-11 rounded-xl" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 12 34 56 78" className="bg-background h-11 rounded-xl pl-10" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={profile?.email ?? ""} disabled className="bg-muted/50 h-11 rounded-xl pl-10 text-muted-foreground cursor-not-allowed" />
              </div>
              <p className="text-xs text-muted-foreground">L&apos;adresse email ne peut pas être modifiée.</p>
            </div>
            <Button
              type="submit"
              disabled={savingProfile}
              className={`rounded-xl gap-2 transition-all ${profileSaved ? "bg-emerald-600 hover:bg-emerald-700" : "bg-[#F97316] hover:bg-[#EA580C]"} text-white`}
            >
              {savingProfile
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : profileSaved
                  ? <CheckCircle2 className="w-4 h-4" />
                  : null}
              {profileSaved ? "Modifications enregistrées" : "Enregistrer les modifications"}
            </Button>
          </form>
        </div>

        {/* ── Changer le mot de passe ────────────────────────────────────── */}
        <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4 text-orange-600" />
            </div>
            <h3 className="font-semibold text-sm">Changer le mot de passe</h3>
          </div>

          <Separator />

          <form onSubmit={handleChangePassword} className="space-y-4">
            {/* Nouveau mot de passe */}
            <div className="space-y-2">
              <Label>Nouveau mot de passe</Label>
              <div className="relative">
                <Input
                  type={showNew ? "text" : "password"}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  className="bg-background h-11 rounded-xl pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  aria-label={showNew ? "Masquer" : "Afficher"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Indicateur de force */}
              {newPassword.length > 0 && (
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
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className={`bg-background h-11 rounded-xl pr-12 transition-colors ${passwordsMismatch ? "border-red-400 focus-visible:ring-red-400/30" : passwordsMatch ? "border-emerald-400" : ""}`}
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

            {/* Note de sécurité */}
            <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-xl">
              <Shield className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Utilisez au moins 8 caractères avec des majuscules, chiffres et symboles pour un mot de passe sécurisé.
              </p>
            </div>

            <Button
              type="submit"
              disabled={savingPassword || passwordsMismatch}
              variant="outline"
              className="rounded-xl gap-2 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700 dark:hover:bg-orange-950/30 dark:hover:text-orange-300 transition-all"
            >
              {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              Modifier le mot de passe
            </Button>
          </form>
        </div>
        {/* ── Notifications push ────────────────────────────────────────── */}
        <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4 text-blue-600" />
            </div>
            <h3 className="font-semibold text-sm">Notifications push</h3>
          </div>
          <Separator />
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              {pushStatus === "unsupported" && (
                <p className="text-sm text-muted-foreground">Votre navigateur ne supporte pas les notifications push.</p>
              )}
              {pushStatus === "denied" && (
                <p className="text-sm text-red-500 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Notifications bloquées par le navigateur. Modifiez les permissions dans les paramètres du site.
                </p>
              )}
              {pushStatus === "subscribed" && (
                <div>
                  <p className="text-sm font-medium text-emerald-600 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />Notifications activées
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Vous recevrez les alertes même onglet fermé.</p>
                </div>
              )}
              {pushStatus === "unsubscribed" && (
                <div>
                  <p className="text-sm font-medium">Notifications désactivées</p>
                  <p className="text-xs text-muted-foreground mt-1">Activez-les pour recevoir les alertes en temps réel (affectations, décisions…) même si l'onglet est fermé.</p>
                </div>
              )}
              {pushStatus === "loading" && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />Vérification…
                </p>
              )}
            </div>
            {pushStatus === "subscribed" && (
              <Button variant="outline" size="sm" className="rounded-xl gap-2 shrink-0" onClick={pushUnsubscribe}>
                <BellOff className="w-4 h-4" />Désactiver
              </Button>
            )}
            {pushStatus === "unsubscribed" && (
              <Button size="sm" className="rounded-xl gap-2 shrink-0 bg-[#F97316] hover:bg-[#EA580C] text-white" onClick={pushSubscribe}>
                <Bell className="w-4 h-4" />Activer
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
