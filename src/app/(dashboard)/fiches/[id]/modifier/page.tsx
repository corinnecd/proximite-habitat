"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Topbar } from "@/components/layout/Topbar";
import { FicheStepper } from "@/components/forms/FicheStepper";
import { createClient } from "@/lib/supabase/client";
import { getFicheById, getFichePhotos } from "@/lib/data/fiches";
import { useProfile } from "@/lib/hooks/use-profile";
import { canEditFiche } from "@/lib/permissions";
import type { FicheStatus } from "@/types/database";
import { Loader2, AlertCircle } from "lucide-react";

interface PhotoRow { id: string; storage_path: string; original_name: string; }

export default function ModifierFichePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { profile, loading: profileLoading } = useProfile();
  const router = useRouter();
  const supabase = createClient();

  const [initialData, setInitialData] = useState<Record<string, unknown> | null>(null);
  const [initialPhotos, setInitialPhotos] = useState<PhotoRow[]>([]);
  const [ficheStatus, setFicheStatus] = useState<FicheStatus>("BROUILLON");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profileLoading || !profile) return;

    async function load() {
      const [fiche, photos] = await Promise.all([
        getFicheById(supabase, id),
        getFichePhotos(supabase, id),
      ]);

      if (!fiche) {
        setError("Fiche introuvable");
        setLoading(false);
        return;
      }

      // Vérification des droits
      if (!profile || !canEditFiche(profile.role, profile.id, fiche.created_by, fiche.assigned_to, fiche.status as FicheStatus)) {
        setError("Vous n'avez pas l'autorisation de modifier cette fiche.");
        setLoading(false);
        return;
      }

      // Les prospecteurs ne peuvent modifier que leurs propres brouillons
      if (profile.role === "PROSPECTEUR" && fiche.status !== "BROUILLON") {
        setError("Seules les fiches en brouillon peuvent être modifiées par un prospecteur.");
        setLoading(false);
        return;
      }

      setFicheStatus(fiche.status as FicheStatus);

      // Conversion des valeurs DB → valeurs formulaire (numbers → strings pour les inputs)
      setInitialData({
        prospect_nom:        fiche.prospect_nom        ?? "",
        prospect_prenom:     fiche.prospect_prenom     ?? "",
        prospect_adresse:    fiche.prospect_adresse    ?? "",
        prospect_cp:         fiche.prospect_cp         ?? "",
        prospect_ville:      fiche.prospect_ville      ?? "",
        prospect_telephone:  fiche.prospect_telephone  ?? "",
        disponibilites:      fiche.disponibilites      ?? [],
        date_visite:         fiche.date_visite         ?? "",
        heure_visite:        fiche.heure_visite        ?? "",
        annee_construction:  fiche.annee_construction  != null ? String(fiche.annee_construction)  : "",
        annee_emmenagement:  fiche.annee_emmenagement  != null ? String(fiche.annee_emmenagement)  : "",
        temperature_confort: fiche.temperature_confort != null ? String(fiche.temperature_confort) : "",
        surface_chauffee:    fiche.surface_chauffee    != null ? String(fiche.surface_chauffee)    : "",
        nb_habitants:        fiche.nb_habitants,
        maison_en_vente:     fiche.maison_en_vente,
        modes_chauffage:     fiche.modes_chauffage     ?? [],
        systemes_chauffage:  fiche.systemes_chauffage  ?? [],
        consommation:        fiche.consommation        ?? "",
        cout_annuel:         fiche.cout_annuel         != null ? String(fiche.cout_annuel) : "",
        systemes_ventilation: fiche.systemes_ventilation ?? [],
        age_ventilation:     fiche.age_ventilation     ?? "",
        nature_isolant:      fiche.nature_isolant      ?? [],
        age_isolant:         fiche.age_isolant         ?? "",
        epaisseur_isolant:   fiche.epaisseur_isolant   ?? "",
        types_pose_toiture:  fiche.types_pose_toiture  ?? [],
        materiaux_toiture:   fiche.materiaux_toiture   ?? [],
        observations:        fiche.observations        ?? "",
        consentement_rgpd:   fiche.consentement_rgpd   ?? false,
      });

      setInitialPhotos(photos.map((p) => ({ ...p, original_name: p.original_name ?? "" })));
      setLoading(false);
    }

    load();
  }, [id, profile, profileLoading, router, supabase]);

  // ── Loading ──────────────────────────────────────────────────────────────

  if (profileLoading || loading) {
    return (
      <>
        <Topbar title="Modifier la fiche" />
        <div className="p-6 lg:p-8 flex items-center justify-center min-h-64">
          <div className="text-center text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
            <p className="text-sm">Chargement de la fiche…</p>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Topbar title="Modifier la fiche" />
        <div className="p-6 lg:p-8 flex items-center justify-center min-h-64">
          <div className="text-center text-muted-foreground">
            <AlertCircle className="w-8 h-8 mx-auto mb-3 text-destructive" />
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </>
    );
  }

  // ── Rendu ────────────────────────────────────────────────────────────────

  const isEditSubmitted = ficheStatus !== "BROUILLON";
  const pageTitle = isEditSubmitted ? "Modifier la fiche" : "Modifier le brouillon";

  return (
    <>
      <Topbar title={pageTitle} />
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6 lg:p-10">
            <FicheStepper
              key={id}
              ficheId={id}
              initialData={initialData ?? undefined}
              initialPhotos={initialPhotos}
              mode={isEditSubmitted ? "edit-submitted" : "edit-draft"}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
