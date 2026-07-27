"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Topbar } from "@/components/layout/Topbar";
import { ExportPdfButton } from "@/components/ui/export-pdf-button";
import { ExportCsvButton } from "@/components/ui/export-csv-button";
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
import { type MapMarker } from "@/components/ui/VilleMap";
import { RouteMapDynamic, type RouteData } from "@/components/ui/RouteMapDynamic";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Route } from "lucide-react";

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
  const [villeStats, setVilleStats] = useState<Map<string, VilleStats>>(new Map());
  const [showAllPerfVilles, setShowAllPerfVilles] = useState(false);
  const [parcours, setParcours] = useState<RouteData | null>(null);
  const [parcoursId, setParcoursId] = useState<string | null>(null);
  const [savedParcoursList, setSavedParcoursList] = useState<Array<{
    id: string;
    semaine_du: string;
    distance_m: number | null;
    duration_s: number | null;
    nb_waypoints: number;
    updated_at: string;
    villes: string[];
    createdBy?: { first_name: string; last_name: string } | null;
    nom: string | null;
    date_effective: string | null;
  }>>([]);
  const [savedParcoursOpen, setSavedParcoursOpen] = useState(false);
  const [loadingSavedParcours, setLoadingSavedParcours] = useState(false);
  const [savedParcoursSearch, setSavedParcoursSearch] = useState("");

  const mondayStr = `${currentMonday.getFullYear()}-${String(currentMonday.getMonth() + 1).padStart(2, "0")}-${String(currentMonday.getDate()).padStart(2, "0")}`;
  const sunday = new Date(currentMonday);
  sunday.setDate(currentMonday.getDate() + 6);
  const sundayStr = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, "0")}-${String(sunday.getDate()).padStart(2, "0")}`;

  const isAdmin = profile?.role === "DIRECTION" || profile?.role === "SUPER_ADMIN" || profile?.role === "CHEF_EQUIPE" || profile?.role === "COMMERCIAL";
  const canEditParcours = profile?.role === "DIRECTION" || profile?.role === "SUPER_ADMIN" || profile?.role === "CHEF_EQUIPE" || profile?.role === "COMMERCIAL";

  const fetchPlan = useCallback(async () => {
    if (!profile) return;

    // Tout charger en parallèle (plan + parcours + départements + chefs)
    const _branchFilter = (isDG && selectedBranchId !== "all") ? selectedBranchId : null;
    const parcoursOrg = _branchFilter ?? profile.organization_id;
    let planQuery = supabase.from("planification_hebdo").select("id, ville_id, chef_equipe_id").eq("semaine_du", mondayStr);
    if (_branchFilter) {
      planQuery = planQuery.eq("organization_id", _branchFilter);
    } else if (!isDG) {
      planQuery = planQuery.eq("organization_id", profile.organization_id);
    }
    const [deptRes, planRes, chefsRes, parcoursRes] = await Promise.all([
      supabase.from("zones_departements").select("*").order("code"),
      planQuery,
      isAdmin
        ? supabase.from("profiles").select("id, first_name, last_name").eq("role", "CHEF_EQUIPE").eq("is_active", true)
        : Promise.resolve({ data: null }),
      supabase
        .from("parcours_hebdo")
        .select("id, waypoints, route_geometry, distance_m, duration_s, nom, date_effective")
        .eq("organization_id", parcoursOrg)
        .eq("semaine_du", mondayStr)
        .is("chef_equipe_id", null)
        .maybeSingle(),
    ]);

    if (deptRes.data) setDepartements(deptRes.data);
    if (chefsRes.data) setReferents(chefsRes.data);

    // Parcours
    if (parcoursRes.data) {
      setParcoursId(parcoursRes.data.id);
      setParcours({
        waypoints: (parcoursRes.data.waypoints ?? []) as [number, number][],
        route_geometry: (parcoursRes.data.route_geometry ?? []) as [number, number][],
        distance_m: parcoursRes.data.distance_m,
        duration_s: parcoursRes.data.duration_s,
        nom: parcoursRes.data.nom,
        date_effective: parcoursRes.data.date_effective,
      });
    } else {
      setParcoursId(null);
      setParcours(null);
    }

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
  }, [profile, mondayStr, isAdmin, supabase, isDG, selectedBranchId]);

  useEffect(() => {
    if (profileLoading || !profile) return;
    fetchPlan();
  }, [profileLoading, profile, fetchPlan]);

  const handleSaveParcours = useCallback(async (data: RouteData) => {
    if (!profile) return;
    const orgId = (isDG && selectedBranchId !== "all") ? selectedBranchId : profile.organization_id;
    const payload = {
      organization_id: orgId,
      semaine_du: mondayStr,
      chef_equipe_id: null,
      waypoints: data.waypoints,
      route_geometry: data.route_geometry,
      distance_m: data.distance_m != null ? Math.round(data.distance_m) : null,
      duration_s: data.duration_s != null ? Math.round(data.duration_s) : null,
      nom: data.nom ?? null,
      date_effective: data.date_effective ?? null,
      created_by: profile.id,
    };
    if (parcoursId) {
      const { error } = await supabase.from("parcours_hebdo").update(payload).eq("id", parcoursId);
      if (error) throw error;
    } else {
      const { data: inserted, error } = await supabase
        .from("parcours_hebdo").insert(payload).select("id").single();
      if (error) throw error;
      if (inserted) setParcoursId(inserted.id);
    }
    setParcours(data);
  }, [profile, isDG, selectedBranchId, mondayStr, parcoursId, supabase]);

  const handleDeleteParcours = useCallback(async () => {
    if (!parcoursId) return;
    const { error } = await supabase.from("parcours_hebdo").delete().eq("id", parcoursId);
    if (error) throw error;
    setParcoursId(null);
    setParcours(null);
  }, [parcoursId, supabase]);

  // Liste de tous les parcours enregistrés (pour la modale historique)
  const fetchSavedParcoursList = useCallback(async () => {
    if (!profile) return;
    setLoadingSavedParcours(true);
    const branchFilter = (isDG && selectedBranchId !== "all") ? selectedBranchId : profile.organization_id;

    const { data: parcoursRows } = await supabase
      .from("parcours_hebdo")
      .select("id, semaine_du, distance_m, duration_s, waypoints, updated_at, created_by, nom, date_effective")
      .eq("organization_id", branchFilter)
      .order("semaine_du", { ascending: false })
      .limit(50);

    if (!parcoursRows || parcoursRows.length === 0) {
      setSavedParcoursList([]);
      setLoadingSavedParcours(false);
      return;
    }

    const semaines = [...new Set(parcoursRows.map((p) => p.semaine_du))];
    const creatorIds = [...new Set(parcoursRows.map((p) => p.created_by))];

    const [planRes, villesRes, creatorsRes] = await Promise.all([
      supabase.from("planification_hebdo").select("semaine_du, ville_id").eq("organization_id", branchFilter).in("semaine_du", semaines),
      supabase.from("zones_villes").select("id, nom"),
      supabase.from("profiles").select("id, first_name, last_name").in("id", creatorIds),
    ]);

    const villeMap = new Map((villesRes.data || []).map((v) => [v.id, v.nom]));
    const creatorMap = new Map((creatorsRes.data || []).map((c) => [c.id, c]));
    const villesBySemaine = new Map<string, Set<string>>();
    (planRes.data || []).forEach((p) => {
      if (!villesBySemaine.has(p.semaine_du)) villesBySemaine.set(p.semaine_du, new Set());
      const nom = villeMap.get(p.ville_id);
      if (nom) villesBySemaine.get(p.semaine_du)!.add(nom);
    });

    setSavedParcoursList(
      parcoursRows.map((p) => ({
        id: p.id,
        semaine_du: p.semaine_du,
        distance_m: p.distance_m,
        duration_s: p.duration_s,
        nb_waypoints: (p.waypoints as [number, number][])?.length ?? 0,
        updated_at: p.updated_at,
        villes: [...(villesBySemaine.get(p.semaine_du) ?? new Set<string>())].sort(),
        createdBy: creatorMap.get(p.created_by) ?? null,
        nom: p.nom,
        date_effective: p.date_effective,
      })),
    );
    setLoadingSavedParcours(false);
  }, [profile, isDG, selectedBranchId, supabase]);

  function openSavedParcoursDialog() {
    setSavedParcoursOpen(true);
    fetchSavedParcoursList();
  }

  function goToSemaine(semaine_du: string) {
    const [y, m, d] = semaine_du.split("-").map(Number);
    setCurrentMonday(new Date(y, m - 1, d));
    setSavedParcoursOpen(false);
  }

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
          const passedAffectee = new Set(["AFFECTEE", "RDV_A_REPRENDRE", "ACCEPTEE", "RETRACTATION", "REFUSEE", "ARCHIVEE"]);
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
    // Quand la DG plannifie pour une succursale, on enregistre dans
    // l'organisation sélectionnée — pas celle du profil DG (siège).
    // Sinon les commerciaux/référents de la succursale ne voient rien.
    const orgId = (isDG && selectedBranchId !== "all") ? selectedBranchId : profile.organization_id;
    const rows = [...selectedVilles].map((ville_id) => ({
      organization_id: orgId,
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

    const orgId = (isDG && selectedBranchId !== "all") ? selectedBranchId : profile.organization_id;
    const { data } = await supabase
      .from("planification_hebdo")
      .select("ville_id, chef_equipe_id")
      .eq("organization_id", orgId)
      .eq("semaine_du", prevMondayStr);

    if (!data || data.length === 0) {
      toast.error("Aucune planification la semaine précédente");
      return;
    }

    setSaving(true);
    const rows = data.map((d) => ({
      organization_id: orgId,
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
      <Topbar
        title="Planification hebdomadaire"
        actions={
          <div className="flex items-center gap-2">
            <ExportPdfButton
              title="Planification hebdomadaire"
              subtitle={`Semaine du ${formatDateFr(currentMonday)} — ${formatDateFr(sunday)}`}
              filename={`planification-${mondayStr}`}
            />
            <ExportCsvButton
              filename={`planification-${mondayStr}`}
              getData={() => {
                const distanceKm = parcours?.distance_m != null ? (parcours.distance_m / 1000).toFixed(2) : "";
                const durationMin = parcours?.duration_s != null ? Math.round(parcours.duration_s / 60).toString() : "";
                const nbPoints = parcours?.waypoints?.length?.toString() ?? "0";
                return {
                  columns: [
                    { key: "semaine_du", label: "Semaine du" },
                    { key: "ville", label: "Ville" },
                    { key: "code_postal", label: "Code postal" },
                    { key: "departement", label: "Département" },
                    { key: "chef_equipe", label: "Chef d'équipe" },
                    { key: "fiches_total", label: "Fiches total" },
                    { key: "fiches_soumises", label: "Fiches soumises" },
                    { key: "fiches_affectees", label: "Fiches affectées" },
                    { key: "fiches_acceptees", label: "Fiches acceptées" },
                    { key: "fiches_refusees", label: "Fiches refusées" },
                    { key: "parcours_points", label: "Parcours (points)" },
                    { key: "parcours_distance_km", label: "Distance parcours (km)" },
                    { key: "parcours_duree_min", label: "Durée parcours (min)" },
                  ] as { key: keyof {
                    semaine_du: string; ville: string; code_postal: string; departement: string;
                    chef_equipe: string; fiches_total: string; fiches_soumises: string;
                    fiches_affectees: string; fiches_acceptees: string; fiches_refusees: string;
                    parcours_points: string; parcours_distance_km: string; parcours_duree_min: string;
                  }; label: string }[],
                  rows: planEntries.map((e) => {
                    const s = villeStats.get(e.ville_id);
                    return {
                      semaine_du: mondayStr,
                      ville: e.ville?.nom ?? "",
                      code_postal: e.ville?.code_postal ?? "",
                      departement: e.ville?.departement_code ?? "",
                      chef_equipe: e.chefEquipe ? `${e.chefEquipe.first_name} ${e.chefEquipe.last_name}` : "Toute l'équipe",
                      fiches_total: (s?.total ?? 0).toString(),
                      fiches_soumises: (s?.soumise ?? 0).toString(),
                      fiches_affectees: (s?.affectee ?? 0).toString(),
                      fiches_acceptees: (s?.acceptee ?? 0).toString(),
                      fiches_refusees: (s?.refusee ?? 0).toString(),
                      parcours_points: nbPoints,
                      parcours_distance_km: distanceKm,
                      parcours_duree_min: durationMin,
                    };
                  }),
                };
              }}
            />
          </div>
        }
      />
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">

        {/* ═══ HERO PLANIFICATION — navy signature ══════════════════════════ */}
        <div className="hero-surface hero-surface-sm rounded-3xl p-6 sm:p-7">
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <span className="text-[10px] tracking-[1.2px] uppercase text-white/50 font-medium">
                  Planification hebdomadaire
                </span>
                <h1 className="font-heading text-3xl sm:text-4xl text-white tracking-tight leading-none mt-1.5">
                  Semaine du <span className="text-[#F97316]">{formatDateFr(currentMonday)}</span>
                </h1>
                <p className="text-sm text-white/60 mt-1.5">
                  Au dimanche {formatDateFr(sunday)} · {planEntries.length} ville{planEntries.length > 1 ? "s" : ""} planifiée{planEntries.length > 1 ? "s" : ""}
                </p>
              </div>
              <button
                onClick={openSavedParcoursDialog}
                className="flex-shrink-0 bg-emerald-500/90 hover:bg-emerald-500 text-white rounded-full px-4 py-2 text-sm font-medium inline-flex items-center gap-2 transition-colors self-start"
                aria-label="Voir les trajets enregistrés"
              >
                <Route className="w-4 h-4" />
                Trajets enregistrés
              </button>
            </div>

            {/* Navigation semaines */}
            <div className="mt-5 pt-5 border-t border-white/10 flex items-center gap-3">
              <button
                onClick={() => navigateWeek(-1)}
                aria-label="Semaine précédente"
                className="bg-white/8 hover:bg-white/15 border border-white/10 rounded-full w-9 h-9 flex items-center justify-center text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex-1 flex items-center gap-2 text-sm text-white/70">
                <Calendar className="w-4 h-4 text-[#F97316]" />
                <span className="font-medium text-white">Vue semaine</span>
                <span className="text-white/50">· lundi → dimanche</span>
              </div>
              <button
                onClick={() => navigateWeek(1)}
                aria-label="Semaine suivante"
                className="bg-white/8 hover:bg-white/15 border border-white/10 rounded-full w-9 h-9 flex items-center justify-center text-white transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Contenu principal */}
        <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] p-6 space-y-4">
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
                <div key={entry.id} className="flex items-center justify-between bg-secondary/50 hover:bg-secondary/80 rounded-xl px-4 py-3 transition-colors group">
                  <Link
                    href={`/fiches?search=${encodeURIComponent(entry.ville?.nom || "")}`}
                    className="flex-1 min-w-0"
                    title={`Voir les fiches de ${entry.ville?.nom || ""}`}
                  >
                    <p className="text-sm font-semibold group-hover:text-[#F97316] transition-colors">{entry.ville?.nom || "—"}</p>
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
                  </Link>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleDelete(entry.id)}
                      className="w-8 h-8 rounded-full hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors shrink-0 ml-2"
                      aria-label="Supprimer cette planification"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Carte interactive des villes planifiées + parcours de tournée */}
          {planEntries.length > 0 && (
            <div className="pt-2 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  Carte des villes planifiées & parcours de tournée
                </p>
              </div>

              <RouteMapDynamic
                markers={planEntries
                  .filter((e) => e.ville && e.ville.lat !== 0)
                  .map((e): MapMarker => ({
                    lat: e.ville!.lat,
                    lng: e.ville!.lng,
                    label: e.ville!.nom,
                    sublabel: e.chefEquipe ? `${e.chefEquipe.first_name} ${e.chefEquipe.last_name}` : "Toute l'équipe",
                  }))}
                route={parcours}
                isEditable={canEditParcours}
                onSave={handleSaveParcours}
                onDelete={parcoursId ? handleDeleteParcours : undefined}
                height={450}
              />
            </div>
          )}
        </div>

        {/* Tableau récapitulatif des performances */}
        {planEntries.length > 0 && (
          <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] p-6 space-y-4">
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
            <div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-2.5 px-2 sm:px-3 font-semibold">Ville</th>
                    <th className="py-2.5 px-2 sm:px-3 font-semibold hidden sm:table-cell">Chef d&apos;équipe</th>
                    <th className="py-2.5 px-2 sm:px-3 text-center font-semibold">Fiches</th>
                    <th className="py-2.5 px-2 sm:px-3 text-center font-semibold hidden sm:table-cell">Soumises</th>
                    <th className="py-2.5 px-2 sm:px-3 text-center font-semibold hidden sm:table-cell">Affectées</th>
                    <th className="py-2.5 px-2 sm:px-3 text-center font-semibold">Acceptées</th>
                    <th className="py-2.5 px-2 sm:px-3 text-center font-semibold">Taux</th>
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
                        <td className="py-2.5 px-2 sm:px-3">
                          <p className="font-medium">{entry.ville?.nom || "—"}</p>
                          <p className="text-[10px] text-muted-foreground">{entry.ville?.code_postal}</p>
                        </td>
                        <td className="py-2.5 px-2 sm:px-3 text-xs hidden sm:table-cell">
                          {entry.chefEquipe
                            ? <span className="text-[#F97316] font-medium">{entry.chefEquipe.first_name} {entry.chefEquipe.last_name}</span>
                            : <span className="text-muted-foreground">Toute l&apos;équipe</span>}
                        </td>
                        {(!s || s.total === 0) ? (
                          <>
                            <td colSpan={3} className="py-2.5 px-2 text-center sm:hidden">
                              <span className="text-xs text-muted-foreground italic">Pas encore prospectée</span>
                            </td>
                            <td colSpan={5} className="py-2.5 px-3 text-center hidden sm:table-cell">
                              <span className="text-xs text-muted-foreground italic">Pas encore prospectée</span>
                            </td>
                          </>
                        ) : (<>
                          <td className="py-2.5 px-2 sm:px-3 text-center font-medium">{s.total}</td>
                          <td className="py-2.5 px-2 sm:px-3 text-center hidden sm:table-cell">
                            <span className={s.soumise ? "text-blue-600 font-medium" : "text-muted-foreground/40"}>{s.soumise}</span>
                          </td>
                          <td className="py-2.5 px-2 sm:px-3 text-center hidden sm:table-cell">
                            <span className={s.affectee ? "text-purple-600 font-medium" : "text-muted-foreground/40"}>{s.affectee}</span>
                          </td>
                          <td className="py-2.5 px-2 sm:px-3 text-center">
                            <span className={s.acceptee ? "text-green-600 font-medium" : "text-muted-foreground/40"}>{s.acceptee}</span>
                          </td>
                          <td className="py-2.5 px-2 sm:px-3 text-center">
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
        {isAdmin && <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] p-6 space-y-4">
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
      </div>

      {/* Dialog : trajets enregistrés (historique) */}
      <Dialog open={savedParcoursOpen} onOpenChange={setSavedParcoursOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Route className="w-5 h-5 text-[#F97316]" />
              Trajets enregistrés
            </DialogTitle>
          </DialogHeader>
          {/* Recherche par nom */}
          {savedParcoursList.length > 0 && (
            <div className="pt-1 pb-2">
              <input
                type="text"
                placeholder="Rechercher un parcours par nom, ville…"
                value={savedParcoursSearch}
                onChange={(e) => setSavedParcoursSearch(e.target.value)}
                className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
              />
            </div>
          )}

          <div className="overflow-y-auto -mx-6 px-6 flex-1">
            {loadingSavedParcours ? null : savedParcoursList.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <Route className="w-10 h-10 mx-auto text-muted-foreground opacity-40" />
                <p className="text-sm font-medium">Aucun trajet enregistré</p>
                <p className="text-xs text-muted-foreground">Les parcours tracés apparaîtront ici.</p>
              </div>
            ) : (
              (() => {
                const q = savedParcoursSearch.trim().toLowerCase();
                const filtered = q
                  ? savedParcoursList.filter((p) =>
                      (p.nom?.toLowerCase().includes(q)) ||
                      p.villes.some((v) => v.toLowerCase().includes(q)) ||
                      p.semaine_du.includes(q),
                    )
                  : savedParcoursList;

                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-10 space-y-2">
                      <p className="text-sm font-medium">Aucun résultat</p>
                      <p className="text-xs text-muted-foreground">Essayez un autre nom ou ville.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2 py-2">
                    {filtered.map((p) => {
                      const [y, m, d] = p.semaine_du.split("-").map(Number);
                      const monday = new Date(y, m - 1, d);
                      const sun = new Date(monday); sun.setDate(monday.getDate() + 6);
                      const isCurrent = p.semaine_du === mondayStr;
                      const km = p.distance_m != null ? (p.distance_m / 1000).toFixed(2) + " km" : "—";
                      const dur = p.duration_s != null ? Math.round(p.duration_s / 60) + " min" : "—";
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => goToSemaine(p.semaine_du)}
                          className={`w-full text-left rounded-xl border p-4 transition-all hover:border-[#F97316] hover:shadow-sm ${isCurrent ? "border-[#F97316] bg-[#F97316]/5" : "border-border bg-card"}`}
                        >
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-bold text-sm text-foreground truncate">
                                  {p.nom || `Semaine du ${formatDateFr(monday)}`}
                                </p>
                                {isCurrent && (
                                  <span className="text-[10px] font-semibold text-[#F97316] bg-[#F97316]/10 px-2 py-0.5 rounded-full">
                                    Semaine active
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {p.date_effective ? (
                                  <>Date effective : <span className="font-medium">{new Date(p.date_effective).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</span></>
                                ) : (
                                  <>Semaine du {formatDateFr(monday)} au {formatDateFr(sun)}</>
                                )}
                              </p>
                              {p.villes.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                                  <MapPin className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{p.villes.join(", ")}</span>
                                </p>
                              )}
                              {p.createdBy && (
                                <p className="text-[11px] text-muted-foreground mt-1">
                                  Tracé par {p.createdBy.first_name} {p.createdBy.last_name}
                                </p>
                              )}
                            </div>
                            <div className="text-right shrink-0 space-y-0.5">
                              <p className="text-sm font-bold text-[#F97316]">{km}</p>
                              <p className="text-xs text-muted-foreground">{dur} · {p.nb_waypoints} pts</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })()
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
