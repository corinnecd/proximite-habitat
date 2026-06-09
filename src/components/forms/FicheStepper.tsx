"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/use-profile";
import { ficheSchema, step1Schema } from "@/lib/validations/fiche";
import type { FicheFormData } from "@/lib/validations/fiche";
import { Step1Coordonnees } from "./steps/Step1Coordonnees";
import { Step2Habitation } from "./steps/Step2Habitation";
import { Step3Chauffage } from "./steps/Step3Chauffage";
import { Step4Ventilation } from "./steps/Step4Ventilation";
import { Step5Isolation } from "./steps/Step5Isolation";
import { Step6Photos } from "./steps/Step6Photos";
import type { UploadedPhoto } from "./steps/Step6Photos";
import { Step7Signature } from "./steps/Step7Signature";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Save, Send, Loader2, Edit } from "lucide-react";
import { sendEmailFicheSoumise } from "@/lib/email";

// ── Types ────────────────────────────────────────────────────────────────────

/** Props communes pouvant être passées à n'importe quelle étape */
interface StepAllProps {
  photos?: File[];
  setPhotos?: (p: File[]) => void;
  signatureDataUrl?: string | null;
  setSignatureDataUrl?: (url: string | null) => void;
  /** URL publique de la signature déjà en storage (mode édition) */
  existingSignatureUrl?: string | null;
  uploadedPhotos?: UploadedPhoto[];
  onRemoveUploaded?: (id: string) => void;
  onAddValidFiles?: (files: File[]) => Promise<void>;
  /** ID de la fiche courante (mode édition) — pour exclure la fiche d'elle-même en détection de doublons. */
  currentFicheId?: string;
}

export interface FicheStepperProps {
  /** En mode édition : ID de la fiche à reprendre */
  ficheId?: string;
  /** Données initiales pré-remplissant le formulaire */
  initialData?: Partial<Record<string, unknown>>;
  /** Photos déjà persistées (chargées depuis fiche_photos) */
  initialPhotos?: Array<{ id: string; storage_path: string; original_name: string }>;
  /** URL publique de la signature déjà enregistrée (mode édition) */
  existingSignatureUrl?: string | null;
  /**
   * create        — nouvelle fiche (défaut) : soumettre → SOUMISE
   * edit-draft    — reprise d'un brouillon  : soumettre → SOUMISE
   * edit-submitted — modification d'une fiche déjà soumise : enregistrer sans changer le statut
   */
  mode?: "create" | "edit-draft" | "edit-submitted";
}

// ── Constantes ───────────────────────────────────────────────────────────────

const STEPS = [
  { title: "Coordonnées",       component: Step1Coordonnees },
  { title: "Habitation",        component: Step2Habitation },
  { title: "Chauffage",         component: Step3Chauffage },
  { title: "Ventilation",       component: Step4Ventilation },
  { title: "Isolation & Toiture", component: Step5Isolation },
  { title: "Photos & Notes",    component: Step6Photos },
  { title: "Signature",         component: Step7Signature },
];

const DEFAULT_FORM_VALUES = {
  prospect_nom: "", prospect_prenom: "", prospect_adresse: "",
  prospect_cp: "", prospect_ville: "", prospect_telephone: "",
  disponibilites: [] as string[], date_visite: "", heure_visite: "",
  annee_construction: "", annee_emmenagement: "",
  temperature_confort: "", surface_chauffee: "",
  nb_habitants: null as number | null, maison_en_vente: null as boolean | null,
  modes_chauffage: [] as string[], systemes_chauffage: [] as string[],
  consommation: "", cout_annuel: "",
  systemes_ventilation: [] as string[], age_ventilation: "",
  nature_isolant: [] as string[], age_isolant: "", epaisseur_isolant: "",
  types_pose_toiture: [] as string[], materiaux_toiture: [] as string[],
  observations: "",
  consentement_rgpd: false,
};

// ── Composant ─────────────────────────────────────────────────────────────────

export function FicheStepper({ ficheId: ficheIdProp, initialData, initialPhotos, existingSignatureUrl, mode = "create" }: FicheStepperProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [stepDirection, setStepDirection] = useState<"next" | "prev">("next");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // State pour l'affichage (lecture render-safe, ex. détection de doublons),
  // ref pour les lectures synchrones dans les callbacks async. Le setter met à
  // jour l'affichage après la première sauvegarde.
  const [savedFicheId, setSavedFicheId] = useState<string | undefined>(ficheIdProp);
  const ficheIdRef = useRef<string | undefined>(ficheIdProp);

  const [photos, setPhotos] = useState<File[]>([]);
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);

  const router = useRouter();
  const { profile } = useProfile();
  const supabase = createClient();

  const methods = useForm({
    defaultValues: { ...DEFAULT_FORM_VALUES, ...(initialData ?? {}) },
    mode: "onChange",
  });

  // Réinitialise le formulaire avec les données de la fiche en mode édition.
  // Nécessaire car useForm n'utilise defaultValues qu'au premier rendu.
  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      methods.reset({ ...DEFAULT_FORM_VALUES, ...initialData });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialise les photos déjà persistées au montage (mode édition)
  useEffect(() => {
    if (initialPhotos && initialPhotos.length > 0) {
      const withUrls: UploadedPhoto[] = initialPhotos.map((p) => ({
        ...p,
        url: supabase.storage.from("photos").getPublicUrl(p.storage_path).data.publicUrl,
      }));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUploadedPhotos(withUrls);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function generateReference() {
    const now = new Date();
    const dateStr = now.getFullYear().toString() +
      (now.getMonth() + 1).toString().padStart(2, "0") +
      now.getDate().toString().padStart(2, "0");
    const rand = Math.floor(Math.random() * 9000 + 1000);
    const time = now.getHours().toString().padStart(2, "0") +
      now.getMinutes().toString().padStart(2, "0") +
      now.getSeconds().toString().padStart(2, "0");
    return `PHC-${dateStr}-${time}${rand}`;
  }

  /** Upload un lot de fichiers vers storage + insertion dans fiche_photos */
  async function uploadPhotoFiles(files: File[], ficheId: string): Promise<UploadedPhoto[]> {
    if (!profile) return [];
    const result: UploadedPhoto[] = [];
    for (const file of files) {
      const path = `${profile.organization_id}/${ficheId}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("photos").upload(path, file);
      if (error) { toast.error(`Erreur upload ${file.name}`); continue; }
      const { data: ins } = await supabase
        .from("fiche_photos")
        .insert({ fiche_id: ficheId, organization_id: profile.organization_id, storage_path: path, original_name: file.name, size: file.size })
        .select("id").single();
      const { data: urlData } = supabase.storage.from("photos").getPublicUrl(path);
      result.push({
        id: ins?.id ?? crypto.randomUUID(),
        url: urlData.publicUrl,
        original_name: file.name,
        storage_path: path,
      });
    }
    return result;
  }

  // ── Gestion des photos ─────────────────────────────────────────────────────

  /**
   * Ajoute des photos :
   * - Si la fiche existe déjà → upload immédiat vers storage
   * - Sinon → mise en attente locale jusqu'à la première sauvegarde
   */
  const handleAddValidFiles = useCallback(async (files: File[]) => {
    const id = ficheIdRef.current;
    if (id && profile) {
      const uploaded = await uploadPhotoFiles(files, id);
      setUploadedPhotos((prev) => [...prev, ...uploaded]);
    } else {
      setPhotos((prev) => [...prev, ...files]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, supabase]);

  /** Supprime une photo déjà uploadée (storage + DB) */
  const handleRemoveUploaded = useCallback(async (photoId: string) => {
    const photo = uploadedPhotos.find((p) => p.id === photoId);
    if (!photo) return;
    await supabase.storage.from("photos").remove([photo.storage_path]);
    await supabase.from("fiche_photos").delete().eq("id", photoId);
    setUploadedPhotos((prev) => prev.filter((p) => p.id !== photoId));
  }, [uploadedPhotos, supabase]);

  // ── Sauvegarde brouillon ───────────────────────────────────────────────────

  const saveDraft = useCallback(async () => {
    if (!profile) return;
    setSaving(true);

    const values = methods.getValues();
    const cleanData = {
      organization_id: profile.organization_id,
      created_by: profile.id,
      reference: generateReference(),
      status: "BROUILLON" as const,
      prospect_nom: values.prospect_nom || "",
      prospect_prenom: values.prospect_prenom || "",
      prospect_adresse: values.prospect_adresse || "",
      prospect_cp: values.prospect_cp || "",
      prospect_ville: values.prospect_ville || "",
      prospect_telephone: values.prospect_telephone || "",
      disponibilites: values.disponibilites || [],
      date_visite: values.date_visite || null,
      heure_visite: values.heure_visite || null,
      annee_construction: values.annee_construction ? Number(values.annee_construction) : null,
      annee_emmenagement: values.annee_emmenagement ? Number(values.annee_emmenagement) : null,
      temperature_confort: values.temperature_confort ? Number(values.temperature_confort) : null,
      surface_chauffee: values.surface_chauffee ? Number(values.surface_chauffee) : null,
      nb_habitants: values.nb_habitants,
      maison_en_vente: values.maison_en_vente,
      modes_chauffage: values.modes_chauffage || [],
      systemes_chauffage: values.systemes_chauffage || [],
      consommation: values.consommation || null,
      cout_annuel: values.cout_annuel ? Number(values.cout_annuel) : null,
      systemes_ventilation: values.systemes_ventilation || [],
      age_ventilation: values.age_ventilation || null,
      nature_isolant: values.nature_isolant || [],
      age_isolant: values.age_isolant || null,
      epaisseur_isolant: values.epaisseur_isolant || null,
      types_pose_toiture: values.types_pose_toiture || [],
      materiaux_toiture: values.materiaux_toiture || [],
      observations: values.observations || null,
      consentement_rgpd: values.consentement_rgpd || false,
    };

    try {
      if (ficheIdRef.current) {
        // Mise à jour — on exclut les champs immuables ET le statut
        // (le statut ne change que via le RPC transition_fiche, jamais ici)
        const { organization_id, created_by, reference, status, ...updateData } = cleanData;
        const { error } = await supabase.from("fiches").update(updateData).eq("id", ficheIdRef.current);
        if (error) { toast.error("Erreur de sauvegarde : " + error.message); setSaving(false); return; }
      } else {
        // Première insertion
        const { data, error } = await supabase.from("fiches").insert(cleanData).select("id").single();
        if (error) { toast.error("Erreur de création : " + error.message); setSaving(false); return; }
        if (data) {
          ficheIdRef.current = data.id;
          setSavedFicheId(data.id);
          // Upload immédiat des photos en attente maintenant qu'on a un ID
          if (photos.length > 0) {
            const pending = [...photos];
            setPhotos([]);
            const uploaded = await uploadPhotoFiles(pending, data.id);
            setUploadedPhotos((prev) => [...prev, ...uploaded]);
          }
        }
      }
      toast.success(mode === "edit-submitted" ? "Modifications enregistrées" : "Brouillon sauvegardé");
      setLastSavedAt(new Date());
    } catch (e) {
      console.error("Save error:", e);
      toast.error("Erreur inattendue");
    }
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, methods, photos, supabase]);

  // Auto-save toutes les 30 s si le formulaire a été modifié
  useEffect(() => {
    const interval = setInterval(() => {
      if (profile && methods.formState.isDirty) saveDraft();
    }, 30000);
    return () => clearInterval(interval);
  }, [profile, methods.formState.isDirty, saveDraft]);

  // Confirmation avant de quitter la page si des données ne sont pas sauvegardées
  // (formulaire modifié, photos locales en attente d'upload, ou signature non envoyée).
  const isDirty = methods.formState.isDirty;
  const hasUnsavedChanges = isDirty || photos.length > 0 || Boolean(signatureDataUrl);
  useEffect(() => {
    if (!hasUnsavedChanges || submitting) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Requis par certains navigateurs pour afficher la boîte de confirmation
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges, submitting]);

  // ── Navigation étapes ──────────────────────────────────────────────────────

  /** Valide l'étape 1 (seule étape avec des champs obligatoires) avant d'avancer */
  async function handleNext() {
    if (currentStep === 0) {
      const values = methods.getValues();
      const result = step1Schema.safeParse(values);
      if (!result.success) {
        result.error.issues.forEach((issue) => {
          methods.setError(String(issue.path[0]) as keyof FicheFormData, {
            type: "manual",
            message: issue.message,
          });
        });
        toast.error("Veuillez remplir les champs obligatoires avant de continuer");
        return;
      }
    }
    await saveDraft();
    setStepDirection("next");
    setCurrentStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  // ── Soumission finale ──────────────────────────────────────────────────────

  async function handleSubmitFiche() {
    if (!profile) return;

    const values = methods.getValues();

    // ── Mode « enregistrer les modifications » (fiche déjà soumise) ─────────
    if (mode === "edit-submitted") {
      // Valider uniquement les champs prospect obligatoires
      const r = step1Schema.safeParse(values);
      if (!r.success) {
        r.error.issues.forEach((issue) => {
          methods.setError(String(issue.path[0]) as keyof FicheFormData, { type: "manual", message: issue.message });
        });
        toast.error("Vérifiez les champs obligatoires (étape 1)");
        setCurrentStep(0);
        return;
      }
      setSubmitting(true);
      try {
        await saveDraft(); // UPDATE — conserve le statut existant
        if (ficheIdRef.current) {
          await supabase.from("fiche_history").insert({
            fiche_id: ficheIdRef.current,
            organization_id: profile.organization_id,
            user_id: profile.id,
            action: `Fiche modifiée par ${profile.first_name} ${profile.last_name}`,
            old_status: null,
            new_status: null,
          });
        }
        toast.success("Modifications enregistrées !");
        router.push(ficheIdRef.current ? `/fiches/${ficheIdRef.current}` : "/fiches");
      } catch {
        toast.error("Erreur lors de l'enregistrement");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // ── Mode « soumettre » (nouvelle fiche ou reprise brouillon) ─────────────
    const result = ficheSchema.safeParse({
      ...values,
      annee_construction: values.annee_construction ? Number(values.annee_construction) : null,
      annee_emmenagement: values.annee_emmenagement ? Number(values.annee_emmenagement) : null,
      temperature_confort: values.temperature_confort ? Number(values.temperature_confort) : null,
      surface_chauffee: values.surface_chauffee ? Number(values.surface_chauffee) : null,
      cout_annuel: values.cout_annuel ? Number(values.cout_annuel) : null,
    });

    if (!result.success) {
      const firstError = result.error.issues[0];
      toast.error(`Champ obligatoire manquant : ${firstError.message}`);
      const field = String(firstError.path[0]);
      if (["prospect_nom","prospect_prenom","prospect_adresse","prospect_cp","prospect_ville","prospect_telephone"].includes(field)) {
        setCurrentStep(0);
      } else if (field === "consentement_rgpd") {
        setCurrentStep(6);
      }
      return;
    }

    // Vérification de la signature (obligatoire pour soumettre)
    if (!signatureDataUrl && !existingSignatureUrl) {
      toast.error("La signature du prospect est obligatoire");
      setCurrentStep(6);
      return;
    }

    // Sauvegarder si pas encore fait — ficheIdRef.current mis à jour de façon synchrone
    if (!ficheIdRef.current) await saveDraft();
    if (!ficheIdRef.current) { toast.error("Erreur : impossible de sauvegarder la fiche"); return; }

    setSubmitting(true);
    try {
      const id = ficheIdRef.current;

      // Signature : upload si nouvelle, sinon on conserve l'existante (pas d'écrasement)
      if (signatureDataUrl) {
        try {
          const blob = await fetch(signatureDataUrl).then((r) => r.blob());
          await supabase.storage
            .from("signatures")
            .upload(`${profile.organization_id}/${id}/signature.png`, blob, { contentType: "image/png", upsert: true });
        } catch {
          toast.error("La signature n'a pas pu être enregistrée");
        }
      }
      // Si pas de nouvelle signature mais une existante → on ne fait rien (déjà en storage)

      // Photos encore en attente
      if (photos.length > 0) {
        await uploadPhotoFiles(photos, id);
      }

      // Soumission validée et écrite côté serveur (statut + RGPD + historique,
      // de façon atomique). Voir supabase/migrations/0003_rpc_transitions.sql.
      const { data: submittedFiche, error: submitError } = await supabase.rpc("transition_fiche", {
        p_fiche_id: id,
        p_new_status: "SOUMISE",
      });
      if (submitError) {
        toast.error("Soumission refusée : " + submitError.message);
        setSubmitting(false);
        return;
      }

      toast.success("Fiche soumise avec succès !");

      // Email aux admins de l'organisation (non bloquant)
      const ficheReference = (submittedFiche as { reference?: string } | null)?.reference ?? id;
      const { data: admins } = await supabase
        .from("profiles")
        .select("email")
        .eq("organization_id", profile.organization_id)
        .eq("role", "ADMIN")
        .eq("is_active", true);
      if (admins && admins.length > 0) {
        await sendEmailFicheSoumise({
          ficheId: id,
          reference: ficheReference,
          prospecteurNom: `${profile.first_name} ${profile.last_name}`,
          adminEmails: admins.map((a) => a.email),
        });
      }

      router.push("/");
    } catch {
      toast.error("Erreur lors de la soumission");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Rendu ──────────────────────────────────────────────────────────────────

  // Cast nécessaire : toutes les étapes reçoivent les mêmes props mais n'en utilisent qu'une partie
  const StepComponent = STEPS[currentStep].component as React.ComponentType<StepAllProps>;
  const isEditMode = Boolean(ficheIdProp);
  const submitLabel = mode === "edit-submitted" ? "Enregistrer les modifications" : "Soumettre";

  return (
    <FormProvider {...methods}>
      <div>
        {/* Bandeau mode édition */}
        {isEditMode && (
          <div className="mb-6 flex items-center gap-2 text-sm text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900 rounded-xl p-3">
            <Edit className="w-4 h-4 text-amber-500 shrink-0" />
            <span>Vous modifiez un brouillon. Les modifications sont sauvegardées automatiquement.</span>
          </div>
        )}

        {/* Stepper visuel */}
        <div className="mb-8 bg-card border border-border rounded-2xl px-6 pt-5 pb-4">
          <div className="flex items-center">
            {STEPS.map((s, i) => {
              const done   = i < currentStep;
              const active = i === currentStep;
              return (
                <div key={i} className="flex items-center flex-1 last:flex-none">
                  <button
                    type="button"
                    onClick={() => { setStepDirection(i > currentStep ? "next" : "prev"); setCurrentStep(i); }}
                    aria-current={active ? "step" : undefined}
                    className="flex flex-col items-center gap-1.5 group"
                  >
                    <span className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-200
                      ${done   ? "bg-primary border-primary text-white"                                   : ""}
                      ${active ? "bg-white border-primary text-primary shadow-[0_0_0_4px_rgba(30,58,95,.1)]" : ""}
                      ${!done && !active ? "bg-card border-border text-muted-foreground group-hover:border-primary/40" : ""}
                    `}>
                      {done ? "✓" : i + 1}
                    </span>
                    <span className={`text-[10px] font-medium hidden sm:block transition-colors whitespace-nowrap
                      ${done || active ? "text-primary" : "text-muted-foreground"}`}>
                      {s.title}
                    </span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-[2px] mx-2 mb-4 rounded-full transition-colors duration-300
                      ${i < currentStep ? "bg-primary" : "bg-border"}`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Barre de progression globale */}
          <div className="mt-4 space-y-1.5">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-400"
                style={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }}
              />
            </div>
            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">
                Étape <span className="font-semibold text-foreground">{currentStep + 1}</span> sur {STEPS.length}
              </p>
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-primary">{Math.round((currentStep / (STEPS.length - 1)) * 100)}%</span> complété
              </p>
            </div>
          </div>
        </div>

        {/* Contenu de l'étape */}
        <div
          key={currentStep}
          className="min-h-[400px]"
          style={{
            animation: `${stepDirection === "next" ? "slideInFromRight" : "slideInFromLeft"} 0.25s ease both`,
          }}
        >
          <StepComponent
            photos={photos}
            setPhotos={setPhotos}
            signatureDataUrl={signatureDataUrl}
            setSignatureDataUrl={setSignatureDataUrl}
            existingSignatureUrl={existingSignatureUrl}
            uploadedPhotos={uploadedPhotos}
            onRemoveUploaded={handleRemoveUploaded}
            onAddValidFiles={handleAddValidFiles}
            currentFicheId={savedFicheId}
          />
        </div>

        {/* Navigation */}
        {/* Indicateur auto-save */}
        {lastSavedAt && (
          <div className="flex items-center justify-center mt-4">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground" style={{ animation: "fadeIn 0.3s ease" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              Sauvegardé à {lastSavedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between mt-8 pt-6 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => { setStepDirection("prev"); setCurrentStep((s) => Math.max(0, s - 1)); }}
            disabled={currentStep === 0}
            className="rounded-xl gap-2"
          >
            <ChevronLeft className="w-4 h-4" />Précédent
          </Button>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={saveDraft}
              disabled={saving}
              className="rounded-xl gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Sauvegarder
            </Button>
            {currentStep < STEPS.length - 1 ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={saving}
                className="bg-[#F97316] hover:bg-[#EA580C] text-white rounded-xl gap-2"
              >
                Suivant<ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmitFiche}
                disabled={submitting}
                className="bg-[#10B981] hover:bg-[#059669] text-white rounded-xl gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {submitLabel}
              </Button>
            )}
          </div>
        </div>
      </div>
    </FormProvider>
  );
}
