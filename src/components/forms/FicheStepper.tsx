"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";

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
import { ChevronLeft, ChevronRight, Save, Send, Loader2, Edit, X } from "lucide-react";
import { sendEmailFicheSoumise } from "@/lib/email";

// ── Types ────────────────────────────────────────────────────────────────────

/** Props communes pouvant être passées à n'importe quelle étape */
interface StepAllProps {
  photos?: File[];
  setPhotos?: (p: File[]) => void;
  signatureDataUrl?: string | null;
  setSignatureDataUrl?: (url: string | null) => void;
  /** URL publique de la signature prospect déjà en storage (mode édition) */
  existingSignatureUrl?: string | null;
  referentSignatureDataUrl?: string | null;
  setReferentSignatureDataUrl?: (url: string | null) => void;
  /** URL publique de la signature référent déjà en storage (mode édition) */
  existingReferentSignatureUrl?: string | null;
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
  initialData?: Partial<FicheFormData>;
  /** Photos déjà persistées (chargées depuis fiche_photos) */
  initialPhotos?: Array<{ id: string; storage_path: string; original_name: string }>;
  /** URL publique de la signature prospect déjà enregistrée (mode édition) */
  existingSignatureUrl?: string | null;
  /** URL publique de la signature référent déjà enregistrée (mode édition) */
  existingReferentSignatureUrl?: string | null;
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
  prospect_cp: "", prospect_ville: "", prospect_telephone: "", prospect_email: "",
  departement_code: null, ville_id: null,
  disponibilites: [] as string[], date_visite: "", heure_visite: "",
  rdv_date: "", referent_nom: "", referent_telephone: "",
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

export function FicheStepper({ ficheId: ficheIdProp, initialData, initialPhotos, existingSignatureUrl, existingReferentSignatureUrl, mode = "create" }: FicheStepperProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [stepDirection, setStepDirection] = useState<"next" | "prev">("next");
  const [hasNavigated, setHasNavigated] = useState(false);
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
  const [referentSignatureDataUrl, setReferentSignatureDataUrl] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [pendingNavUrl, setPendingNavUrl] = useState<string | null>(null);
  const isLeaving = useRef(false);

  const router = useRouter();
  const { profile } = useProfile();
  const supabase = useMemo(() => createClient(), []);

  const methods = useForm({
    defaultValues: { ...DEFAULT_FORM_VALUES, ...(initialData ?? {}) },
    mode: "onChange",
  });

  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      methods.reset({ ...DEFAULT_FORM_VALUES, ...initialData });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialise les photos déjà persistées au montage (mode édition) — signed URLs (bucket privé)
  useEffect(() => {
    if (!initialPhotos || initialPhotos.length === 0) return;
    async function loadSignedUrls() {
      const results = await Promise.all(
        (initialPhotos ?? []).map(async (p) => {
          const { data } = await supabase.storage.from("photos").createSignedUrl(p.storage_path, 7200);
          const url = data?.signedUrl ?? "";
          return url ? { ...p, url } : null;
        })
      );
      // B-08 : exclure les photos dont l'URL signée est invalide
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUploadedPhotos(results.filter((r): r is UploadedPhoto => r !== null));
    }
    loadSignedUrls();
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

  /** Sanitise un nom de fichier pour Supabase Storage (ASCII-only, sans espaces ni caractères spéciaux) */
  function sanitizeFileName(name: string): string {
    const dotIndex = name.lastIndexOf(".");
    const base = dotIndex > 0 ? name.slice(0, dotIndex) : name;
    const ext = dotIndex > 0 ? name.slice(dotIndex + 1) : "";
    const cleanBase = base
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/['‘’“”]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "photo";
    const cleanExt = ext.toLowerCase().replace(/[^a-z0-9]/g, "");
    return cleanExt ? `${cleanBase}.${cleanExt}` : cleanBase;
  }

  /** Upload un lot de fichiers en parallèle vers storage + insertion dans fiche_photos */
  async function uploadPhotoFiles(files: File[], ficheId: string): Promise<UploadedPhoto[]> {
    if (!profile) return [];
    const results = await Promise.all(files.map(async (file) => {
      const safeName = sanitizeFileName(file.name);
      const path = `${profile.organization_id}/${ficheId}/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage.from("photos").upload(path, file);
      if (error) { toast.error(`Erreur upload ${file.name}`); return null; }
      const { data: ins } = await supabase
        .from("fiche_photos")
        .insert({ fiche_id: ficheId, organization_id: profile.organization_id, storage_path: path, original_name: file.name, size: file.size })
        .select("id").single();
      const { data: signedData } = await supabase.storage.from("photos").createSignedUrl(path, 7200);
      const signedUrl = signedData?.signedUrl ?? "";
      // B-08 : ne pas ajouter les photos sans URL signée valide
      if (!signedUrl) return null;
      return {
        id: ins?.id ?? crypto.randomUUID(),
        url: signedUrl,
        original_name: file.name,
        storage_path: path,
      } satisfies UploadedPhoto;
    }));
    return results.filter((r): r is UploadedPhoto => r !== null);
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

  const saveDraft = useCallback(async (opts?: { silent?: boolean }) => {
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
      prospect_email: values.prospect_email || null,
      departement_code: values.departement_code || null,
      ville_id: values.ville_id || null,
      disponibilites: values.disponibilites || [],
      date_visite: values.date_visite || null,
      heure_visite: values.heure_visite || null,
      rdv_date: values.rdv_date || null,
      referent_nom: values.referent_nom || null,
      referent_telephone: values.referent_telephone || null,
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

    // Auto-match ville_id if missing but prospect_ville is set
    if (!cleanData.ville_id && cleanData.prospect_ville) {
      let q = supabase.from("zones_villes").select("id").ilike("nom", cleanData.prospect_ville.trim());
      if (cleanData.prospect_cp) q = q.eq("code_postal", cleanData.prospect_cp.trim());
      const { data: matchedVilles } = await q.limit(1);
      if (matchedVilles && matchedVilles.length === 1) {
        cleanData.ville_id = matchedVilles[0].id;
        methods.setValue("ville_id", matchedVilles[0].id);
      }
    }

    const silent = opts?.silent === true;
    try {
      if (ficheIdRef.current) {
        // Mise à jour — on exclut les champs immuables ET le statut
        // (le statut ne change que via le RPC transition_fiche, jamais ici)
        const { organization_id, created_by, reference, status, ...updateData } = cleanData;
        const { error } = await supabase.from("fiches").update(updateData).eq("id", ficheIdRef.current);
        if (error) {
          console.error("[saveDraft] update error:", error);
          if (!silent) toast.error("Erreur de sauvegarde : " + error.message);
          setSaving(false);
          return;
        }
      } else {
        // Première insertion
        const { data, error } = await supabase.from("fiches").insert(cleanData).select("id").single();
        if (error) {
          console.error("[saveDraft] insert error:", error);
          if (!silent) toast.error("Erreur de création : " + error.message);
          setSaving(false);
          return;
        }
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
      if (!silent) {
        toast.success(mode === "edit-submitted" ? "Modifications enregistrées" : "Brouillon sauvegardé");
      }
      setLastSavedAt(new Date());
    } catch (e) {
      console.error("[saveDraft] unexpected error:", e);
      if (!silent) toast.error("Erreur inattendue");
    }
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, methods, photos, supabase]);

  // Auto-save toutes les 30 s si le formulaire a été modifié
  useEffect(() => {
    const interval = setInterval(() => {
      if (profile && methods.formState.isDirty) saveDraft({ silent: true });
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

  useEffect(() => {
    if (submitting) return;
    const handler = (e: MouseEvent) => {
      if (!hasUnsavedChanges || isLeaving.current) return;
      const anchor = (e.target as HTMLElement).closest("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("#") || href === "/fiches/nouvelle") return;
      e.preventDefault();
      e.stopPropagation();
      setPendingNavUrl(href);
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [submitting, hasUnsavedChanges]);

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
    await saveDraft({ silent: true });
    setHasNavigated(true);
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
        const currentValues = methods.getValues();
        const changedFields: string[] = [];
        const FIELD_LABELS: Record<string, string> = {
          prospect_nom: "Nom", prospect_prenom: "Prénom", prospect_adresse: "Adresse",
          prospect_cp: "Code postal", prospect_ville: "Ville", prospect_telephone: "Téléphone",
          prospect_email: "Email", rdv_date: "Date RDV", observations: "Observations",
          modes_chauffage: "Chauffage", systemes_ventilation: "Ventilation",
          surface_chauffee: "Surface", nb_habitants: "Habitants", consommation: "Consommation",
          cout_annuel: "Coût annuel", nature_isolant: "Isolant",
        };
        if (initialData) {
          for (const key of Object.keys(currentValues) as (keyof typeof currentValues)[]) {
            const oldVal = initialData[key];
            const newVal = currentValues[key];
            if (JSON.stringify(oldVal ?? "") !== JSON.stringify(newVal ?? "")) {
              changedFields.push(FIELD_LABELS[key] || key);
            }
          }
        }
        await saveDraft({ silent: true });
        if (ficheIdRef.current) {
          const detail = changedFields.length > 0
            ? changedFields.slice(0, 5).join(", ") + (changedFields.length > 5 ? ` (+${changedFields.length - 5})` : "")
            : "modifications mineures";
          await supabase.from("fiche_history").insert({
            fiche_id: ficheIdRef.current,
            organization_id: profile.organization_id,
            user_id: profile.id,
            action: `Fiche modifiée par ${profile.first_name} ${profile.last_name}`,
            comment: `Champs modifiés : ${detail}`,
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
    if (!ficheIdRef.current) await saveDraft({ silent: true });
    if (!ficheIdRef.current) { toast.error("Erreur : impossible de sauvegarder la fiche"); return; }

    setSubmitting(true);
    try {
      const id = ficheIdRef.current;

      // Signatures : upload si nouvelles, sinon on conserve les existantes (pas d'écrasement)
      if (signatureDataUrl) {
        try {
          const blob = await fetch(signatureDataUrl).then((r) => r.blob());
          await supabase.storage
            .from("signatures")
            .upload(`${profile.organization_id}/${id}/signature.png`, blob, { contentType: "image/png", upsert: true });
        } catch {
          toast.error("La signature du prospect n'a pas pu être enregistrée");
        }
      }
      if (referentSignatureDataUrl) {
        try {
          const blob = await fetch(referentSignatureDataUrl).then((r) => r.blob());
          await supabase.storage
            .from("signatures")
            .upload(`${profile.organization_id}/${id}/signature_referent.png`, blob, { contentType: "image/png", upsert: true });
        } catch {
          toast.error("La signature du référent n'a pas pu être enregistrée");
        }
      }

      // Photos encore en attente
      if (photos.length > 0) {
        await uploadPhotoFiles(photos, id);
      }

      // Soumission validée et écrite côté serveur (statut + RGPD + historique,
      // de façon atomique). Voir supabase/migrations/0003_rpc_transitions.sql.
      const { error: submitError } = await supabase.rpc("transition_fiche", {
        p_fiche_id: id,
        p_new_status: "SOUMISE",
      });
      if (submitError) {
        toast.error("Soumission refusée : " + submitError.message);
        setSubmitting(false);
        return;
      }

      toast.success("Fiche soumise avec succès !");

      // Email aux admins de l'organisation — résolu côté serveur (non bloquant)
      await sendEmailFicheSoumise(id);

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

        {/* ═══ HERO STEPPER — voyage 7 chapitres ═══════════════════════════ */}
        <div className="mb-6 hero-surface hero-surface-sm rounded-3xl p-6 sm:p-7">
          <div className="relative z-10">
            {/* Header : chapitre courant en vedette */}
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] tracking-[1.2px] uppercase text-white/50 font-medium">
                    Chapitre {currentStep + 1} sur {STEPS.length}
                  </span>
                  {lastSavedAt && (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                      Sauvegardé
                    </span>
                  )}
                </div>
                <h2 className="font-heading text-2xl sm:text-3xl text-white tracking-tight leading-none">
                  {STEPS[currentStep].title}
                </h2>
                <p className="text-sm text-white/60 mt-2">
                  {(() => {
                    const remaining = STEPS.length - currentStep - 1;
                    if (remaining === 0) return "Dernier chapitre — signature du prospect.";
                    const mins = Math.max(1, Math.round(remaining * 1.5));
                    return `~ ${mins} min restante${mins > 1 ? "s" : ""} · ${remaining} chapitre${remaining > 1 ? "s" : ""} à compléter`;
                  })()}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-heading text-3xl sm:text-4xl text-white leading-none tracking-tight">
                  {Math.round((currentStep / (STEPS.length - 1)) * 100)}<span className="text-lg text-white/60">%</span>
                </div>
                <div className="text-[10px] tracking-[1px] uppercase text-white/50 mt-1">complété</div>
              </div>
            </div>

            {/* Timeline visuelle 7 chapitres */}
            <div className="relative">
              {/* Ligne de fond */}
              <div className="absolute top-4 left-4 right-4 h-0.5 bg-white/10 rounded-full" />
              {/* Ligne progressive */}
              <div
                className="absolute top-4 left-4 h-0.5 bg-[#F97316] rounded-full transition-all duration-500"
                style={{ width: `calc((100% - 32px) * ${currentStep / (STEPS.length - 1)})` }}
              />
              <div className="relative grid" style={{ gridTemplateColumns: `repeat(${STEPS.length}, minmax(0, 1fr))` }}>
                {STEPS.map((s, i) => {
                  const done = i < currentStep;
                  const active = i === currentStep;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={async () => {
                        if (i > currentStep && currentStep === 0) {
                          const result = step1Schema.safeParse(methods.getValues());
                          if (!result.success) {
                            result.error.issues.forEach((issue) => {
                              methods.setError(String(issue.path[0]) as keyof FicheFormData, { type: "manual", message: issue.message });
                            });
                            toast.error("Veuillez remplir les champs obligatoires avant de continuer");
                            return;
                          }
                        }
                        setHasNavigated(true);
                        setStepDirection(i > currentStep ? "next" : "prev");
                        setCurrentStep(i);
                      }}
                      aria-current={active ? "step" : undefined}
                      className="flex flex-col items-center gap-2 group"
                    >
                      <span className={`
                        relative rounded-full flex items-center justify-center text-xs font-medium transition-all
                        ${done ? "w-8 h-8 bg-emerald-500 text-white" : ""}
                        ${active ? "w-9 h-9 bg-[#F97316] text-white ring-4 ring-[#F97316]/20" : ""}
                        ${!done && !active ? "w-8 h-8 bg-white/8 border border-white/15 text-white/50 group-hover:bg-white/12" : ""}
                      `}>
                        {done ? "✓" : i + 1}
                      </span>
                      <span className={`text-[10px] font-medium hidden sm:block transition-colors text-center leading-tight
                        ${active ? "text-white" : done ? "text-white/60" : "text-white/40"}`}>
                        {s.title.split(" ")[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Contenu de l'étape */}
        <div
          key={currentStep}
          className="min-h-[400px]"
          style={{
            animation: hasNavigated ? `${stepDirection === "next" ? "slideInFromRight" : "slideInFromLeft"} 0.25s ease both` : "none",
          }}
        >
          <StepComponent
            photos={photos}
            setPhotos={setPhotos}
            signatureDataUrl={signatureDataUrl}
            setSignatureDataUrl={setSignatureDataUrl}
            existingSignatureUrl={existingSignatureUrl}
            referentSignatureDataUrl={referentSignatureDataUrl}
            setReferentSignatureDataUrl={setReferentSignatureDataUrl}
            existingReferentSignatureUrl={existingReferentSignatureUrl}
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
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setHasNavigated(true); setStepDirection("prev"); setCurrentStep((s) => Math.max(0, s - 1)); }}
              disabled={currentStep === 0}
              className="rounded-xl gap-2"
            >
              <ChevronLeft className="w-4 h-4" />Précédent
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowCancelConfirm(true)}
              className="rounded-xl gap-2 text-muted-foreground hover:text-destructive hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <X className="w-4 h-4" />Annuler
            </Button>
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => saveDraft({ silent: true })}
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
                className="bg-[#F97316] hover:bg-[#EA580C] text-white rounded-full px-5 gap-2"
              >
                Suivant<ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmitFiche}
                disabled={submitting}
                className="bg-[#10B981] hover:bg-[#059669] text-white rounded-full px-5 gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {submitLabel}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Dialog : confirmation d'annulation ─────────────────────────── */}
      <Dialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <X className="w-5 h-5" />Annuler les modifications ?
            </DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "La fiche sera sauvegardée en brouillon. Vous pourrez la reprendre depuis la liste des fiches."
                : "Les modifications non sauvegardées seront perdues. La fiche restera dans son état actuel."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="!flex-col gap-2">
            <Button
              type="button"
              onClick={() => {
                isLeaving.current = true;
                setShowCancelConfirm(false);
                const id = ficheIdRef.current;
                if (id) router.push(`/fiches/${id}`);
                else router.push("/fiches");
              }}
              className="w-full bg-destructive hover:bg-destructive/90 text-white rounded-xl gap-2"
            >
              <X className="w-4 h-4" />
              {mode === "create" ? "Quitter (garder le brouillon)" : "Annuler les modifications"}
            </Button>
            <DialogClose render={<Button type="button" variant="outline" className="w-full rounded-xl" />}>Continuer la saisie</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog : confirmation de navigation ──────────────────────── */}
      <Dialog open={!!pendingNavUrl} onOpenChange={(open) => { if (!open) setPendingNavUrl(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <Save className="w-5 h-5" />Quitter le formulaire ?
            </DialogTitle>
            <DialogDescription>
              Votre fiche sera sauvegardée en brouillon. Vous pourrez la reprendre depuis la liste des fiches.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="!flex-col gap-2">
            <Button
              type="button"
              onClick={async () => {
                isLeaving.current = true;
                await saveDraft({ silent: true });
                const url = pendingNavUrl!;
                setPendingNavUrl(null);
                router.push(url);
              }}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white rounded-xl gap-2"
            >
              <Save className="w-4 h-4" />
              Sauvegarder et quitter
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={async () => {
                if (ficheIdRef.current) {
                  await supabase.from("fiche_photos").delete().eq("fiche_id", ficheIdRef.current);
                  await supabase.from("fiches").delete().eq("id", ficheIdRef.current);
                }
                setPendingNavUrl(null);
                window.location.href = "/fiches/nouvelle";
              }}
              className="w-full rounded-xl gap-2"
            >
              <X className="w-4 h-4" />
              Annuler la saisie
            </Button>
            <Button type="button" variant="outline" className="w-full rounded-xl" onClick={() => setPendingNavUrl(null)}>
              Continuer la saisie
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FormProvider>
  );
}
