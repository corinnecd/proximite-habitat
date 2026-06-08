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
import {
  BarChart3, TrendingUp, Users, FileText,
  CheckCircle2, XCircle, Clock, ArrowUp, ArrowDown, Minus,
  Medal, Trophy,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface StatusCount { status: FicheStatus; count: number; }
interface ProspecteurRow { name: string; total: number; submitted: number; accepted: number; }

// ── Palette statuts ───────────────────────────────────────────────────────────
const STATUS_BAR_COLORS: Record<FicheStatus, string> = {
  BROUILLON: "bg-slate-400", SOUMISE: "bg-blue-500",
  AFFECTEE: "bg-orange-500", ACCEPTEE: "bg-emerald-500",
  REFUSEE: "bg-red-500", ARCHIVEE: "bg-slate-300",
};

// ── Composants locaux ─────────────────────────────────────────────────────────

function Bar({ value, max, colorClass }: { value: number; max: number; colorClass: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-semibold w-8 text-right tabular-nums">{value}</span>
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

  const isCommercial = profile?.role === "COMMERCIAL";

  async function loadData(profileId: string, role: string) {
    const isComm = role === "COMMERCIAL";
    const statuses: FicheStatus[] = isComm
      ? ["AFFECTEE", "ACCEPTEE", "REFUSEE", "ARCHIVEE"]
      : ["BROUILLON", "SOUMISE", "AFFECTEE", "ACCEPTEE", "REFUSEE", "ARCHIVEE"];

    const countResults = await Promise.all(
      statuses.map(async (s) => {
        let q = supabase.from("fiches").select("*", { count: "exact", head: true }).eq("status", s);
        if (isComm) q = q.eq("assigned_to", profileId);
        const { count } = await q;
        return { status: s, count: count || 0 };
      })
    );
    setStatusCounts(countResults);
    setTotalFiches(countResults.reduce((a, b) => a + b.count, 0));

    // Top prospecteurs (direction uniquement)
    if (!isComm) {
      const { data: fichesRaw } = await supabase
        .from("fiches")
        .select("created_by, status, profiles!created_by(first_name, last_name)")
        .neq("status", "BROUILLON");

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
    loadData(profile.id, profile.role);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, profileLoading]);

  const accepted   = statusCounts.find((s) => s.status === "ACCEPTEE")?.count ?? 0;
  const refused    = statusCounts.find((s) => s.status === "REFUSEE")?.count ?? 0;
  const submitted  = statusCounts.filter((s) => s.status !== "BROUILLON").reduce((a, b) => a + b.count, 0);
  const inProgress = (statusCounts.find((s) => s.status === "SOUMISE")?.count ?? 0) +
                     (statusCounts.find((s) => s.status === "AFFECTEE")?.count ?? 0);
  const conversionRate = submitted > 0 ? Math.round((accepted / submitted) * 100) : 0;
  const maxStatus = Math.max(...statusCounts.map((s) => s.count), 1);
  const maxProspecteur = Math.max(...prospecteurs.map((p) => p.total), 1);

  const buckets = useMemo(() => buildBuckets(statPoints, granularity), [statPoints, granularity]);
  const { current, previous } = useMemo(() => currentAndPreviousPeriod(statPoints, granularity), [statPoints, granularity]);
  const maxBucket = Math.max(...buckets.map((b) => b.total), 1);
  const totalDelta = current.total - previous.total;

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

        {/* Sous-titre contextuel */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {isCommercial
            ? <><Users className="w-4 h-4" /> Statistiques personnelles — vos fiches affectées</>
            : <><BarChart3 className="w-4 h-4" /> Vue globale — tous commerciaux et prospecteurs réunis</>}
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

        {/* ── Ligne 2 : Répartition + Prospecteurs ────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Répartition par statut */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-5 hover:shadow-md transition-all duration-200">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <BarChart3 className="w-4 h-4 text-primary" />
              </div>
              <h3 className="font-semibold text-sm">Répartition par statut</h3>
            </div>
            <div className="space-y-4">
              {statusCounts.map(({ status, count }) => (
                <div key={status}>
                  <div className="flex items-center justify-between mb-2">
                    <FicheStatusBadge status={status} />
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="tabular-nums font-medium text-foreground">{count}</span>
                      <span className="w-9 text-right">
                        {totalFiches > 0 ? `${Math.round((count / totalFiches) * 100)}%` : "0%"}
                      </span>
                    </div>
                  </div>
                  <Bar value={count} max={maxStatus} colorClass={STATUS_BAR_COLORS[status]} />
                </div>
              ))}
            </div>
          </div>

          {/* Top prospecteurs (direction) ou résumé performance (commercial) */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-5 hover:shadow-md transition-all duration-200">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <Trophy className="w-4 h-4 text-amber-600" />
              </div>
              <h3 className="font-semibold text-sm">{isCommercial ? "Ma performance" : "Top prospecteurs"}</h3>
            </div>
            {isCommercial ? (
              /* Vue commercial : récap statuts */
              <div className="space-y-3">
                {statusCounts.filter(s => s.count > 0).map(({ status, count }) => (
                  <div key={status}>
                    <div className="flex items-center justify-between mb-1.5">
                      <FicheStatusBadge status={status} />
                      <span className="text-sm font-semibold tabular-nums">{count}</span>
                    </div>
                    <Bar value={count} max={Math.max(...statusCounts.map(s => s.count), 1)} colorClass={STATUS_BAR_COLORS[status]} />
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
              <div className="space-y-4">
                {prospecteurs.map((p, i) => {
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
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <div className="flex items-center gap-2 text-xs shrink-0 ml-2">
                            {p.accepted > 0 && (
                              <span className="text-emerald-600 font-medium">✓ {p.accepted}</span>
                            )}
                            <span className="text-muted-foreground">{p.total} fiche{p.total > 1 ? "s" : ""}</span>
                            <span className={`font-medium ${convRate >= 50 ? "text-emerald-600" : convRate >= 25 ? "text-orange-500" : "text-muted-foreground"}`}>
                              {convRate}%
                            </span>
                          </div>
                        </div>
                        <Bar value={p.total} max={maxProspecteur} colorClass="bg-primary/70" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Évolution par période ─────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-6 hover:shadow-md transition-all duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <PeriodKpi label={`Total ${CURRENT_PERIOD_LABELS[granularity]}`} value={current.total} delta={totalDelta} />
            <PeriodKpi label="Soumises" value={current.submitted} />
            <PeriodKpi label="Acceptées" value={current.accepted} accent="green" />
            <PeriodKpi label="Conversion" value={`${periodConversion(current)}%`} accent="green" />
          </div>

          {/* Barres d'évolution */}
          {buckets.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Pas de données pour cette période</p>
          ) : (
            <div className="space-y-3">
              {buckets.map((b) => {
                const acceptedPct = b.total > 0 ? Math.round((b.accepted / b.total) * 100) : 0;
                return (
                  <div key={b.key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium capitalize">{b.label}</span>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {b.accepted > 0 && (
                          <span className="text-emerald-600 font-medium">{acceptedPct}% acceptées</span>
                        )}
                        <span className="tabular-nums font-semibold text-foreground">{b.total}</span>
                      </div>
                    </div>
                    {/* Barre composite : acceptées en vert + reste en primary */}
                    <div className="h-3 bg-muted rounded-full overflow-hidden flex">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-700"
                        style={{ width: `${maxBucket > 0 ? (b.accepted / maxBucket) * 100 : 0}%` }}
                      />
                      <div
                        className="h-full bg-primary/50 transition-all duration-700"
                        style={{ width: `${maxBucket > 0 ? ((b.total - b.accepted) / maxBucket) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center gap-4 pt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />Acceptées</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-primary/50 inline-block" />Autres</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
