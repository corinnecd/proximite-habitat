"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Topbar } from "@/components/layout/Topbar";
import { FicheStatusBadge } from "@/components/fiches/FicheStatusBadge";
import { createClient } from "@/lib/supabase/client";
import { getFichesForStats } from "@/lib/data/fiches";
import {
  type Granularity, type StatPoint,
  GRANULARITIES, GRANULARITY_LABELS, CURRENT_PERIOD_LABELS,
  buildBuckets, currentAndPreviousPeriod, conversionRate as periodConversion,
} from "@/lib/stats";
import { useProfile } from "@/lib/hooks/use-profile";
import type { FicheStatus } from "@/types/database";
import { STATUS_LABELS } from "@/lib/permissions";
import {
  BarChart3, TrendingUp, Users, FileText,
  CheckCircle2, XCircle, Clock, ArrowUp, ArrowDown, Minus,
  Medal, Trophy, RefreshCw, CalendarDays,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
  Area, AreaChart,
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────
interface StatusCount { status: FicheStatus; count: number; }
interface ProspecteurRow { name: string; total: number; submitted: number; accepted: number; }

// ── Palette statuts ───────────────────────────────────────────────────────────
const STATUS_COLORS_HEX: Record<FicheStatus, string> = {
  BROUILLON: "#94a3b8", SOUMISE: "#3b82f6",
  AFFECTEE: "#f97316", ACCEPTEE: "#10b981",
  RETRACTATION: "#a855f7",
  REFUSEE: "#ef4444", ARCHIVEE: "#cbd5e1",
};

const STATUS_BAR_COLORS: Record<FicheStatus, string> = {
  BROUILLON: "bg-slate-400", SOUMISE: "bg-blue-500",
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

function PeriodKpi({ label, value, delta, accent }: { label: string; value: number | string; delta?: number; accent?: "green" }) {
  return (
    <div className={`rounded-xl bg-card border border-border border-l-4 p-4 transition-all duration-200 hover:shadow-md ${accent === "green" ? "border-l-emerald-500" : "border-l-primary/40"}`}>
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide truncate">{label}</p>
      <div className="flex items-baseline gap-2 mt-1.5">
        <p className={`text-2xl font-bold tabular-nums ${accent === "green" ? "text-emerald-600" : ""}`}>{value}</p>
        {delta !== undefined && (
          delta === 0
            ? <span className="flex items-center text-xs text-muted-foreground"><Minus className="w-3 h-3" /></span>
            : <span className={`flex items-center text-xs font-semibold ${delta > 0 ? "text-emerald-600" : "text-red-500"}`}>
                {delta > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}{Math.abs(delta)}
              </span>
        )}
      </div>
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
  const [prospecteurs, setProspecteurs] = useState<ProspecteurRow[]>([]);
  const [statPoints, setStatPoints] = useState<StatPoint[]>([]);
  const [granularity, setGranularity] = useState<Granularity>("month");
  const [totalFiches, setTotalFiches] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("ALL");
  const [pieTooltipPos, setPieTooltipPos] = useState<{ x: number; y: number } | undefined>(undefined);

  const isCommercial = profile?.role === "COMMERCIAL";

  async function loadData(profileId: string, role: string, period: PeriodFilter = "ALL") {
    const isComm = role === "COMMERCIAL";
    const statuses: FicheStatus[] = isComm
      ? ["AFFECTEE", "ACCEPTEE", "RETRACTATION", "REFUSEE", "ARCHIVEE"]
      : ["SOUMISE", "AFFECTEE", "ACCEPTEE", "RETRACTATION", "REFUSEE", "ARCHIVEE"];

    // Construire les bornes de la période si filtre actif
    const dates = getPeriodDates(period);
    let ficheIdsForPeriod: string[] | null = null;
    if (dates) {
      const from = `${dates.from}T00:00:00Z`;
      const to   = `${dates.to}T23:59:59Z`;
      // IDs via historique (passage à SOUMISE)
      const { data: histRows } = await supabase
        .from("fiche_history").select("fiche_id")
        .eq("new_status", "SOUMISE").gte("created_at", from).lte("created_at", to);
      const idSet = new Set((histRows ?? []).map((h: { fiche_id: string }) => h.fiche_id));
      // Fallback sur created_at pour fiches sans historique
      const { data: legacyRows } = await supabase
        .from("fiches").select("id").neq("status", "BROUILLON")
        .gte("created_at", from).lte("created_at", to);
      (legacyRows ?? []).forEach((f: { id: string }) => idSet.add(f.id));
      ficheIdsForPeriod = Array.from(idSet);
      if (ficheIdsForPeriod.length === 0) {
        setStatusCounts(statuses.map((s) => ({ status: s, count: 0 })));
        setTotalFiches(0);
        setProspecteurs([]);
        setStatPoints([]);
        setLoading(false);
        return;
      }
    }

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

    if (!isComm) {
      let fichesQuery = supabase
        .from("fiches")
        .select("created_by, status, profiles!created_by(first_name, last_name)")
        .neq("status", "BROUILLON");
      if (ficheIdsForPeriod) fichesQuery = fichesQuery.in("id", ficheIdsForPeriod);
      const { data: fichesRaw } = await fichesQuery;

      if (fichesRaw) {
        const map: Record<string, ProspecteurRow> = {};
        for (const f of fichesRaw as unknown as Array<{
          created_by: string; status: string;
          profiles: { first_name: string; last_name: string } | null;
        }>) {
          const key = f.created_by;
          if (!map[key]) {
            const name = f.profiles ? `${f.profiles.first_name} ${f.profiles.last_name}` : "Inconnu";
            map[key] = { name, total: 0, submitted: 0, accepted: 0 };
          }
          map[key].total++;
          map[key].submitted++;
          if (f.status === "ACCEPTEE") map[key].accepted++;
        }
        setProspecteurs(Object.values(map).sort((a, b) => b.total - a.total).slice(0, 10));
      }
    }

    setStatPoints(await getFichesForStats(supabase, isComm ? { assignedTo: profileId } : undefined));
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

  const accepted   = statusCounts.find((s) => s.status === "ACCEPTEE")?.count ?? 0;
  const refused    = statusCounts.find((s) => s.status === "REFUSEE")?.count ?? 0;
  const submitted  = statusCounts.reduce((a, b) => a + b.count, 0);
  const inProgress = (statusCounts.find((s) => s.status === "SOUMISE")?.count ?? 0) +
                     (statusCounts.find((s) => s.status === "AFFECTEE")?.count ?? 0);
  const conversionRate = submitted > 0 ? Math.round((accepted / submitted) * 100) : 0;
  const maxProspecteur = Math.max(...prospecteurs.map((p) => p.total), 1);

  const buckets = useMemo(() => buildBuckets(statPoints, granularity), [statPoints, granularity]);
  const { current, previous } = useMemo(() => currentAndPreviousPeriod(statPoints, granularity), [statPoints, granularity]);
  const totalDelta = current.total - previous.total;

  // Données pour le pie chart (filtrer les 0)
  const pieData = statusCounts.filter((s) => s.count > 0).map((s) => ({
    name: STATUS_LABELS[s.status],
    value: s.count,
    color: STATUS_COLORS_HEX[s.status],
  }));

  // Données pour le bar/area chart d'évolution
  const chartData = buckets.map((b) => ({
    name: b.label,
    Acceptées: b.accepted,
    Autres: b.total - b.accepted,
    Total: b.total,
  }));

  // Données pour le bar chart des prospecteurs
  const prospecteurChartData = prospecteurs.slice(0, 6).map((p) => ({
    name: p.name.split(" ")[0], // Prénom uniquement pour économiser l'espace
    fullName: p.name,
    Fiches: p.total,
    Acceptées: p.accepted,
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
      <Topbar title={isCommercial ? "Mon reporting" : "Reporting direction"} />
      <div className="p-6 lg:p-8 space-y-6">

        {/* Sous-titre contextuel + bouton refresh */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {isCommercial
              ? <><Users className="w-4 h-4" /> Statistiques personnelles — vos fiches affectées</>
              : <><BarChart3 className="w-4 h-4" /> Vue globale — tous commerciaux et prospecteurs réunis</>}
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

        {/* ── KPIs ─────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label={isCommercial ? "Mes fiches" : "Total fiches"} value={totalFiches}
            Icon={FileText} iconBg="bg-primary/10" iconColor="text-primary"
            border="border-l-primary"
          />
          <KpiCard
            label="Taux de conversion" value={`${conversionRate}%`}
            sub={`${accepted} acceptée${accepted > 1 ? "s" : ""}`}
            Icon={CheckCircle2} iconBg="bg-emerald-100 dark:bg-emerald-900/30" iconColor="text-emerald-600"
            border="border-l-emerald-500"
            trend={{ delta: totalDelta }}
          />
          <KpiCard
            label="En cours" value={inProgress}
            sub="Soumises + affectées"
            Icon={Clock} iconBg="bg-orange-100 dark:bg-orange-900/30" iconColor="text-orange-600"
            border="border-l-orange-500"
          />
          <KpiCard
            label="Refusées" value={refused}
            Icon={XCircle} iconBg="bg-red-100 dark:bg-red-900/30" iconColor="text-red-500"
            border="border-l-red-500"
          />
        </div>

        {/* ── Ligne 2 : Pie chart + Prospecteurs ──────────────────────────── */}
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
                        setPieTooltipPos({
                          x: cx + (or + 18) * Math.cos(-ma * RADIAN),
                          y: cy + (or + 18) * Math.sin(-ma * RADIAN),
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
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0];
                        const pct = Math.round(((d.value as number) / pieData.reduce((s, p) => s + p.value, 0)) * 100);
                        return (
                          <div className="bg-popover border border-border rounded-xl px-3 py-2 shadow-lg text-xs flex items-center gap-2">
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
                      <span className="text-xs font-semibold tabular-nums">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Top prospecteurs (direction) ou performance (commercial) */}
          <div className="bg-card border border-border rounded-2xl p-6 hover:shadow-md transition-all duration-200">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <Trophy className="w-4 h-4 text-amber-600" />
              </div>
              <h3 className="font-semibold text-sm">{isCommercial ? "Ma performance" : "Top prospecteurs"}</h3>
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
            ) : prospecteurs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucune fiche soumise pour le moment</p>
              </div>
            ) : (
              <>
                {/* Bar chart prospecteurs */}
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={prospecteurChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f1f5f9", radius: 6 }} />
                    <Bar dataKey="Fiches" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={32} animationDuration={700} />
                    <Bar dataKey="Acceptées" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} animationDuration={700} />
                  </BarChart>
                </ResponsiveContainer>
                {/* Classement détaillé */}
                <div className="mt-4 space-y-3">
                  {prospecteurs.slice(0, 5).map((p, i) => {
                    const medalColor = i === 0 ? "text-amber-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-700" : "text-muted-foreground";
                    const convRate = p.total > 0 ? Math.round((p.accepted / p.total) * 100) : 0;
                    return (
                      <div key={p.name} className="flex items-center gap-3">
                        <div className="w-7 flex items-center justify-center shrink-0">
                          {i < 3
                            ? <Medal className={`w-5 h-5 ${medalColor}`} />
                            : <span className="text-sm font-bold text-muted-foreground tabular-nums">{i + 1}</span>}
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
                          <Bar2 value={p.total} max={maxProspecteur} colorClass="bg-primary/70" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Évolution par période (Area chart) ───────────────────────────── */}
        <div className="bg-card border border-border rounded-2xl p-6 hover:shadow-md transition-all duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4 text-blue-600" />
              </div>
              <h3 className="font-semibold text-sm">Évolution</h3>
            </div>
            <Tabs value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
              <TabsList variant="line" className="h-auto flex-wrap">
                {GRANULARITIES.map((g) => (
                  <TabsTrigger key={g} value={g}>{GRANULARITY_LABELS[g]}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {/* KPIs période courante */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <PeriodKpi label={`Total ${CURRENT_PERIOD_LABELS[granularity]}`} value={current.total} delta={totalDelta} />
            <PeriodKpi label="Soumises" value={current.submitted} />
            <PeriodKpi label="Acceptées" value={current.accepted} accent="green" />
            <PeriodKpi label="Conversion" value={`${periodConversion(current)}%`} accent="green" />
          </div>

          {/* Area chart */}
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Pas de données pour cette période</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAcceptees" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorAutres" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: string) => v.length > 10 ? v.slice(0, 8) + "…" : v}
                  />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="Autres"
                    stackId="1"
                    stroke="#f97316"
                    strokeWidth={2}
                    fill="url(#colorAutres)"
                    animationDuration={700}
                  />
                  <Area
                    type="monotone"
                    dataKey="Acceptées"
                    stackId="1"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#colorAcceptees)"
                    animationDuration={700}
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 pt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />Acceptées</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#f97316]/60 inline-block" />Autres</span>
              </div>
            </>
          )}
        </div>

      </div>
    </>
  );
}
