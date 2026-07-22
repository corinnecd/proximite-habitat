"use client";

import { Trophy, Star } from "lucide-react";
import type { FicheListItem } from "@/lib/data/fiches";

const SEUIL = 3;

// ── Prime du mois (référent) ───────────────────────────────────────────────────
export function PrimeSection({ prospAcceptees }: { prospAcceptees: FicheListItem[] }) {
  const now = new Date();
  const ventesMonth = prospAcceptees.filter((f) => {
    const d = new Date(f.updated_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const restantes = Math.max(0, SEUIL - ventesMonth);
  const pct = Math.min(100, Math.round((ventesMonth / SEUIL) * 100));
  const gained = ventesMonth >= SEUIL;
  const moisFr = now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  return (
    <div className={`rounded-2xl border p-5 ${gained ? "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800" : "bg-card border-border"}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${gained ? "bg-amber-100 dark:bg-amber-900/40" : "bg-muted"}`}>
            <Trophy className={`w-5 h-5 ${gained ? "text-amber-500" : "text-muted-foreground"}`} />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Prime exceptionnelle — {moisFr}</h3>
            <p className="text-xs text-muted-foreground">3 ventes validées dans le mois = prime exceptionnelle</p>
          </div>
        </div>
        {gained && (
          <span className="flex items-center gap-1 bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full">
            <Star className="w-3 h-3" /> Prime décrochée !
          </span>
        )}
      </div>

      {/* Barre de progression */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs font-medium">
          <span className={gained ? "text-amber-700 dark:text-amber-400" : "text-foreground"}>
            {ventesMonth} vente{ventesMonth > 1 ? "s" : ""} validée{ventesMonth > 1 ? "s" : ""} ce mois
          </span>
          <span className="text-muted-foreground">{ventesMonth} / {SEUIL}</span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${gained ? "bg-amber-400" : "bg-primary"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {!gained && (
          <p className="text-xs text-muted-foreground">
            {restantes} vente{restantes > 1 ? "s" : ""} restante{restantes > 1 ? "s" : ""} pour décrocher la prime exceptionnelle 🎯
          </p>
        )}
      </div>
    </div>
  );
}
