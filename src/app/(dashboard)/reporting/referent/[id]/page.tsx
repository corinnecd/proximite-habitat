"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { FicheStatusBadge } from "@/components/fiches/FicheStatusBadge";
import { KpiCard } from "@/components/reporting/KpiCard";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/use-profile";
import { type PeriodFilter, PERIOD_LABELS, getPeriodDates, getPeriodLabel } from "@/lib/periods";
import { MOTIF_REFUS_LABELS, STATUS_LABELS } from "@/lib/permissions";
import {
  TrendingUp, XCircle, Euro, FileText, ArrowLeft, CalendarDays, RefreshCw, Send,
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { FicheStatus } from "@/types/database";

const STATUS_BAR: Record<string, { bg: string; label: string }> = {
  BROUILLON:       { bg: "bg-slate-300",   label: "Brouillons" },
  SOUMISE:         { bg: "bg-blue-400",    label: "Soumises" },
  VALIDEE:         { bg: "bg-indigo-400",  label: "Validées" },
  AFFECTEE:        { bg: "bg-orange-400",  label: "Affectées" },
  RDV_A_REPRENDRE: { bg: "bg-amber-400",   label: "RDV à reprendre" },
  RETRACTATION:    { bg: "bg-purple-400",  label: "Rétractation" },
  ACCEPTEE:        { bg: "bg-emerald-400", label: "Acceptées" },
  RDV_TECHNICIEN:  { bg: "bg-sky-400",     label: "RDV Technicien" },
  INSTALLEE:       { bg: "bg-violet-500",  label: "Installées" },
  REFUSEE:         { bg: "bg-red-400",     label: "Refusées" },
  ARCHIVEE:        { bg: "bg-slate-300",   label: "Archivées" },
};

const STATUSES: FicheStatus[] = [
  "BROUILLON", "SOUMISE", "VALIDEE", "AFFECTEE",
  "RDV_A_REPRENDRE", "RETRACTATION", "ACCEPTEE",
  "RDV_TECHNICIEN", "INSTALLEE", "REFUSEE", "ARCHIVEE",
];

interface FicheRow {
  id: string;
  reference: string;
  status: FicheStatus;
  prospect_nom: string | null;
  prospect_prenom: string | null;
  prospect_ville: string | null;
  montant_ht: number | null;
  motif_refus: string | null;
  created_at: string;
  updated_at: string;
}

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  organization_id: string;
}

export default function ReferentDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { profile: currentProfile } = useProfile();
  const supabase = useMemo(() => createClient(), []);

  const [referent, setReferent] = useState<Profile | null>(null);
  const [fiches, setFiches] = useState<FicheRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("ALL");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const isAdminOrDG = currentProfile?.role === "DIRECTION" || currentProfile?.role === "SUPER_ADMIN" || currentProfile?.role === "DIRECTION_GENERALE";

  useLayoutEffect(() => {
    if (!id) return;
    try {
      const raw = localStorage.getItem(`ref_dash_${id}_${periodFilter}`);
      if (!raw) return;
      const c = JSON.parse(raw);
      if (c.profile) setReferent(c.profile);
      if (c.fiches?.length) { setFiches(c.fiches); setLoading(false); }
    } catch {}
  }, [id, periodFilter]);

  useEffect(() => {
    if (!currentProfile) return;
    if (!isAdminOrDG) { router.replace("/"); return; }
  }, [currentProfile, isAdminOrDG, router]);

  const loadData = useCallback(async (period: PeriodFilter = "ALL") => {
    if (!id) return;

    const profileRes = await supabase
      .from("profiles")
      .select("id, first_name, last_name, role, organization_id")
      .eq("id", id)
      .single();
    if (profileRes.data) setReferent(profileRes.data as Profile);

    const dates = getPeriodDates(period);
    let q = supabase
      .from("fiches")
      .select("id, reference, status, prospect_nom, prospect_prenom, prospect_ville, montant_ht, motif_refus, created_at, updated_at")
      .eq("created_by", id)
      .order("updated_at", { ascending: false });

    if (dates) {
      q = q.gte("created_at", `${dates.from}T00:00:00Z`).lte("created_at", `${dates.to}T23:59:59Z`);
    }

    const { data } = await q;
    const freshFiches = (data as FicheRow[]) ?? [];
    setFiches(freshFiches);
    setLoading(false);
    setExpandedGroups(new Set());
    try {
      localStorage.setItem(`ref_dash_${id}_${period}`, JSON.stringify({
        profile: profileRes.data,
        fiches: freshFiches,
      }));
    } catch {}
  }, [id, supabase]);

  useEffect(() => {
    loadData(periodFilter);
  }, [loadData, periodFilter]);

  const statusMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const f of fiches) m[f.status] = (m[f.status] ?? 0) + 1;
    return m;
  }, [fiches]);

  const total       = fiches.length;
  const submitted   = fiches.filter(f => f.status !== "BROUILLON").length;
  const accepted    = statusMap["ACCEPTEE"] ?? 0;
  const refused     = statusMap["REFUSEE"] ?? 0;
  const installees  = statusMap["INSTALLEE"] ?? 0;
  const baseActive  = total - (statusMap["ARCHIVEE"] ?? 0);
  const convRate    = submitted > 0 ? Math.round((accepted / submitted) * 100) : 0;
  const caTotal     = fiches.filter(f => f.status === "ACCEPTEE").reduce((s, f) => s + Number(f.montant_ht ?? 0), 0);
  const periodSuffix = getPeriodLabel(periodFilter) ? ` (${getPeriodLabel(periodFilter)})` : "";

  const fichesByStatus = useMemo(() => {
    const groups: Partial<Record<string, FicheRow[]>> = {};
    for (const f of fiches) {
      if (!groups[f.status]) groups[f.status] = [];
      groups[f.status]!.push(f);
    }
    return groups;
  }, [fiches]);

  const motifCounts = useMemo(() => {
    const c = { RDC: 0, ANNULATION: 0, REFUS_CLASSIQUE: 0 };
    for (const f of fiches) {
      if (f.status === "REFUSEE" && f.motif_refus && f.motif_refus in c) {
        c[f.motif_refus as keyof typeof c]++;
      }
    }
    return c;
  }, [fiches]);

  if (!currentProfile || !isAdminOrDG) return null;

  return (
    <>
      <Topbar
        title={referent ? `${referent.first_name} ${referent.last_name}` : "Référent"}
        actions={
          <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4" />Retour
          </Button>
        }
      />
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">

        {/* Hero */}
        <div className="hero-surface hero-surface-sm rounded-3xl p-6 sm:p-7">
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5">
              <div>
                <span className="text-[10px] tracking-[1.2px] uppercase text-white/50 font-medium">Référent / Prospecteur</span>
                <h1 className="font-heading text-3xl sm:text-4xl text-white tracking-tight leading-none mt-1.5">
                  {referent ? `${referent.first_name} ${referent.last_name}` : "…"}
                </h1>
              </div>
            </div>
            <div className="pt-5 border-t border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays className="w-3.5 h-3.5 text-white/50" />
                <span className="text-[10px] tracking-[1.2px] uppercase text-white/50 font-medium">Période</span>
                {getPeriodLabel(periodFilter) && (
                  <span className="text-[11px] text-white/70">· {getPeriodLabel(periodFilter)}</span>
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
                    onClick={() => setPeriodFilter(p)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      periodFilter === p
                        ? "bg-emerald-500 text-white"
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

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard
            label={`Fiches créées${periodSuffix}`} value={total}
            Icon={FileText} iconBg="bg-primary/10" iconColor="text-primary"
            border="border-l-primary" loading={loading}
          />
          <KpiCard
            label={`Fiches soumises${periodSuffix}`} value={submitted}
            sub={total > 0 ? `${Math.round((submitted / total) * 100)}% du total créé` : ""}
            Icon={Send} iconBg="bg-blue-100 dark:bg-blue-900/30" iconColor="text-blue-600"
            border="border-l-blue-500" loading={loading}
          />
          <KpiCard
            label={`CA HT généré${periodSuffix}`}
            value={caTotal.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
            sub={`${accepted} contrat${accepted > 1 ? "s" : ""} signé${accepted > 1 ? "s" : ""}`}
            Icon={Euro} iconBg="bg-amber-100 dark:bg-amber-900/30" iconColor="text-amber-600"
            border="border-l-amber-500" loading={loading}
          />
          <KpiCard
            label={`Taux de conversion${periodSuffix}`} value={`${convRate}%`}
            sub={`${accepted} acceptée${accepted > 1 ? "s" : ""} / ${submitted} soumise${submitted > 1 ? "s" : ""}`}
            Icon={TrendingUp} iconBg="bg-emerald-100 dark:bg-emerald-900/30" iconColor="text-emerald-600"
            border="border-l-emerald-500" loading={loading}
          />
          <KpiCard
            label={`Refus${periodSuffix}`} value={refused}
            sub={baseActive > 0 ? `${Math.round((refused / baseActive) * 100)}% du portefeuille actif` : ""}
            Icon={XCircle} iconBg="bg-red-100 dark:bg-red-900/30" iconColor="text-red-500"
            border="border-l-red-500" loading={loading}
          />
          <KpiCard
            label={`Installations réalisées${periodSuffix}`} value={installees}
            sub={accepted > 0 ? `${Math.round((installees / accepted) * 100)}% des contrats` : ""}
            Icon={TrendingUp} iconBg="bg-violet-100 dark:bg-violet-900/30" iconColor="text-violet-600"
            border="border-l-violet-500" loading={loading}
          />
        </div>

        {/* Répartition par statut */}
        {total > 0 && (
          <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] p-6">
            <h3 className="font-semibold text-sm mb-4">Répartition par statut{periodSuffix}</h3>
            <div className="space-y-2">
              {STATUSES.filter(s => statusMap[s]).map(s => {
                const count = statusMap[s] ?? 0;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                const { bg, label } = STATUS_BAR[s] ?? { bg: "bg-slate-400", label: STATUS_LABELS[s] };
                return (
                  <div key={s} className="flex items-center gap-3">
                    <span className="text-xs font-medium w-32 text-right shrink-0 text-muted-foreground">{label}</span>
                    <div className="flex-1 overflow-hidden">
                      <div className={`${bg} h-5 rounded-md flex items-center transition-all duration-700`} style={{ width: `${Math.max(3, pct)}%` }}>
                        <span className="text-white text-[11px] font-bold px-2">{count}</span>
                      </div>
                    </div>
                    <span className="text-[11px] w-8 text-right shrink-0 tabular-nums text-muted-foreground">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Fiches par statut */}
        <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">Fiches{periodSuffix}</h3>
            {total > 0 && (
              <Link href={`/fiches?status=ALL&referent=${id}`} className="text-xs text-emerald-600 hover:underline">
                Voir toutes ({total})
              </Link>
            )}
          </div>
          {fiches.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucune fiche sur cette période.</p>
          ) : (
            <div className="space-y-5">
              {STATUSES.filter(s => fichesByStatus[s]?.length).map(s => {
                const group = fichesByStatus[s]!;
                const isExpanded = expandedGroups.has(s);
                const shown = isExpanded ? group : group.slice(0, 5);
                const remaining = group.length - 5;
                return (
                  <div key={s}>
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {STATUS_BAR[s]?.label ?? STATUS_LABELS[s]}
                      </span>
                      <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5 font-medium">
                        {group.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {shown.map(f => (
                        <Link key={f.id} href={`/fiches/${f.id}`}>
                          <div className="flex items-center gap-3 rounded-xl border px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{f.prospect_prenom} {f.prospect_nom}</p>
                              <p className="text-xs text-muted-foreground truncate">{f.reference}{f.prospect_ville ? ` · ${f.prospect_ville}` : ""}</p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              {f.status === "ACCEPTEE" && f.montant_ht && (
                                <span className="text-xs font-semibold text-emerald-600 hidden sm:block">
                                  {Number(f.montant_ht).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                                </span>
                              )}
                              <FicheStatusBadge status={f.status} short />
                              <span className="text-xs text-muted-foreground hidden md:block">
                                {new Date(f.updated_at).toLocaleDateString("fr-FR")}
                              </span>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                    {group.length > 5 && (
                      <button
                        type="button"
                        onClick={() => setExpandedGroups(prev => {
                          const next = new Set(prev);
                          if (isExpanded) next.delete(s); else next.add(s);
                          return next;
                        })}
                        className="mt-1.5 ml-1 text-xs text-primary hover:underline"
                      >
                        {isExpanded ? "Voir moins" : `Voir plus (${remaining} restant${remaining > 1 ? "s" : ""})`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Analyse des refus */}
        {refused > 0 && (() => {
          const MOTIF_COLORS_HEX: Record<string, string> = { RDC: "#f97316", ANNULATION: "#f59e0b", REFUS_CLASSIQUE: "#ef4444" };
          const MOTIF_CARD_COLORS: Record<string, { bg: string; text: string; bar: string; icon: string }> = {
            RDC: { bg: "bg-orange-50 dark:bg-orange-950/20", text: "text-orange-700 dark:text-orange-300", bar: "bg-orange-500", icon: "🚪" },
            ANNULATION: { bg: "bg-amber-50 dark:bg-amber-950/20", text: "text-amber-700 dark:text-amber-300", bar: "bg-amber-500", icon: "📞" },
            REFUS_CLASSIQUE: { bg: "bg-red-50 dark:bg-red-950/20", text: "text-red-700 dark:text-red-300", bar: "bg-red-500", icon: "✋" },
          };
          const refusChartData = (Object.keys(MOTIF_REFUS_LABELS) as string[])
            .filter(m => motifCounts[m as keyof typeof motifCounts] > 0)
            .map(m => ({ name: MOTIF_REFUS_LABELS[m as keyof typeof MOTIF_REFUS_LABELS], value: motifCounts[m as keyof typeof motifCounts], fill: MOTIF_COLORS_HEX[m] }));
          return (
            <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] p-6 hover:shadow-md transition-all duration-200">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                  <XCircle className="w-4 h-4 text-red-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Analyse des refus{periodSuffix}</h3>
                  <p className="text-[11px] text-muted-foreground">
                    {refused} refus sur {total} fiche{total > 1 ? "s" : ""} créée{total > 1 ? "s" : ""}
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
                      <Tooltip formatter={(value, name) => [`${value} fiche${Number(value) > 1 ? "s" : ""}`, String(name)]} contentStyle={{ borderRadius: 12, fontSize: 13, border: "1px solid #e5e7eb" }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-1">
                    {refusChartData.map(entry => (
                      <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.fill }} />
                        <span className="text-muted-foreground">{entry.name}</span>
                        <span className="font-bold">{refused > 0 ? Math.round((entry.value / refused) * 100) : 0}%</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  {(Object.keys(MOTIF_REFUS_LABELS) as string[]).map(motif => {
                    const count = motifCounts[motif as keyof typeof motifCounts];
                    const pctRefus = refused > 0 ? Math.round((count / refused) * 100) : 0;
                    const pctTotal = total > 0 ? Math.round((count / total) * 100) : 0;
                    const c = MOTIF_CARD_COLORS[motif];
                    return (
                      <div key={motif} className={`rounded-xl p-4 ${c.bg} border border-transparent hover:border-border/50 transition-all`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{c.icon}</span>
                            <span className="text-sm font-semibold">{MOTIF_REFUS_LABELS[motif as keyof typeof MOTIF_REFUS_LABELS]}</span>
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

      </div>
    </>
  );
}
