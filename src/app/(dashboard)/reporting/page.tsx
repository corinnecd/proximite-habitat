"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { ExportPdfButton } from "@/components/ui/export-pdf-button";
import { FicheStatusBadge } from "@/components/fiches/FicheStatusBadge";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/use-profile";
import type { FicheStatus, MotifRefus } from "@/types/database";
import { STATUS_LABELS, MOTIF_REFUS_LABELS } from "@/lib/permissions";
import {
  BarChart3, TrendingUp, Users, FileText, Search, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Clock, ArrowUp, ArrowDown, Minus,
  Medal, Trophy, RefreshCw, CalendarDays, MapPin, Target,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
  Area, AreaChart,
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────
interface StatusCount { status: FicheStatus; count: number; }
interface ReferentRow { name: string; total: number; submitted: number; accepted: number; }
interface CommercialRow { name: string; assigned: number; accepted: number; refused: number; rate: number; }
interface VilleRow { ville: string; accepted: number; refused: number; total: number; rate: number; }
interface WeeklyPoint { label: string; soumises: number; acceptées: number; }
interface DelaiInfo { avg: number; min: number; max: number; count: number; }

// ── Palette statuts ───────────────────────────────────────────────────────────
const STATUS_COLORS_HEX: Record<FicheStatus, string> = {
  BROUILLON: "#94a3b8", SOUMISE: "#3b82f6", VALIDEE: "#10b981",
  AFFECTEE: "#f97316", ACCEPTEE: "#10b981",
  RETRACTATION: "#a855f7",
  REFUSEE: "#ef4444", ARCHIVEE: "#cbd5e1",
};

const STATUS_BAR_COLORS: Record<FicheStatus, string> = {
  BROUILLON: "bg-slate-400", SOUMISE: "bg-blue-500", VALIDEE: "bg-emerald-500",
  AFFECTEE: "bg-orange-500", ACCEPTEE: "bg-emerald-500",
  RETRACTATION: "bg-purple-500",
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

function KpiCard({
  label, value, sub, Icon, iconBg, iconColor, border, trend,
}: {
  label: string; value: string | number; sub?: string;
  Icon: React.ElementType; iconBg: string; iconColor: string; border: string;
  trend?: { delta: number };
}) {
  return (
    <div className={`bg-card/80 backdrop-blur-sm border border-border border-l-4 ${border} rounded-2xl p-5 shadow-sm hover:-translate-y-1.5 hover:shadow-xl transition-all duration-200`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        {trend !== undefined && trend.delta !== 0 && (
          <span className={`flex items-center text-xs font-medium ${trend.delta > 0 ? "text-emerald-600" : "text-red-500"}`}>
            {trend.delta > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {Math.abs(trend.delta)}
          </span>
        )}
        {trend !== undefined && trend.delta === 0 && (
          <span className="flex items-center text-xs text-muted-foreground">
            <Minus className="w-3 h-3" />
          </span>
        )}
      </div>
      <p className="text-3xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// Tooltip personnalisé pour les charts
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-xl px-3 py-2 shadow-lg text-xs space-y-1">
      <p className="font-semibold text-foreground capitalize">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="font-bold ml-auto pl-3">{p.value}</span>
        </div>
      ))}
    </div>
  );
}


// ── Filtre période de soumission ──────────────────────────────────────────────
type PeriodFilter = "ALL" | "TODAY" | "WEEK" | "MONTH" | "QUARTER";

const PERIOD_LABELS: Record<PeriodFilter, string> = {
  ALL: "Toutes les dates", TODAY: "Aujourd'hui",
  WEEK: "Cette semaine", MONTH: "Ce mois", QUARTER: "Ce trimestre",
};

function getPeriodDates(period: PeriodFilter): { from: string; to: string } | null {
  if (period === "ALL") return null;
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (period === "TODAY") { const t = fmt(now); return { from: t, to: t }; }
  if (period === "WEEK") {
    const day = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const mon = new Date(now); mon.setDate(now.getDate() - day);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { from: fmt(mon), to: fmt(sun) };
  }
  if (period === "MONTH") {
    return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
  }
  if (period === "QUARTER") {
    const q = Math.floor(now.getMonth() / 3);
    return { from: fmt(new Date(now.getFullYear(), q * 3, 1)), to: fmt(new Date(now.getFullYear(), q * 3 + 3, 0)) };
  }
  return null;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ReportingPage() {
  const { profile, loading: profileLoading } = useProfile();
  const router = useRouter();
  const supabase = createClient();

  const [statusCounts, setStatusCounts] = useState<StatusCount[]>([]);
  const [referents, setReferents] = useState<ReferentRow[]>([]);
  const [commerciaux, setCommerciaux] = useState<CommercialRow[]>([]);
  const [villes, setVilles] = useState<VilleRow[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyPoint[]>([]);
  const [delai, setDelai] = useState<DelaiInfo>({ avg: 0, min: 0, max: 0, count: 0 });
  const [totalFiches, setTotalFiches] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("ALL");
  const [pieTooltipPos, setPieTooltipPos] = useState<{ x: number; y: number } | undefined>(undefined);
  const [showAllReferents, setShowAllReferents] = useState(false);
  const [showAllCommerciaux, setShowAllCommerciaux] = useState(false);
  const [commSearch, setCommSearch] = useState("");
  const [refSearch, setRefSearch] = useState("");
  const [motifRefusCounts, setMotifRefusCounts] = useState<Record<MotifRefus, number>>({ RDC: 0, ANNULATION: 0, REFUS_CLASSIQUE: 0 });

  const isCommercial = profile?.role === "COMMERCIAL";

  async function loadData(profileId: string, role: string, period: PeriodFilter = "ALL") {
    const isComm = role === "COMMERCIAL";
    const statuses: FicheStatus[] = isComm
      ? ["AFFECTEE", "ACCEPTEE", "RETRACTATION", "REFUSEE", "ARCHIVEE"]
      : ["SOUMISE", "VALIDEE", "AFFECTEE", "ACCEPTEE", "RETRACTATION", "REFUSEE", "ARCHIVEE"];

    const dates = getPeriodDates(period);
    let ficheIdsForPeriod: string[] | null = null;
    if (dates) {
      const from = `${dates.from}T00:00:00Z`;
      const to   = `${dates.to}T23:59:59Z`;
      const { data: histRows } = await supabase
        .from("fiche_history").select("fiche_id")
        .eq("new_status", "SOUMISE").gte("created_at", from).lte("created_at", to);
      const idSet = new Set((histRows ?? []).map((h: { fiche_id: string }) => h.fiche_id));
      const { data: legacyRows } = await supabase
        .from("fiches").select("id").neq("status", "BROUILLON")
        .gte("created_at", from).lte("created_at", to);
      (legacyRows ?? []).forEach((f: { id: string }) => idSet.add(f.id));
      ficheIdsForPeriod = Array.from(idSet);
      if (ficheIdsForPeriod.length === 0) {
        setStatusCounts(statuses.map((s) => ({ status: s, count: 0 })));
        setTotalFiches(0);
        setReferents([]);
        setCommerciaux([]);
        setVilles([]);
        setWeeklyData([]);
        setDelai({ avg: 0, min: 0, max: 0, count: 0 });
        setLoading(false);
        return;
      }
    }

    // ── Compteurs par statut ──
    const countResults = await Promise.all(
      statuses.map(async (s) => {
        let q = supabase.from("fiches").select("*", { count: "exact", head: true }).eq("status", s);
        if (isComm) q = q.eq("assigned_to", profileId);
        if (ficheIdsForPeriod) q = q.in("id", ficheIdsForPeriod);
        const { count } = await q;
        return { status: s, count: count || 0 };
      })
    );
    setStatusCounts(countResults);
    setTotalFiches(countResults.reduce((a, b) => a + b.count, 0));

    // ── Données détaillées des fiches ──
    let fichesQuery = supabase
      .from("fiches")
      .select("id, created_by, assigned_to, status, motif_refus, prospect_ville, created_at, profiles!created_by(first_name, last_name), assigned_to_profile:profiles!fiches_assigned_to_fkey(first_name, last_name)")
      .neq("status", "BROUILLON");
    if (isComm) fichesQuery = fichesQuery.eq("assigned_to", profileId);
    if (ficheIdsForPeriod) fichesQuery = fichesQuery.in("id", ficheIdsForPeriod);
    const { data: fichesRaw } = await fichesQuery;

    type FicheRow = {
      id: string; created_by: string; assigned_to: string | null; status: string;
      motif_refus: MotifRefus | null; prospect_ville: string | null; created_at: string;
      profiles: { first_name: string; last_name: string } | null;
      assigned_to_profile: { first_name: string; last_name: string } | null;
    };
    const fiches = (fichesRaw ?? []) as unknown as FicheRow[];

    // ── Ventilation des refus par motif ──
    const motifCounts: Record<MotifRefus, number> = { RDC: 0, ANNULATION: 0, REFUS_CLASSIQUE: 0 };
    for (const f of fiches) {
      if (f.status === "REFUSEE" && f.motif_refus) {
        motifCounts[f.motif_refus]++;
      }
    }
    setMotifRefusCounts(motifCounts);

    // ── 1. Productivité référents ──
    if (!isComm) {
      const refMap: Record<string, ReferentRow> = {};
      for (const f of fiches) {
        const key = f.created_by;
        if (!refMap[key]) {
          const name = f.profiles ? `${f.profiles.first_name} ${f.profiles.last_name}` : "Inconnu";
          refMap[key] = { name, total: 0, submitted: 0, accepted: 0 };
        }
        refMap[key].total++;
        refMap[key].submitted++;
        if (f.status === "ACCEPTEE") refMap[key].accepted++;
      }
      setReferents(Object.values(refMap).sort((a, b) => b.total - a.total));
    }

    // ── 2. Taux de conversion par commercial ──
    const commMap: Record<string, CommercialRow> = {};
    const COMM_STATUSES = ["AFFECTEE", "RETRACTATION", "ACCEPTEE", "REFUSEE", "ARCHIVEE"];
    for (const f of fiches) {
      if (!f.assigned_to || !COMM_STATUSES.includes(f.status)) continue;
      const key = f.assigned_to;
      if (!commMap[key]) {
        const name = f.assigned_to_profile ? `${f.assigned_to_profile.first_name} ${f.assigned_to_profile.last_name}` : "Inconnu";
        commMap[key] = { name, assigned: 0, accepted: 0, refused: 0, rate: 0 };
      }
      commMap[key].assigned++;
      if (f.status === "ACCEPTEE") commMap[key].accepted++;
      if (f.status === "REFUSEE") commMap[key].refused++;
    }
    const commRows = Object.values(commMap).map((c) => ({
      ...c,
      rate: c.assigned > 0 ? Math.round((c.accepted / c.assigned) * 100) : 0,
    })).sort((a, b) => b.assigned - a.assigned);
    setCommerciaux(commRows);

    // ── 3. Répartition géographique (basée sur les villes planifiées) ──
    const { data: planifRows } = await supabase
      .from("planification_hebdo")
      .select("ville_id, zones_villes!inner(nom)");
    type PlanifRow = { ville_id: string; zones_villes: { nom: string } };
    const plannedVilleNames = new Set<string>();
    for (const pr of (planifRows ?? []) as unknown as PlanifRow[]) {
      plannedVilleNames.add(pr.zones_villes.nom.trim().toUpperCase());
    }
    const villeMap: Record<string, VilleRow> = {};
    for (const f of fiches) {
      if (!f.prospect_ville) continue;
      const vKey = f.prospect_ville.trim().toUpperCase();
      if (!plannedVilleNames.has(vKey)) continue;
      if (!villeMap[vKey]) villeMap[vKey] = { ville: f.prospect_ville.trim(), accepted: 0, refused: 0, total: 0, rate: 0 };
      villeMap[vKey].total++;
      if (f.status === "ACCEPTEE") villeMap[vKey].accepted++;
      if (f.status === "REFUSEE") villeMap[vKey].refused++;
    }
    const villeRows = Object.values(villeMap)
      .map((v) => ({ ...v, rate: v.total > 0 ? Math.round((v.accepted / v.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);
    setVilles(villeRows);

    // ── 4. Évolution semaine par semaine (8-12 dernières semaines) ──
    const WEEK_COUNT = 12;
    const now = new Date();
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
      let soumises = 0, acceptées = 0;
      for (const f of fiches) {
        const d = new Date(f.created_at);
        if (d >= ws && d < end) {
          soumises++;
          if (f.status === "ACCEPTEE") acceptées++;
        }
      }
      return { label, soumises, acceptées };
    });
    setWeeklyData(weekBuckets);

    // ── 5. Délai moyen soumission → validation ──
    const ficheIds = fiches.map((f) => f.id);
    if (ficheIds.length > 0) {
      const { data: histAll } = await supabase
        .from("fiche_history")
        .select("fiche_id, new_status, created_at")
        .in("fiche_id", ficheIds)
        .in("new_status", ["SOUMISE", "VALIDEE"])
        .order("created_at", { ascending: true });

      type HistEntry = { fiche_id: string; new_status: string; created_at: string };
      const firstSoumise = new Map<string, string>();
      const firstValidee = new Map<string, string>();
      for (const h of (histAll ?? []) as HistEntry[]) {
        if (h.new_status === "SOUMISE" && !firstSoumise.has(h.fiche_id)) firstSoumise.set(h.fiche_id, h.created_at);
        if (h.new_status === "VALIDEE" && !firstValidee.has(h.fiche_id)) firstValidee.set(h.fiche_id, h.created_at);
      }

      const delais: number[] = [];
      for (const [ficheId, soumiseDate] of firstSoumise) {
        const valideeDate = firstValidee.get(ficheId);
        if (valideeDate) {
          const diffH = (new Date(valideeDate).getTime() - new Date(soumiseDate).getTime()) / (1000 * 60 * 60);
          if (diffH >= 0) delais.push(diffH);
        }
      }

      if (delais.length > 0) {
        const avg = delais.reduce((a, b) => a + b, 0) / delais.length;
        setDelai({ avg: Math.round(avg * 10) / 10, min: Math.round(Math.min(...delais) * 10) / 10, max: Math.round(Math.max(...delais) * 10) / 10, count: delais.length });
      } else {
        setDelai({ avg: 0, min: 0, max: 0, count: 0 });
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    if (profileLoading) return;
    if (!profile) return;
    if (profile.role !== "ADMIN" && profile.role !== "COMMERCIAL") { router.replace("/"); return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData(profile.id, profile.role, periodFilter);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, profileLoading, periodFilter]);

  const accepted      = statusCounts.find((s) => s.status === "ACCEPTEE")?.count ?? 0;
  const refused       = statusCounts.find((s) => s.status === "REFUSEE")?.count ?? 0;
  const archived      = statusCounts.find((s) => s.status === "ARCHIVEE")?.count ?? 0;
  const soumises      = statusCounts.find((s) => s.status === "SOUMISE")?.count ?? 0;
  const validees      = statusCounts.find((s) => s.status === "VALIDEE")?.count ?? 0;
  const affectees     = statusCounts.find((s) => s.status === "AFFECTEE")?.count ?? 0;
  const retractation  = statusCounts.find((s) => s.status === "RETRACTATION")?.count ?? 0;
  // En cours = tout sauf acceptées, refusées, archivées
  const inProgress    = soumises + validees + affectees + retractation;
  const assignedBase  = affectees + retractation + accepted + refused + archived;
  const acceptanceRate = assignedBase > 0 ? Math.round((accepted / assignedBase) * 100) : 0;
  const refusalRate = assignedBase > 0 ? Math.round((refused / assignedBase) * 100) : 0;
  const inProgressRate = totalFiches > 0 ? Math.round((inProgress / totalFiches) * 100) : 0;
  // Taux de transformation = fiches soumises non encore validées et affectées
  const pendingValidation = soumises + validees;
  const pendingRate = totalFiches > 0 ? Math.round((pendingValidation / totalFiches) * 100) : 0;
  const maxReferent = Math.max(...referents.map((p) => p.total), 1);
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

  const referentChartData = referents.slice(0, 6).map((p) => ({
    name: p.name.split(" ")[0],
    fullName: p.name,
    Soumises: p.total,
    Acceptées: p.accepted,
  }));

  const commChartData = commerciaux.slice(0, 8).map((c) => ({
    name: c.name.split(" ")[0],
    fullName: c.name,
    Affectées: c.assigned,
    Acceptées: c.accepted,
    Refusées: c.refused,
  }));



  // ── Loading ────────────────────────────────────────────────────────────────
  if (profileLoading || loading) {
    return (
      <>
        <Topbar title="Reporting" />
        <div className="p-6 lg:p-8 animate-pulse space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 bg-card rounded-2xl border border-border" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-72 bg-card rounded-2xl border border-border" />
            <div className="h-72 bg-card rounded-2xl border border-border" />
          </div>
          <div className="h-64 bg-card rounded-2xl border border-border" />
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar
        title={isCommercial ? "Mon reporting" : "Reporting direction"}
        actions={<ExportPdfButton title={isCommercial ? "Mon reporting" : "Reporting direction"} subtitle={`Période : ${PERIOD_LABELS[periodFilter]}`} filename="reporting" />}
      />
      <div className="p-6 lg:p-8 space-y-6">

        {/* Sous-titre contextuel + bouton refresh */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {isCommercial
              ? <><Users className="w-4 h-4" /> Statistiques personnelles — vos fiches affectées</>
              : <><BarChart3 className="w-4 h-4" /> Vue globale — tous commerciaux et référents réunis</>}
          </div>
          <button
            type="button"
            disabled={refreshing}
            onClick={async () => {
              if (!profile) return;
              setRefreshing(true);
              await loadData(profile.id, profile.role, periodFilter);
              setRefreshing(false);
            }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-secondary border border-border/50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Actualisation…" : "Actualiser"}
          </button>
        </div>

        {/* ── Filtre période de soumission ─────────────────────────────────── */}
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <CalendarDays className="w-3.5 h-3.5" />Période de soumission
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(PERIOD_LABELS) as PeriodFilter[]).map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={periodFilter === p}
                onClick={() => setPeriodFilter(p)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                  periodFilter === p ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-secondary border border-border"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        {/* ── KPIs (5 indicateurs clés) ────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <KpiCard
            label={isCommercial ? "Mes fiches" : "Total fiches"} value={totalFiches}
            Icon={FileText} iconBg="bg-primary/10" iconColor="text-primary"
            border="border-l-primary"
          />
          <KpiCard
            label="Taux d'acceptation" value={`${acceptanceRate}%`}
            sub={`${accepted} acceptée${accepted > 1 ? "s" : ""} / ${assignedBase} affectée${assignedBase > 1 ? "s" : ""}`}
            Icon={CheckCircle2} iconBg="bg-emerald-100 dark:bg-emerald-900/30" iconColor="text-emerald-600"
            border="border-l-emerald-500"
          />
          <KpiCard
            label="Taux de refus" value={`${refusalRate}%`}
            sub={`${refused} refusée${refused > 1 ? "s" : ""} / ${assignedBase} affectée${assignedBase > 1 ? "s" : ""}`}
            Icon={XCircle} iconBg="bg-red-100 dark:bg-red-900/30" iconColor="text-red-500"
            border="border-l-red-500"
          />
          <KpiCard
            label="Taux en cours" value={`${inProgressRate}%`}
            sub={`${inProgress} fiche${inProgress > 1 ? "s" : ""} · à valider, validées, affectées, attente client`}
            Icon={Clock} iconBg="bg-orange-100 dark:bg-orange-900/30" iconColor="text-orange-600"
            border="border-l-orange-500"
          />
          <KpiCard
            label="Taux de transformation" value={`${pendingRate}%`}
            sub={`${pendingValidation} en attente sur ${totalFiches} fiche${totalFiches > 1 ? "s" : ""}`}
            Icon={Target} iconBg="bg-primary/10" iconColor="text-primary"
            border="border-l-primary"
          />
        </div>

        {/* ── Analyse des refus par type ──────────────────────────────── */}
        {refused > 0 && (() => {
          const MOTIF_COLORS_HEX: Record<MotifRefus, string> = { RDC: "#f97316", ANNULATION: "#f59e0b", REFUS_CLASSIQUE: "#ef4444" };
          const MOTIF_CARD_COLORS: Record<MotifRefus, { bg: string; text: string; bar: string; icon: string }> = {
            RDC: { bg: "bg-orange-50 dark:bg-orange-950/20", text: "text-orange-700 dark:text-orange-300", bar: "bg-orange-500", icon: "🚪" },
            ANNULATION: { bg: "bg-amber-50 dark:bg-amber-950/20", text: "text-amber-700 dark:text-amber-300", bar: "bg-amber-500", icon: "📞" },
            REFUS_CLASSIQUE: { bg: "bg-red-50 dark:bg-red-950/20", text: "text-red-700 dark:text-red-300", bar: "bg-red-500", icon: "✋" },
          };
          const refusChartData = (Object.keys(MOTIF_REFUS_LABELS) as MotifRefus[])
            .filter((m) => motifRefusCounts[m] > 0)
            .map((m) => ({ name: MOTIF_REFUS_LABELS[m], value: motifRefusCounts[m], fill: MOTIF_COLORS_HEX[m] }));

          return (
            <div className="bg-card border border-border rounded-2xl p-6 hover:shadow-md transition-all duration-200">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                  <XCircle className="w-4 h-4 text-red-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Analyse des refus</h3>
                  <p className="text-[11px] text-muted-foreground">
                    {refused} refus sur {assignedBase} fiche{assignedBase > 1 ? "s" : ""} affectée{assignedBase > 1 ? "s" : ""} — taux global de {refusalRate}%
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
                        formatter={(value: number, name: string) => [`${value} fiche${value > 1 ? "s" : ""}`, name]}
                        contentStyle={{ borderRadius: 12, fontSize: 13, border: "1px solid #e5e7eb" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-1">
                    {refusChartData.map((entry) => {
                      const pct = refused > 0 ? Math.round((entry.value / refused) * 100) : 0;
                      return (
                        <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.fill }} />
                          <span className="text-muted-foreground">{entry.name}</span>
                          <span className="font-bold">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Détail par type */}
                <div className="space-y-3">
                  {(Object.keys(MOTIF_REFUS_LABELS) as MotifRefus[]).map((motif) => {
                    const count = motifRefusCounts[motif];
                    const pctRefus = refused > 0 ? Math.round((count / refused) * 100) : 0;
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

        {/* ── Ligne 2 : Pie chart + Référents ──────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Pie chart — répartition par statut */}
          <div className="bg-card border border-border rounded-2xl p-6 hover:shadow-md transition-all duration-200">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <BarChart3 className="w-4 h-4 text-primary" />
              </div>
              <h3 className="font-semibold text-sm">Répartition par statut</h3>
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
          <div className="bg-card border border-border rounded-2xl p-6 hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                  <Trophy className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{isCommercial ? "Ma performance" : "Productivité référents"}</h3>
                  {!isCommercial && referents.length > 0 && (
                    <p className="text-[11px] text-muted-foreground">{referents.length} référent{referents.length > 1 ? "s" : ""}</p>
                  )}
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
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </div>
                <div className={`space-y-3 overflow-y-auto ${showAllReferents || refSearch ? "max-h-[400px]" : "max-h-[280px]"}`}>
                  {filteredReferents.map((p, i) => {
                    const origIndex = referents.indexOf(p);
                    const medalColor = origIndex === 0 ? "text-amber-500" : origIndex === 1 ? "text-slate-400" : origIndex === 2 ? "text-amber-700" : "text-muted-foreground";
                    const convRate = p.total > 0 ? Math.round((p.accepted / p.total) * 100) : 0;
                    return (
                      <div key={p.name} className="flex items-center gap-3">
                        <div className="w-7 flex items-center justify-center shrink-0">
                          {origIndex < 3
                            ? <Medal className={`w-5 h-5 ${medalColor}`} />
                            : <span className="text-sm font-bold text-muted-foreground tabular-nums">{origIndex + 1}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium truncate">{p.name}</p>
                            <div className="flex items-center gap-2 text-xs shrink-0 ml-2">
                              {p.accepted > 0 && <span className="text-emerald-600 font-medium">✓ {p.accepted}</span>}
                              <span className="text-muted-foreground">{p.total} fiche{p.total > 1 ? "s" : ""}</span>
                              <span className={`font-medium ${convRate >= 50 ? "text-emerald-600" : convRate >= 25 ? "text-orange-500" : "text-muted-foreground"}`}>
                                {convRate}%
                              </span>
                            </div>
                          </div>
                          <Bar2 value={p.total} max={maxReferent} colorClass="bg-primary/70" />
                        </div>
                      </div>
                    );
                  })}
                  {refSearch && filteredReferents.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-3">Aucun référent trouvé</p>
                  )}
                </div>
                {!refSearch && referents.length > 8 && (
                  <button
                    type="button"
                    onClick={() => setShowAllReferents(!showAllReferents)}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 py-2 rounded-lg hover:bg-primary/5 transition-colors"
                  >
                    {showAllReferents ? <><ChevronUp className="w-3.5 h-3.5" />Réduire</> : <><ChevronDown className="w-3.5 h-3.5" />Voir les {referents.length} référents</>}
                  </button>
                )}
              </>
            )}
          </div>
        </div>


        {/* ── Évolution semaine par semaine (courbe 12 semaines) ──────────── */}
        <div className="bg-card border border-border rounded-2xl p-6 hover:shadow-md transition-all duration-200">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Tendance hebdomadaire</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Volume soumis et accepté sur les 12 dernières semaines</p>
            </div>
          </div>
          {weeklyData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucune donnée disponible</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={weeklyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradSoumises" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradAcceptees" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="soumises" name="Soumises" stroke="#3b82f6" strokeWidth={2} fill="url(#gradSoumises)" animationDuration={700} />
                <Area type="monotone" dataKey="acceptées" name="Acceptées" stroke="#10b981" strokeWidth={2} fill="url(#gradAcceptees)" animationDuration={700} />
              </AreaChart>
            </ResponsiveContainer>
          )}
          <div className="flex items-center gap-4 pt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />Soumises</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />Acceptées</span>
          </div>
        </div>

        {/* ── Taux de conversion par commercial ──────────────────────────── */}
        {!isCommercial && commerciaux.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-6 hover:shadow-md transition-all duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Taux de conversion par commercial</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{commerciaux.length} commercial{commerciaux.length > 1 ? "aux" : ""} · Affectées vs Acceptées vs Refusées</p>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Rechercher un commercial…"
                  value={commSearch}
                  onChange={(e) => setCommSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/30 w-52"
                />
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={commChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f1f5f9", radius: 6 }} />
                <Bar dataKey="Affectées" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={28} animationDuration={700} />
                <Bar dataKey="Acceptées" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} animationDuration={700} />
                <Bar dataKey="Refusées" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={28} animationDuration={700} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 pt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-orange-500 inline-block" />Affectées</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />Acceptées</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />Refusées</span>
            </div>
            {/* Détail par commercial */}
            <div className={`mt-5 space-y-2 overflow-y-auto ${showAllCommerciaux || commSearch ? "max-h-[400px]" : "max-h-[200px]"}`}>
              {(commSearch ? filteredCommerciaux : (showAllCommerciaux ? commerciaux : commerciaux.slice(0, 5))).map((c) => (
                <div key={c.name} className="flex items-center gap-3 text-sm">
                  <span className="w-32 truncate font-medium">{c.name}</span>
                  <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden flex">
                    {c.assigned > 0 && (
                      <>
                        <div className="h-full bg-emerald-500 rounded-l-full" style={{ width: `${(c.accepted / c.assigned) * 100}%` }} />
                        <div className="h-full bg-red-500" style={{ width: `${(c.refused / c.assigned) * 100}%` }} />
                      </>
                    )}
                  </div>
                  <span className={`w-12 text-right font-bold tabular-nums ${c.rate >= 50 ? "text-emerald-600" : c.rate >= 25 ? "text-orange-500" : "text-red-500"}`}>{c.rate}%</span>
                  <span className="text-xs text-muted-foreground w-20 text-right">{c.assigned} fiche{c.assigned > 1 ? "s" : ""}</span>
                </div>
              ))}
              {commSearch && filteredCommerciaux.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-3">Aucun commercial trouvé</p>
              )}
            </div>
            {!commSearch && commerciaux.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllCommerciaux(!showAllCommerciaux)}
                className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 py-2 rounded-lg hover:bg-primary/5 transition-colors"
              >
                {showAllCommerciaux ? <><ChevronUp className="w-3.5 h-3.5" />Réduire</> : <><ChevronDown className="w-3.5 h-3.5" />Voir les {commerciaux.length} commerciaux</>}
              </button>
            )}
          </div>
        )}

        {/* ── Répartition géographique ────────────────────────────────────── */}
        {!isCommercial && (
          <div className="bg-card border border-border rounded-2xl p-6 hover:shadow-md transition-all duration-200">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Villes planifiées — résultats</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Performance des fiches dans les villes issues de la planification</p>
              </div>
            </div>
            {villes.length > 0 ? (
              <div className="space-y-2.5">
                <div className="grid grid-cols-[1fr_60px_60px_60px_50px] gap-2 text-[10px] text-muted-foreground uppercase tracking-wide font-semibold pb-1 border-b border-border">
                  <span>Ville</span>
                  <span className="text-right">Total</span>
                  <span className="text-right text-emerald-600">Accept.</span>
                  <span className="text-right text-red-500">Refus.</span>
                  <span className="text-right">Taux</span>
                </div>
                {villes.map((v) => (
                  <div key={v.ville} className="grid grid-cols-[1fr_60px_60px_60px_50px] gap-2 items-center text-sm">
                    <span className="font-medium truncate">{v.ville}</span>
                    <span className="text-right tabular-nums text-muted-foreground">{v.total}</span>
                    <span className="text-right tabular-nums text-emerald-600 font-medium">{v.accepted}</span>
                    <span className="text-right tabular-nums text-red-500 font-medium">{v.refused}</span>
                    <span className={`text-right tabular-nums font-bold ${v.rate >= 50 ? "text-emerald-600" : v.rate >= 25 ? "text-orange-500" : "text-red-500"}`}>{v.rate}%</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Aucune fiche ne correspond aux villes planifiées</p>
            )}
          </div>
        )}

      </div>
    </>
  );
}
