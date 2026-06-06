"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Topbar } from "@/components/layout/Topbar";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/use-profile";
import { ROLE_LABELS } from "@/lib/permissions";
import { toast } from "sonner";
import { User, Lock, Loader2, Eye, EyeOff, Mail } from "lucide-react";

export default function ProfilPage() {
  const { profile, loading } = useProfile();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name);
      setLastName(profile.last_name);
      setPhone(profile.phone || "");
    }
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
      toast.error("Erreur lors de la sauvegarde : " + error.message);
    } else {
      toast.success("Profil mis à jour");
    }
    setSavingProfile(false);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Le mot de passe doit contenir au moins 8 caractères");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
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

  if (loading || !profile) {
    return (
      <>
        <Topbar title="Mon profil" />
        <div className="p-6 lg:p-8 max-w-2xl mx-auto animate-pulse space-y-4">
          <div className="h-48 bg-white rounded-xl" />
          <div className="h-48 bg-white rounded-xl" />
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title="Mon profil" />
      <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6">

        {/* Informations personnelles */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="w-4 h-4" /> Informations personnelles
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar + rôle */}
            <div className="flex items-center gap-4 p-4 bg-secondary/30 rounded-xl">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary shrink-0">
                {profile.first_name[0]}{profile.last_name[0]}
              </div>
              <div>
                <p className="font-semibold">{profile.first_name} {profile.last_name}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Mail className="w-3 h-3" />{profile.email}
                </p>
                <Badge
                  variant="secondary"
                  className={`mt-1.5 text-xs ${profile.role === "ADMIN" ? "bg-purple-100 text-purple-700" : profile.role === "COMMERCIAL" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}
                >
                  {ROLE_LABELS[profile.role]}
                </Badge>
              </div>
            </div>

            <Separator />

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prénom</Label>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nom</Label>
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    className="bg-white"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="06 12 34 56 78"
                  className="bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={profile.email}
                  disabled
                  className="bg-secondary/50 text-muted-foreground cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground">L&apos;adresse email ne peut pas être modifiée</p>
              </div>
              <Button
                type="submit"
                disabled={savingProfile}
                className="bg-[#F97316] hover:bg-[#EA580C] text-white rounded-xl gap-2"
              >
                {savingProfile && <Loader2 className="w-4 h-4 animate-spin" />}
                Enregistrer les modifications
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Changer le mot de passe */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="w-4 h-4" /> Changer le mot de passe
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
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
                    className="bg-white pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Confirmer le nouveau mot de passe</Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="bg-white"
                />
              </div>
              <p className="text-xs text-muted-foreground">8 caractères minimum</p>
              <Button
                type="submit"
                disabled={savingPassword}
                variant="outline"
                className="rounded-xl gap-2"
              >
                {savingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
                Modifier le mot de passe
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
