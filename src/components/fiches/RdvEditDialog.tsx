"use client";

import { useEffect, useState } from "react";
import { Calendar } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";

interface RdvEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ficheId: string;
  /** Date de RDV actuelle (format YYYY-MM-DD), utilisée pour pré-remplir le champ et l'historique. */
  currentRdvDate: string | null;
  organizationId: string;
  userId: string;
  /** Appelé après une sauvegarde réussie avec la nouvelle date. */
  onSaved: (newDate: string) => void;
}

/**
 * Dialog partagé pour modifier la date de rendez-vous d'une fiche RDV_A_REPRENDRE.
 * Utilisé depuis la page détail fiche et depuis le calendrier des RDV.
 */
export function RdvEditDialog({
  open,
  onOpenChange,
  ficheId,
  currentRdvDate,
  organizationId,
  userId,
  onSaved,
}: RdvEditDialogProps) {
  const [value, setValue] = useState(currentRdvDate ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setValue(currentRdvDate ?? "");
  }, [open, currentRdvDate]);

  async function handleSave() {
    if (!value) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const oldDate = currentRdvDate;
      const { error: updateError } = await supabase
        .from("fiches")
        .update({ rdv_date: value })
        .eq("id", ficheId);
      if (updateError) throw updateError;
      await supabase.from("fiche_history").insert({
        fiche_id: ficheId,
        organization_id: organizationId,
        user_id: userId,
        action: oldDate ? "MODIFICATION_RDV" : "PLANIFICATION_RDV",
        comment: oldDate ? `Date de RDV modifiée : ${oldDate} → ${value}` : `RDV planifié au ${value}`,
      });
      onSaved(value);
      toast.success(oldDate ? "Date de rendez-vous mise à jour" : "Rendez-vous planifié");
      onOpenChange(false);
    } catch (err) {
      console.error("Erreur mise à jour date RDV:", err);
      toast.error("Erreur lors de la mise à jour de la date");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onOpenChange(false);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
            <Calendar className="w-5 h-5" />
            {currentRdvDate ? "Modifier le rendez-vous" : "Planifier le rendez-vous"}
          </DialogTitle>
          <DialogDescription>
            {currentRdvDate ? "Choisissez la nouvelle date de rendez-vous pour cette fiche." : "Définissez la date de rendez-vous pour cette fiche."}
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <label
            htmlFor="rdv-edit-date"
            className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1.5"
          >
            Date de rendez-vous
          </label>
          <input
            id="rdv-edit-date"
            type="date"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm"
          />
        </div>
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            Annuler
          </Button>
          <Button
            disabled={!value || saving}
            onClick={handleSave}
            className="rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white gap-2"
          >
            <Calendar className="w-4 h-4" />
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
