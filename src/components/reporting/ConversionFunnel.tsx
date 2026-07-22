"use client";

import { TrendingUp } from "lucide-react";
import type { FicheStatus } from "@/types/database";

interface StatusCount { status: FicheStatus; count: number; }

export function ConversionFunnel({
  statusCounts, isCommercial, soumises, validees, affectees, accepted, refused,
  acceptanceRate, periodSuffix,
}: {
  statusCounts: StatusCount[];
  isCommercial: boolean;
  soumises: number; validees: number; affectees: number;
  accepted: number; refused: number; acceptanceRate: number;
  periodSuffix: string;
}) {
  const rdvReprendre = statusCounts.find((s) => s.status === "RDV_A_REPRENDRE")?.count ?? 0;
  const affecteesCount = affectees + rdvReprendre + accepted + refused;
  // Fiches affectées qui n'ont pas encore reçu de décision (ni acceptée, ni refusée) :
  // ajoutée pour que En attente + Acceptées + Refusées reconstitue bien 100% des Affectées.
  const enAttente = Math.max(0, affecteesCount - accepted - refused);
  const steps = isCommercial
    ? [
        { label: "Affectées", count: affecteesCount, color: "bg-orange-500", textColor: "text-orange-600" },
        { label: "RDV effectués", count: accepted + refused, color: "bg-blue-500", textColor: "text-blue-600" },
        { label: "En attente", count: enAttente, color: "bg-slate-400", textColor: "text-slate-500" },
        { label: "Acceptées", count: accepted, color: "bg-emerald-500", textColor: "text-emerald-600" },
        { label: "Refusées", count: refused, color: "bg-red-500", textColor: "text-red-500" },
      ]
    : [
        { label: "Soumises", count: soumises + validees + affectees + rdvReprendre + accepted + refused, color: "bg-blue-500", textColor: "text-blue-600" },
        { label: "Validées", count: validees + affectees + rdvReprendre + accepted + refused, color: "bg-teal-500", textColor: "text-teal-600" },
        { label: "Affectées", count: affecteesCount, color: "bg-orange-500", textColor: "text-orange-600" },
        { label: "En attente", count: enAttente, color: "bg-slate-400", textColor: "text-slate-500" },
        { label: "Acceptées", count: accepted, color: "bg-emerald-500", textColor: "text-emerald-600" },
        { label: "Refusées", count: refused, color: "bg-red-500", textColor: "text-red-500" },
      ];
  const maxCount = steps[0]?.count || 1;
  // En attente / Acceptées / Refusées sont 3 issues distinctes d'une même base (Affectées)
  // — pas une suite séquentielle les unes des autres. Leurs % sont donc calculés par rapport
  // à cette base commune, et se somment (à l'arrondi près) à 100% des fiches affectées.
  const BRANCH_LABELS = new Set(["En attente", "Acceptées", "Refusées"]);
  const parentCount = affecteesCount || 1;

  return (
    <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] p-6 hover:shadow-md transition-all duration-200">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-[#1E3A5F]/10 dark:bg-[#1E3A5F]/30 flex items-center justify-center shrink-0">
          <TrendingUp className="w-4 h-4 text-[#1E3A5F] dark:text-blue-300" />
        </div>
        <div>
          <h3 className="font-semibold text-sm">Taux de conversion des fiches{periodSuffix}</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Parcours des fiches de la soumission à la décision finale</p>
        </div>
      </div>
      <div className="space-y-2">
        {steps.map((step, i) => {
          const widthPct = Math.max(4, Math.round((step.count / maxCount) * 100));
          const isBranch = BRANCH_LABELS.has(step.label);
          let pct: number;
          if (i === 0) {
            pct = 100;
          } else if (isBranch) {
            // Part de la base commune (Affectées / RDV effectués), pas de l'étape précédente
            pct = parentCount > 0 ? Math.round((step.count / parentCount) * 100) : 0;
          } else {
            // Taux de rétention séquentiel par rapport à l'étape précédente
            const prevCount = steps[i - 1].count;
            pct = prevCount > 0 ? Math.round((step.count / prevCount) * 100) : 0;
          }
          return (
            <div key={step.label} className="flex items-center gap-3">
              <span className="text-xs font-medium w-20 text-right shrink-0 text-muted-foreground">{step.label}</span>
              <div className="flex-1 relative">
                <div
                  className={`${step.color} h-9 rounded-lg flex items-center transition-all duration-700`}
                  style={{ width: `${widthPct}%` }}
                >
                  <span className="text-white text-xs font-bold px-3 whitespace-nowrap">
                    {step.count}
                  </span>
                </div>
              </div>
              <span className="text-[11px] w-14 text-right shrink-0 tabular-nums">
                {i === 0 ? (
                  <span className="text-muted-foreground">{pct}%</span>
                ) : isBranch ? (
                  <span className={`${step.textColor} font-medium`}>{pct}%</span>
                ) : (
                  <span className={pct >= 90 ? "text-emerald-600 font-medium" : pct >= 70 ? "text-orange-500 font-medium" : "text-red-500 font-medium"}>
                    {pct}%
                  </span>
                )}
              </span>
            </div>
          );
        })}
        {!isCommercial && accepted + refused > 0 && (
          <div className="mt-3 pt-3 border-t border-border flex items-center gap-4 text-xs">
            <span className="text-muted-foreground">Taux global de conversion :</span>
            <span className={`font-bold text-sm ${acceptanceRate >= 50 ? "text-emerald-600" : acceptanceRate >= 25 ? "text-orange-500" : "text-red-500"}`}>
              {acceptanceRate}%
            </span>
            <span className="text-muted-foreground">
              ({accepted} acceptée{accepted > 1 ? "s" : ""} sur {maxCount} soumise{maxCount > 1 ? "s" : ""})
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
