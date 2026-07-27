"use client";

import { useEffect, useState, use, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Topbar } from "@/components/layout/Topbar";
import { FicheStepper } from "@/components/forms/FicheStepper";
import { createClient } from "@/lib/supabase/client";
import { getFicheById, getFichePhotos } from "@/lib/data/fiches";
import { useProfile } from "@/lib/hooks/use-profile";
import { canEditFiche } from "@/lib/permissions";
import type { FicheStatus } from "@/types/database";
import { AlertCircle } from "lucide-react";

interface PhotoRow { id: string; storage_path: string; original_name: string; }

export default function ModifierFichePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { profile, loading: profileLoading } = useProfile();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [initialData, setInitialData] = useState<Record<string, unknown> | null>(null);
  const [initialPhotos, setInitialPhotos] = useState<PhotoRow[]>([]);
  const [existingSignatureUrl, setExistingSignatureUrl] = useState<string | null>(null);
  const [existingReferentSignatureUrl, setExistingReferentSignatureUrl] = useState<string | null>(null);
  const [ficheStatus, setFicheStatus] = useState<FicheStatus>("BROUILLON");
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

        return;
      }

      // Vérification des droits
      if (!profile || !canEditFiche(profile.role, profile.id, fiche.created_by, fiche.assigned_to, fiche.status as FicheStatus)) {
        setError("Vous n'avez pas l'autorisation de modifier cette fiche.");

        return;
      }

      // Les référents ne peuvent modifier que leurs propres brouillons
      if (profile.role === "PROSPECTEUR" && fiche.status !== "BROUILLON") {
        setError("Seules les fiches en brouillon peuvent être modifiées par un référent.");

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
        prospect_email:      fiche.prospect_email      ?? "",
        departement_code:    fiche.departement_code    ?? null,
        ville_id:            fiche.ville_id            ?? null,
        disponibilites:      fiche.disponibilites      ?? [],
        date_visite:         fiche.date_visite         ?? "",
        heure_visite:        fiche.heure_visite        ?? "",
        rdv_date:            fiche.rdv_date            ?? "",
        referent_nom:        fiche.referent_nom        ?? "",
        referent_telephone:  fiche.referent_telephone  ?? "",
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

      // Charger les signatures existantes via signed URL (bucket privé)
      // Le cache-buster t= force le CDN à retourner la version la plus récente
      const cacheBuster = `t=${Date.now()}`;
      try {
        const [{ data: signData }, { data: refSignData }] = await Promise.all([
          supabase.storage.from("signatures").createSignedUrl(`${fiche.organization_id}/${id}/signature.png`, 7200),
          supabase.storage.from("signatures").createSignedUrl(`${fiche.organization_id}/${id}/signature_referent.png`, 7200),
        ]);
        if (signData?.signedUrl) setExistingSignatureUrl(`${signData.signedUrl}&${cacheBuster}`);
        if (refSignData?.signedUrl) setExistingReferentSignatureUrl(`${refSignData.signedUrl}&${cacheBuster}`);
      } catch { /* pas de signature */ }
    }

    load();
  // supabase est stable (useMemo), pas besoin de l'inclure explicitement
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, profile, profileLoading, router]);

  // ── Rendu ────────────────────────────────────────────────────────────────

  const isEditSubmitted = ficheStatus !== "BROUILLON";
  const pageTitle = isEditSubmitted ? "Modifier la fiche" : "Modifier le brouillon";

  if (error) {
    return (
      <>
        <Topbar title={pageTitle} />
        <div className="p-4 sm:p-6 lg:p-8 flex items-center justify-center min-h-64">
          <div className="text-center text-muted-foreground">
            <AlertCircle className="w-8 h-8 mx-auto mb-3 text-destructive" />
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title={pageTitle} />
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6 lg:p-10">
            {initialData && (
              <FicheStepper
                key={id}
                ficheId={id}
                initialData={initialData}
                initialPhotos={initialPhotos}
                existingSignatureUrl={existingSignatureUrl}
                existingReferentSignatureUrl={existingReferentSignatureUrl}
                mode={isEditSubmitted ? "edit-submitted" : "edit-draft"}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
