"use client";

import { Separator } from "@/components/ui/separator";
import {
  Clock, ChevronDown, ChevronUp, Ban, Calendar, UserCheck, CheckCircle2, ShieldCheck,
} from "lucide-react";
import type { Fiche } from "@/types/database";
import type { HistoryEntry, ProfileEntry } from "@/components/fiches/FicheDetailHelpers";

interface FicheSidebarProps {
  fiche: Fiche;
  history: HistoryEntry[];
  showHistory: boolean;
  setShowHistory: (v: boolean) => void;
  commercials: ProfileEntry[];
}

export function FicheSidebar({ fiche, history, showHistory, setShowHistory, commercials }: FicheSidebarProps) {
  return (
    <div className="space-y-4">

      {/* Historique */}
      <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] p-6">
        <button
          type="button"
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-3 w-full text-left"
        >
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 text-primary" />
          </div>
          <h3 className="font-semibold text-sm">Historique</h3>
          {history.length > 0 && (
            <span className="ml-auto text-xs text-muted-foreground mr-2">{history.length} action{history.length > 1 ? "s" : ""}</span>
          )}
          {showHistory ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
        </button>
        {showHistory && (history.length === 0 ? (
          <div className="flex flex-col items-center py-6 gap-2 text-muted-foreground">
            <Clock className="w-8 h-8 opacity-20" />
            <p className="text-sm">Aucun historique</p>
          </div>
        ) : (
          <div className="space-y-0 mt-5">
            {history.map((entry, idx) => {
              // Couleur du point selon le nouveau statut
              const dotColors: Record<string, string> = {
                SOUMISE:      "border-blue-500 bg-blue-50 dark:bg-blue-950/40",
                AFFECTEE:     "border-orange-500 bg-orange-50 dark:bg-orange-950/40",
                ACCEPTEE:     "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40",
                RETRACTATION: "border-purple-500 bg-purple-50 dark:bg-purple-950/40",
                REFUSEE:      "border-red-500 bg-red-50 dark:bg-red-950/40",
                ARCHIVEE:     "border-slate-400 bg-slate-50 dark:bg-slate-800/40",
                BROUILLON:    "border-slate-400 bg-slate-50 dark:bg-slate-800/40",
              };
              const innerColors: Record<string, string> = {
                SOUMISE:      "bg-blue-500",
                AFFECTEE:     "bg-orange-500",
                ACCEPTEE:     "bg-emerald-500",
                RETRACTATION: "bg-purple-500",
                REFUSEE:      "bg-red-500",
                ARCHIVEE:     "bg-slate-400",
                BROUILLON:    "bg-slate-400",
              };
              const dotClass = entry.new_status
                ? (dotColors[entry.new_status] ?? "border-primary/40 bg-primary/10")
                : (idx === 0 ? "border-[#F97316] bg-[#F97316]/10" : "border-primary/40 bg-primary/10");
              const innerClass = entry.new_status
                ? (innerColors[entry.new_status] ?? "bg-primary")
                : (idx === 0 ? "bg-[#F97316]" : "bg-primary");
              const statusLabels: Record<string, string> = {
                BROUILLON: "Brouillon", SOUMISE: "À valider", VALIDEE: "Validée", AFFECTEE: "Validée et affectée",
                RETRACTATION: "Attente Acceptation Client", ACCEPTEE: "Acceptation Client", REFUSEE: "Refus Client", ARCHIVEE: "Archivé",
              };
              return (
                <div
                  key={entry.id}
                  className="relative pl-6"
                  style={undefined}
                >
                  {idx < history.length - 1 && (
                    <div className="absolute left-[7px] top-5 bottom-0 w-px bg-border" />
                  )}
                  <div className={`absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${dotClass}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${innerClass}`} />
                  </div>
                  <div className="pb-5">
                    {/* Transition statut ou action */}
                    {entry.old_status && entry.new_status ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                          {statusLabels[entry.old_status] ?? entry.old_status}
                        </span>
                        <span className="text-xs text-muted-foreground">→</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          entry.new_status === "ACCEPTEE"     ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                          entry.new_status === "RETRACTATION" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" :
                          entry.new_status === "REFUSEE"      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                          entry.new_status === "AFFECTEE"     ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" :
                          entry.new_status === "SOUMISE"      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                          entry.new_status === "ARCHIVEE"     ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {statusLabels[entry.new_status] ?? entry.new_status}
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm font-semibold leading-snug">{entry.action}</p>
                    )}
                    {entry.comment && (
                      <p className="text-xs text-muted-foreground mt-1.5 italic bg-muted/50 px-2.5 py-1.5 rounded-lg border-l-2 border-border">
                        &quot;{entry.comment}&quot;
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                      <span className="font-medium text-foreground/70">
                        {entry.profiles
                          ? `${entry.profiles.first_name} ${entry.profiles.last_name}`
                          : "Système"}
                      </span>
                      <span>·</span>
                      <span>
                        {new Date(entry.created_at).toLocaleDateString("fr-FR", {
                          day: "2-digit", month: "short",
                        })}
                        {" "}
                        {new Date(entry.created_at).toLocaleTimeString("fr-FR", {
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Motif du refus */}
      {fiche.status === "REFUSEE" && (() => {
        const refusEntry = history.find((e) => e.new_status === "REFUSEE");
        return (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
                <Ban className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="font-semibold text-sm text-red-800 dark:text-red-300">Motif du refus</h3>
            </div>
            {refusEntry?.comment ? (
              <p className="text-sm text-red-700 dark:text-red-300 leading-relaxed italic bg-red-100/60 dark:bg-red-900/20 rounded-xl px-4 py-3">
                &quot;{refusEntry.comment}&quot;
              </p>
            ) : (
              <p className="text-sm text-red-500/70 italic">Aucun motif renseigné.</p>
            )}
            {refusEntry && (
              <p className="text-xs text-red-500/70 dark:text-red-400/60">
                Refusée par{" "}
                <span className="font-medium text-red-700 dark:text-red-300">
                  {refusEntry.profiles
                    ? `${refusEntry.profiles.first_name} ${refusEntry.profiles.last_name}`
                    : "Système"}
                </span>
                {" · "}
                {new Date(refusEntry.created_at).toLocaleDateString("fr-FR", {
                  day: "2-digit", month: "long", year: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </p>
            )}
          </div>
        );
      })()}

      {/* Infos */}
      <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] p-5 space-y-3 text-sm hover:shadow-md transition-all duration-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
            <Calendar className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Créée le</p>
            <p className="font-medium text-sm leading-tight">
              {new Date(fiche.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
            </p>
          </div>
        </div>
        <Separator />
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Modifiée le</p>
            <p className="font-medium text-sm leading-tight">
              {new Date(fiche.updated_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
        {fiche.assigned_to && (
          <>
            <Separator />
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-950/40 flex items-center justify-center shrink-0">
                <UserCheck className="w-3.5 h-3.5 text-orange-500" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Commercial</p>
                <p className="font-medium text-sm leading-tight">
                  {commercials.find((c) => c.id === fiche.assigned_to)
                    ? `${commercials.find((c) => c.id === fiche.assigned_to)!.first_name} ${commercials.find((c) => c.id === fiche.assigned_to)!.last_name}`
                    : "—"}
                </p>
              </div>
            </div>
          </>
        )}
        {fiche.consentement_rgpd && (
          <>
            <Separator />
            <div className="flex items-center gap-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl px-3 py-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Consentement RGPD obtenu</span>
            </div>
          </>
        )}
      </div>

      {/* RGPD note */}
      {fiche.status === "ACCEPTEE" && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
            Fiche acceptée. Les données du prospect sont conservées conformément à la politique RGPD.
          </p>
        </div>
      )}
    </div>
  );
}
