"use client";

/**
 * Version mobile-only des 6 tuiles KPI : les 6 cartes séparées (chacune avec
 * son ombre et son bord de couleur) sont fusionnées en une seule carte à
 * grille interne, séparateurs fins. Même contenu, mêmes couleurs d'identifi-
 * cation par statistique — moins de "boîtes" empilées. Utilisée uniquement
 * sous `sm` (voir AdminKpiSection.tsx), le desktop conserve ses 6 tuiles.
 */

import { CheckCircle2, XCircle, Clock, Euro, BarChart3 } from "lucide-react";
import type { FicheStatus } from "@/types/database";
import { type PeriodFilter as DashPeriod, getPeriodLabel } from "@/lib/periods";
import { AnimatedCounter } from "@/components/ui/animated-counter";

export function AdminKpiSectionMobile({
  caTotal, totalVentes, counts, isAllPeriod, dashPeriod, loading,
}: {
  caTotal: number;
  totalVentes: number;
  counts: Record<FicheStatus, number>;
  isAllPeriod: boolean;
  dashPeriod: DashPeriod;
  loading?: boolean;
}) {
  const inProgress = counts.SOUMISE + counts.VALIDEE + counts.AFFECTEE + counts.RETRACTATION;
  const baseActive = counts.ACCEPTEE + counts.REFUSEE + inProgress;
  const acceptanceRate = baseActive > 0 ? Math.round((counts.ACCEPTEE / baseActive) * 100) : 0;
  const refusalRate    = baseActive > 0 ? Math.round((counts.REFUSEE   / baseActive) * 100) : 0;
  const inProgressRate = baseActive > 0 ? Math.round((inProgress        / baseActive) * 100) : 0;

  const stats = [
    {
      icon: Euro, color: "amber",
      value: caTotal.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }),
      label: isAllPeriod ? "CA global HT" : `CA HT (${getPeriodLabel(dashPeriod)})`,
      caption: `${totalVentes} contrat${totalVentes > 1 ? "s" : ""} signé${totalVentes > 1 ? "s" : ""}`,
    },
    {
      icon: CheckCircle2, color: "emerald",
      value: <AnimatedCounter value={totalVentes} className="text-2xl font-bold" loading={loading} />,
      label: isAllPeriod ? "Ventes totales" : `Ventes (${getPeriodLabel(dashPeriod)})`,
    },
    {
      icon: BarChart3, color: "blue",
      value: totalVentes > 0 ? Math.round(caTotal / totalVentes).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }) : "0 €",
      label: isAllPeriod ? "CA moyen" : `CA moyen (${getPeriodLabel(dashPeriod)})`,
    },
    {
      icon: CheckCircle2, color: "emerald",
      value: `${acceptanceRate}%`,
      label: "Taux d'acceptation",
      caption: `${counts.ACCEPTEE} / ${baseActive} actives`,
    },
    {
      icon: XCircle, color: "red",
      value: `${refusalRate}%`,
      label: "Taux de refus",
      caption: `${counts.REFUSEE} / ${baseActive} actives`,
    },
    {
      icon: Clock, color: "orange",
      value: `${inProgressRate}%`,
      label: "Taux en cours",
      caption: `${inProgress} fiche${inProgress > 1 ? "s" : ""}`,
    },
  ];

  const colorClasses: Record<string, string> = {
    amber: "bg-amber-100 dark:bg-amber-900/30 text-amber-600",
    emerald: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600",
    blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-600",
    red: "bg-red-100 dark:bg-red-900/30 text-red-500",
    orange: "bg-orange-100 dark:bg-orange-900/30 text-orange-600",
  };

  return (
    <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="grid grid-cols-2 divide-x divide-y divide-border">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="p-4">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${colorClasses[s.color]}`}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold tabular-nums leading-tight">{s.value}</p>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide mt-1 leading-tight">{s.label}</p>
              {s.caption && <p className="text-[11px] text-muted-foreground/80 mt-0.5">{s.caption}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
