"use client";

import { useEffect, useLayoutEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { ExportPdfButton } from "@/components/ui/export-pdf-button";
import { ExportCsvButton } from "@/components/ui/export-csv-button";
import { FicheStatusBadge } from "@/components/fiches/FicheStatusBadge";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/use-profile";
import { useBranch } from "@/lib/context/branch-context";
import { getCachedProfileId } from "@/lib/utils";
import type { FicheStatus, MotifRefus } from "@/types/database";
import { STATUS_LABELS, MOTIF_REFUS_LABELS } from "@/lib/permissions";
import { type PeriodFilter, PERIOD_LABELS, getPeriodDates, getPeriodLabel as getReportPeriodLabel } from "@/lib/periods";
import {
  BarChart3, TrendingUp, Users, FileText, Search, X, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, Clock, Euro,
  Trophy, RefreshCw, CalendarDays, MapPin, Wrench, CalendarCheck,
} from "lucide-react";
import { KpiCard, CustomTooltip } from "@/components/reporting/KpiCard";
import { ConversionFunnel } from "@/components/reporting/ConversionFunnel";
import { CommercialReportingView } from "@/components/reporting/CommercialReportingView";
import { EvolutionChart, bucketReferentFiches, bucketCommercialVentes } from "@/components/reporting/EvolutionChart";
import type { Granularity } from "@/components/reporting/EvolutionChart";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
  Area, AreaChart,
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────
interface StatusCount { status: FicheStatus; count: number; }
interface ReferentRow { id: string; name: string; total: number; submitted: number; accepted: number; ca: number; }
interface CommercialRow { id: string; name: string; assigned: number; accepted: number; refused: number; rate: number; ca: number; }
interface VilleRow { ville: string; accepted: number; refused: number; total: number; rate: number; }
interface WeeklyPoint { label: string; creees: number; acceptees: number; }
interface BranchRow { orgId: string; total: number; accepted: number; refused: number; ca: number; rate: number; }

function roundToHundred(values: number[], total: number): number[] {
  if (total === 0) return values.map(() => 0);
  const raw = values.map((v) => (v / total) * 100);
  const floored = raw.map((r) => Math.floor(r));
  let diff = 100 - floored.reduce((a, b) => a + b, 0);
  const remainders = raw.map((r, i) => ({ i, r: r - floored[i] })).sort((a, b) => b.r - a.r);
  for (let k = 0; k < diff; k++) floored[remainders[k].i]++;
  return floored;
}

// ── Palette statuts ───────────────────────────────────────────────────────────
const STATUS_COLORS_HEX: Record<FicheStatus, string> = {
  BROUILLON: "#94a3b8", SOUMISE: "#3b82f6", VALIDEE: "#6366f1",
  AFFECTEE: "#f97316", RDV_A_REPRENDRE: "#eab308", ACCEPTEE: "#10b981",
  RETRACTATION: "#ec4899", RDV_TECHNICIEN: "#a855f7", INSTALLEE: "#14b8a6",
  REFUSEE: "#ef4444", ARCHIVEE: "#cbd5e1",
};

const STATUS_BAR_COLORS: Record<FicheStatus, string> = {
  BROUILLON: "bg-slate-400", SOUMISE: "bg-blue-500", VALIDEE: "bg-indigo-500",
  AFFECTEE: "bg-orange-500", RDV_A_REPRENDRE: "bg-yellow-500", ACCEPTEE: "bg-emerald-500",
  RETRACTATION: "bg-pink-500", RDV_TECHNICIEN: "bg-purple-500", INSTALLEE: "bg-teal-500",
  REFUSEE: "bg-red-500", ARCHIVEE: "bg-slate-300",
};

// ── Composants locaux ─────────────────────────────────────────────────────────

function Bar2({ value, max, colorClass }: { value: number; max: number; colorClass: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-700 ${colorClass}`} style={{ width: `${pct}%` }} />
    </div>
  );
}



// ── Page ─────────────────────────────────────────────────────────────────────

export default function ReportingPage() {
  const { profile } = useProfile();
  const { selectedBranchId, isDG, branches } = useBranch();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [statusCounts, setStatusCounts] = useState<StatusCount[]>([]);
  const [referents, setReferents] = useState<ReferentRow[]>([]);
  const [commerciaux, setCommerciaux] = useState<CommercialRow[]>([]);
  const [villes, setVilles] = useState<VilleRow[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyPoint[]>([]);
  const [totalFiches, setTotalFiches] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("ALL");
  const [pieTooltipPos, setPieTooltipPos] = useState<{ x: number; y: number } | undefined>(undefined);
  const [showAllVilles, setShowAllVilles] = useState(false);
  const [showAllReferents, setShowAllReferents] = useState(false);
  const [showAllCommerciaux, setShowAllCommerciaux] = useState(false);
  const [commSearch, setCommSearch] = useState("");
  const [refSearch, setRefSearch] = useState("");
  const [motifRefusCounts, setMotifRefusCounts] = useState<Record<MotifRefus, number>>({ RDC: 0, ANNULATION: 0, REFUS_CLASSIQUE: 0 });
  const [caTotal, setCaTotal] = useState(0);
  const [branchStats, setBranchStats] = useState<BranchRow[]>([]);
  const [confirmNav, setConfirmNav] = useState<{ type: "commercial" | "referent"; id: string; name: string } | null>(null);
  const [rawFiches, setRawFiches] = useState<{ created_by: string; assigned_to: string | null; status: string; montant_ht: number | null; created_at: string }[]>([]);
  const [selectedRefPerson, setSelectedRefPerson] = useState("all");
  const [selectedCommPerson, setSelectedCommPerson] = useState("all");
  const [refGranularity, setRefGranularity] = useState<Granularity>("month");
  const [commGranularity, setCommGranularity] = useState<Granularity>("month");
  const [selectedCommEvolPerson, setSelectedCommEvolPerson] = useState("all");
  const [commEvolGranularity, setCommEvolGranularity] = useState<Granularity>("month");
  const [weeklyTrendOffset, setWeeklyTrendOffset] = useState(0);

  const isCommercial = profile?.role === "COMMERCIAL";

  const rpCacheKey = profile ? `rpt_cache_${profile.id}` : null;
  useLayoutEffect(() => {
    const pid = getCachedProfileId();
    if (!pid) return;
    try {
      const raw = localStorage.getItem(`rpt_cache_${pid}`);
      if (!raw) return;
      const c = JSON.parse(raw);
      if (c.statusCounts) setStatusCounts(c.statusCounts);
      if (c.totalFiches != null) setTotalFiches(c.totalFiches);
      if (c.caTotal != null) setCaTotal(c.caTotal);
      if (c.referents) setReferents(c.referents);
      if (c.commerciaux) setCommerciaux(c.commerciaux);
      if (c.villes) setVilles(c.villes);
      if (c.weeklyData) setWeeklyData(c.weeklyData);
      if (c.motifRefusCounts) setMotifRefusCounts(c.motifRefusCounts);
      if (c.branchStats) setBranchStats(c.branchStats);
      setLoading(false);
    } catch { /* ignore */ }
  }, []);

  const saveRptCache = useCallback((data: Record<string, unknown>) => {
    if (!rpCacheKey) return;
    try { localStorage.setItem(rpCacheKey, JSON.stringify(data)); } catch { /* ignore */ }
  }, [rpCacheKey]);

  async function loadData(profileId: string, role: string, period: PeriodFilter = "ALL") {
    const isComm = role === "COMMERCIAL";
    const statuses: FicheStatus[] = isComm
      ? ["AFFECTEE", "RDV_A_REPRENDRE", "ACCEPTEE", "RETRACTATION", "REFUSEE", "RDV_TECHNICIEN", "INSTALLEE", "ARCHIVEE"]
      : ["SOUMISE", "VALIDEE", "AFFECTEE", "RDV_A_REPRENDRE", "ACCEPTEE", "RETRACTATION", "REFUSEE", "RDV_TECHNICIEN", "INSTALLEE", "ARCHIVEE"];

    const _branchFilter = (isDG && selectedBranchId !== "all") ? selectedBranchId : null;
    const dates = getPeriodDates(period);
    let ficheIdsForPeriod: string[] | null = null;

    if (dates) {
      const from = `${dates.from}T00:00:00Z`;
      const to   = `${dates.to}T23:59:59Z`;
      let ficheQ = supabase
        .from("fiches").select("id").neq("status", "BROUILLON")
        .gte("updated_at", from).lte("updated_at", to);
      if (isComm) ficheQ = ficheQ.eq("assigned_to", profileId);
      if (_branchFilter) ficheQ = ficheQ.eq("organization_id", _branchFilter);
      const { data: ficheRows } = await ficheQ;
      ficheIdsForPeriod = (ficheRows ?? []).map((f: { id: string }) => f.id);

      if (ficheIdsForPeriod.length === 0) {
        setStatusCounts(statuses.map((s) => ({ status: s, count: 0 })));
        setTotalFiches(0);
        setCaTotal(0);
        setMotifRefusCounts({ RDC: 0, ANNULATION: 0, REFUS_CLASSIQUE: 0 });
        setReferents([]);
        let emptyCommQ = supabase
          .from("profiles").select("id, first_name, last_name")
          .eq("role", "COMMERCIAL").eq("is_active", true);
        if (_branchFilter) emptyCommQ = emptyCommQ.eq("organization_id", _branchFilter);
        const { data: emptyCommProfiles } = await emptyCommQ;
        setCommerciaux((emptyCommProfiles ?? []).map((p: { id: string; first_name: string; last_name: string }) => ({
          id: p.id, name: `${p.first_name} ${p.last_name}`, assigned: 0, accepted: 0, refused: 0, rate: 0, ca: 0,
        })));
        setVilles([]);
        setWeeklyData([]);
        setLoading(false);
        return;
      }
    }

    // ── Construire les requêtes indépendantes ──
    // Pas de JOIN sur profiles ici — on les charge séparément en parallèle (requête beaucoup plus légère)
    let fichesQuery = supabase
      .from("fiches")
      .select("id, created_by, assigned_to, organization_id, status, motif_refus, montant_ht, prospect_ville, ville_id, created_at")
      .neq("status", "BROUILLON");
    if (isComm) fichesQuery = fichesQuery.eq("assigned_to", profileId);
    if (ficheIdsForPeriod) fichesQuery = fichesQuery.in("id", ficheIdsForPeriod);
    if (_branchFilter) fichesQuery = fichesQuery.eq("organization_id", _branchFilter);

    // Une seule requête pour tous les profils actifs — sert à la fois au tableau des commerciaux et à la résolution des noms créateurs
    let allProfilesQ = supabase
      .from("profiles").select("id, first_name, last_name, role")
      .eq("is_active", true);
    if (_branchFilter) allProfilesQ = allProfilesQ.eq("organization_id", _branchFilter);

    const _planifOrg = _branchFilter ?? profile!.organization_id;
    let planifQ = supabase
      .from("planification_hebdo")
      .select("ville_id, zones_villes!inner(nom)")
      .eq("organization_id", _planifOrg);
    if (dates) {
      const fromDate = new Date(dates.from + "T00:00:00");
      const fromDay = fromDate.getDay();
      fromDate.setDate(fromDate.getDate() - (fromDay === 0 ? 6 : fromDay - 1));
      const mondayOfFrom = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, "0")}-${String(fromDate.getDate()).padStart(2, "0")}`;
      planifQ = planifQ.gte("semaine_du", mondayOfFrom).lte("semaine_du", dates.to);
    }

    // ── Tout en parallèle : fiches + tous les profils + planification ──
    const [{ data: fichesRaw }, { data: allProfilesData }, { data: planifRows }] = await Promise.all([
      fichesQuery,
      allProfilesQ,
      planifQ,
    ]);

    const allProfiles = allProfilesData ?? [];
    // Commerciaux actifs pour initialiser les lignes vides du tableau
    const allCommProfiles = allProfiles.filter((p) => p.role === "COMMERCIAL");
    // Map id → nom complet pour tous les profils
    const profileNameMap: Record<string, string> = {};
    for (const p of allProfiles) profileNameMap[p.id] = `${p.first_name} ${p.last_name}`;

    type FicheRow = {
      id: string; created_by: string; assigned_to: string | null; organization_id: string; status: string;
      montant_ht: number | null; motif_refus: MotifRefus | null; prospect_ville: string | null; ville_id: string | null; created_at: string;
    };
    const fiches = (fichesRaw ?? []) as unknown as FicheRow[];
    setRawFiches(fiches);

    // ── Compter les statuts côté client (remplace 7-8 requêtes COUNT individuelles) ──
    const statusMap: Record<string, number> = {};
    for (const f of fiches) statusMap[f.status] = (statusMap[f.status] ?? 0) + 1;
    const countResults = statuses.map((s) => ({ status: s, count: statusMap[s] ?? 0 }));
    setStatusCounts(countResults);
    setTotalFiches(countResults.reduce((a, b) => a + b.count, 0));

    // ── Ventilation des refus par motif ──
    const motifCounts: Record<MotifRefus, number> = { RDC: 0, ANNULATION: 0, REFUS_CLASSIQUE: 0 };
    for (const f of fiches) {
      if (f.status === "REFUSEE" && f.motif_refus) {
        motifCounts[f.motif_refus]++;
      }
    }
    setMotifRefusCounts(motifCounts);

    // ── Vue comparative succursales (DG uniquement, vue globale) ──
    let branchRows: BranchRow[] = [];
    if (isDG && !_branchFilter) {
      const bMap = new Map<string, BranchRow>();
      for (const f of fiches) {
        const orgId = f.organization_id;
        if (!orgId) continue;
        if (!bMap.has(orgId)) bMap.set(orgId, { orgId, total: 0, accepted: 0, refused: 0, ca: 0, rate: 0 });
        const b = bMap.get(orgId)!;
        b.total++;
        if (f.status === "ACCEPTEE") { b.accepted++; b.ca += Number(f.montant_ht ?? 0); }
        if (f.status === "REFUSEE") b.refused++;
      }
      branchRows = Array.from(bMap.values())
        .map((b) => ({ ...b, rate: b.total > 0 ? Math.round((b.accepted / b.total) * 100) : 0 }))
        .sort((a, b) => b.accepted - a.accepted);
      setBranchStats(branchRows);
    } else {
      setBranchStats([]);
    }

    // ── 1. Productivité référents ──
    let refRows: ReferentRow[] = [];
    if (!isComm) {
      const refMap: Record<string, ReferentRow> = {};
      for (const f of fiches) {
        const key = f.created_by;
        if (!refMap[key]) {
          const name = profileNameMap[key] ?? "Inconnu";
          refMap[key] = { id: key, name, total: 0, submitted: 0, accepted: 0, ca: 0 };
        }
        refMap[key].total++;
        refMap[key].submitted++;
        if (f.status === "ACCEPTEE") {
          refMap[key].accepted++;
          if (f.montant_ht) refMap[key].ca += Number(f.montant_ht);
        }
      }
      refRows = Object.values(refMap).sort((a, b) => b.total - a.total);
      setReferents(refRows);
    }

    // ── 2. Taux d'acceptation par commercial ──
    const commMap: Record<string, CommercialRow> = {};
    const COMM_STATUSES = ["AFFECTEE", "RETRACTATION", "ACCEPTEE", "REFUSEE"]; // hors ARCHIVEE → cohérent avec baseActive
    for (const p of allCommProfiles ?? []) {
      commMap[p.id] = { id: p.id, name: `${p.first_name} ${p.last_name}`, assigned: 0, accepted: 0, refused: 0, rate: 0, ca: 0 };
    }
    for (const f of fiches) {
      if (!f.assigned_to || !COMM_STATUSES.includes(f.status)) continue;
      const key = f.assigned_to;
      if (!commMap[key]) {
        const name = profileNameMap[key] ?? "Inconnu";
        commMap[key] = { id: key, name, assigned: 0, accepted: 0, refused: 0, rate: 0, ca: 0 };
      }
      commMap[key].assigned++;
      if (f.status === "ACCEPTEE") {
        commMap[key].accepted++;
        if (f.montant_ht) commMap[key].ca += Number(f.montant_ht);
      }
      if (f.status === "REFUSEE") commMap[key].refused++;
    }
    const commRows = Object.values(commMap).map((c) => ({
      ...c,
      rate: c.assigned > 0 ? Math.round((c.accepted / c.assigned) * 100) : 0,
    })).sort((a, b) => b.assigned - a.assigned);
    setCommerciaux(commRows);

    // CA total depuis la source primaire (toutes les fiches ACCEPTEE du dataset filtré)
    setCaTotal(fiches.filter((f) => f.status === "ACCEPTEE").reduce((sum, f) => sum + (f.montant_ht ? Number(f.montant_ht) : 0), 0));
    type PlanifRow = { ville_id: string; zones_villes: { nom: string } };
    // Build a map of planned ville_id → ville name
    const plannedVilleMap = new Map<string, string>();
    for (const pr of (planifRows ?? []) as unknown as PlanifRow[]) {
      plannedVilleMap.set(pr.ville_id, pr.zones_villes.nom.trim());
    }
    // Initialize all planned villes (even those with 0 fiches)
    const villeMap: Record<string, VilleRow> = {};
    for (const [vid, vnom] of plannedVilleMap) {
      villeMap[vid] = { ville: vnom, accepted: 0, refused: 0, total: 0, rate: 0 };
    }
    // Match fiches by ville_id first, then fallback to prospect_ville name match
    const plannedNamesUpper = new Map<string, string>();
    for (const [vid, vnom] of plannedVilleMap) {
      plannedNamesUpper.set(vnom.toUpperCase(), vid);
    }
    for (const f of fiches) {
      let matchKey: string | null = null;
      if (f.ville_id && plannedVilleMap.has(f.ville_id)) {
        matchKey = f.ville_id;
      } else if (f.prospect_ville) {
        const nameKey = f.prospect_ville.trim().toUpperCase();
        if (plannedNamesUpper.has(nameKey)) matchKey = plannedNamesUpper.get(nameKey)!;
      }
      if (!matchKey) continue;
      if (f.status !== "ARCHIVEE") villeMap[matchKey].total++; // hors ARCHIVEE → cohérent avec baseActive
      if (f.status === "ACCEPTEE") villeMap[matchKey].accepted++;
      if (f.status === "REFUSEE") villeMap[matchKey].refused++;
    }
    const villeRows = Object.values(villeMap)
      .map((v) => ({ ...v, rate: v.total > 0 ? Math.round((v.accepted / v.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total);
    setVilles(villeRows);

    // ── 4. Évolution semaine par semaine (depuis le 1er janvier calendaire) ──
    const now = new Date();
    const getMonday = (d: Date) => {
      const day = d.getDay();
      const diff = d.getDate() - (day === 0 ? 6 : day - 1);
      return new Date(d.getFullYear(), d.getMonth(), diff);
    };
    const firstMonday = getMonday(new Date(now.getFullYear(), 0, 1));
    const currentMonday = getMonday(now);
    const WEEK_COUNT = Math.round((currentMonday.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
    const weekStarts: Date[] = [];
    for (let i = WEEK_COUNT - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1) - i * 7);
      weekStarts.push(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
    }
    const weekBuckets: WeeklyPoint[] = weekStarts.map((ws) => {
      const end = new Date(ws);
      end.setDate(end.getDate() + 7);
      const sun = new Date(ws);
      sun.setDate(sun.getDate() + 6);
      const fmtD = (d: Date) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
      const label = `${fmtD(ws)} - ${fmtD(sun)}`;
      let creees = 0, acceptees = 0;
      for (const f of fiches) {
        const d = new Date(f.created_at);
        if (d >= ws && d < end) {
          creees++;
          if (f.status === "ACCEPTEE") acceptees++;
        }
      }
      return { label, creees, acceptees };
    });
    setWeeklyData(weekBuckets);

    saveRptCache({
      statusCounts: countResults,
      totalFiches: countResults.reduce((a: number, b: StatusCount) => a + b.count, 0),
      caTotal: fiches.filter((f) => f.status === "ACCEPTEE").reduce((sum, f) => sum + (f.montant_ht ? Number(f.montant_ht) : 0), 0),
      referents: refRows.slice(0, 20),
      commerciaux: commRows.slice(0, 20),
      villes: villeRows.slice(0, 30),
      weeklyData: weekBuckets,
      motifRefusCounts: motifCounts,
      branchStats: branchRows,
    });
    setLoading(false);
  }

  useEffect(() => {
    if (!profile) return;
    if (profile.role !== "DIRECTION" && profile.role !== "COMMERCIAL" && profile.role !== "DIRECTION_GENERALE" && profile.role !== "SUPER_ADMIN") { router.replace("/"); return; }
    if (profile.role === "COMMERCIAL") { setLoading(false); return; } // délégué à CommercialReportingView
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData(profile.id, profile.role, periodFilter);
    setShowAllVilles(false);
    setShowAllReferents(false);
    setShowAllCommerciaux(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, periodFilter, selectedBranchId]);

  const refPersons = useMemo(() => referents.map((r) => ({ id: r.id, name: r.name })), [referents]);
  const commPersons = useMemo(() => commerciaux.map((c) => ({ id: c.id, name: c.name })), [commerciaux]);
  const refEvolutionData = useMemo(() => bucketReferentFiches(rawFiches, refGranularity, selectedRefPerson), [rawFiches, refGranularity, selectedRefPerson]);
  const commEvolutionData = useMemo(() => bucketCommercialVentes(rawFiches, commGranularity, selectedCommPerson), [rawFiches, commGranularity, selectedCommPerson]);
  const commEvolutionPctData = useMemo(() => bucketCommercialVentes(rawFiches, commEvolGranularity, selectedCommEvolPerson), [rawFiches, commEvolGranularity, selectedCommEvolPerson]);

  const accepted      = statusCounts.find((s) => s.status === "ACCEPTEE")?.count ?? 0;
  const refused       = statusCounts.find((s) => s.status === "REFUSEE")?.count ?? 0;
  const soumises      = statusCounts.find((s) => s.status === "SOUMISE")?.count ?? 0;
  const validees      = statusCounts.find((s) => s.status === "VALIDEE")?.count ?? 0;
  const affectees     = statusCounts.find((s) => s.status === "AFFECTEE")?.count ?? 0;
  const retractation  = statusCounts.find((s) => s.status === "RETRACTATION")?.count ?? 0;
  const rdvTechnicien = statusCounts.find((s) => s.status === "RDV_TECHNICIEN")?.count ?? 0;
  const installees    = statusCounts.find((s) => s.status === "INSTALLEE")?.count ?? 0;
  const inProgress    = soumises + validees + affectees + retractation;
  const baseActive    = accepted + refused + inProgress;
  const acceptanceRate = baseActive > 0 ? Math.round((accepted / baseActive) * 100) : 0;
  const refusalRate    = baseActive > 0 ? Math.round((refused / baseActive) * 100) : 0;
  const inProgressRate = baseActive > 0 ? Math.round((inProgress / baseActive) * 100) : 0;
  const installationRate = (accepted + rdvTechnicien + installees) > 0 ? Math.round((installees / (accepted + rdvTechnicien + installees)) * 100) : 0;
  const _pl = getReportPeriodLabel(periodFilter);
  const periodSuffix = _pl ? ` (${_pl})` : "";
  const isAllPeriod = periodFilter === "ALL";
  const filteredCommerciaux = commSearch
    ? commerciaux.filter((c) => c.name.toLowerCase().includes(commSearch.toLowerCase()))
    : commerciaux;
  const filteredReferents = refSearch
    ? referents.filter((p) => p.name.toLowerCase().includes(refSearch.toLowerCase()))
    : (showAllReferents ? referents : referents.slice(0, 8));

  const pieData = statusCounts.filter((s) => s.count > 0).map((s) => ({
    name: STATUS_LABELS[s.status],
    value: s.count,
    color: STATUS_COLORS_HEX[s.status],
  }));

  const _referentChartData = referents.slice(0, 6).map((p) => ({
    name: p.name.split(" ")[0],
    fullName: p.name,
    "Fiches créées": p.total,
    Acceptées: p.accepted,
  }));




  if (isCommercial && profile) return <CommercialReportingView subjectId={profile.id} />;

  return (
    <>
      <Topbar
        title="Reporting direction"
        actions={<div className="flex items-center gap-2"><ExportPdfButton title={isCommercial ? "Mon reporting" : "Reporting direction"} subtitle={`Période : ${_pl ? `${PERIOD_LABELS[periodFilter]} (${_pl})` : PERIOD_LABELS[periodFilter]}`} filename="reporting" /><ExportCsvButton filename="reporting" getData={() => ({
          columns: [
            { key: "indicateur", label: "Indicateur" },
            { key: "valeur", label: "Valeur" },
          ] as { key: keyof { indicateur: string; valeur: string }; label: string }[],
          rows: [
            { indicateur: "Fiches totales", valeur: String(statusCounts.reduce((s, c) => s + c.count, 0)) },
            { indicateur: "Acceptées", valeur: String(statusCounts.find((s) => s.status === "ACCEPTEE")?.count ?? 0) },
            { indicateur: "Refusées", valeur: String(statusCounts.find((s) => s.status === "REFUSEE")?.count ?? 0) },
            { indicateur: "CA Total HT", valeur: String(caTotal) },
            { indicateur: "Période", valeur: PERIOD_LABELS[periodFilter] },
            ...commerciaux.map((c) => ({ indicateur: `Commercial: ${c.name}`, valeur: `${c.accepted} acceptées, ${c.refused} refusées, ${c.ca}€ CA` })),
            ...villes.map((v) => ({ indicateur: `Ville: ${v.ville}`, valeur: `${v.total} fiches, ${v.rate}% taux` })),
          ],
        })} /></div>}
      />
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">

        {/* ═══ HERO REPORTING ═══ */}
        <div className="hero-surface hero-surface-sm rounded-3xl p-6 sm:p-7">
          <div className="relative z-10">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5">
                <div>
                  <span className="text-[10px] tracking-[1.2px] uppercase text-white/50 font-medium">
                    {isCommercial ? "Vue personnelle" : "Vue consolidée"}
                  </span>
                  <h1 className="font-heading text-3xl sm:text-4xl text-white tracking-tight leading-none mt-1.5">
                    {isCommercial ? "Mon reporting" : "Reporting"}
                  </h1>
                  <p className="text-sm text-white/60 mt-2">
                    {isCommercial
                      ? "Statistiques personnelles — vos fiches affectées"
                      : "Vue globale — tous commerciaux et référents réunis"}
                  </p>
                </div>
              </div>
              <div className="pt-5 border-t border-white/10">
                <div className="flex items-center gap-2 mb-3">
                  <CalendarDays className="w-3.5 h-3.5 text-white/50" />
                  <span className="text-[10px] tracking-[1.2px] uppercase text-white/50 font-medium">Période de soumission</span>
                  {getReportPeriodLabel(periodFilter) && (
                    <span className="text-[11px] text-white/70">· {getReportPeriodLabel(periodFilter)}</span>
                  )}
                  <button
                    type="button"
                    disabled={refreshing}
                    onClick={async () => {
                      if (!profile) return;
                      setRefreshing(true);
                      await loadData(profile.id, profile.role, periodFilter);
                      setRefreshing(false);
                    }}
                    className="ml-auto flex items-center gap-1.5 text-[11px] text-white/60 hover:text-white transition-colors"
                  >
                    <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
                    {refreshing ? "Actualisation…" : "Actualiser"}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(PERIOD_LABELS) as PeriodFilter[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={periodFilter === p}
                      onClick={() => setPeriodFilter(p)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        periodFilter === p
                          ? "bg-[#F97316] text-white"
                          : "bg-white/8 text-white/70 hover:bg-white/15 border border-white/10"
                      }`}
                    >
                      {PERIOD_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
        </div>

        <div className="space-y-6">

        {/* ── KPIs (6 indicateurs clés — 2 lignes de 3) ────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard
            label={(isAllPeriod ? (isCommercial ? "Mes fiches globales" : "Total global fiches") : (isCommercial ? "Mes fiches" : "Total fiches")) + periodSuffix} value={totalFiches}
            Icon={FileText} iconBg="bg-primary/10" iconColor="text-primary"
            border="border-l-primary" loading={loading}
          />
          <KpiCard
            label={(isAllPeriod ? (isCommercial ? "Mon CA global HT" : "CA global HT consolidé") : (isCommercial ? "Mon CA HT" : "CA HT consolidé")) + periodSuffix}
            value={caTotal.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
            sub={`${accepted} contrat${accepted > 1 ? "s" : ""} signé${accepted > 1 ? "s" : ""}`}
            Icon={Euro} iconBg="bg-amber-100 dark:bg-amber-900/30" iconColor="text-amber-600"
            border="border-l-amber-500" loading={loading}
          />
          <KpiCard
            label={(isAllPeriod ? "Chiffre d'affaires moyen global" : "Chiffre d'affaires moyen") + periodSuffix}
            value={accepted > 0 ? Math.round(caTotal / accepted).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }) : "0 €"}
            sub={accepted > 0 ? `sur ${accepted} contrat${accepted > 1 ? "s" : ""}` : "Aucun contrat"}
            Icon={BarChart3} iconBg="bg-blue-100 dark:bg-blue-900/30" iconColor="text-blue-600"
            border="border-l-blue-500" loading={loading}
          />
          <KpiCard
            label={(isAllPeriod ? (isCommercial ? "Mon taux global d'acceptation" : "Taux global d'acceptation") : (isCommercial ? "Mon taux d'acceptation" : "Taux d'acceptation global")) + periodSuffix}
            value={`${acceptanceRate}%`}
            sub={`${accepted} acceptée${accepted > 1 ? "s" : ""} / ${baseActive} active${baseActive > 1 ? "s" : ""}`}
            Icon={TrendingUp} iconBg="bg-emerald-100 dark:bg-emerald-900/30" iconColor="text-emerald-600"
            border="border-l-emerald-500" loading={loading}
          />
          <KpiCard
            label={(isAllPeriod ? "Taux global de refus" : "Taux de refus") + periodSuffix} value={`${refusalRate}%`}
            sub={`${refused} refusée${refused > 1 ? "s" : ""} / ${baseActive} active${baseActive > 1 ? "s" : ""}`}
            Icon={XCircle} iconBg="bg-red-100 dark:bg-red-900/30" iconColor="text-red-500"
            border="border-l-red-500" loading={loading}
          />
          <KpiCard
            label={(isAllPeriod ? "Taux global en cours" : "Taux en cours") + periodSuffix} value={`${inProgressRate}%`}
            sub={`${inProgress} fiche${inProgress > 1 ? "s" : ""} · à valider, validées, affectées, attente client`}
            Icon={Clock} iconBg="bg-orange-100 dark:bg-orange-900/30" iconColor="text-orange-600"
            border="border-l-orange-500" loading={loading}
          />
          <KpiCard
            label={"RDV Technicien planifiés" + periodSuffix}
            value={rdvTechnicien}
            sub={`+ ${installees} installation${installees > 1 ? "s" : ""} réalisée${installees > 1 ? "s" : ""}`}
            Icon={CalendarCheck} iconBg="bg-sky-100 dark:bg-sky-900/30" iconColor="text-sky-600"
            border="border-l-sky-500" loading={loading}
          />
          <KpiCard
            label={"Installations réalisées" + periodSuffix}
            value={installees}
            sub={installationRate > 0 ? `${installationRate}% des contrats installés` : "Aucune installation"}
            Icon={Wrench} iconBg="bg-violet-100 dark:bg-violet-900/30" iconColor="text-violet-600"
            border="border-l-violet-500" loading={loading}
          />
        </div>

        {/* ── Funnel de conversion ────────────────────────────────────────── */}
        {totalFiches > 0 && (
          <ConversionFunnel
            statusCounts={statusCounts}
            isCommercial={isCommercial}
            soumises={soumises}
            validees={validees}
            affectees={affectees}
            accepted={accepted}
            refused={refused}
            acceptanceRate={acceptanceRate}
            periodSuffix={periodSuffix}
          />
        )}

        {/* ── Vue comparative succursales (DG, vue globale) ────────────────── */}
        {isDG && selectedBranchId === "all" && branchStats.length > 0 && (
          <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] p-6 hover:shadow-md transition-all duration-200">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-[#1E3A5F]/10 dark:bg-[#1E3A5F]/30 flex items-center justify-center shrink-0">
                <BarChart3 className="w-4 h-4 text-[#1E3A5F] dark:text-blue-300" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Vue comparative succursales{periodSuffix}</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">{branchStats.length} succursale{branchStats.length > 1 ? "s" : ""} — acceptées, refusées, taux, CA</p>
              </div>
            </div>

            {/* Tableau ranking */}
            <div className="mb-5">
              <div className="grid grid-cols-[1fr_56px_56px_56px_72px_80px] gap-2 text-[10px] text-muted-foreground uppercase tracking-wide font-semibold pb-2 border-b border-border">
                <span>Succursale</span>
                <span className="text-right">Fiches</span>
                <span className="text-right text-emerald-600">Accept.</span>
                <span className="text-right text-red-500">Refus.</span>
                <span className="text-right">Taux</span>
                <span className="text-right text-amber-600">CA HT</span>
              </div>
              {branchStats.map((b, i) => {
                const name = branches.find((br) => br.id === b.orgId)?.name ?? b.orgId.slice(0, 8) + "…";
                return (
                  <div key={b.orgId} className="grid grid-cols-[1fr_56px_56px_56px_72px_80px] gap-2 items-center py-2.5 border-b border-border/50 last:border-0 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-slate-100 text-slate-600" : "bg-muted text-muted-foreground"}`}>{i + 1}</span>
                      <span className="font-medium truncate">{name}</span>
                    </div>
                    <span className="text-right tabular-nums text-muted-foreground">{b.total}</span>
                    <span className="text-right tabular-nums text-emerald-600 font-semibold">{b.accepted}</span>
                    <span className="text-right tabular-nums text-red-500">{b.refused}</span>
                    <span className={`text-right tabular-nums font-bold ${b.rate >= 50 ? "text-emerald-600" : b.rate >= 25 ? "text-orange-500" : "text-red-500"}`}>{b.rate}%</span>
                    <span className="text-right tabular-nums text-amber-700 dark:text-amber-400 font-medium text-xs">
                      {b.ca > 0 ? b.ca.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Bar chart comparatif */}
            {branchStats.length > 0 && (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={branchStats.map((b) => ({
                    name: (branches.find((br) => br.id === b.orgId)?.name ?? "…").split(" ").slice(0, 2).join(" "),
                    Acceptées: b.accepted,
                    Refusées: b.refused,
                    "En cours": b.total - b.accepted - b.refused,
                  }))}
                  margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, fontSize: 12, border: "1px solid var(--border)" }}
                    cursor={{ fill: "var(--muted)" }}
                  />
                  <Bar dataKey="Acceptées" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Refusées" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="En cours" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
            <div className="flex items-center gap-4 pt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />Acceptées</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />Refusées</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-orange-500 inline-block" />En cours</span>
            </div>
          </div>
        )}

        {/* ── Taux d'acceptation par commercial ──────────────────────────── */}
        {!isCommercial && commerciaux.length > 0 && (
          <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] p-6 hover:shadow-md transition-all duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{isAllPeriod ? "Taux global d'acceptation" : "Taux d'acceptation"} par commercial ({commerciaux.length} {commerciaux.length > 1 ? "Commerciaux" : "Commercial"}){periodSuffix}</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Affectées vs Acceptées vs Refusées</p>
                </div>
              </div>
              <div className="relative w-full sm:w-52">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Rechercher un commercial…"
                  value={commSearch}
                  onChange={(e) => setCommSearch(e.target.value)}
                  className="w-full pl-8 pr-8 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
                {commSearch && (
                  <button
                    type="button"
                    onClick={() => setCommSearch("")}
                    aria-label="Effacer la recherche"
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
            {/* Détail par commercial avec CA */}
            <div className="mt-5">
              <div className="grid grid-cols-[1fr_48px_48px_48px_70px] sm:grid-cols-[1fr_50px_50px_50px_50px_80px] gap-1.5 sm:gap-2 text-[10px] text-muted-foreground uppercase tracking-wide font-semibold pb-2 border-b border-border">
                <span>Commercial</span>
                <span className="text-right">Affect.</span>
                <span className="text-right text-emerald-600">Accept.</span>
                <span className="text-right text-red-500">Refus.</span>
                <span className="hidden sm:block text-right">Conv.</span>
                <span className="text-right">CA HT</span>
              </div>
              <div className={`space-y-0 overflow-y-auto ${showAllCommerciaux || commSearch ? "max-h-[400px]" : "max-h-[250px]"}`}>
                {(commSearch ? filteredCommerciaux : (showAllCommerciaux ? commerciaux : commerciaux.slice(0, 5))).map((c) => (
                  <div key={c.name} className="grid grid-cols-[1fr_48px_48px_48px_70px] sm:grid-cols-[1fr_50px_50px_50px_50px_80px] gap-1.5 sm:gap-2 items-center py-2 hover:bg-secondary/30 rounded-lg px-1 transition-colors">
                    <button type="button" onClick={() => setConfirmNav({ type: "commercial", id: c.id, name: c.name })} className="text-sm font-medium truncate hover:text-[#F97316] hover:underline transition-colors text-left">{c.name}</button>
                    <span className="text-sm text-right tabular-nums text-muted-foreground">{c.assigned}</span>
                    <span className="text-sm text-right tabular-nums text-emerald-600 font-medium">{c.accepted}</span>
                    <span className="text-sm text-right tabular-nums text-red-500 font-medium">{c.refused}</span>
                    <span className={`hidden sm:block text-sm text-right tabular-nums font-bold ${c.rate >= 50 ? "text-emerald-600" : c.rate >= 25 ? "text-orange-500" : "text-red-500"}`}>{c.rate}%</span>
                    <span className={`text-sm text-right tabular-nums font-bold ${c.ca > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                      {c.ca > 0 ? c.ca.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + "€" : "—"}
                    </span>
                  </div>
                ))}
                {commSearch && filteredCommerciaux.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-3">Aucun commercial trouvé</p>
                )}
              </div>
              {commerciaux.length > 0 && !commSearch && (
                <div className="grid grid-cols-[1fr_48px_48px_48px_70px] sm:grid-cols-[1fr_50px_50px_50px_50px_80px] gap-1.5 sm:gap-2 pt-3 mt-1 border-t border-border px-1">
                  <span className="text-sm font-bold">Total</span>
                  <span className="text-sm font-bold text-right tabular-nums">{commerciaux.reduce((s, c) => s + c.assigned, 0)}</span>
                  <span className="text-sm font-bold text-right tabular-nums text-emerald-600">{commerciaux.reduce((s, c) => s + c.accepted, 0)}</span>
                  <span className="text-sm font-bold text-right tabular-nums text-red-500">{commerciaux.reduce((s, c) => s + c.refused, 0)}</span>
                  <span className="hidden sm:block" />
                  <span className="text-sm font-bold text-right tabular-nums text-amber-600">{caTotal.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}€</span>
                </div>
              )}
            </div>
            {!commSearch && commerciaux.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllCommerciaux(!showAllCommerciaux)}
                className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 py-2 rounded-lg hover:bg-primary/5 transition-colors"
              >
                {showAllCommerciaux ? <><ChevronUp className="w-3.5 h-3.5" />Voir moins</> : <><ChevronDown className="w-3.5 h-3.5" />Voir plus ({commerciaux.length - 5} restant{commerciaux.length - 5 > 1 ? "s" : ""})</>}
              </button>
            )}
          </div>
        )}

        {/* ── Évolution des ventes par commercial ────────────────────── */}
        {!isCommercial && commerciaux.length > 0 && (
          <EvolutionChart
            title="Évolution des ventes par commercial"
            subtitle="Nombre de ventes et chiffre d'affaires par période"
            icon={<Euro className="w-4 h-4 text-emerald-600" />}
            iconBg="bg-emerald-50"
            data={commEvolutionData}
            lines={[
              { dataKey: "ventes", label: "Ventes", color: "#10b981", yAxisId: "left" },
              { dataKey: "ca", label: "CA HT", color: "#f59e0b", yAxisId: "right", formatter: (v: number) => `${v.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}€` },
            ]}
            persons={commPersons}
            selectedPerson={selectedCommPerson}
            onPersonChange={setSelectedCommPerson}
            allLabel="Tous les commerciaux"
            dualAxis
            rightAxisFormatter={(v: number) => `${(v / 1000).toFixed(0)}k€`}
            granularity={commGranularity}
            onGranularityChange={setCommGranularity}
          />
        )}

        {/* ── Évolution en % des ventes par commercial ───────────────── */}
        {!isCommercial && commerciaux.length > 0 && (
          <EvolutionChart
            title="Évolution en % des ventes par commercial"
            subtitle="Variation d'une période à l'autre (ventes & CA HT)"
            icon={<TrendingUp className="w-4 h-4 text-emerald-600" />}
            iconBg="bg-emerald-50"
            data={commEvolutionPctData}
            showZeroLine
            lines={[
              { dataKey: "ventesEvol", label: "Évolution ventes", color: "#10b981", formatter: (v: number) => `${v > 0 ? "+" : ""}${v}%` },
              { dataKey: "caEvol", label: "Évolution CA", color: "#f59e0b", formatter: (v: number) => `${v > 0 ? "+" : ""}${v}%` },
            ]}
            persons={commPersons}
            selectedPerson={selectedCommEvolPerson}
            onPersonChange={setSelectedCommEvolPerson}
            allLabel="Tous les commerciaux"
            granularity={commEvolGranularity}
            onGranularityChange={setCommEvolGranularity}
          />
        )}

        {/* ── Ligne 2 : Pie chart + Référents ──────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Pie chart — répartition par statut */}
          <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] p-6 hover:shadow-md transition-all duration-200">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <BarChart3 className="w-4 h-4 text-primary" />
              </div>
              <h3 className="font-semibold text-sm">{isAllPeriod ? "Répartition globale par statut" : "Répartition par statut"}{periodSuffix}</h3>
            </div>
            {pieData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                Aucune donnée disponible
              </div>
            ) : (
              <div className="space-y-4">
                <style>{`
                  .pie-hover .recharts-pie-sector path {
                    transition: transform 0.2s ease;
                    transform-box: fill-box;
                    transform-origin: center;
                  }
                  .pie-hover .recharts-pie-sector:hover path {
                    transform: scale(1.07);
                  }
                `}</style>
                <div className="pie-hover">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ cx, cy, midAngle, innerRadius, outerRadius, value, percent }: import("recharts").PieLabelRenderProps) => {
                        const pct = typeof percent === "number" ? percent : 0;
                        if (pct < 0.04) return null;
                        const RADIAN = Math.PI / 180;
                        const ir = typeof innerRadius === "number" ? innerRadius : 0;
                        const or = typeof outerRadius === "number" ? outerRadius : 0;
                        const ma = typeof midAngle === "number" ? midAngle : 0;
                        const cxn = typeof cx === "number" ? cx : 0;
                        const cyn = typeof cy === "number" ? cy : 0;
                        const r = ir + (or - ir) * 0.5;
                        return (
                          <text
                            x={cxn + r * Math.cos(-ma * RADIAN)}
                            y={cyn + r * Math.sin(-ma * RADIAN)}
                            fill="white" textAnchor="middle" dominantBaseline="central"
                            fontSize={18} fontWeight="800"
                            style={{ pointerEvents: "none" }}
                          >
                            {typeof value === "number" ? value : ""}
                          </text>
                        );
                      }}
                      labelLine={false}
                      isAnimationActive={false}
                      onMouseEnter={(data: { cx?: number; cy?: number; midAngle?: number; outerRadius?: number }) => {
                        const RADIAN = Math.PI / 180;
                        const cx = data.cx ?? 0;
                        const cy = data.cy ?? 0;
                        const ma = data.midAngle ?? 0;
                        const or = data.outerRadius ?? 0;
                        const cosA = Math.cos(-ma * RADIAN);
                        const sinA = Math.sin(-ma * RADIAN);
                        const tipX = cx + (or + 2) * cosA + 15;
                        const tipY = cy + (or + 2) * sinA - 10;
                        setPieTooltipPos({
                          x: cosA >= 0 ? tipX : tipX - 220,
                          y: tipY,
                        });
                      }}
                      onMouseLeave={() => setPieTooltipPos(undefined)}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      position={pieTooltipPos}
                      isAnimationActive={false}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0];
                        const pct = Math.round(((d.value as number) / pieData.reduce((s, p) => s + p.value, 0)) * 100);
                        return (
                          <div
                            className="bg-popover border border-border rounded-xl px-3 py-2 shadow-lg text-xs flex items-center gap-2 transition-[transform] duration-300 ease-out"
                          >
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.payload.color }} />
                            <span className="text-muted-foreground">{d.name}</span>
                            <span className="font-bold ml-1">{d.value}</span>
                            <span className="text-muted-foreground">— {pct}%</span>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                </div>
                {/* Légende */}
                <div className="grid grid-cols-2 gap-2">
                  {statusCounts.filter((s) => s.count > 0).map(({ status, count }) => (
                    <div key={status} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: STATUS_COLORS_HEX[status] }} />
                      <FicheStatusBadge status={status} />
                      <span className="text-xs font-semibold tabular-nums ml-1">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Top referents (direction) ou performance (commercial) */}
          <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] p-6 hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                  <Trophy className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{isCommercial ? (isAllPeriod ? "Ma performance globale" : "Ma performance") : `${isAllPeriod ? "Nombre de fiches globales" : "Nombre de fiches"} par référent (${referents.length} Référent${referents.length > 1 ? "s" : ""})`}{periodSuffix}</h3>
                </div>
              </div>
            </div>
            {isCommercial ? (
              <div className="space-y-3">
                {statusCounts.filter(s => s.count > 0).map(({ status, count }) => (
                  <div key={status}>
                    <div className="flex items-center justify-between mb-1.5">
                      <FicheStatusBadge status={status} />
                      <span className="text-sm font-semibold tabular-nums">{count}</span>
                    </div>
                    <Bar2 value={count} max={Math.max(...statusCounts.map(s => s.count), 1)} colorClass={STATUS_BAR_COLORS[status]} />
                  </div>
                ))}
                {statusCounts.every(s => s.count === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucune fiche affectée pour le moment</p>
                )}
              </div>
            ) : referents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucune fiche soumise pour le moment</p>
              </div>
            ) : (
              <>
                <div className="relative mb-4">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Rechercher un référent…"
                    value={refSearch}
                    onChange={(e) => setRefSearch(e.target.value)}
                    className="w-full pl-8 pr-8 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                  {refSearch && (
                    <button
                      type="button"
                      onClick={() => setRefSearch("")}
                      aria-label="Effacer la recherche"
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div>
                <div className="mb-3">
                  <div className="grid grid-cols-[1fr_50px_50px_50px] gap-2 text-[10px] text-muted-foreground uppercase tracking-wide font-semibold pb-2 border-b border-border">
                    <span>Référent</span>
                    <span className="text-right">Fiches</span>
                    <span className="text-right text-emerald-600">Accept.</span>
                    <span className="text-right">Conv.</span>
                  </div>
                </div>
                <div className="space-y-0">
                  {(refSearch ? filteredReferents : (showAllReferents ? referents : referents.slice(0, 5))).map((p) => {
                    const origIndex = referents.indexOf(p);
                    const convRate = p.total > 0 ? Math.round((p.accepted / p.total) * 100) : 0;
                    return (
                      <div key={p.name} className="grid grid-cols-[1fr_50px_50px_50px] gap-2 items-center py-2 hover:bg-secondary/30 rounded-lg px-1 transition-colors">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 text-center text-xs font-bold text-muted-foreground shrink-0">{origIndex + 1}</span>
                          <button type="button" onClick={() => setConfirmNav({ type: "referent", id: p.id, name: p.name })} className="text-sm font-medium truncate hover:text-emerald-600 hover:underline transition-colors text-left">{p.name}</button>
                        </div>
                        <span className="text-sm text-right tabular-nums text-muted-foreground">{p.total}</span>
                        <span className="text-sm text-right tabular-nums text-emerald-600 font-medium">{p.accepted}</span>
                        <span className={`text-sm text-right tabular-nums font-medium ${convRate >= 50 ? "text-emerald-600" : convRate >= 25 ? "text-orange-500" : "text-muted-foreground"}`}>{convRate}%</span>
                      </div>
                    );
                  })}
                  {refSearch && filteredReferents.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-3">Aucun référent trouvé</p>
                  )}
                </div>
                {referents.length > 0 && !refSearch && (
                  <div className="grid grid-cols-[1fr_50px_50px_50px] gap-2 pt-3 mt-1 border-t border-border px-1">
                    <span className="text-sm font-bold">Total</span>
                    <span className="text-sm font-bold text-right tabular-nums">{referents.reduce((s, r) => s + r.total, 0)}</span>
                    <span className="text-sm font-bold text-right tabular-nums text-emerald-600">{referents.reduce((s, r) => s + r.accepted, 0)}</span>
                    <span />
                  </div>
                )}
                </div>
                {!refSearch && referents.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setShowAllReferents(!showAllReferents)}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 py-2 rounded-lg hover:bg-primary/5 transition-colors"
                  >
                    {showAllReferents ? <><ChevronUp className="w-3.5 h-3.5" />Voir moins</> : <><ChevronDown className="w-3.5 h-3.5" />Voir plus ({referents.length - 5} restant{referents.length - 5 > 1 ? "s" : ""})</>}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Analyse des refus par type ──────────────────────────────── */}
        {refused > 0 && (() => {
          const MOTIF_COLORS_HEX: Record<MotifRefus, string> = { RDC: "#f97316", ANNULATION: "#f59e0b", REFUS_CLASSIQUE: "#ef4444" };
          const MOTIF_CARD_COLORS: Record<MotifRefus, { bg: string; text: string; bar: string; icon: string }> = {
            RDC: { bg: "bg-orange-50 dark:bg-orange-950/20", text: "text-orange-700 dark:text-orange-300", bar: "bg-orange-500", icon: "🚪" },
            ANNULATION: { bg: "bg-amber-50 dark:bg-amber-950/20", text: "text-amber-700 dark:text-amber-300", bar: "bg-amber-500", icon: "📞" },
            REFUS_CLASSIQUE: { bg: "bg-red-50 dark:bg-red-950/20", text: "text-red-700 dark:text-red-300", bar: "bg-red-500", icon: "✋" },
          };
          const allMotifs = Object.keys(MOTIF_REFUS_LABELS) as MotifRefus[];
          const motifPctByKey: Record<string, number> = {};
          roundToHundred(allMotifs.map((m) => motifRefusCounts[m]), refused).forEach((pct, i) => {
            motifPctByKey[allMotifs[i]] = pct;
          });
          const refusChartData = allMotifs
            .filter((m) => motifRefusCounts[m] > 0)
            .map((m) => ({ name: MOTIF_REFUS_LABELS[m], value: motifRefusCounts[m], fill: MOTIF_COLORS_HEX[m], pct: motifPctByKey[m] }));

          return (
            <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] p-6 hover:shadow-md transition-all duration-200">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                  <XCircle className="w-4 h-4 text-red-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{isAllPeriod ? "Analyse globale des refus" : "Analyse des refus"}{periodSuffix}</h3>
                  <p className="text-[11px] text-muted-foreground">
                    {refused} refus sur {baseActive} fiche{baseActive > 1 ? "s" : ""} affectée{baseActive > 1 ? "s" : ""} — taux global de {refusalRate}%
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Donut chart + légende */}
                <div className="flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={refusChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                        labelLine={false}
                        label={false}
                      >
                        {refusChartData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} stroke="transparent" />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: unknown, name: unknown) => [`${value} fiche${Number(value) > 1 ? "s" : ""}`, String(name)]}
                        contentStyle={{ borderRadius: 12, fontSize: 13, border: "1px solid #e5e7eb" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-1">
                    {refusChartData.map((entry) => (
                      <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.fill }} />
                        <span className="text-muted-foreground">{entry.name}</span>
                        <span className="font-bold">{entry.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Détail par type */}
                <div className="space-y-3">
                  {allMotifs.map((motif) => {
                    const count = motifRefusCounts[motif];
                    const pctRefus = motifPctByKey[motif];
                    const pctTotal = totalFiches > 0 ? Math.round((count / totalFiches) * 100) : 0;
                    const c = MOTIF_CARD_COLORS[motif];
                    return (
                      <div key={motif} className={`rounded-xl p-4 ${c.bg} border border-transparent hover:border-border/50 transition-all`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{c.icon}</span>
                            <span className="text-sm font-semibold">{MOTIF_REFUS_LABELS[motif]}</span>
                          </div>
                          <span className={`text-xl font-bold ${c.text}`}>{count}</span>
                        </div>
                        <div className="h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden mb-2">
                          <div className={`h-full rounded-full ${c.bar} transition-all duration-500`} style={{ width: `${pctRefus}%` }} />
                        </div>
                        <div className="flex justify-between text-[11px] text-muted-foreground">
                          <span><strong className={c.text}>{pctRefus}%</strong> des refus</span>
                          <span><strong>{pctTotal}%</strong> du total fiches</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Détail du parcours acceptation ──────────────────────────── */}
        {(accepted + retractation + rdvTechnicien + installees) > 0 && (() => {
          const ACCEPT_STATUSES = [
            { key: "ACCEPTEE", label: "Acceptation client", icon: "✅", color: "#10b981", bg: "bg-emerald-50 dark:bg-emerald-950/20", text: "text-emerald-700 dark:text-emerald-300", bar: "bg-emerald-500" },
            { key: "RETRACTATION", label: "Attente acceptation client", icon: "⏳", color: "#f59e0b", bg: "bg-amber-50 dark:bg-amber-950/20", text: "text-amber-700 dark:text-amber-300", bar: "bg-amber-500" },
            { key: "RDV_TECHNICIEN", label: "RDV Technicien planifié", icon: "🔧", color: "#3b82f6", bg: "bg-blue-50 dark:bg-blue-950/20", text: "text-blue-700 dark:text-blue-300", bar: "bg-blue-500" },
            { key: "INSTALLEE", label: "Installation réalisée", icon: "🏠", color: "#8b5cf6", bg: "bg-violet-50 dark:bg-violet-950/20", text: "text-violet-700 dark:text-violet-300", bar: "bg-violet-500" },
          ] as const;
          const acceptCounts: Record<string, number> = {
            ACCEPTEE: accepted, RETRACTATION: retractation, RDV_TECHNICIEN: rdvTechnicien, INSTALLEE: installees,
          };
          const totalAccept = accepted + retractation + rdvTechnicien + installees;
          const acceptPctByKey: Record<string, number> = {};
          roundToHundred(ACCEPT_STATUSES.map((s) => acceptCounts[s.key]), totalAccept).forEach((pct, i) => {
            acceptPctByKey[ACCEPT_STATUSES[i].key] = pct;
          });
          const acceptChartData = ACCEPT_STATUSES
            .filter((s) => acceptCounts[s.key] > 0)
            .map((s) => ({ name: s.label, value: acceptCounts[s.key], fill: s.color, pct: acceptPctByKey[s.key] }));

          return (
            <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] p-6 hover:shadow-md transition-all duration-200">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{isAllPeriod ? "Analyse Globale des Acceptations" : "Analyse des Acceptations"}{periodSuffix}</h3>
                  <p className="text-[11px] text-muted-foreground">
                    {totalAccept} fiche{totalAccept > 1 ? "s" : ""} dans le parcours d&apos;acceptation — {acceptanceRate}% du total actif
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={acceptChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                        labelLine={false}
                        label={false}
                      >
                        {acceptChartData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} stroke="transparent" />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: unknown, name: unknown) => [`${value} fiche${Number(value) > 1 ? "s" : ""}`, String(name)]}
                        contentStyle={{ borderRadius: 12, fontSize: 13, border: "1px solid #e5e7eb" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-1">
                    {acceptChartData.map((entry) => (
                      <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.fill }} />
                        <span className="text-muted-foreground">{entry.name}</span>
                        <span className="font-bold">{entry.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  {ACCEPT_STATUSES.map((s) => {
                    const count = acceptCounts[s.key];
                    const pctAccept = acceptPctByKey[s.key];
                    const pctTotal = totalFiches > 0 ? Math.round((count / totalFiches) * 100) : 0;
                    return (
                      <div key={s.key} className={`rounded-xl p-4 ${s.bg} border border-transparent hover:border-border/50 transition-all`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{s.icon}</span>
                            <span className="text-sm font-semibold">{s.label}</span>
                          </div>
                          <span className={`text-xl font-bold ${s.text}`}>{count}</span>
                        </div>
                        <div className="h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden mb-2">
                          <div className={`h-full rounded-full ${s.bar} transition-all duration-500`} style={{ width: `${pctAccept}%` }} />
                        </div>
                        <div className="flex justify-between text-[11px] text-muted-foreground">
                          <span><strong className={s.text}>{pctAccept}%</strong> du parcours</span>
                          <span><strong>{pctTotal}%</strong> du total fiches</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Évolution semaine par semaine (fenêtre de 8 semaines) ──────────── */}
        {(() => {
          const windowSize = 8;
          const visibleWeeklyData = weeklyData.length > windowSize
            ? weeklyData.slice(Math.max(0, weeklyData.length - windowSize - weeklyTrendOffset), weeklyData.length - weeklyTrendOffset)
            : weeklyData;
          const canGoBack = (weeklyData.length - windowSize - weeklyTrendOffset) > 0;
          const canGoForward = weeklyTrendOffset > 0;
          return (
        <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] p-6 hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">{isAllPeriod ? "Tendance globale hebdomadaire" : "Tendance hebdomadaire"}{periodSuffix}</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Fiches créées et acceptées depuis le début de l&apos;année</p>
              </div>
            </div>
            {weeklyData.length > windowSize && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setWeeklyTrendOffset((o) => Math.min(o + 1, weeklyData.length - windowSize))}
                  disabled={!canGoBack}
                  aria-label="Semaines précédentes"
                  className="w-7 h-7 flex items-center justify-center rounded-full border border-[#F97316]/50 text-[#F97316] hover:bg-[#F97316]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setWeeklyTrendOffset((o) => Math.max(o - 1, 0))}
                  disabled={!canGoForward}
                  aria-label="Semaines suivantes"
                  className="w-7 h-7 flex items-center justify-center rounded-full border border-[#F97316]/50 text-[#F97316] hover:bg-[#F97316]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
          {weeklyData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucune donnée disponible</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={visibleWeeklyData} margin={{ top: 5, right: 55, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradCreees" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradAcceptees" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="creees" name="Fiches créées" stroke="#3b82f6" strokeWidth={2} fill="url(#gradCreees)" animationDuration={700} />
                <Area type="monotone" dataKey="acceptees" name="Acceptées" stroke="#10b981" strokeWidth={2} fill="url(#gradAcceptees)" animationDuration={700} />
              </AreaChart>
            </ResponsiveContainer>
          )}
          <div className="flex items-center gap-4 pt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />Fiches créées</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />Acceptées</span>
          </div>
        </div>
          );
        })()}

        {/* ── Évolution des fiches par référent ──────────────────────── */}
        {!isCommercial && referents.length > 0 && (
          <EvolutionChart
            title="Évolution des fiches par référent"
            subtitle="Nombre de fiches créées par période"
            icon={<FileText className="w-4 h-4 text-blue-600" />}
            iconBg="bg-blue-50"
            data={refEvolutionData}
            lines={[{ dataKey: "fiches", label: "Fiches créées", color: "#3b82f6" }]}
            persons={refPersons}
            selectedPerson={selectedRefPerson}
            onPersonChange={setSelectedRefPerson}
            allLabel="Tous les référents"
            granularity={refGranularity}
            onGranularityChange={setRefGranularity}
          />
        )}

        {/* ── Répartition géographique ────────────────────────────────────── */}
        {!isCommercial && (
          <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] p-6 hover:shadow-md transition-all duration-200">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">{isAllPeriod ? "Villes planifiées — résultats globaux" : "Villes planifiées — résultats"}{periodSuffix} <span className="text-muted-foreground font-normal">({villes.length})</span></h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">{villes.length} ville{villes.length > 1 ? "s" : ""} planifiée{villes.length > 1 ? "s" : ""}{periodSuffix}</p>
              </div>
            </div>
            {villes.length > 0 ? (
              <div className="space-y-2.5"><div className="space-y-2.5">
                <div className="grid grid-cols-[1fr_48px_48px_50px] sm:grid-cols-[1fr_60px_60px_60px_50px] gap-1.5 sm:gap-2 text-[10px] text-muted-foreground uppercase tracking-wide font-semibold pb-1 border-b border-border">
                  <span>Ville</span>
                  <span className="text-right">Total</span>
                  <span className="text-right text-emerald-600">Accept.</span>
                  <span className="hidden sm:block text-right text-red-500">Refus.</span>
                  <span className="text-right">Taux</span>
                </div>
                {(() => {
                  const sorted = [...villes].sort((a, b) => b.rate !== a.rate ? b.rate - a.rate : b.total - a.total);
                  return (showAllVilles ? sorted : sorted.slice(0, 5));
                })().map((v) => (
                  <div key={v.ville} className="grid grid-cols-[1fr_48px_48px_50px] sm:grid-cols-[1fr_60px_60px_60px_50px] gap-1.5 sm:gap-2 items-center text-sm">
                    <span className="font-medium truncate">{v.ville}</span>
                    {v.total === 0 ? (
                      <span className="col-span-3 sm:col-span-4 text-xs text-muted-foreground italic text-center">Pas encore prospectée</span>
                    ) : (<>
                      <span className="text-right tabular-nums text-muted-foreground">{v.total}</span>
                      <span className="text-right tabular-nums text-emerald-600 font-medium">{v.accepted}</span>
                      <span className="hidden sm:block text-right tabular-nums text-red-500 font-medium">{v.refused}</span>
                      <span className={`text-right tabular-nums font-bold ${v.rate >= 50 ? "text-emerald-600" : v.rate >= 25 ? "text-orange-500" : "text-red-500"}`}>{v.rate}%</span>
                    </>)}
                  </div>
                ))}
                {villes.length > 5 && (
                  <button
                    onClick={() => setShowAllVilles(!showAllVilles)}
                    className="w-full text-center py-2 text-sm font-medium text-[#F97316] hover:text-[#F97316]/80 transition-colors"
                  >
                    {showAllVilles ? "Voir moins ▲" : `Voir plus (${villes.length - 5} villes) ▼`}
                  </button>
                )}
              </div></div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Aucune fiche ne correspond aux villes planifiées</p>
            )}
          </div>
        )}
        </div>
      </div>

      <Dialog open={!!confirmNav} onOpenChange={(open) => { if (!open) setConfirmNav(null); }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              Accéder au tableau de bord {confirmNav?.type === "commercial" ? "commercial" : "référent"}
            </DialogTitle>
            <DialogDescription>
              Vous allez accéder au tableau de bord reporting de{" "}
              <span className="font-semibold text-foreground">{confirmNav?.name}</span>{" "}
              ({confirmNav?.type === "commercial" ? "commercial" : "référent"}).
              Confirmez-vous cet accès ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
            <Button
              onClick={() => {
                if (!confirmNav) return;
                const url = confirmNav.type === "commercial"
                  ? `/reporting/commercial/${confirmNav.id}`
                  : `/reporting/referent/${confirmNav.id}`;
                setConfirmNav(null);
                router.push(url);
              }}
            >
              Accéder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
