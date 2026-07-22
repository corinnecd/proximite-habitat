"use client";

import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
  DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Topbar } from "@/components/layout/Topbar";
import { ExportPdfButton } from "@/components/ui/export-pdf-button";
import { ExportCsvButton } from "@/components/ui/export-csv-button";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/client";
import { getAllProfiles, setProfileActive } from "@/lib/data/profiles";
import { useProfile } from "@/lib/hooks/use-profile";
import { useBranch } from "@/lib/context/branch-context";
import { ROLE_LABELS } from "@/lib/permissions";
import type { UserRole, Profile } from "@/types/database";
import { toast } from "sonner";
import {
  UserPlus, Loader2, Shield, Mail, Phone, Search,
  CheckCircle2, XCircle, Pencil,
  ChevronDown,
} from "lucide-react";

const VISIBLE_INIT = 5;

// ── Palette rôle ──────────────────────────────────────────────────────────────

const ROLE_STYLE: Record<UserRole, { border: string; avatarBg: string; avatarText: string; badge: string }> = {
  ADMIN:       { border: "border-l-purple-500", avatarBg: "bg-purple-100 dark:bg-purple-900/40", avatarText: "text-purple-700 dark:text-purple-300", badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  COMMERCIAL:  { border: "border-l-blue-500",   avatarBg: "bg-blue-100 dark:bg-blue-900/40",    avatarText: "text-blue-700 dark:text-blue-300",    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  PROSPECTEUR: { border: "border-l-emerald-500",avatarBg: "bg-emerald-100 dark:bg-emerald-900/40", avatarText: "text-emerald-700 dark:text-emerald-300", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  CHEF_EQUIPE: { border: "border-l-amber-500", avatarBg: "bg-amber-100 dark:bg-amber-900/40", avatarText: "text-amber-700 dark:text-amber-300", badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  DIRECTION_GENERALE: { border: "border-l-rose-500", avatarBg: "bg-rose-100 dark:bg-rose-900/40", avatarText: "text-rose-700 dark:text-rose-300", badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" },
};

const ROLE_FILTERS: Array<{ value: UserRole | "ALL"; label: string }> = [
  { value: "ALL", label: "Tous" },
  { value: "DIRECTION_GENERALE", label: "Direction Générale" },
  { value: "ADMIN", label: "Direction" },
  { value: "COMMERCIAL", label: "Commerciaux" },
  { value: "PROSPECTEUR", label: "Référents" },
  { value: "CHEF_EQUIPE", label: "Chefs d'équipe" },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function UtilisateursPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmUser, setConfirmUser] = useState<Profile | null>(null);
  const [toggling, setToggling] = useState(false);
  const [editUser, setEditUser] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState({ first_name: "", last_name: "", phone: "", role: "PROSPECTEUR" as UserRole });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "ALL">("ALL");
  const [showAll, setShowAll] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "", password: "", first_name: "", last_name: "",
    role: "PROSPECTEUR" as UserRole, phone: "",
  });
  const [targetOrgId, setTargetOrgId] = useState<string>("");
  const { profile } = useProfile();
  const { isDG, branches, selectedBranchId } = useBranch();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!profile || (profile.role !== "ADMIN" && profile.role !== "DIRECTION_GENERALE")) {
      setLoading(false);
      return;
    }
    getAllProfiles(supabase).then((data) => { setUsers(data); setLoading(false); });
  }, [supabase, profile]);

  // Pour le DG : restreindre à la succursale sélectionnée (cohérent avec dashboard/reporting).
  const branchScopedUsers = useMemo(() => {
    if (isDG && selectedBranchId !== "all") {
      return users.filter((u) => u.organization_id === selectedBranchId);
    }
    return users;
  }, [users, isDG, selectedBranchId]);

  const filtered = useMemo(() => {
    return branchScopedUsers.filter((u) => {
      const matchRole = roleFilter === "ALL" || u.role === roleFilter;
      const q = search.toLowerCase();
      const matchSearch = !q ||
        u.first_name.toLowerCase().includes(q) ||
        u.last_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q);
      return matchRole && matchSearch;
    });
  }, [branchScopedUsers, roleFilter, search]);

  // Replier la liste quand les filtres changent
  useEffect(() => {
    setShowAll(false);
  }, [branchScopedUsers, roleFilter, search]);

  const stats = useMemo(() => ({
    total: branchScopedUsers.length,
    active: branchScopedUsers.filter((u) => u.is_active).length,
    admins: branchScopedUsers.filter((u) => u.role === "ADMIN").length,
    commercials: branchScopedUsers.filter((u) => u.role === "COMMERCIAL").length,
    référents: branchScopedUsers.filter((u) => u.role === "PROSPECTEUR").length,
    chefsEquipe: branchScopedUsers.filter((u) => u.role === "CHEF_EQUIPE").length,
  }), [branchScopedUsers]);

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    const orgId = isDG ? (targetOrgId || profile.organization_id) : profile.organization_id;
    setCreating(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newUser, organization_id: orgId }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      const created = await res.json();
      setUsers([created, ...users]);
      setDialogOpen(false);
      setNewUser({ email: "", password: "", first_name: "", last_name: "", role: "PROSPECTEUR", phone: "" });
      toast.success(`${created.first_name} ${created.last_name} a été créé`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la création");
    } finally { setCreating(false); }
  }

  async function handleToggleActive() {
    if (!confirmUser) return;
    setToggling(true);
    try {
      const { error } = await setProfileActive(supabase, confirmUser.id, !confirmUser.is_active);
      if (error) throw error;
      setUsers(users.map((u) => u.id === confirmUser.id ? { ...u, is_active: !confirmUser.is_active } : u));
      toast.success(confirmUser.is_active ? `${confirmUser.first_name} désactivé` : `${confirmUser.first_name} activé`);
      setConfirmUser(null);
    } catch {
      toast.error("Erreur lors de la modification du compte");
    } finally {
      setToggling(false);
    }
  }

  function openEditDialog(user: Profile) {
    setEditUser(user);
    setEditForm({ first_name: user.first_name, last_name: user.last_name, phone: user.phone ?? "", role: user.role });
  }

  async function handleEditUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editUser.id, ...editForm }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      const updated = await res.json();
      setUsers(users.map((u) => u.id === updated.id ? updated : u));
      setEditUser(null);
      toast.success(`${updated.first_name} ${updated.last_name} mis à jour`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la mise à jour");
    } finally { setSaving(false); }
  }

  // Accès refusé — attendre que le profil soit chargé avant de juger le rôle
  if (profile?.role !== "ADMIN" && profile?.role !== "DIRECTION_GENERALE") {
    return (
      <>
        <Topbar title="Utilisateurs" />
        <div className="p-4 sm:p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
              <Shield className="w-8 h-8 text-muted-foreground opacity-40" />
            </div>
            <p className="font-semibold text-lg">Accès restreint</p>
            <p className="text-sm text-muted-foreground">Cette section est réservée à la direction.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title="Gestion des utilisateurs" actions={<div className="flex items-center gap-2"><ExportPdfButton title="Utilisateurs" filename="utilisateurs" /><ExportCsvButton filename="utilisateurs" getData={() => ({
        columns: [
          { key: "nom", label: "Nom" },
          { key: "prenom", label: "Prénom" },
          { key: "email", label: "Email" },
          { key: "role", label: "Rôle" },
          { key: "actif", label: "Actif" },
        ] as { key: keyof { nom: string; prenom: string; email: string; role: string; actif: string }; label: string }[],
        rows: users.map((u) => ({ nom: u.last_name, prenom: u.first_name, email: u.email, role: ROLE_LABELS[u.role] || u.role, actif: u.is_active ? "Oui" : "Non" })),
      })} /></div>} />
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">

        {/* ═══ HERO UTILISATEURS — navy signature ═══════════════════════ */}
        <div className="hero-surface hero-surface-sm rounded-3xl p-6 sm:p-7">
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
              <div>
                <span className="text-[10px] tracking-[1.2px] uppercase text-white/50 font-medium">
                  Gestion des équipes
                </span>
                <h1 className="font-heading text-3xl sm:text-4xl text-white tracking-tight leading-none mt-1.5">
                  Utilisateurs
                </h1>
                <p className="text-sm text-white/60 mt-2">
                  {loading ? <span className="inline-block h-4 w-64 bg-white/10 rounded animate-pulse align-middle" /> : `${stats.total} collaborateur${stats.total > 1 ? "s" : ""} · ${stats.active} actif${stats.active > 1 ? "s" : ""} · ${stats.commercials} commerciaux · ${stats.référents} référents`}
                </p>
              </div>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger render={<button className="flex-shrink-0 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-full px-5 py-2 text-sm font-medium inline-flex items-center gap-2 transition-colors self-start" />}>
                  <UserPlus className="w-4 h-4" />Nouvel utilisateur
                </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-primary" />Créer un utilisateur
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Prénom *</Label>
                    <Input value={newUser.first_name} onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })} required className="bg-card" />
                  </div>
                  <div className="space-y-2">
                    <Label>Nom *</Label>
                    <Input value={newUser.last_name} onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })} required className="bg-card" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} required className="bg-card" />
                </div>
                <div className="space-y-2">
                  <Label>Mot de passe *</Label>
                  <Input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} required minLength={8} className="bg-card" placeholder="8 caractères minimum" />
                </div>
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input value={newUser.phone} onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })} className="bg-card" placeholder="06 12 34 56 78" />
                </div>
                <div className="space-y-2">
                  <Label>Rôle *</Label>
                  <Select value={newUser.role} onValueChange={(v) => v && setNewUser({ ...newUser, role: v as UserRole })}>
                    <SelectTrigger className="bg-card rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DIRECTION_GENERALE">Direction Générale</SelectItem>
                      <SelectItem value="ADMIN">Direction</SelectItem>
                      <SelectItem value="COMMERCIAL">Commercial</SelectItem>
                      <SelectItem value="CHEF_EQUIPE">Chef d&apos;équipe</SelectItem>
                      <SelectItem value="PROSPECTEUR">Référent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {isDG && (
                  <div className="space-y-2">
                    <Label>Succursale *</Label>
                    <Select
                      value={targetOrgId || profile?.organization_id || ""}
                      onValueChange={(v) => v && setTargetOrgId(v)}
                    >
                      <SelectTrigger className="bg-card rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}{b.is_hq ? " (Siège)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button type="submit" disabled={creating} className="w-full bg-[#F97316] hover:bg-[#EA580C] text-white rounded-full px-5 gap-2">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Créer l&apos;utilisateur
                </Button>
              </form>
            </DialogContent>
          </Dialog>
            </div>

            {/* Recherche + filtres rôle intégrés dans le hero */}
            <div className="flex flex-col sm:flex-row gap-3 pt-5 border-t border-white/10">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Rechercher par nom, email…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-10 pl-10 pr-3 bg-white/8 border border-white/10 rounded-full text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-[#F97316]/50 focus:border-[#F97316]/30 transition-all"
                />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {ROLE_FILTERS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setRoleFilter(value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      roleFilter === value
                        ? "bg-[#F97316] text-white"
                        : "bg-white/8 text-white/70 hover:bg-white/15 border border-white/10"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Liste ────────────────────────────────────────────────────────── */}
        <div className={`transition-opacity duration-300 ${loading ? "opacity-0" : "opacity-100"}`}>
        {filtered.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border">
            <EmptyState
              illustration="fiches"
              title="Aucun utilisateur trouvé"
              description={search || roleFilter !== "ALL" ? "Essayez de modifier votre recherche ou vos filtres." : "Commencez par créer un premier utilisateur."}
              action={!search && roleFilter === "ALL" ? (
                <button
                  type="button"
                  onClick={() => setDialogOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-sm font-medium transition-colors"
                >
                  <UserPlus className="w-4 h-4" />Créer un utilisateur
                </button>
              ) : undefined}
            />
          </div>
        ) : (
          <div className="space-y-2">
            {(showAll ? filtered : filtered.slice(0, VISIBLE_INIT)).map((user) => {
              const s = ROLE_STYLE[user.role];
              const initials = `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
              const isMe = user.id === profile?.id;
              return (
                <div
                  key={user.id}
                  className={`bg-card border border-border border-l-4 ${s.border} rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 transition-all hover:shadow-sm ${!user.is_active ? "opacity-60" : ""}`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-11 h-11 rounded-xl ${s.avatarBg} flex items-center justify-center text-sm font-bold ${s.avatarText} shrink-0`}>
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{user.first_name} {user.last_name}</p>
                        {isMe && <span className="text-xs text-muted-foreground">(vous)</span>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />{user.email}
                        </span>
                        {user.phone && (
                          <span className="flex items-center gap-1 hidden sm:flex">
                            <Phone className="w-3 h-3" />{user.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    <Badge variant="secondary" className={`text-xs rounded-lg ${s.badge}`}>
                      {ROLE_LABELS[user.role]}
                    </Badge>
                    <Badge variant="secondary" className={`text-xs rounded-lg ${user.is_active ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"}`}>
                      {user.is_active ? (
                        <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Actif</span>
                      ) : (
                        <span className="flex items-center gap-1"><XCircle className="w-3 h-3" />Inactif</span>
                      )}
                    </Badge>
                    {!isMe && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(user)}
                        className="rounded-xl text-xs h-8 gap-1"
                        aria-label={`Modifier ${user.first_name}`}
                      >
                        <Pencil className="w-3 h-3" />Modifier
                      </Button>
                    )}
                    {!isMe && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmUser(user)}
                        className={`rounded-xl text-xs h-8 ${user.is_active ? "hover:border-red-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" : "hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"}`}
                        aria-label={user.is_active ? `Désactiver ${user.first_name}` : `Activer ${user.first_name}`}
                      >
                        {user.is_active ? "Désactiver" : "Activer"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && filtered.length > VISIBLE_INIT && (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAll((v) => !v)}
              className="gap-1.5 text-muted-foreground hover:text-foreground rounded-xl text-xs"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAll ? "rotate-180" : ""}`} />
              {showAll ? "Voir moins" : `Voir plus (${filtered.length - VISIBLE_INIT})`}
            </Button>
          </div>
        )}
        {filtered.length > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            {showAll ? filtered.length : Math.min(VISIBLE_INIT, filtered.length)} utilisateur{filtered.length > 1 ? "s" : ""} affiché{filtered.length > 1 ? "s" : ""} sur {filtered.length}
            {filtered.length !== users.length && ` (${users.length} au total)`}
          </p>
        )}
        </div>
      </div>

      {/* ── Dialog édition utilisateur ───────────────────────────────────── */}
      <Dialog open={editUser !== null} onOpenChange={(open) => { if (!open) setEditUser(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" />Modifier l&apos;utilisateur
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditUser} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prénom *</Label>
                <Input value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} required className="bg-card" />
              </div>
              <div className="space-y-2">
                <Label>Nom *</Label>
                <Input value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} required className="bg-card" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="bg-card" placeholder="06 12 34 56 78" />
            </div>
            <div className="space-y-2">
              <Label>Rôle *</Label>
              <Select value={editForm.role} onValueChange={(v) => v && setEditForm({ ...editForm, role: v as UserRole })}>
                <SelectTrigger className="bg-card rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DIRECTION_GENERALE">Direction Générale</SelectItem>
                  <SelectItem value="ADMIN">Direction</SelectItem>
                  <SelectItem value="COMMERCIAL">Commercial</SelectItem>
                  <SelectItem value="CHEF_EQUIPE">Chef d&apos;équipe</SelectItem>
                  <SelectItem value="PROSPECTEUR">Référent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="gap-2 pt-2">
              <DialogClose render={<Button type="button" variant="outline" className="rounded-xl" />}>Annuler</DialogClose>
              <Button type="submit" disabled={saving} className="bg-[#F97316] hover:bg-[#EA580C] text-white rounded-full px-5 gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog confirmation activation/désactivation ──────────────────── */}
      <Dialog open={confirmUser !== null} onOpenChange={(open) => { if (!open) setConfirmUser(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${confirmUser?.is_active ? "text-destructive" : "text-emerald-600"}`}>
              {confirmUser?.is_active ? <XCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
              {confirmUser?.is_active ? "Désactiver" : "Activer"} cet utilisateur ?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            {confirmUser?.is_active
              ? <>L&apos;utilisateur <span className="font-semibold text-foreground">{confirmUser?.first_name} {confirmUser?.last_name}</span> ne pourra plus se connecter.</>
              : <>L&apos;utilisateur <span className="font-semibold text-foreground">{confirmUser?.first_name} {confirmUser?.last_name}</span> pourra à nouveau se connecter.</>
            }
          </p>
          <DialogFooter className="gap-2">
            <DialogClose render={<Button type="button" variant="outline" className="rounded-xl" />}>Annuler</DialogClose>
            <Button
              onClick={handleToggleActive}
              disabled={toggling}
              className={`rounded-xl gap-2 text-white ${confirmUser?.is_active ? "bg-destructive hover:bg-destructive/90" : "bg-emerald-600 hover:bg-emerald-700"}`}
            >
              {toggling ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
