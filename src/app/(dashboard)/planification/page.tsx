"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Topbar } from "@/components/layout/Topbar";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/use-profile";
import { useBranch } from "@/lib/context/branch-context";
import { toast } from "sonner";
import {
  Calendar, ChevronLeft, ChevronRight, MapPin, Check, Copy,
  Loader2, Users, Trash2, X, BarChart3, TrendingUp, FileText, Send, UserCheck, CheckCircle2, ChevronDown, ChevronUp,
} from "lucide-react";
import type { ZoneDepartement, ZoneVille } from "@/types/database";
import { Autocomplete } from "@/components/ui/autocomplete";
import { VilleMapDynamic, type MapMarker } from "@/components/ui/VilleMapDynamic";

interface PlanEntry {
  id: string;
  ville_id: string;
  chef_equipe_id: string | null;
  ville?: ZoneVille;
  chefEquipe?: { id: string; first_name: string; last_name: string } | null;
}

interface VilleStats {
  ville_id: string;
  total: number;
  brouillon: number;
  soumise: number;
  affectee: number;
  acceptee: number;
  refusee: number;
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateFr(date: Date): string {
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export default function PlanificationPage() {
  const { profile, loading: profileLoading } = useProfile();
  const { selectedBranchId, isDG } = useBranch();
  const supabase = useMemo(() => createClient(), []);

  const [currentMonday, setCurrentMonday] = useState(() => getMondayOfWeek(new Date()));
  const [departements, setDepartements] = useState<ZoneDepartement[]>([]);
  const [villes, setVilles] = useState<ZoneVille[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>("");
  const [planEntries, setPlanEntries] = useState<PlanEntry[]>([]);
  const [chefsEquipe, setReferents] = useState<{ id: string; first_name: string; last_name: string }[]>([]);
  const [selectedVilles, setSelectedVilles] = useState<Set<string>>(new Set());
  const [selectedChef, setSelectedChef] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [villeStats, setVilleStats] = useState<Map<string, VilleStats>>(new Map());
  const [showAllPerfVilles, setShowAllPerfVilles] = useState(false);

  const mondayStr = `${currentMonday.getFullYear()}-${String(currentMonday.getMonth() + 1).padStart(2, "0")}-${String(currentMonday.getDate()).padStart(2, "0")}`;
  const sunday = new Date(currentMonday);
  sunday.setDate(currentMonday.getDate() + 6);
  const sundayStr = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, "0")}-${String(sunday.getDate()).padStart(2, "0")}`;

  const isAdmin = profile?.role === "ADMIN";

  const fetchPlan = useCallback(async () => {
    if (!profile) return;
    setLoading(true);

    // Tout charger en parallèle
    const _branchFilter = (isDG && selectedBranchId !== "all") ? selectedBranchId : null;
    let planQuery = supabase.from("planification_hebdo").select("id, ville_id, chef_equipe_id").eq("semaine_du", mondayStr);
    if (_branchFilter) {
      planQuery = planQuery.eq("organization_id", _branchFilter);
    } else if (!isDG) {
      planQuery = planQuery.eq("organization_id", profile.organization_id);
    }
    const [deptRes, planRes, chefsRes] = await Promise.all([
      supabase.from("zones_departements").select("*").order("code"),
      planQuery,
      isAdmin
        ? supabase.from("profiles").select("id, first_name, last_name").eq("role", "CHEF_EQUIPE").eq("is_active", true)
        : Promise.resolve({ data: null }),
    ]);

    if (deptRes.data) setDepartements(deptRes.data);
    if (chefsRes.data) setReferents(chefsRes.data);

    const data = planRes.data;
    if (data && data.length > 0) {
      const villeIds = [...new Set(data.map((d) => d.ville_id))];
      const chefIds = [...new Set(data.filter((d) => d.chef_equipe_id).map((d) => d.chef_equipe_id!))];

      const [villesRes, chefsMapRes] = await Promise.all([
        supabase.from("zones_villes").select("*").in("id", villeIds),
        chefIds.length > 0
          ? supabase.from("profiles").select("id, first_name, last_name").in("id", chefIds)
          : Promise.resolve({ data: [] as { id: string; first_name: string; last_name: string }[] }),
      ]);

      const villesMap = new Map((villesRes.data || []).map((v) => [v.id, v]));
      const chefsMap = new Map((chefsMapRes.data || []).map((p) => [p.id, p]));

      setPlanEntries(data.map((d) => ({
        ...d,
        ville: villesMap.get(d.ville_id),
        chefEquipe: d.chef_equipe_id ? chefsMap.get(d.chef_equipe_id) || null : null,
      })));
    } else {
      setPlanEntries([]);
    }
    setLoading(false);
  }, [profile, mondayStr, isAdmin, supabase, isDG, selectedBranchId]);

  useEffect(() => {
    if (profileLoading || !profile) return;
    fetchPlan();
  }, [profileLoading, profile, fetchPlan]);

  // Fetch fiche stats per planned ville (fiches créées pendant la semaine)
  useEffect(() => {
    if (!profile || planEntries.length === 0) { setVilleStats(new Map()); return; }
    const villeIds = [...new Set(planEntries.map((e) => e.ville_id))];
    const branchFilter = (isDG && selectedBranchId !== "all") ? selectedBranchId : null;
    const orgFilter = branchFilter ?? (isDG ? null : profile.organization_id);

    let q = supabase
      .from("fiches")
      .select("ville_id, status")
      .in("ville_id", villeIds)
      .neq("status", "BROUILLON")
      .gte("created_at", mondayStr + "T00:00:00")
      .lte("created_at", sundayStr + "T23:59:59");
    if (orgFilter) q = q.eq("organization_id", orgFilter);
    q.then(({ data }) => {
        const map = new Map<string, VilleStats>();
        for (const vid of villeIds) {
          map.set(vid, { ville_id: vid, total: 0, brouillon: 0, soumise: 0, affectee: 0, acceptee: 0, refusee: 0 });
        }
        if (data) {
          const passedSoumise = new Set(["SOUMISE", "VALIDEE", "AFFECTEE", "ACCEPTEE", "RETRACTATION", "REFUSEE", "ARCHIVEE"]);
          const passedAffectee = new Set(["AFFECTEE", "ACCEPTEE", "RETRACTATION", "REFUSEE", "ARCHIVEE"]);
          for (const f of data) {
            if (!f.ville_id) continue;
            const s = map.get(f.ville_id);
            if (!s) continue;
            s.total++;
            if (passedSoumise.has(f.status)) s.soumise++;
            if (passedAffectee.has(f.status)) s.affectee++;
            if (f.status === "ACCEPTEE") s.acceptee++;
            if (f.status === "REFUSEE") s.refusee++;
          }
        }
        setVilleStats(map);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, planEntries, supabase, isDG, selectedBranchId, mondayStr, sundayStr]);

  useEffect(() => {
    if (!selectedDept) { setVilles([]); return; }
    supabase.from("zones_villes").select("*").eq("departement_code", selectedDept).order("nom").then(({ data }) => {
      if (data) setVilles(data);
    });
  }, [selectedDept, supabase]);

  function toggleVille(villeId: string) {
    setSelectedVilles((prev) => {
      const next = new Set(prev);
      if (next.has(villeId)) next.delete(villeId); else next.add(villeId);
      return next;
    });
  }

  async function handleSave() {
    if (!profile || selectedVilles.size === 0) return;
    setSaving(true);
    const rows = [...selectedVilles].map((ville_id) => ({
      organization_id: profile.organization_id,
      semaine_du: mondayStr,
      ville_id,
      chef_equipe_id: selectedChef || null,
      created_by: profile.id,
    }));

    const { error } = await supabase.from("planification_hebdo").upsert(rows, {
      onConflict: "organization_id,semaine_du,ville_id,chef_equipe_id",
    });

    if (error) {
      toast.error("Erreur : " + error.message);
    } else {
      toast.success(`${selectedVilles.size} ville(s) planifiée(s)`);
      setSelectedVilles(new Set());
      fetchPlan();
    }
    setSaving(false);
  }

  async function handleDelete(entryId: string) {
    await supabase.from("planification_hebdo").delete().eq("id", entryId);
    setPlanEntries((prev) => prev.filter((e) => e.id !== entryId));
    toast.success("Ville retirée du planning");
  }

  async function handleDuplicatePrevious() {
    if (!profile) return;
    const prevMonday = new Date(currentMonday);
    prevMonday.setDate(prevMonday.getDate() - 7);
    const prevMondayStr = `${prevMonday.getFullYear()}-${String(prevMonday.getMonth() + 1).padStart(2, "0")}-${String(prevMonday.getDate()).padStart(2, "0")}`;

    const { data } = await supabase
      .from("planification_hebdo")
      .select("ville_id, chef_equipe_id")
      .eq("organization_id", profile.organization_id)
      .eq("semaine_du", prevMondayStr);

    if (!data || data.length === 0) {
      toast.error("Aucune planification la semaine précédente");
      return;
    }

    setSaving(true);
    const rows = data.map((d) => ({
      organization_id: profile.organization_id,
      semaine_du: mondayStr,
      ville_id: d.ville_id,
      chef_equipe_id: d.chef_equipe_id,
      created_by: profile.id,
    }));

    const { error } = await supabase.from("planification_hebdo").upsert(rows, {
      onConflict: "organization_id,semaine_du,ville_id,chef_equipe_id",
    });

    if (error) toast.error("Erreur : " + error.message);
    else { toast.success("Planning dupliqué"); fetchPlan(); }
    setSaving(false);
  }

  function navigateWeek(dir: -1 | 1) {
    setCurrentMonday((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + dir * 7);
      return next;
    });
  }

  return (
    <>
      <Topbar title="Planification hebdomadaire" />
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">

        {/* Navigation semaine — toujours visible */}
        <div className="flex items-center justify-between bg-card border border-border rounded-2xl px-6 py-4">
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => navigateWeek(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Semaine du</p>
            <p className="text-lg font-bold flex items-center gap-2 justify-center">
              <Calendar className="w-5 h-5 text-[#F97316]" />
              {formatDateFr(currentMonday)} — {formatDateFr(sunday)}
            </p>
          </div>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => navigateWeek(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Skeleton pendant chargement du profil */}
        {(profileLoading || !profile) && (
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <div className="h-5 w-48 bg-muted rounded animate-pulse" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-muted/50 rounded-xl animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Contenu principal — visible après chargement du profil */}
        {profile && <>
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#F97316]" />
              Villes planifiées ({planEntries.length})
            </h2>
            {isAdmin && (
              <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={handleDuplicatePrevious} disabled={saving}>
                <Copy className="w-4 h-4" />
                Dupliquer semaine précédente
              </Button>
            )}
          </div>

          {planEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucune ville planifiée pour cette semaine.{isAdmin && " Ajoutez des villes ci-dessous."}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {planEntries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between bg-secondary/50 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">{entry.ville?.nom || "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.ville?.code_postal} · {departements.find((d) => d.code === entry.ville?.departement_code)?.nom || ""}
                    </p>
                    {entry.chefEquipe && (
                      <p className="text-xs text-[#F97316] font-medium mt-0.5 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {entry.chefEquipe.first_name} {entry.chefEquipe.last_name}
                      </p>
                    )}
                    {!entry.chef_equipe_id && (
                      <p className="text-xs text-muted-foreground/60 mt-0.5">Toute l&apos;équipe</p>
                    )}
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleDelete(entry.id)}
                      className="w-8 h-8 rounded-full hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Carte interactive des villes planifiées */}
          {planEntries.length > 0 && (
            <div className="pt-2 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  Carte des villes planifiées
                </p>
              </div>

              <VilleMapDynamic
                markers={planEntries
                  .filter((e) => e.ville && e.ville.lat !== 0)
                  .map((e): MapMarker => ({
                    lat: e.ville!.lat,
                    lng: e.ville!.lng,
                    label: e.ville!.nom,
                    sublabel: e.chefEquipe ? `${e.chefEquipe.first_name} ${e.chefEquipe.last_name}` : "Toute l'équipe",
                  }))}
                height={400}
              />
            </div>
          )}
        </div>

        {/* Tableau récapitulatif des performances */}
        {planEntries.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="font-bold flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#F97316]" />
                Performances de la semaine
              </h2>
              <span className="text-sm text-muted-foreground font-medium">
                {formatDateFr(currentMonday)} — {formatDateFr(sunday)}
              </span>
            </div>

            {/* KPI globaux */}
            {(() => {
              let totTotal = 0, totSoumise = 0, totAffectee = 0, totAcceptee = 0;
              villeStats.forEach((s) => { totTotal += s.total; totSoumise += s.soumise; totAffectee += s.affectee; totAcceptee += s.acceptee; });
              const convRate = totTotal > 0 ? Math.round((totAcceptee / totTotal) * 100) : 0;
              return (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="bg-secondary/50 rounded-xl px-4 py-3 text-center">
                    <p className="text-2xl font-bold">{totTotal}</p>
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><FileText className="w-3 h-3" />Fiches créées</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl px-4 py-3 text-center">
                    <p className="text-2xl font-bold text-blue-600">{totSoumise}</p>
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Send className="w-3 h-3" />Soumises</p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-950/30 rounded-xl px-4 py-3 text-center">
                    <p className="text-2xl font-bold text-purple-600">{totAffectee}</p>
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><UserCheck className="w-3 h-3" />Affectées</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-950/30 rounded-xl px-4 py-3 text-center">
                    <p className="text-2xl font-bold text-green-600">{totAcceptee}</p>
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><CheckCircle2 className="w-3 h-3" />Acceptées</p>
                  </div>
                  <div className="bg-[#F97316]/10 rounded-xl px-4 py-3 text-center">
                    <p className="text-2xl font-bold text-[#F97316]">{convRate}%</p>
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><TrendingUp className="w-3 h-3" />Conversion</p>
                  </div>
                </div>
              );
            })()}

            {/* Tableau détaillé par ville */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-2.5 px-3 font-semibold">Ville</th>
                    <th className="py-2.5 px-3 font-semibold">Chef d&apos;équipe</th>
                    <th className="py-2.5 px-3 text-center font-semibold">Fiches</th>
                    <th className="py-2.5 px-3 text-center font-semibold">Soumises</th>
                    <th className="py-2.5 px-3 text-center font-semibold">Affectées</th>
                    <th className="py-2.5 px-3 text-center font-semibold">Acceptées</th>
                    <th className="py-2.5 px-3 text-center font-semibold">Taux</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const sorted = [...planEntries].sort((a, b) => {
                      const sa = villeStats.get(a.ville_id);
                      const sb = villeStats.get(b.ville_id);
                      const ra = sa && sa.total > 0 ? (sa.acceptee / sa.total) : 0;
                      const rb = sb && sb.total > 0 ? (sb.acceptee / sb.total) : 0;
                      if (rb !== ra) return rb - ra;
                      return (sb?.total || 0) - (sa?.total || 0);
                    });
                    return (showAllPerfVilles ? sorted : sorted.slice(0, 5));
                  })().map((entry) => {
                    const s = villeStats.get(entry.ville_id);
                    const rate = s && s.total > 0 ? Math.round((s.acceptee / s.total) * 100) : 0;
                    return (
                      <tr key={entry.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                        <td className="py-2.5 px-3">
                          <p className="font-medium">{entry.ville?.nom || "—"}</p>
                          <p className="text-[10px] text-muted-foreground">{entry.ville?.code_postal}</p>
                        </td>
                        <td className="py-2.5 px-3 text-xs">
                          {entry.chefEquipe
                            ? <span className="text-[#F97316] font-medium">{entry.chefEquipe.first_name} {entry.chefEquipe.last_name}</span>
                            : <span className="text-muted-foreground">Toute l&apos;équipe</span>}
                        </td>
                        {(!s || s.total === 0) ? (
                          <td colSpan={5} className="py-2.5 px-3 text-center">
                            <span className="text-xs text-muted-foreground italic">Pas encore prospectée</span>
                          </td>
                        ) : (<>
                          <td className="py-2.5 px-3 text-center font-medium">{s.total}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={s.soumise ? "text-blue-600 font-medium" : "text-muted-foreground/40"}>{s.soumise}</span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={s.affectee ? "text-purple-600 font-medium" : "text-muted-foreground/40"}>{s.affectee}</span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={s.acceptee ? "text-green-600 font-medium" : "text-muted-foreground/40"}>{s.acceptee}</span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                              rate >= 50 ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400"
                              : rate > 0 ? "bg-[#F97316]/10 text-[#F97316]"
                              : "bg-secondary text-muted-foreground"
                            }`}>
                              {rate}%
                            </span>
                          </td>
                        </>)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {planEntries.length > 5 && (
              <button
                onClick={() => setShowAllPerfVilles(!showAllPerfVilles)}
                className="w-full text-center py-2 text-sm font-medium text-[#F97316] hover:text-[#F97316]/80 transition-colors flex items-center justify-center gap-1"
              >
                {showAllPerfVilles
                  ? <>Voir moins <ChevronUp className="w-4 h-4" /></>
                  : <>Voir plus ({planEntries.length - 5} villes) <ChevronDown className="w-4 h-4" /></>}
              </button>
            )}
          </div>
        )}

        {/* Ajouter des villes — ADMIN uniquement */}
        {isAdmin && <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="font-bold flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Ajouter des villes
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Département</label>
              <Autocomplete
                options={departements.map((d) => ({ value: d.code, label: `${d.code} — ${d.nom}` }))}
                value={selectedDept}
                onChange={(v) => { setSelectedDept(v); setSelectedVilles(new Set()); }}
                placeholder="Rechercher un département…"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Ville</label>
              <Autocomplete
                options={villes
                  .filter((v) => !planEntries.some((e) => e.ville_id === v.id) && !selectedVilles.has(v.id))
                  .map((v) => ({ value: v.id, label: v.nom, sublabel: v.code_postal }))}
                value=""
                onChange={(villeId) => { if (villeId) toggleVille(villeId); }}
                placeholder={selectedDept ? "Rechercher une ville…" : "Choisir un département d'abord"}
                disabled={!selectedDept}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Chef d&apos;équipe</label>
              <Autocomplete
                options={[
                  { value: "", label: "Toute l'équipe" },
                  ...chefsEquipe.map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name}` })),
                ]}
                value={selectedChef}
                onChange={setSelectedChef}
                placeholder="Rechercher un chef d'équipe…"
              />
            </div>
          </div>

          {selectedVilles.size > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{selectedVilles.size} ville(s) sélectionnée(s) :</p>
              <div className="flex flex-wrap gap-2">
                {[...selectedVilles].map((villeId) => {
                  const v = villes.find((x) => x.id === villeId);
                  return (
                    <span key={villeId} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F97316]/10 text-[#F97316] text-sm font-medium border border-[#F97316]/30">
                      {v?.nom || villeId}
                      <button type="button" onClick={() => toggleVille(villeId)} className="hover:text-[#EA580C]">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  );
                })}
              </div>
              <div className="flex items-center justify-end pt-2 border-t border-border">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Planifier
                </Button>
              </div>
            </div>
          )}
        </div>}
        </>}
      </div>
    </>
  );
}
