"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Clock, Loader2, Calendar, CheckCircle2, ShieldCheck, AlertTriangle, Ban, UserX,
} from "lucide-react";
import { STATUS_LABELS, MOTIF_REFUS_LABELS } from "@/lib/permissions";
import { toast } from "sonner";
import type { FicheStatus, Fiche, MotifRefus } from "@/types/database";

interface FicheStatusChangeDialogProps {
  fiche: Fiche;
  pendingStatus: FicheStatus | null;
  setPendingStatus: (v: FicheStatus | null) => void;
  statusComment: string;
  setStatusComment: (v: string) => void;
  selectedMotifRefus: MotifRefus | "";
  setSelectedMotifRefus: (v: MotifRefus | "") => void;
  montantHtInput: string;
  setMontantHtInput: (v: string) => void;
  newRdvDate: string;
  setNewRdvDate: (v: string) => void;
  transitioning: boolean;
  handleStatusChange: (newStatus: FicheStatus, comment?: string, motifRefus?: MotifRefus, rdvDateParam?: string) => Promise<void>;
}

export function FicheStatusChangeDialog({
  fiche, pendingStatus, setPendingStatus, statusComment, setStatusComment,
  selectedMotifRefus, setSelectedMotifRefus, montantHtInput, setMontantHtInput,
  newRdvDate, setNewRdvDate, transitioning, handleStatusChange,
}: FicheStatusChangeDialogProps) {
  return (
    <Dialog open={pendingStatus !== null} onOpenChange={(open) => { if (!open) { setPendingStatus(null); setStatusComment(""); setSelectedMotifRefus(""); setNewRdvDate(""); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${
            pendingStatus === "REFUSEE" || pendingStatus === "BROUILLON"
              ? "text-red-600 dark:text-red-400"
              : pendingStatus === "RETRACTATION"
                ? "text-purple-600 dark:text-purple-400"
                : pendingStatus === "ACCEPTEE"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : pendingStatus === "ARCHIVEE"
                    ? "text-slate-600 dark:text-slate-400"
                    : pendingStatus === "RDV_A_REPRENDRE" || (pendingStatus === "AFFECTEE" && fiche.status === "RDV_A_REPRENDRE") || (pendingStatus === "RDV_TECHNICIEN" && fiche.status === "INSTALLEE")
                      ? "text-amber-600 dark:text-amber-400"
                      : pendingStatus === "INSTALLEE"
                        ? "text-violet-600 dark:text-violet-400"
                        : "text-foreground"
          }`}>
            {pendingStatus === "REFUSEE"
              ? <><Ban className="w-5 h-5" />Refus Client</>
              : pendingStatus === "BROUILLON"
                ? <><Ban className="w-5 h-5" />Renvoyer en brouillon</>
                : pendingStatus === "RETRACTATION"
                  ? <><Clock className="w-5 h-5" />Attente Acceptation Client</>
                  : pendingStatus === "ACCEPTEE"
                    ? <><CheckCircle2 className="w-5 h-5" />Acceptation Client</>
                    : pendingStatus === "ARCHIVEE"
                      ? <><ShieldCheck className="w-5 h-5" />Archiver la fiche</>
                      : pendingStatus === "RDV_A_REPRENDRE"
                        ? <><UserX className="w-5 h-5" />Client absent — RDV à reprendre</>
                        : pendingStatus === "AFFECTEE" && fiche.status === "RDV_A_REPRENDRE"
                          ? <><Calendar className="w-5 h-5" />Confirmer le nouveau RDV</>
                          : pendingStatus === "INSTALLEE"
                            ? <><CheckCircle2 className="w-5 h-5" />Confirmer l&apos;installation</>
                            : pendingStatus === "RDV_TECHNICIEN" && fiche.status === "INSTALLEE"
                              ? <><AlertTriangle className="w-5 h-5" />L&apos;installation n&apos;a pas eu lieu</>
                              : <>Passer en : {pendingStatus ? STATUS_LABELS[pendingStatus] : ""}</>
            }
          </DialogTitle>
          <DialogDescription>
            {pendingStatus === "AFFECTEE" && fiche?.status === "RDV_A_REPRENDRE"
              ? "Indiquez la nouvelle date de rendez-vous et ajoutez un commentaire pour le commercial."
              : pendingStatus === "INSTALLEE"
                ? "Confirmez que le rendez-vous technicien a bien eu lieu et que l'installation a été réalisée."
                : pendingStatus === "RDV_TECHNICIEN" && fiche?.status === "INSTALLEE"
                  ? "La fiche reviendra en statut « RDV Technicien ». Expliquez la raison (annulation, report…)."
                  : pendingStatus === "RETRACTATION" && fiche?.status === "RDV_TECHNICIEN"
                  ? "Le client exerce son droit de rétractation. La fiche reviendra en attente — vous pourrez relancer ou fermer le dossier."
                  : "Le motif est obligatoire et sera conservé dans l’historique de la fiche."}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-3">
          {pendingStatus === "AFFECTEE" && fiche?.status === "RDV_A_REPRENDRE" && (
            <div className="space-y-1.5">
              <label htmlFor="new-rdv-date" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Nouvelle date de rendez-vous <span className="text-red-500">*</span>
              </label>
              <input
                id="new-rdv-date"
                type="date"
                value={newRdvDate}
                onChange={(e) => setNewRdvDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className={`w-full h-10 rounded-lg border bg-card px-3 text-sm transition-colors ${
                  !newRdvDate ? "border-red-300 dark:border-red-700" : "border-amber-300 dark:border-amber-700"
                }`}
              />
              {!newRdvDate && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />La nouvelle date de rendez-vous est obligatoire.
                </p>
              )}
            </div>
          )}
          {pendingStatus === "REFUSEE" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Type de refus <span className="text-red-500">*</span>
              </label>
              <Select value={selectedMotifRefus} onValueChange={(v) => setSelectedMotifRefus(v as MotifRefus)}>
                <SelectTrigger className="rounded-xl bg-card">
                  <SelectValue placeholder="Sélectionner le type de refus…" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(MOTIF_REFUS_LABELS) as MotifRefus[]).map((m) => (
                    <SelectItem key={m} value={m}>{MOTIF_REFUS_LABELS[m]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!selectedMotifRefus && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />Veuillez sélectionner le type de refus.
                </p>
              )}
            </div>
          )}
          {pendingStatus === "ACCEPTEE" && (
            <div className="space-y-1.5">
              <label htmlFor="montant-ht" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Montant HT du contrat (€) <span className="text-red-500">*</span>
              </label>
              <input
                id="montant-ht"
                type="number"
                min="0"
                step="0.01"
                placeholder="Ex : 12500.00"
                value={montantHtInput}
                onChange={(e) => setMontantHtInput(e.target.value)}
                className={`w-full h-10 rounded-lg border bg-card px-3 text-sm transition-colors ${
                  !montantHtInput || parseFloat(montantHtInput) <= 0
                    ? "border-red-300 dark:border-red-700 focus-visible:ring-red-400/30"
                    : "border-emerald-300 dark:border-emerald-700"
                }`}
              />
              {(!montantHtInput || parseFloat(montantHtInput) <= 0) && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />Le montant HT est obligatoire pour une acceptation.
                </p>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <label htmlFor="textarea-motif" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Motif <span className="text-red-500">*</span>
            </label>
            <Textarea
              id="textarea-motif"
              placeholder="Indiquez la raison de ce changement de statut…"
              value={statusComment}
              onChange={(e) => setStatusComment(e.target.value)}
              rows={4}
              className={`bg-card resize-none transition-colors ${
                statusComment.trim().length === 0
                  ? "border-red-300 dark:border-red-700 focus-visible:ring-red-400/30"
                  : "border-emerald-300 dark:border-emerald-700"
              }`}
            />
            {statusComment.trim().length === 0 && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />Veuillez saisir un motif avant de confirmer.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => { setPendingStatus(null); setStatusComment(""); setSelectedMotifRefus(""); setMontantHtInput(""); setNewRdvDate(""); }}>Annuler</Button>
          <Button
            onClick={async () => {
              if (!pendingStatus) return;
              if (!statusComment.trim()) {
                toast.error("Veuillez saisir un motif avant de confirmer.");
                return;
              }
              if (pendingStatus === "REFUSEE" && !selectedMotifRefus) {
                toast.error("Veuillez sélectionner le type de refus.");
                return;
              }
              if (pendingStatus === "ACCEPTEE" && (!montantHtInput || parseFloat(montantHtInput) <= 0)) {
                toast.error("Veuillez saisir le montant HT du contrat.");
                return;
              }
              if (pendingStatus === "AFFECTEE" && fiche?.status === "RDV_A_REPRENDRE" && !newRdvDate) {
                toast.error("Veuillez indiquer la nouvelle date de rendez-vous.");
                return;
              }
              await handleStatusChange(pendingStatus, statusComment.trim(), selectedMotifRefus as MotifRefus || undefined, newRdvDate || undefined);
              setPendingStatus(null);
              setStatusComment("");
              setSelectedMotifRefus("");
              setMontantHtInput("");
              setNewRdvDate("");
            }}
            disabled={transitioning || !statusComment.trim() || (pendingStatus === "REFUSEE" && !selectedMotifRefus) || (pendingStatus === "ACCEPTEE" && (!montantHtInput || parseFloat(montantHtInput) <= 0)) || (pendingStatus === "AFFECTEE" && fiche?.status === "RDV_A_REPRENDRE" && !newRdvDate)}
            className={`rounded-xl gap-2 text-white ${
              pendingStatus === "REFUSEE"
                ? "bg-red-600 hover:bg-red-700"
                : pendingStatus === "RETRACTATION"
                  ? "bg-purple-600 hover:bg-purple-700"
                  : pendingStatus === "ACCEPTEE"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : pendingStatus === "INSTALLEE"
                      ? "bg-violet-600 hover:bg-violet-700"
                      : pendingStatus === "RDV_TECHNICIEN" && fiche.status === "INSTALLEE"
                        ? "bg-amber-600 hover:bg-amber-700"
                        : "bg-[#F97316] hover:bg-[#EA580C]"
            }`}
          >
            {transitioning
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : pendingStatus === "REFUSEE"
                ? <Ban className="w-4 h-4" />
                : pendingStatus === "RETRACTATION" || pendingStatus === "ACCEPTEE"
                  ? <CheckCircle2 className="w-4 h-4" />
                  : null
            }
            {pendingStatus === "REFUSEE"
              ? "Confirmer le refus"
              : pendingStatus === "ACCEPTEE"
                ? "Confirmer l'acceptation"
                : "Confirmer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
