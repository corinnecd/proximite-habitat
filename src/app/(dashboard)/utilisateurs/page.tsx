"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Topbar } from "@/components/layout/Topbar";
import { createClient } from "@/lib/supabase/client";
import { getAllProfiles, setProfileActive } from "@/lib/data/profiles";
import { useProfile } from "@/lib/hooks/use-profile";
import { ROLE_LABELS } from "@/lib/permissions";
import type { UserRole, Profile } from "@/types/database";
import { toast } from "sonner";
import { UserPlus, Loader2, Shield, Mail, Phone } from "lucide-react";

export default function UtilisateursPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({ email: "", password: "", first_name: "", last_name: "", role: "PROSPECTEUR" as UserRole, phone: "" });
  const { profile } = useProfile();
  const supabase = createClient();

  useEffect(() => { getAllProfiles(supabase).then((data) => { setUsers(data); setLoading(false); }); }, [supabase]);

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setCreating(true);
    try {
      const res = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...newUser, organization_id: profile.organization_id }) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      const created = await res.json();
      setUsers([created, ...users]);
      setDialogOpen(false);
      setNewUser({ email: "", password: "", first_name: "", last_name: "", role: "PROSPECTEUR", phone: "" });
      toast.success("Utilisateur créé");
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Erreur"); } finally { setCreating(false); }
  }

  async function toggleActive(userId: string, isActive: boolean) {
    await setProfileActive(supabase, userId, !isActive);
    setUsers(users.map((u) => u.id === userId ? { ...u, is_active: !isActive } : u));
    toast.success(isActive ? "Désactivé" : "Activé");
  }

  if (profile?.role !== "ADMIN") return (<><Topbar title="Utilisateurs" /><div className="p-6"><Card className="border-0 shadow-sm"><CardContent className="p-12 text-center text-muted-foreground"><Shield className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>Accès réservé à la direction</p></CardContent></Card></div></>);

  return (
    <><Topbar title="Gestion des utilisateurs" />
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">{users.length} utilisateur{users.length > 1 ? "s" : ""}</p>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger><Button className="bg-[#F97316] hover:bg-[#EA580C] text-white rounded-xl gap-2"><UserPlus className="w-4 h-4" />Nouvel utilisateur</Button></DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Créer un utilisateur</DialogTitle></DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Prénom</Label><Input value={newUser.first_name} onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })} required className="bg-card" /></div>
                  <div className="space-y-2"><Label>Nom</Label><Input value={newUser.last_name} onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })} required className="bg-card" /></div>
                </div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} required className="bg-card" /></div>
                <div className="space-y-2"><Label>Mot de passe</Label><Input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} required minLength={8} className="bg-card" /></div>
                <div className="space-y-2"><Label>Rôle</Label><Select value={newUser.role} onValueChange={(v) => v && setNewUser({ ...newUser, role: v as UserRole })}><SelectTrigger className="bg-card"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ADMIN">Direction</SelectItem><SelectItem value="COMMERCIAL">Commercial</SelectItem><SelectItem value="PROSPECTEUR">Prospecteur</SelectItem></SelectContent></Select></div>
                <Button type="submit" disabled={creating} className="w-full bg-[#F97316] hover:bg-[#EA580C] text-white rounded-xl">{creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Créer"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <div className="grid gap-4">
          {loading ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 bg-card rounded-xl animate-pulse" />) : users.map((user) => (
            <Card key={user.id} className="border-0 shadow-sm"><CardContent className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">{user.first_name[0]}{user.last_name[0]}</div>
                <div><p className="font-medium">{user.first_name} {user.last_name}</p><div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5"><span className="flex items-center gap-1"><Mail className="w-3 h-3" />{user.email}</span>{user.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{user.phone}</span>}</div></div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className={user.role === "ADMIN" ? "bg-purple-100 text-purple-700" : user.role === "COMMERCIAL" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}>{ROLE_LABELS[user.role]}</Badge>
                <Badge variant="secondary" className={user.is_active ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}>{user.is_active ? "Actif" : "Inactif"}</Badge>
                {user.id !== profile?.id && <Button variant="ghost" size="sm" onClick={() => toggleActive(user.id, user.is_active)} className="text-xs">{user.is_active ? "Désactiver" : "Activer"}</Button>}
              </div>
            </CardContent></Card>
          ))}
        </div>
      </div>
    </>
  );
}
