"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface StatusCount { status: FicheStatus; count: number; }
interface ProspecteurRow { name: string; total: number; submitted: number; accepted: number; }

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<FicheStatus, string> = {
  BROUILLON: "bg-gray-400", SOUMISE: "bg-blue-500",
  AFFECTEE: "bg-orange-500", ACCEPTEE: "bg-green-500",
  REFUSEE: "bg-red-500", ARCHIVEE: "bg-gray-300",
};

function Bar({ value, max, colorClass }: { value: number; max: number; colorClass: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-semibold w-8 text-right">{value}</span>
    </div>
  );
}

function PeriodKpi({ label, value, delta, accent }: { label: string; value: number | string; delta?: number; accent?: "green" }) {
  return (
    <div className="rounded-xl bg-muted/50 p-3">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide truncate">{label}</p>
      <div className="flex items-baseline gap-2 mt-1">
        <p className={`text-2xl font-bold ${accent === "green" ? "text-green-600" : ""}`}>{value}</p>
        {delta !== undefined && (
          delta === 0 ? (
            <span className="flex items-center text-xs text-muted-foreground"><Minus className="w-3 h-3" /></span>
          ) : (
            <span className={`flex items-center text-xs font-medium ${delta > 0 ? "text-green-600" : "text-red-500"}`}>
              {delta > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}{Math.abs(delta)}
            </span>
          )
        )}
      </div>
    </div>
  );
}

// ── Composant ──────────────────────────────────────────────────────────────

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

  async function loadData() {
    // ── 1. Compteurs par statut ────────────────────────────────────────────
    const statuses: FicheStatus[] = ["BROUILLON","SOUMISE","AFFECTEE","ACCEPTEE","REFUSEE","ARCHIVEE"];
    const countResults = await Promise.all(
      statuses.map(async (s) => {
        const { count } = await supabase.from("fiches")
          .select("*", { count: "exact", head: true }).eq("status", s);
        return { status: s, count: count || 0 };
      })
    );
    setStatusCounts(countResults);
    setTotalFiches(countResults.reduce((a, b) => a + b.count, 0));

    // ── 2. Top prospecteurs ────────────────────────────────────────────────
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
      setProspecteurs(
        Object.values(map).sort((a, b) => b.total - a.total).slice(0, 10)
      );
    }

    // ── 3. Points pour l'évolution paramétrable (1 seule requête) ──────────
    setStatPoints(await getFichesForStats(supabase));
    setLoading(false);
  }

  useEffect(() => {
    if (profileLoading) return;
    if (!profile) return;
    if (profile.role !== "ADMIN") { router.replace("/"); return; }
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, profileLoading]);

  // ── KPIs rapides ──────────────────────────────────────────────────────────
  const accepted = statusCounts.find((s) => s.status === "ACCEPTEE")?.count ?? 0;
  const submitted = statusCounts.filter((s) => s.status !== "BROUILLON").reduce((a, b) => a + b.count, 0);
  const conversionRate = submitted > 0 ? Math.round((accepted / submitted) * 100) : 0;
  const inProgress = (statusCounts.find((s) => s.status === "SOUMISE")?.count ?? 0) +
                     (statusCounts.find((s) => s.status === "AFFECTEE")?.count ?? 0);
  const maxStatus = Math.max(...statusCounts.map((s) => s.count), 1);
  const maxProspecteur = Math.max(...prospecteurs.map((p) => p.total), 1);

  // Évolution paramétrable + période courante vs précédente
  const buckets = useMemo(() => buildBuckets(statPoints, granularity), [statPoints, granularity]);
  const { current, previous } = useMemo(
    () => currentAndPreviousPeriod(statPoints, granularity),
    [statPoints, granularity],
  );
  const maxBucket = Math.max(...buckets.map((b) => b.total), 1);
  const totalDelta = current.total - previous.total;

  if (profileLoading || loading) {
    return (
      <>
        <Topbar title="Reporting" />
        <div className="p-6 lg:p-8 animate-pulse space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 bg-card rounded-xl" />)}
          </div>
          <div className="h-64 bg-card rounded-xl" />
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title="Reporting" />
      <div className="p-6 lg:p-8 space-y-8">

        {/* ── KPIs rapides ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total fiches</p>
              </div>
              <p className="text-3xl font-bold">{totalFiches}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                </div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Taux conversion</p>
              </div>
              <p className="text-3xl font-bold">{conversionRate}<span className="text-lg font-normal text-muted-foreground">%</span></p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-orange-600" />
                </div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">En cours</p>
              </div>
              <p className="text-3xl font-bold">{inProgress}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
                  <XCircle className="w-4 h-4 text-red-500" />
                </div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Refusées</p>
              </div>
              <p className="text-3xl font-bold">{statusCounts.find((s) => s.status === "REFUSEE")?.count ?? 0}</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Répartition par statut ────────────────────────────────────────── */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="w-4 h-4" /> Répartition par statut
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {statusCounts.map(({ status, count }) => (
              <div key={status}>
                <div className="flex items-center justify-between mb-1.5">
                  <FicheStatusBadge status={status} />
                  <span className="text-xs text-muted-foreground">
                    {totalFiches > 0 ? `${Math.round((count / totalFiches) * 100)}%` : "0%"}
                  </span>
                </div>
                <Bar value={count} max={maxStatus} colorClass={STATUS_COLORS[status]} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ── Évolution par période ─────────────────────────────────────────── */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="w-4 h-4" /> Évolution
            </CardTitle>
            <Tabs value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
              <TabsList variant="line" className="h-auto flex-wrap">
                {GRANULARITIES.map((g) => (
                  <TabsTrigger key={g} value={g}>{GRANULARITY_LABELS[g]}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Période courante (vs précédente) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <PeriodKpi label={`Total ${CURRENT_PERIOD_LABELS[granularity]}`} value={current.total} delta={totalDelta} />
              <PeriodKpi label="Soumises" value={current.submitted} />
              <PeriodKpi label="Acceptées" value={current.accepted} accent="green" />
              <PeriodKpi label="Conversion" value={`${periodConversion(current)}%`} accent="green" />
            </div>

            {/* Courbe d'évolution */}
            <div className="space-y-4">
              {buckets.map((b) => (
                <div key={b.key}>
                  <div className="flex items-center justify-between mb-1.5 text-sm">
                    <span className="font-medium capitalize">{b.label}</span>
                    <span className="text-muted-foreground text-xs">
                      {b.accepted > 0 && <span className="text-green-600 mr-2">✓ {b.accepted} acceptée{b.accepted > 1 ? "s" : ""}</span>}
                      {b.total} fiche{b.total > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary/70 rounded-full transition-all duration-500"
                        style={{ width: `${maxBucket > 0 ? (b.total / maxBucket) * 100 : 0}%` }} />
                    </div>
                    <span className="text-sm font-semibold w-6 text-right">{b.total}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Top prospecteurs ─────────────────────────────────────────────── */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="w-4 h-4" /> Top prospecteurs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {prospecteurs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune fiche soumise pour le moment</p>
            ) : (
              <div className="space-y-4">
                {prospecteurs.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-4">
                    <span className="w-6 text-sm font-bold text-muted-foreground">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0 ml-2">
                          {p.accepted > 0 && (
                            <span className="text-green-600">✓ {p.accepted}</span>
                          )}
                          <span>{p.total} soumise{p.total > 1 ? "s" : ""}</span>
                        </div>
                      </div>
                      <Bar value={p.total} max={maxProspecteur} colorClass="bg-primary/70" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
