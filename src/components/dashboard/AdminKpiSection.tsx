"use client";

import {
  CheckCircle2, XCircle, Clock, Euro, BarChart3, Trophy, TrendingUp, Star,
} from "lucide-react";
import type { FicheStatus } from "@/types/database";
import { type PeriodFilter as DashPeriod, getPeriodLabel } from "@/lib/periods";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { CollapsibleList } from "./CollapsibleList";
import type { ReferentStat, CommercialStat } from "./dashboard-types";

// ── Section ADMIN/DG : KPI CA consolidé ────────────────────────────────────────
export function AdminKpiSection({
  caTotal, totalVentes, counts, referentsStats, commerciauxStats, isAllPeriod, dashPeriod, loading,
}: {
  caTotal: number;
  totalVentes: number;
  counts: Record<FicheStatus, number>;
  referentsStats: ReferentStat[];
  commerciauxStats: CommercialStat[];
  isAllPeriod: boolean;
  dashPeriod: DashPeriod;
  loading?: boolean;
}) {
  return (
    <div className="space-y-6">
      {/* KPI Cards CA */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
        <div className="bg-card border border-border border-l-4 border-l-amber-500 rounded-2xl p-4 sm:p-5 shadow-sm hover:-translate-y-1.5 hover:shadow-xl transition-all duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Euro className="w-5 h-5 text-amber-600" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold tabular-nums">{caTotal.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">{isAllPeriod ? "CA global HT consolidé" : <>CA HT consolidé<span className="normal-case"> ({getPeriodLabel(dashPeriod)})</span></>}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{totalVentes} contrat{totalVentes > 1 ? "s" : ""} signé{totalVentes > 1 ? "s" : ""}</p>
        </div>
        <div className="bg-card border border-border border-l-4 border-l-emerald-500 rounded-2xl p-4 sm:p-5 shadow-sm hover:-translate-y-1.5 hover:shadow-xl transition-all duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <AnimatedCounter value={totalVentes} className="text-2xl sm:text-3xl font-bold" loading={loading} />
          <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">{isAllPeriod ? "Ventes globales totales" : <>Ventes totales<span className="normal-case"> ({getPeriodLabel(dashPeriod)})</span></>}</p>
        </div>
        <div className="bg-card border border-border border-l-4 border-l-blue-500 rounded-2xl p-4 sm:p-5 shadow-sm hover:-translate-y-1.5 hover:shadow-xl transition-all duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold tabular-nums">{totalVentes > 0 ? Math.round(caTotal / totalVentes).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }) : "0 €"}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">{isAllPeriod ? "Chiffre d'affaires moyen global" : <>Chiffre d&apos;affaires moyen<span className="normal-case"> ({getPeriodLabel(dashPeriod)})</span></>}</p>
        </div>
      </div>

      {/* KPI Cards secondaires */}
      {(() => {
        const inProgress = counts.SOUMISE + counts.VALIDEE + counts.AFFECTEE + counts.RETRACTATION;
        // Dénominateur commun hors archivées → les 3 taux somment à 100%
        const baseActive = counts.ACCEPTEE + counts.REFUSEE + inProgress;
        const acceptanceRate = baseActive > 0 ? Math.round((counts.ACCEPTEE / baseActive) * 100) : 0;
        const refusalRate    = baseActive > 0 ? Math.round((counts.REFUSEE   / baseActive) * 100) : 0;
        const inProgressRate = baseActive > 0 ? Math.round((inProgress        / baseActive) * 100) : 0;
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
            <div className="bg-card border border-border border-l-4 border-l-emerald-500 rounded-2xl p-4 sm:p-5 shadow-sm hover:-translate-y-1.5 hover:shadow-xl transition-all duration-200">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-bold tabular-nums">{`${acceptanceRate}%`}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">{isAllPeriod ? "Taux global d'acceptation" : <>Taux d&apos;acceptation<span className="normal-case"> ({getPeriodLabel(dashPeriod)})</span></>}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{counts.ACCEPTEE} acceptée{counts.ACCEPTEE > 1 ? "s" : ""} / {baseActive} active{baseActive > 1 ? "s" : ""}</p>
            </div>
            <div className="bg-card border border-border border-l-4 border-l-red-500 rounded-2xl p-4 sm:p-5 shadow-sm hover:-translate-y-1.5 hover:shadow-xl transition-all duration-200">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-red-500" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-bold tabular-nums">{`${refusalRate}%`}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">{isAllPeriod ? "Taux global de refus" : <>Taux de refus<span className="normal-case"> ({getPeriodLabel(dashPeriod)})</span></>}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{counts.REFUSEE} refusée{counts.REFUSEE > 1 ? "s" : ""} / {baseActive} active{baseActive > 1 ? "s" : ""}</p>
            </div>
            <div className="bg-card border border-border border-l-4 border-l-orange-500 rounded-2xl p-4 sm:p-5 shadow-sm hover:-translate-y-1.5 hover:shadow-xl transition-all duration-200">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-orange-600" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-bold tabular-nums">{`${inProgressRate}%`}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">{isAllPeriod ? "Taux global en cours" : <>Taux en cours<span className="normal-case"> ({getPeriodLabel(dashPeriod)})</span></>}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{inProgress} fiche{inProgress > 1 ? "s" : ""} · à valider, affectées, attente client</p>
            </div>
          </div>
        );
      })()}

      {/* Tableaux commerciaux + référents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Classement commerciaux avec CA */}
        <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-sm">CA par commercial ({commerciauxStats.length} {commerciauxStats.length > 1 ? "Commerciaux" : "Commercial"})</h3>
            </div>
          </div>
          {commerciauxStats.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Aucune vente enregistrée</p>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-[1fr_60px_80px] sm:grid-cols-[1fr_60px_80px_60px] gap-2 text-[10px] text-muted-foreground uppercase tracking-wide font-semibold pb-2 border-b border-border">
                <span>Commercial</span>
                <span className="text-right">Ventes</span>
                <span className="text-right">CA HT</span>
                <span className="text-right hidden sm:block">CA moy.</span>
              </div>
              <CollapsibleList items={commerciauxStats} renderItem={(c: typeof commerciauxStats[0], idx: number) => {
                const rate = c.ventes > 0 ? Math.round((c.ventes / (commerciauxStats[0]?.ventes ?? 1)) * 100) : 0;
                return (
                  <div key={c.id} className="space-y-1">
                    <div className="grid grid-cols-[1fr_60px_80px] sm:grid-cols-[1fr_60px_80px_60px] gap-2 items-center py-2 hover:bg-secondary/30 rounded-lg px-1 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-4 text-center text-xs font-bold text-muted-foreground shrink-0">{idx+1}</span>
                        <span className="text-sm font-medium truncate">{c.nom}</span>
                      </div>
                      <span className="text-sm font-bold text-right tabular-nums">{c.ventes}</span>
                      <span className={`text-sm font-bold text-right tabular-nums ${c.ca > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                        {c.ca > 0 ? c.ca.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }) : "—"}
                      </span>
                      <span className="text-xs text-right tabular-nums text-muted-foreground hidden sm:block">{c.ventes > 0 && c.ca > 0 ? Math.round(c.ca / c.ventes).toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + "€/v" : "—"}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden mx-1">
                      <div className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                        style={{ width: `${rate}%` }} />
                    </div>
                  </div>
                );
              }} />
              {commerciauxStats.length > 0 && (
                <div className="grid grid-cols-[1fr_60px_80px] sm:grid-cols-[1fr_60px_80px_60px] gap-2 pt-3 border-t border-border">
                  <span className="text-sm font-bold">Total</span>
                  <span className="text-sm font-bold text-right tabular-nums">{commerciauxStats.reduce((s, c) => s + c.ventes, 0)}</span>
                  <span className="text-sm font-bold text-right tabular-nums text-amber-600">
                    {commerciauxStats.reduce((s, c) => s + c.ca, 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                  </span>
                  <span className="hidden sm:block" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Classement référents — ventes uniquement */}
        <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                <Trophy className="w-4 h-4 text-amber-600" />
              </div>
              <h3 className="font-semibold text-sm">Objectif mensuel de prime (3 ventes) · {referentsStats.length} Référent{referentsStats.length > 1 ? "s" : ""}</h3>
            </div>
          </div>
          {referentsStats.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Aucune vente enregistrée</p>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-[1fr_60px_70px] gap-2 text-[10px] text-muted-foreground uppercase tracking-wide font-semibold pb-2 border-b border-border">
                <span>Référent</span>
                <span className="text-right">Ventes</span>
                <span className="text-right">En +</span>
              </div>
              <CollapsibleList items={referentsStats} renderItem={(p: typeof referentsStats[0], idx: number) => {
                const bonus = Math.max(0, p.ventes - 3);
                return (
                  <div key={p.id} className="grid grid-cols-[1fr_60px_70px] gap-2 items-center py-2 hover:bg-secondary/30 rounded-lg px-1 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-4 text-center text-xs font-bold text-muted-foreground shrink-0">{idx+1}</span>
                      <span className="text-sm font-medium truncate">{p.nom}</span>
                      {p.ventes >= 3 && <Star className="w-3 h-3 text-amber-500 shrink-0" />}
                    </div>
                    <span className="text-sm font-bold text-right tabular-nums">{p.ventes}</span>
                    <span className={`text-xs text-right tabular-nums ${bonus > 0 ? "text-emerald-600 font-bold" : "text-muted-foreground"}`}>{bonus > 0 ? `+${bonus}` : "—"}</span>
                  </div>
                );
              }} />
              {referentsStats.length > 0 && (
                <div className="grid grid-cols-[1fr_60px_70px] gap-2 pt-3 border-t border-border">
                  <span className="text-sm font-bold">Total</span>
                  <span className="text-sm font-bold text-right tabular-nums">{referentsStats.reduce((s, r) => s + r.ventes, 0)}</span>
                  <span className="text-sm font-bold text-right tabular-nums text-emerald-600">+{referentsStats.reduce((s, r) => s + Math.max(0, r.ventes - 3), 0)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
