"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { FicheStatusBadge } from "@/components/fiches/FicheStatusBadge";
import { KpiCard } from "@/components/reporting/KpiCard";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/use-profile";
import { type PeriodFilter, PERIOD_LABELS, getPeriodDates, getPeriodLabel } from "@/lib/periods";
import { STATUS_LABELS } from "@/lib/permissions";
import {
  TrendingUp, XCircle, Euro, FileText, ArrowLeft, CalendarDays, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { FicheStatus } from "@/types/database";

const STATUS_BAR: Record<string, { bg: string; label: string }> = {
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
  "AFFECTEE", "RDV_A_REPRENDRE", "RETRACTATION", "ACCEPTEE",
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

export default function CommercialDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { profile: currentProfile } = useProfile();
  const supabase = useMemo(() => createClient(), []);

  const [commercial, setCommercial] = useState<Profile | null>(null);
  const [fiches, setFiches] = useState<FicheRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("ALL");

  const isAdminOrDG = currentProfile?.role === "DIRECTION" || currentProfile?.role === "SUPER_ADMIN" || currentProfile?.role === "DIRECTION_GENERALE";

  useEffect(() => {
    if (!currentProfile) return;
    if (!isAdminOrDG) { router.replace("/"); return; }
  }, [currentProfile, isAdminOrDG, router]);

  const loadData = useCallback(async (period: PeriodFilter = "ALL") => {
    if (!id) return;

    const [profileRes] = await Promise.all([
      supabase.from("profiles").select("id, first_name, last_name, role, organization_id").eq("id", id).single(),
    ]);
    if (profileRes.data) setCommercial(profileRes.data as Profile);

    const dates = getPeriodDates(period);
    let q = supabase
      .from("fiches")
      .select("id, reference, status, prospect_nom, prospect_prenom, prospect_ville, montant_ht, created_at, updated_at")
      .eq("assigned_to", id)
      .neq("status", "BROUILLON")
      .order("updated_at", { ascending: false });

    if (dates) {
      q = q.gte("updated_at", `${dates.from}T00:00:00Z`).lte("updated_at", `${dates.to}T23:59:59Z`);
    }

    const { data } = await q;
    setFiches((data as FicheRow[]) ?? []);
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => {
    loadData(periodFilter);
  }, [loadData, periodFilter]);

  const statusMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const f of fiches) m[f.status] = (m[f.status] ?? 0) + 1;
    return m;
  }, [fiches]);

  const accepted    = statusMap["ACCEPTEE"] ?? 0;
  const refused     = statusMap["REFUSEE"] ?? 0;
  const rdvTech     = statusMap["RDV_TECHNICIEN"] ?? 0;
  const installees  = statusMap["INSTALLEE"] ?? 0;
  const total       = fiches.length;
  const baseActive  = total - (statusMap["ARCHIVEE"] ?? 0);
  const acceptanceRate = baseActive > 0 ? Math.round((accepted / baseActive) * 100) : 0;
  const caTotal = fiches.filter(f => f.status === "ACCEPTEE").reduce((s, f) => s + Number(f.montant_ht ?? 0), 0);
  const periodSuffix = getPeriodLabel(periodFilter) ? ` (${getPeriodLabel(periodFilter)})` : "";

  const recentFiches = fiches.slice(0, 20);

  if (!currentProfile || !isAdminOrDG) return null;

  return (
    <>
      <Topbar
        title={commercial ? `${commercial.first_name} ${commercial.last_name}` : "Commercial"}
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
                <span className="text-[10px] tracking-[1.2px] uppercase text-white/50 font-medium">Commercial</span>
                <h1 className="font-heading text-3xl sm:text-4xl text-white tracking-tight leading-none mt-1.5">
                  {commercial ? `${commercial.first_name} ${commercial.last_name}` : "…"}
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

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard
            label={`Fiches affectées${periodSuffix}`} value={total}
            Icon={FileText} iconBg="bg-primary/10" iconColor="text-primary"
            border="border-l-primary" loading={loading}
          />
          <KpiCard
            label={`CA HT${periodSuffix}`}
            value={caTotal.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
            sub={`${accepted} contrat${accepted > 1 ? "s" : ""} signé${accepted > 1 ? "s" : ""}`}
            Icon={Euro} iconBg="bg-amber-100 dark:bg-amber-900/30" iconColor="text-amber-600"
            border="border-l-amber-500" loading={loading}
          />
          <KpiCard
            label={`Taux d'acceptation${periodSuffix}`} value={`${acceptanceRate}%`}
            sub={`${accepted} acceptée${accepted > 1 ? "s" : ""} / ${refused} refusée${refused > 1 ? "s" : ""}`}
            Icon={TrendingUp} iconBg="bg-emerald-100 dark:bg-emerald-900/30" iconColor="text-emerald-600"
            border="border-l-emerald-500" loading={loading}
          />
          <KpiCard
            label={`RDV Technicien${periodSuffix}`} value={rdvTech}
            sub={`+ ${installees} installation${installees > 1 ? "s" : ""}`}
            Icon={TrendingUp} iconBg="bg-sky-100 dark:bg-sky-900/30" iconColor="text-sky-600"
            border="border-l-sky-500" loading={loading}
          />
          <KpiCard
            label={`Refus${periodSuffix}`} value={refused}
            sub={baseActive > 0 ? `${Math.round((refused / baseActive) * 100)}% du portefeuille actif` : ""}
            Icon={XCircle} iconBg="bg-red-100 dark:bg-red-900/30" iconColor="text-red-500"
            border="border-l-red-500" loading={loading}
          />
          <KpiCard
            label={`CA moyen / contrat${periodSuffix}`}
            value={accepted > 0 ? Math.round(caTotal / accepted).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }) : "0 €"}
            Icon={Euro} iconBg="bg-blue-100 dark:bg-blue-900/30" iconColor="text-blue-600"
            border="border-l-blue-500" loading={loading}
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

        {/* Liste des fiches récentes */}
        <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">Fiches récentes{periodSuffix}</h3>
            {total > 20 && (
              <Link href={`/fiches?status=ALL&commercial=${id}`} className="text-xs text-[#F97316] hover:underline">
                Voir toutes ({total})
              </Link>
            )}
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-muted/40 animate-pulse" />)}
            </div>
          ) : recentFiches.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucune fiche sur cette période.</p>
          ) : (
            <div className="space-y-2">
              {recentFiches.map(f => (
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
          )}
        </div>

      </div>
    </>
  );
}
