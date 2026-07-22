"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
  DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Topbar } from "@/components/layout/Topbar";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/use-profile";
import type { Organization } from "@/types/database";
import { toast } from "sonner";
import { Building2, Loader2, Plus, Shield, Users, Star, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useBranch } from "@/lib/context/branch-context";

type BranchWithCount = Organization & { userCount: number };

export default function SuccursalesPage() {
  const { profile, loading: profileLoading } = useProfile();
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { setSelectedBranchId } = useBranch();

  const [branches, setBranches] = useState<BranchWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  const load = useCallback(async () => {
    const { data: orgs } = await supabase.from("organizations").select("*").order("name");
    const list = (orgs ?? []).slice().sort((a, b) => {
      if (a.is_hq && !b.is_hq) return -1;
      if (!a.is_hq && b.is_hq) return 1;
      return (a.name ?? "").localeCompare(b.name ?? "", "fr");
    });
    const withCounts = await Promise.all(
      list.map(async (o) => {
        const { count } = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", o.id);
        return { ...o, userCount: count ?? 0 } as BranchWithCount;
      }),
    );
    setBranches(withCounts);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (profileLoading) return;
    if (profile?.role !== "DIRECTION_GENERALE") { setLoading(false); return; }
    load();
  }, [profile, profileLoading, load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      toast.success(`Succursale « ${data.name} » créée`);
      setName("");
      setDialogOpen(false);
      setLoading(true);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la création");
    } finally {
      setCreating(false);
    }
  }

  if (!profileLoading && profile?.role !== "DIRECTION_GENERALE") {
    return (
      <>
        <Topbar title="Succursales" />
        <div className="p-4 sm:p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
              <Shield className="w-8 h-8 text-muted-foreground opacity-40" />
            </div>
            <p className="text-muted-foreground">Accès réservé à la Direction Générale.</p>
          </div>
        </div>
      </>
    );
  }

  if (loading) return null;

  return (
    <>
      <Topbar title="Succursales" />
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* ═══ HERO SUCCURSALES ═══════════════════════════════════════ */}
        <div className="hero-surface hero-surface-sm rounded-3xl p-6 sm:p-7">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <span className="text-[10px] tracking-[1.2px] uppercase text-white/50 font-medium">
                Réseau de la société
              </span>
              <h1 className="font-heading text-3xl sm:text-4xl text-white tracking-tight leading-none mt-1.5">
                Succursales
              </h1>
              <p className="text-sm text-white/60 mt-2">
                {branches.length} succursale{branches.length > 1 ? "s" : ""} · {branches.reduce((s, b) => s + b.userCount, 0)} collaborateur{branches.reduce((s, b) => s + b.userCount, 0) > 1 ? "s" : ""} au total
              </p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger render={<button className="flex-shrink-0 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-full px-5 py-2 text-sm font-medium inline-flex items-center gap-2 transition-colors" />}>
                <Plus className="w-4 h-4" />Nouvelle succursale
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Créer une succursale</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="branch-name">Nom de la succursale</Label>
                  <Input
                    id="branch-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex. Agence de Lyon"
                    autoFocus
                  />
                </div>
                <DialogFooter>
                  <DialogClose render={<Button type="button" variant="outline" className="rounded-xl" />}>
                    Annuler
                  </DialogClose>
                  <Button type="submit" disabled={creating || !name.trim()} className="bg-[#F97316] hover:bg-[#EA580C] text-white rounded-full px-5 gap-2">
                    {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                    Créer
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {loading ? null : branches.length === 0 ? (
          <EmptyState
            title="Aucune succursale"
            description="Créez votre première succursale pour commencer."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {branches.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setSelectedBranchId(b.id);
                  router.push("/");
                }}
                className="text-left bg-card border border-border border-l-4 border-l-rose-500 rounded-2xl p-5 shadow-sm hover:-translate-y-1 hover:shadow-lg transition-all duration-200 cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="w-11 h-11 rounded-xl bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                  </div>
                  <div className="flex items-center gap-2">
                    {b.is_hq && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        <Star className="w-3 h-3" />Siège
                      </span>
                    )}
                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <h3 className="font-semibold text-base mt-3 truncate">{b.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{b.slug}</p>
                <div className="flex items-center gap-1.5 mt-3 text-sm text-muted-foreground">
                  <Users className="w-4 h-4" />
                  {b.userCount} utilisateur{b.userCount > 1 ? "s" : ""}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
