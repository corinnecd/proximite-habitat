"use client";

import { TrendingUp } from "lucide-react";
import type { FicheStatus } from "@/types/database";

interface StatusCount { status: FicheStatus; count: number; }

const STATUS_CONFIG: Record<string, { label: string; color: string; textColor: string }> = {
  SOUMISE:         { label: "Soumises",           color: "bg-blue-400",    textColor: "text-blue-500" },
  VALIDEE:         { label: "Validées",           color: "bg-teal-400",    textColor: "text-teal-500" },
  AFFECTEE:        { label: "Affectées",          color: "bg-orange-400",  textColor: "text-orange-500" },
  RDV_A_REPRENDRE: { label: "RDV à reprendre",   color: "bg-amber-400",   textColor: "text-amber-500" },
  RETRACTATION:    { label: "Rétractation",       color: "bg-purple-400",  textColor: "text-purple-500" },
  ACCEPTEE:        { label: "Acceptées",          color: "bg-emerald-400", textColor: "text-emerald-500" },
  RDV_TECHNICIEN:  { label: "RDV Technicien",    color: "bg-sky-400",     textColor: "text-sky-500" },
  INSTALLEE:       { label: "Installées",         color: "bg-violet-500",  textColor: "text-violet-600" },
  REFUSEE:         { label: "Refusées",           color: "bg-red-400",     textColor: "text-red-500" },
  ARCHIVEE:        { label: "Archivées",          color: "bg-slate-400",   textColor: "text-slate-500" },
};

const DIRECTION_ORDER: FicheStatus[] = [
  "SOUMISE", "VALIDEE", "AFFECTEE", "RDV_A_REPRENDRE",
  "RETRACTATION", "ACCEPTEE", "RDV_TECHNICIEN", "INSTALLEE", "REFUSEE", "ARCHIVEE",
];

const COMMERCIAL_ORDER: FicheStatus[] = [
  "AFFECTEE", "RDV_A_REPRENDRE", "ACCEPTEE", "RDV_TECHNICIEN", "INSTALLEE", "REFUSEE", "ARCHIVEE",
];

export function ConversionFunnel({
  statusCounts, isCommercial, periodSuffix,
}: {
  statusCounts: StatusCount[];
  isCommercial: boolean;
  soumises?: number; validees?: number; affectees?: number;
  accepted?: number; refused?: number; acceptanceRate?: number;
  periodSuffix: string;
}) {
  const order = isCommercial ? COMMERCIAL_ORDER : DIRECTION_ORDER;
  const countMap = new Map(statusCounts.map((s) => [s.status, s.count]));

  const steps = order
    .map((status) => ({
      status,
      count: countMap.get(status) ?? 0,
      ...STATUS_CONFIG[status],
    }))
    .filter((s) => s.count > 0);

  const total = steps.reduce((sum, s) => sum + s.count, 0);
  const accepted = countMap.get("ACCEPTEE") ?? 0;

  return (
    <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] p-6 hover:shadow-md transition-all duration-200">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#1E3A5F]/10 dark:bg-[#1E3A5F]/30 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4 text-[#1E3A5F] dark:text-blue-300" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Répartition des fiches par statut{periodSuffix}</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">{total} fiche{total > 1 ? "s" : ""} au total — chaque fiche comptée une seule fois</p>
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        {steps.map((step) => {
          const pct = total > 0 ? Math.round((step.count / total) * 100) : 0;
          const widthPct = Math.max(3, pct);
          return (
            <div key={step.status} className="flex items-center gap-3">
              <span className="text-xs font-medium w-28 text-right shrink-0 text-muted-foreground">{step.label}</span>
              <div className="flex-1 min-w-0 overflow-hidden">
                <div
                  className={`${step.color} h-6 rounded-md flex items-center transition-all duration-700`}
                  style={{ width: `${widthPct}%` }}
                >
                  <span className="text-white text-[11px] font-bold px-2.5 whitespace-nowrap">
                    {step.count}
                  </span>
                </div>
              </div>
              <span className={`text-[11px] w-10 text-right shrink-0 tabular-nums font-medium ${step.textColor}`}>
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
      {total > 0 && (
        <div className="mt-3 pt-3 border-t border-border flex items-center gap-4 text-xs">
          <span className="text-muted-foreground">Taux de conversion :</span>
          <span className={`font-bold text-sm ${accepted / total >= 0.5 ? "text-emerald-600" : accepted / total >= 0.25 ? "text-orange-500" : "text-red-500"}`}>
            {Math.round((accepted / total) * 100)}%
          </span>
          <span className="text-muted-foreground">
            ({accepted} acceptée{accepted > 1 ? "s" : ""} sur {total} fiche{total > 1 ? "s" : ""})
          </span>
        </div>
      )}
    </div>
  );
}
