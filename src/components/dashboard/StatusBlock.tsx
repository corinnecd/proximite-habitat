"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  FileText, User, ArrowRight, CalendarDays, ChevronDown, ChevronUp,
} from "lucide-react";
import type { FicheAffectee } from "./dashboard-types";

// ── Composant bloc par statut ─────────────────────────────────────────────────

const STATUS_LABELS_FR: Record<string, string> = {
  BROUILLON: "Brouillon", SOUMISE: "À valider", VALIDEE: "Validée", AFFECTEE: "Validée et affectée",
  RETRACTATION: "Attente Acceptation Client", ACCEPTEE: "Acceptation Client", REFUSEE: "Refus Client", ARCHIVEE: "Archivé",
};

export function StatusBlock({
  title, total, icon, iconBg, badge, borderColor, hoverColor, href, fiches,
}: {
  title: string;
  total: number;
  icon: React.ReactNode;
  iconBg: string;
  badge: string;
  borderColor: string;
  hoverColor: string;
  href: string;
  fiches: FicheAffectee[];
}) {
  const [showAll, setShowAll] = React.useState(false);
  const shown  = showAll ? fiches : fiches.slice(0, 5);
  const hasMore = fiches.length > 5;
  return (
    <div className="space-y-3">
      {/* En-tête du bloc */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${iconBg}`}>{icon}</div>
          <h3 className="font-semibold text-base">{title}</h3>
          {total > 0 && (
            <span className={`${badge} text-white text-xs font-bold px-2 py-0.5 rounded-full`}>{total}</span>
          )}
        </div>
        <Link href={href}>
          <Button variant="ghost" size="sm" className="text-muted-foreground gap-1">
            Voir toutes <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </Link>
      </div>

      {/* Contenu */}
      {shown.length === 0 ? (
        <div className="flex items-center gap-3 p-4 bg-muted/30 border border-border rounded-2xl">
          <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">Aucune fiche dans cette catégorie</p>
        </div>
      ) : (
        <div className={`bg-card border rounded-2xl overflow-hidden ${borderColor}`}>
          {shown.map((fiche, idx) => {
            // Historique trié du plus récent au plus ancien
            const history = [...(fiche.fiche_history ?? [])].sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
            return (
              <Link key={fiche.id} href={`/fiches/${fiche.id}`}>
                <div
                  className={`px-5 py-4 transition-colors cursor-pointer ${hoverColor} ${idx < shown.length - 1 ? "border-b border-border" : ""}`}
                  style={undefined}
                >
                  {/* Ligne principale */}
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">
                        Fiche de {fiche.prospect_prenom} {fiche.prospect_nom}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">

                        {fiche.prospect_ville && <span className="text-xs text-muted-foreground">{fiche.prospect_ville}</span>}
                        {fiche.created_by_profile && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {fiche.created_by_profile.first_name} {fiche.created_by_profile.last_name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                      <CalendarDays className="w-3.5 h-3.5" />
                      {new Date(fiche.updated_at).toLocaleDateString("fr-FR")}
                    </div>
                  </div>

                  {/* Dernière action */}
                  {history.length > 0 && (() => { const h = history[0]; return (
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                      {h.user && (
                        <span className="font-medium text-foreground/70">
                          {h.user.first_name} {h.user.last_name}
                        </span>
                      )}
                      {h.old_status && h.new_status ? (
                        <span>{STATUS_LABELS_FR[h.old_status] ?? h.old_status}{" → "}{STATUS_LABELS_FR[h.new_status] ?? h.new_status}</span>
                      ) : (
                        <span>{h.action}</span>
                      )}
                      {h.comment && <span className="italic truncate max-w-[120px]">&quot;{h.comment}&quot;</span>}
                      <span className="ml-auto shrink-0">
                        {new Date(h.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                        {" "}{new Date(h.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ); })()}
                </div>
              </Link>
            );
          })}
          {hasMore && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="w-full px-4 py-2.5 text-center text-xs text-muted-foreground hover:bg-secondary/40 transition-colors border-t border-border flex items-center justify-center gap-1"
            >
              {showAll
                ? <><ChevronUp className="w-3.5 h-3.5" />Voir moins</>
                : <><ChevronDown className="w-3.5 h-3.5" />Voir plus ({fiches.length - 5} restante{fiches.length - 5 > 1 ? "s" : ""})</>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
