"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { ExportPdfButton } from "@/components/ui/export-pdf-button";
import { ExportCsvButton } from "@/components/ui/export-csv-button";
import { FicheStatusBadge } from "@/components/fiches/FicheStatusBadge";
import { createClient } from "@/lib/supabase/client";
import type { FicheStatus, MotifRefus } from "@/types/database";
import { STATUS_LABELS, MOTIF_REFUS_LABELS } from "@/lib/permissions";
import { type PeriodFilter, PERIOD_LABELS, getPeriodDates, getPeriodLabel as getReportPeriodLabel } from "@/lib/periods";
import {
  BarChart3, TrendingUp, FileText, CalendarDays, RefreshCw, Euro, XCircle,
  Clock, Wrench, CalendarCheck, CheckCircle2, ArrowLeft, ChevronLeft, ChevronRight,
} from "lucide-react";
import { KpiCard, CustomTooltip } from "@/components/reporting/KpiCard";
import { ConversionFunnel } from "@/components/reporting/ConversionFunnel";
import { EvolutionChart, bucketCommercialVentes, type Granularity } from "@/components/reporting/EvolutionChart";
import { Button } from "@/components/ui/button";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from "recharts";

// ── Types (identiques à /reporting) ─────────────────────────────────────────
interface StatusCount { status: FicheStatus; count: number; }
interface WeeklyPoint { label: string; creees: number; acceptees: number; }

function roundToHundred(values: number[], total: number): number[] {
  if (total === 0) return values.map(() => 0);
  const raw = values.map((v) => (v / total) * 100);
  const floored = raw.map((r) => Math.floor(r));
  let diff = 100 - floored.reduce((a, b) => a + b, 0);
  const remainders = raw.map((r, i) => ({ i, r: r - floored[i] })).sort((a, b) => b.r - a.r);
  for (let k = 0; k < diff; k++) floored[remainders[k].i]++;
  return floored;
}

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

const COMMERCIAL_STATUSES: FicheStatus[] = [
  "AFFECTEE", "RDV_A_REPRENDRE", "ACCEPTEE", "RETRACTATION", "REFUSEE", "RDV_TECHNICIEN", "INSTALLEE", "ARCHIVEE",
];

function Bar2({ value, max, colorClass }: { value: number; max: number; colorClass: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-700 ${colorClass}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/**
 * Vue "reporting personnel" d'un commercial — contenu strictement identique
 * à ce que le commercial voit sur /reporting (mêmes KPIs, mêmes graphiques,
 * mêmes chiffres). Réutilisée par le commercial lui-même ET par la direction
 * en lecture seule (seul le Topbar diffère : titre + bouton retour).
 */
export function CommercialReportingView({
  subjectId, topbarTitle, backHref, backLabel,
}: {
  subjectId: string;
  topbarTitle?: string;
  backHref?: string;
  backLabel?: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [statusCounts, setStatusCounts] = useState<StatusCount[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyPoint[]>([]);
  const [motifRefusCounts, setMotifRefusCounts] = useState<Record<MotifRefus, number>>({ RDC: 0, ANNULATION: 0, REFUS_CLASSIQUE: 0 });
  const [totalFiches, setTotalFiches] = useState(0);
  const [caTotal, setCaTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("ALL");
  const [pieTooltipPos, setPieTooltipPos] = useState<{ x: number; y: number } | undefined>(undefined);
  const [rawFiches, setRawFiches] = useState<{ created_by: string; assigned_to: string | null; status: string; montant_ht: number | null; created_at: string }[]>([]);
  const [evolGranularity, setEvolGranularity] = useState<Granularity>("month");
  const [weeklyTrendOffset, setWeeklyTrendOffset] = useState(0);

  const cacheKey = `rpt_cache_${subjectId}`;

  useLayoutEffect(() => {
    try {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) return;
      const c = JSON.parse(raw);
      if (c.statusCounts) setStatusCounts(c.statusCounts);
      if (c.totalFiches != null) setTotalFiches(c.totalFiches);
      if (c.caTotal != null) setCaTotal(c.caTotal);
      if (c.weeklyData) setWeeklyData(c.weeklyData);
      if (c.motifRefusCounts) setMotifRefusCounts(c.motifRefusCounts);
      if (c.rawFiches) setRawFiches(c.rawFiches);
      setLoading(false);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  const loadData = useCallback(async (period: PeriodFilter) => {
    const dates = getPeriodDates(period);
    let ficheIdsForPeriod: string[] | null = null;

    if (dates) {
      const from = `${dates.from}T00:00:00Z`;
      const to = `${dates.to}T23:59:59Z`;
      const { data: ficheRows } = await supabase
        .from("fiches").select("id").neq("status", "BROUILLON")
        .eq("assigned_to", subjectId)
        .gte("updated_at", from).lte("updated_at", to);
      ficheIdsForPeriod = (ficheRows ?? []).map((f: { id: string }) => f.id);

      if (ficheIdsForPeriod.length === 0) {
        setStatusCounts(COMMERCIAL_STATUSES.map((s) => ({ status: s, count: 0 })));
        setTotalFiches(0);
        setCaTotal(0);
        setMotifRefusCounts({ RDC: 0, ANNULATION: 0, REFUS_CLASSIQUE: 0 });
        setWeeklyData([]);
        setRawFiches([]);
        setLoading(false);
        return;
      }
    }

    let fichesQuery = supabase
      .from("fiches")
      .select("id, status, motif_refus, montant_ht, created_at")
      .eq("assigned_to", subjectId)
      .neq("status", "BROUILLON");
    if (ficheIdsForPeriod) fichesQuery = fichesQuery.in("id", ficheIdsForPeriod);

    const { data: fichesRaw } = await fichesQuery;
    type FicheRow = { id: string; status: string; montant_ht: number | null; motif_refus: MotifRefus | null; created_at: string };
    const fiches = (fichesRaw ?? []) as unknown as FicheRow[];

    const rawForBucket = fiches.map((f) => ({
      created_by: "", assigned_to: subjectId, status: f.status, montant_ht: f.montant_ht, created_at: f.created_at,
    }));
    setRawFiches(rawForBucket);

    const statusMap: Record<string, number> = {};
    for (const f of fiches) statusMap[f.status] = (statusMap[f.status] ?? 0) + 1;
    const countResults = COMMERCIAL_STATUSES.map((s) => ({ status: s, count: statusMap[s] ?? 0 }));
    setStatusCounts(countResults);
    const freshTotal = countResults.reduce((a, b) => a + b.count, 0);
    setTotalFiches(freshTotal);

    const motifCounts: Record<MotifRefus, number> = { RDC: 0, ANNULATION: 0, REFUS_CLASSIQUE: 0 };
    for (const f of fiches) {
      if (f.status === "REFUSEE" && f.motif_refus) motifCounts[f.motif_refus]++;
    }
    setMotifRefusCounts(motifCounts);

    const freshCaTotal = fiches.filter((f) => f.status === "ACCEPTEE").reduce((sum, f) => sum + (f.montant_ht ? Number(f.montant_ht) : 0), 0);
    setCaTotal(freshCaTotal);

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

    try {
      localStorage.setItem(cacheKey, JSON.stringify({
        statusCounts: countResults, totalFiches: freshTotal, caTotal: freshCaTotal,
        weeklyData: weekBuckets, motifRefusCounts: motifCounts, rawFiches: rawForBucket,
      }));
    } catch { /* ignore */ }
    setLoading(false);
  }, [supabase, subjectId, cacheKey]);

  useEffect(() => {
    loadData(periodFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId, periodFilter]);

  const commEvolutionData = useMemo(() => bucketCommercialVentes(rawFiches, evolGranularity, subjectId), [rawFiches, evolGranularity, subjectId]);

  const accepted = statusCounts.find((s) => s.status === "ACCEPTEE")?.count ?? 0;
  const refused = statusCounts.find((s) => s.status === "REFUSEE")?.count ?? 0;
  const affectees = statusCounts.find((s) => s.status === "AFFECTEE")?.count ?? 0;
  const retractation = statusCounts.find((s) => s.status === "RETRACTATION")?.count ?? 0;
  const rdvTechnicien = statusCounts.find((s) => s.status === "RDV_TECHNICIEN")?.count ?? 0;
  const installees = statusCounts.find((s) => s.status === "INSTALLEE")?.count ?? 0;
  const inProgress = affectees + retractation;
  const baseActive = accepted + refused + inProgress;
  const acceptanceRate = baseActive > 0 ? Math.round((accepted / baseActive) * 100) : 0;
  const refusalRate = baseActive > 0 ? Math.round((refused / baseActive) * 100) : 0;
  const inProgressRate = baseActive > 0 ? Math.round((inProgress / baseActive) * 100) : 0;
  const installationRate = (accepted + rdvTechnicien + installees) > 0 ? Math.round((installees / (accepted + rdvTechnicien + installees)) * 100) : 0;
  const _pl = getReportPeriodLabel(periodFilter);
  const periodSuffix = _pl ? ` (${_pl})` : "";
  const isAllPeriod = periodFilter === "ALL";

  const pieData = statusCounts.filter((s) => s.count > 0).map((s) => ({
    name: STATUS_LABELS[s.status], value: s.count, color: STATUS_COLORS_HEX[s.status],
  }));

  return (
    <>
      <Topbar
        title={topbarTitle ?? "Mon reporting"}
        actions={
          <div className="flex items-center gap-2">
            {backHref && (
              <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={() => router.push(backHref)}>
                <ArrowLeft className="w-4 h-4" />{backLabel ?? "Retour"}
              </Button>
            )}
            <ExportPdfButton
              title={topbarTitle ?? "Mon reporting"}
              subtitle={`Période : ${_pl ? `${PERIOD_LABELS[periodFilter]} (${_pl})` : PERIOD_LABELS[periodFilter]}`}
              filename="reporting"
            />
            <ExportCsvButton filename="reporting" getData={() => ({
              columns: [
                { key: "indicateur", label: "Indicateur" },
                { key: "valeur", label: "Valeur" },
              ] as { key: keyof { indicateur: string; valeur: string }; label: string }[],
              rows: [
                { indicateur: "Fiches totales", valeur: String(totalFiches) },
                { indicateur: "Acceptées", valeur: String(accepted) },
                { indicateur: "Refusées", valeur: String(refused) },
                { indicateur: "CA Total HT", valeur: String(caTotal) },
                { indicateur: "Période", valeur: PERIOD_LABELS[periodFilter] },
              ],
            })} />
          </div>
        }
      />
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">

        {/* ═══ HERO REPORTING ═══ */}
        <div className="hero-surface hero-surface-sm rounded-3xl p-6 sm:p-7">
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5">
              <div>
                <span className="text-[10px] tracking-[1.2px] uppercase text-white/50 font-medium">Vue personnelle</span>
                <h1 className="font-heading text-3xl sm:text-4xl text-white tracking-tight leading-none mt-1.5">Mon reporting</h1>
                <p className="text-sm text-white/60 mt-2">Statistiques personnelles — vos fiches affectées</p>
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
                  onClick={async () => { setRefreshing(true); await loadData(periodFilter); setRefreshing(false); }}
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

        {/* ── KPIs ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard
            label={(isAllPeriod ? "Mes fiches globales" : "Mes fiches") + periodSuffix} value={totalFiches}
            Icon={FileText} iconBg="bg-primary/10" iconColor="text-primary"
            border="border-l-primary" loading={loading}
          />
          <KpiCard
            label={(isAllPeriod ? "Mon CA global HT" : "Mon CA HT") + periodSuffix}
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
            label={(isAllPeriod ? "Mon taux global d'acceptation" : "Mon taux d'acceptation") + periodSuffix}
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
            sub={`${inProgress} fiche${inProgress > 1 ? "s" : ""} · affectées, attente client`}
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

        {/* ── Funnel de conversion ────────────────────────────────────── */}
        {totalFiches > 0 && (
          <ConversionFunnel
            statusCounts={statusCounts}
            isCommercial
            accepted={accepted}
            refused={refused}
            acceptanceRate={acceptanceRate}
            periodSuffix={periodSuffix}
          />
        )}

        {/* ── Ligne 2 : Pie chart + Ma performance ─────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] p-6 hover:shadow-md transition-all duration-200">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <BarChart3 className="w-4 h-4 text-primary" />
              </div>
              <h3 className="font-semibold text-sm">{isAllPeriod ? "Répartition globale par statut" : "Répartition par statut"}{periodSuffix}</h3>
            </div>
            {pieData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Aucune donnée disponible</div>
            ) : (
              <div className="space-y-4">
                <style>{`
                  .pie-hover .recharts-pie-sector path { transition: transform 0.2s ease; transform-box: fill-box; transform-origin: center; }
                  .pie-hover .recharts-pie-sector:hover path { transform: scale(1.07); }
                `}</style>
                <div className="pie-hover">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                    <Pie
                      data={pieData}
                      cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={2} dataKey="value"
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
                          <text x={cxn + r * Math.cos(-ma * RADIAN)} y={cyn + r * Math.sin(-ma * RADIAN)}
                            fill="white" textAnchor="middle" dominantBaseline="central" fontSize={18} fontWeight="800"
                            style={{ pointerEvents: "none" }}>
                            {typeof value === "number" ? value : ""}
                          </text>
                        );
                      }}
                      labelLine={false}
                      isAnimationActive={false}
                      onMouseEnter={(data: { cx?: number; cy?: number; midAngle?: number; outerRadius?: number }) => {
                        const RADIAN = Math.PI / 180;
                        const cx = data.cx ?? 0; const cy = data.cy ?? 0; const ma = data.midAngle ?? 0; const or = data.outerRadius ?? 0;
                        const cosA = Math.cos(-ma * RADIAN); const sinA = Math.sin(-ma * RADIAN);
                        const tipX = cx + (or + 2) * cosA + 15; const tipY = cy + (or + 2) * sinA - 10;
                        setPieTooltipPos({ x: cosA >= 0 ? tipX : tipX - 220, y: tipY });
                      }}
                      onMouseLeave={() => setPieTooltipPos(undefined)}
                    >
                      {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip
                      position={pieTooltipPos}
                      isAnimationActive={false}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0];
                        const pct = Math.round(((d.value as number) / pieData.reduce((s, p) => s + p.value, 0)) * 100);
                        return (
                          <div className="bg-popover border border-border rounded-xl px-3 py-2 shadow-lg text-xs flex items-center gap-2 transition-[transform] duration-300 ease-out">
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

          <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] p-6 hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{isAllPeriod ? "Ma performance globale" : "Ma performance"}{periodSuffix}</h3>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {statusCounts.filter((s) => s.count > 0).map(({ status, count }) => (
                <div key={status}>
                  <div className="flex items-center justify-between mb-1.5">
                    <FicheStatusBadge status={status} />
                    <span className="text-sm font-semibold tabular-nums">{count}</span>
                  </div>
                  <Bar2 value={count} max={Math.max(...statusCounts.map((s) => s.count), 1)} colorClass={STATUS_BAR_COLORS[status]} />
                </div>
              ))}
              {statusCounts.every((s) => s.count === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">Aucune fiche affectée pour le moment</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Analyse des refus ─────────────────────────────────────────── */}
        {refused > 0 && (() => {
          const MOTIF_COLORS_HEX: Record<MotifRefus, string> = { RDC: "#f97316", ANNULATION: "#f59e0b", REFUS_CLASSIQUE: "#ef4444" };
          const MOTIF_CARD_COLORS: Record<MotifRefus, { bg: string; text: string; bar: string; icon: string }> = {
            RDC: { bg: "bg-orange-50 dark:bg-orange-950/20", text: "text-orange-700 dark:text-orange-300", bar: "bg-orange-500", icon: "🚪" },
            ANNULATION: { bg: "bg-amber-50 dark:bg-amber-950/20", text: "text-amber-700 dark:text-amber-300", bar: "bg-amber-500", icon: "📞" },
            REFUS_CLASSIQUE: { bg: "bg-red-50 dark:bg-red-950/20", text: "text-red-700 dark:text-red-300", bar: "bg-red-500", icon: "✋" },
          };
          const allMotifs = Object.keys(MOTIF_REFUS_LABELS) as MotifRefus[];
          const motifPctByKey: Record<string, number> = {};
          roundToHundred(allMotifs.map((m) => motifRefusCounts[m]), refused).forEach((pct, i) => { motifPctByKey[allMotifs[i]] = pct; });
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
                <div className="flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={refusChartData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value" labelLine={false} label={false}>
                        {refusChartData.map((entry, i) => <Cell key={i} fill={entry.fill} stroke="transparent" />)}
                      </Pie>
                      <Tooltip formatter={(value: unknown, name: unknown) => [`${value} fiche${Number(value) > 1 ? "s" : ""}`, String(name)]} contentStyle={{ borderRadius: 12, fontSize: 13, border: "1px solid #e5e7eb" }} />
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

        {/* ── Analyse des acceptations ──────────────────────────────────── */}
        {(accepted + retractation + rdvTechnicien + installees) > 0 && (() => {
          const ACCEPT_STATUSES = [
            { key: "ACCEPTEE", label: "Acceptation client", icon: "✅", color: "#10b981", bg: "bg-emerald-50 dark:bg-emerald-950/20", text: "text-emerald-700 dark:text-emerald-300", bar: "bg-emerald-500" },
            { key: "RETRACTATION", label: "Attente acceptation client", icon: "⏳", color: "#f59e0b", bg: "bg-amber-50 dark:bg-amber-950/20", text: "text-amber-700 dark:text-amber-300", bar: "bg-amber-500" },
            { key: "RDV_TECHNICIEN", label: "RDV Technicien planifié", icon: "🔧", color: "#3b82f6", bg: "bg-blue-50 dark:bg-blue-950/20", text: "text-blue-700 dark:text-blue-300", bar: "bg-blue-500" },
            { key: "INSTALLEE", label: "Installation réalisée", icon: "🏠", color: "#8b5cf6", bg: "bg-violet-50 dark:bg-violet-950/20", text: "text-violet-700 dark:text-violet-300", bar: "bg-violet-500" },
          ] as const;
          const acceptCounts: Record<string, number> = { ACCEPTEE: accepted, RETRACTATION: retractation, RDV_TECHNICIEN: rdvTechnicien, INSTALLEE: installees };
          const totalAccept = accepted + retractation + rdvTechnicien + installees;
          const acceptPctByKey: Record<string, number> = {};
          roundToHundred(ACCEPT_STATUSES.map((s) => acceptCounts[s.key]), totalAccept).forEach((pct, i) => { acceptPctByKey[ACCEPT_STATUSES[i].key] = pct; });
          const acceptChartData = ACCEPT_STATUSES.filter((s) => acceptCounts[s.key] > 0).map((s) => ({ name: s.label, value: acceptCounts[s.key], fill: s.color, pct: acceptPctByKey[s.key] }));

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
                      <Pie data={acceptChartData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value" labelLine={false} label={false}>
                        {acceptChartData.map((entry, i) => <Cell key={i} fill={entry.fill} stroke="transparent" />)}
                      </Pie>
                      <Tooltip formatter={(value: unknown, name: unknown) => [`${value} fiche${Number(value) > 1 ? "s" : ""}`, String(name)]} contentStyle={{ borderRadius: 12, fontSize: 13, border: "1px solid #e5e7eb" }} />
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

        {/* ── Évolution de mes ventes ──────────────────────────────────── */}
        <EvolutionChart
          title="Évolution de mes ventes"
          subtitle="Nombre de ventes et chiffre d'affaires par période"
          icon={<Euro className="w-4 h-4 text-emerald-600" />}
          iconBg="bg-emerald-100 dark:bg-emerald-900/30"
          data={commEvolutionData}
          lines={[
            { dataKey: "ventes", label: "Ventes", color: "#10b981", yAxisId: "left" },
            { dataKey: "ca", label: "CA HT", color: "#f59e0b", yAxisId: "right", formatter: (v: number) => `${v.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}€` },
          ]}
          persons={[]}
          selectedPerson={subjectId}
          onPersonChange={() => {}}
          dualAxis
          rightAxisFormatter={(v: number) => `${(v / 1000).toFixed(0)}k€`}
          hidePersonSelector
          granularity={evolGranularity}
          onGranularityChange={setEvolGranularity}
        />

        {/* ── Évolution en % de mes ventes ──────────────────────────────── */}
        <EvolutionChart
          title="Évolution en % de mes ventes"
          subtitle="Variation d'une période à l'autre (ventes & CA HT)"
          icon={<TrendingUp className="w-4 h-4 text-emerald-600" />}
          iconBg="bg-emerald-100 dark:bg-emerald-900/30"
          data={commEvolutionData}
          showZeroLine
          hidePersonSelector
          lines={[
            { dataKey: "ventesEvol", label: "Évolution ventes", color: "#10b981", formatter: (v: number) => `${v > 0 ? "+" : ""}${v}%` },
            { dataKey: "caEvol", label: "Évolution CA", color: "#f59e0b", formatter: (v: number) => `${v > 0 ? "+" : ""}${v}%` },
          ]}
          persons={[]}
          selectedPerson={subjectId}
          onPersonChange={() => {}}
          granularity={evolGranularity}
          onGranularityChange={setEvolGranularity}
        />

        {/* ── Tendance hebdomadaire (fenêtre de 8 semaines) ─────────────── */}
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
                  className="w-7 h-7 flex items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setWeeklyTrendOffset((o) => Math.max(o - 1, 0))}
                  disabled={!canGoForward}
                  aria-label="Semaines suivantes"
                  className="w-7 h-7 flex items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
              <AreaChart data={visibleWeeklyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
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

        </div>
      </div>
    </>
  );
}
