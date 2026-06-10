"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Topbar } from "@/components/layout/Topbar";
import { ExportPdfButton } from "@/components/ui/export-pdf-button";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/use-profile";
import { ROLE_LABELS } from "@/lib/permissions";
import type { UserRole } from "@/types/database";
import { toast } from "sonner";
import {
  User, Lock, Loader2, Eye, EyeOff, Mail, Phone,
  CheckCircle2, AlertCircle, Shield, FileText, TrendingUp, Clock, Star,
} from "lucide-react";

// ── Palette rôle ─────────────────────────────────────────────────────────────

const ROLE_STYLE: Record<UserRole, { heroBg: string; avatarBg: string; avatarText: string; badge: string }> = {
  ADMIN:       { heroBg: "from-purple-50 to-white dark:from-purple-950/20 dark:to-background", avatarBg: "bg-purple-100 dark:bg-purple-900/40", avatarText: "text-purple-700 dark:text-purple-300", badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  COMMERCIAL:  { heroBg: "from-blue-50 to-white dark:from-blue-950/20 dark:to-background",   avatarBg: "bg-blue-100 dark:bg-blue-900/40",    avatarText: "text-blue-700 dark:text-blue-300",    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  PROSPECTEUR: { heroBg: "from-emerald-50 to-white dark:from-emerald-950/20 dark:to-background", avatarBg: "bg-emerald-100 dark:bg-emerald-900/40", avatarText: "text-emerald-700 dark:text-emerald-300", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
};

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

interface UserStats {
  total: number;
  soumises: number;
  acceptees: number;
  refusees: number;
  lastActivity: string | null;
}

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

  const [stats, setStats] = useState<UserStats | null>(null);

  const supabase = createClient();

  useEffect(() => {
    if (profile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFirstName(profile.first_name);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLastName(profile.last_name);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhone(profile.phone || "");

      // Fetch personal stats (non critique — silencieux en cas d'erreur)
      void (async () => {
        try {
          const { data, error } = await supabase
            .from("fiches")
            .select("status, created_at")
            .eq("created_by", profile.id)
            .order("created_at", { ascending: false });
          if (error || !data) return;
          setStats({
            total: data.length,
            soumises: data.filter((f) => f.status !== "BROUILLON").length,
            acceptees: data.filter((f) => f.status === "ACCEPTEE").length,
            refusees: data.filter((f) => f.status === "REFUSEE").length,
            lastActivity: data[0]?.created_at ?? null,
          });
        } catch { /* stats non critiques */ }
      })();
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

  if (loading || !profile) {
    return (
      <>
        <Topbar title="Mon profil" actions={<ExportPdfButton title="Mon profil" filename="profil" />} />
        <div className="p-6 lg:p-8 max-w-2xl mx-auto animate-pulse space-y-4">
          <div className="h-36 bg-card rounded-2xl border border-border" />
          <div className="h-64 bg-card rounded-2xl border border-border" />
          <div className="h-48 bg-card rounded-2xl border border-border" />
        </div>
      </>
    );
  }

  const roleStyle = ROLE_STYLE[profile.role];
  const initials = `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
  const pwdStrength = passwordStrength(newPassword);
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  return (
    <>
      <Topbar title="Mon profil" actions={<ExportPdfButton title="Mon profil" filename="profil" />} />
      <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6">

        {/* ── Hero card ─────────────────────────────────────────────────── */}
        <div className={`bg-gradient-to-br ${roleStyle.heroBg} border border-border rounded-2xl p-6`}>
          <div className="flex items-center gap-5">
            <div className={`w-20 h-20 rounded-2xl ${roleStyle.avatarBg} flex items-center justify-center text-3xl font-bold ${roleStyle.avatarText} shrink-0 select-none`}>
              {initials}
            </div>
            <div className="min-w-0">
              <h2 className="font-heading text-2xl leading-tight">{profile.first_name} {profile.last_name}</h2>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                <Mail className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{profile.email}</span>
              </div>
              {profile.phone && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  <span>{profile.phone}</span>
                </div>
              )}
              <Badge variant="secondary" className={`mt-2 text-xs rounded-lg ${roleStyle.badge}`}>
                {ROLE_LABELS[profile.role]}
              </Badge>
            </div>
          </div>
        </div>

        {/* ── Statistiques personnelles ──────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                icon: FileText,
                label: "Fiches créées",
                value: stats.total,
                sub: "au total",
                color: "text-primary",
                bg: "bg-primary/10",
              },
              {
                icon: TrendingUp,
                label: "Soumises",
                value: stats.soumises,
                sub: "au traitement",
                color: "text-blue-600",
                bg: "bg-blue-50 dark:bg-blue-950/30",
              },
              {
                icon: Star,
                label: "Acceptées",
                value: stats.acceptees,
                sub: stats.soumises > 0 ? `${Math.round((stats.acceptees / stats.soumises) * 100)}% de conversion` : "aucune soumise",
                color: "text-emerald-600",
                bg: "bg-emerald-50 dark:bg-emerald-950/30",
              },
              {
                icon: Clock,
                label: "Dernière activité",
                value: stats.lastActivity
                  ? new Date(stats.lastActivity).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
                  : "—",
                sub: stats.lastActivity
                  ? new Date(stats.lastActivity).getFullYear().toString()
                  : "aucune fiche",
                color: "text-orange-600",
                bg: "bg-orange-50 dark:bg-orange-950/30",
              },
            ].map(({ icon: Icon, label, value, sub, color, bg }) => (
              <div key={label} className="bg-card border border-border rounded-2xl p-4 space-y-2" style={{ animation: "fadeSlideIn 0.25s ease both" }}>
                <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold font-heading">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Informations personnelles ──────────────────────────────────── */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
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
                <Input value={profile.email} disabled className="bg-muted/50 h-11 rounded-xl pl-10 text-muted-foreground cursor-not-allowed" />
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
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
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
      </div>
    </>
  );
}
