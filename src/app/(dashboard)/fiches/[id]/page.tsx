"use client";

import { useEffect, useState, use, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Topbar } from "@/components/layout/Topbar";
import { ExportCsvButton } from "@/components/ui/export-csv-button";
import { FicheStatusBadge } from "@/components/fiches/FicheStatusBadge";
import { RdvEditDialog } from "@/components/fiches/RdvEditDialog";
import type { HistoryEntry, PhotoEntry, ProfileEntry } from "@/components/fiches/FicheDetailHelpers";
import { FicheMainContent } from "@/components/fiches/FicheMainContent";
import { FicheSidebar } from "@/components/fiches/FicheSidebar";
import { FicheStatusChangeDialog } from "@/components/fiches/FicheStatusChangeDialog";
import { createClient } from "@/lib/supabase/client";
import {
  getFicheById, getFicheHistory, getFichePhotos,
  getActiveCommercialsAndAdmins, deleteFicheCascade,
} from "@/lib/data/fiches";
import { getProfileFullName } from "@/lib/data/profiles";
import { useProfile } from "@/lib/hooks/use-profile";
import {
  getAvailableTransitions, canAssignFiche, canEditFiche, canEditRdvDate, STATUS_LABELS, MOTIF_REFUS_LABELS,
} from "@/lib/permissions";
import { sendEmailFicheAffectee, sendEmailFicheDecision, sendEmailFicheRejetee } from "@/lib/email";
import { createNotifications, getAdminIds } from "@/lib/data/notifications";
import type { FicheStatus, Fiche, MotifRefus } from "@/types/database";
import Image from "next/image";
import { toast } from "sonner";
import {
  User,
  Clock, ArrowLeft, UserCheck, Loader2, Pencil, Trash2,
  MapPin, Calendar, CheckCircle2, ShieldCheck, AlertTriangle, Ban, Copy, ChevronDown, ChevronUp,
  Send, Archive, UserX,
} from "lucide-react";
import { DownloadFicheButton } from "@/components/pdf/DownloadFicheButton";
import confetti from "canvas-confetti";
import type { ZoneVille } from "@/types/database";

// ── Status accent colors (same palette as fiches list) ────────────────────────

const STATUS_HERO: Record<FicheStatus, { border: string; iconBg: string; icon: string; Icon: React.ElementType }> = {
  BROUILLON:    { border: "border-l-slate-400",   iconBg: "bg-slate-100 dark:bg-slate-800",       icon: "text-slate-500",                        Icon: Clock },
  SOUMISE:      { border: "border-l-blue-500",    iconBg: "bg-blue-100 dark:bg-blue-950/50",      icon: "text-blue-600 dark:text-blue-400",      Icon: Send },
  VALIDEE:      { border: "border-l-emerald-500", iconBg: "bg-emerald-100 dark:bg-emerald-950/50",icon: "text-emerald-600 dark:text-emerald-400",Icon: CheckCircle2 },
  AFFECTEE:         { border: "border-l-orange-500",  iconBg: "bg-orange-100 dark:bg-orange-950/50",  icon: "text-orange-600 dark:text-orange-400",  Icon: UserCheck },
  RDV_A_REPRENDRE:  { border: "border-l-amber-500",  iconBg: "bg-amber-100 dark:bg-amber-950/50",    icon: "text-amber-600 dark:text-amber-400",    Icon: UserX },
  ACCEPTEE:     { border: "border-l-emerald-500", iconBg: "bg-emerald-100 dark:bg-emerald-950/50",icon: "text-emerald-700 dark:text-emerald-300",Icon: CheckCircle2 },
  RETRACTATION: { border: "border-l-purple-500",  iconBg: "bg-purple-100 dark:bg-purple-950/50",  icon: "text-purple-600 dark:text-purple-400",  Icon: AlertTriangle },
  REFUSEE:      { border: "border-l-red-500",     iconBg: "bg-red-100 dark:bg-red-950/50",        icon: "text-red-600 dark:text-red-400",        Icon: Ban },
  ARCHIVEE:     { border: "border-l-slate-300",   iconBg: "bg-slate-100 dark:bg-slate-800",       icon: "text-slate-500",                        Icon: Archive },
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function FicheDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [fiche, setFiche] = useState<Fiche | null>(null);
  const [creatorName, setCreatorName] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [referentSignatureUrl, setReferentSignatureUrl] = useState<string | null>(null);
  const [commercials, setCommercials] = useState<ProfileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<FicheStatus | null>(null);
  const [statusComment, setStatusComment] = useState("");
  const [selectedMotifRefus, setSelectedMotifRefus] = useState<MotifRefus | "">("");
  const [editingRdvDate, setEditingRdvDate] = useState(false);
  const [rdvDateValue, setRdvDateValue] = useState("");
  const [selectedCommercial, setSelectedCommercial] = useState("");
  const [isValidated, setIsValidated] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showRejetDialog, setShowRejetDialog] = useState(false);
  const [rejetMotif, setRejetMotif] = useState("");
  const [showReassignPanel, setShowReassignPanel] = useState(false);
  const [reassignCommercialId, setReassignCommercialId] = useState("");
  const [showReassignConfirmModal, setShowReassignConfirmModal] = useState(false);
  const [showValidateSansAffectModal, setShowValidateSansAffectModal] = useState(false);
  const [assignCommercialId, setAssignCommercialId] = useState("");
  const [showHistory, setShowHistory] = useState(true);
  const [deleteMotif, setDeleteMotif] = useState("");
  const [villeData, setVilleData] = useState<ZoneVille | null>(null);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showAnnulationDialog, setShowAnnulationDialog] = useState(false);
  const [annulationMotif, setAnnulationMotif] = useState("");
  const [montantHtInput, setMontantHtInput] = useState("");
  const [newRdvDate, setNewRdvDate] = useState("");
  const [showRdvEditDialog, setShowRdvEditDialog] = useState(false);

  const { profile } = useProfile();
  const router = useRouter();
  // useMemo évite une nouvelle référence à chaque render (stabilise useCallback fetchData)
  const supabase = useMemo(() => createClient(), []);

  const fetchData = useCallback(async () => {
    try {
      const [ficheData, commercialsData] = await Promise.all([
        getFicheById(supabase, id),
        getActiveCommercialsAndAdmins(supabase),
      ]);
      const ficheUuid = ficheData?.id ?? id;
      const [historyData, photosData] = await Promise.all([
        getFicheHistory(supabase, ficheUuid),
        getFichePhotos(supabase, ficheUuid),
      ]);
      setFiche(ficheData);
      if (ficheData?.reference) {
        document.title = `${ficheData.reference} · Proximité Habitat Conseil`;
      }
      setHistory(historyData);
      setCommercials(commercialsData);

      // Toutes les requêtes secondaires en parallèle (signed URLs photos, nom créateur, ville, signatures)
      const orgId = ficheData?.organization_id;
      const [photosWithUrls, creatorName, villeResult, sigsResult] = await Promise.all([
        Promise.all((photosData ?? []).map(async (p) => {
          const { data } = await supabase.storage.from("photos").createSignedUrl(p.storage_path, 7200);
          return { ...p, signedUrl: data?.signedUrl ?? "" };
        })),
        ficheData?.created_by ? getProfileFullName(supabase, ficheData.created_by) : Promise.resolve(null),
        ficheData?.ville_id
          ? supabase.from("zones_villes").select("*").eq("id", ficheData.ville_id).single()
          : Promise.resolve({ data: null }),
        orgId
          ? Promise.all([
              supabase.storage.from("signatures").createSignedUrl(`${orgId}/${id}/signature.png`, 7200),
              supabase.storage.from("signatures").createSignedUrl(`${orgId}/${id}/signature_referent.png`, 7200),
            ])
          : Promise.resolve(null),
      ]);

      setPhotos(photosWithUrls);
      if (creatorName) setCreatorName(creatorName);
      setVilleData(villeResult.data ?? null);
      if (sigsResult) {
        const [{ data: sig }, { data: sigRef }] = sigsResult;
        setSignatureUrl(sig?.signedUrl ?? null);
        setReferentSignatureUrl(sigRef?.signedUrl ?? null);
      }
    } catch (err) {
      console.error("fetchData error", err);
      toast.error("Erreur lors du chargement de la fiche");
    } finally {
      setLoading(false);
    }
  }, [id, supabase]);

  // B-03 : réinitialiser les états de validation quand l'id change (navigation entre fiches)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsValidated(false);
    setSelectedCommercial("");
    setRejetMotif("");
    setShowConfirmModal(false);
    setShowRejetDialog(false);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
    // Restore default title on unmount
    return () => { document.title = "Proximité Habitat Conseil"; };
  }, [fetchData]);

  useEffect(() => {
    const channel = supabase
      .channel(`fiche-detail-${id}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "fiches", filter: `id=eq.${id}` },
        () => { fetchData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, supabase, fetchData]);

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible") fetchData();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [fetchData]);

  useEffect(() => {
    if (!showStatusDropdown) return;
    function close(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest("[data-status-dropdown]")) setShowStatusDropdown(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showStatusDropdown]);

  async function handleStatusChange(newStatus: FicheStatus, comment?: string, motifRefus?: MotifRefus, rdvDateParam?: string) {
    if (!fiche || !profile) return;
    setTransitioning(true);
    const { error } = await supabase.rpc("transition_fiche", {
      p_fiche_id: fiche.id,
      p_new_status: newStatus,
      p_comment: comment || null,
    });
    if (error) { toast.error("Transition refusée : " + error.message); setTransitioning(false); return; }

    if (newStatus === "REFUSEE" && motifRefus) {
      await supabase.from("fiches").update({ motif_refus: motifRefus }).eq("id", fiche.id);
    }

    const montantHtValue = newStatus === "ACCEPTEE" && montantHtInput ? parseFloat(montantHtInput) : null;
    if (newStatus === "ACCEPTEE" && montantHtValue) {
      await supabase.from("fiches").update({ montant_ht: montantHtValue }).eq("id", fiche.id);
    }

    if (newStatus === "AFFECTEE" && fiche.status === "RDV_A_REPRENDRE" && rdvDateParam) {
      await supabase.from("fiches").update({ rdv_date: rdvDateParam }).eq("id", fiche.id);
    }

    setFiche({
      ...fiche,
      status: newStatus,
      ...(motifRefus ? { motif_refus: motifRefus } : {}),
      ...(montantHtValue ? { montant_ht: montantHtValue } : {}),
      ...(newStatus === "AFFECTEE" && fiche.status === "RDV_A_REPRENDRE" && rdvDateParam ? { rdv_date: rdvDateParam } : {}),
    });
    window.dispatchEvent(new CustomEvent("phc:fiche-status-changed"));
    toast.success(`Statut changé : ${STATUS_LABELS[newStatus]}`);
    if (newStatus === "ACCEPTEE") {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ["#1E3A5F", "#F97316", "#10B981", "#F59E0B"] });
    }

    // Notifications + email (non bloquant)
    void (async () => {
      try {
        const orgId = profile.organization_id;
        const ref = fiche.reference;

        if (newStatus === "BROUILLON" && fiche.created_by) {
          // Direction a rejeté la fiche vers BROUILLON — notif + email au référent
          const { data: prospProfile } = await supabase
            .from("profiles")
            .select("email, first_name")
            .eq("id", fiche.created_by)
            .single();
          if (prospProfile) {
            await createNotifications(supabase, [{
              user_id: fiche.created_by,
              organization_id: orgId,
              type: "FICHE_REJETEE",
              title: "Fiche renvoyée en brouillon",
              message: `Votre fiche ${ref} a été renvoyée en brouillon par la direction${comment ? ` : ${comment}` : ""}. Veuillez la corriger avant de la resoumettre.`,
              fiche_id: fiche.id,
            }]);
            await sendEmailFicheRejetee(fiche.id, comment);
          }
        }

        if (newStatus === "SOUMISE") {
          const adminIds = await getAdminIds(supabase, orgId);
          const prospName = `${profile.first_name} ${profile.last_name}`;
          // Direction : nouvelle fiche soumise
          await createNotifications(supabase, adminIds.map((uid) => ({
            user_id: uid,
            organization_id: orgId,
            type: "FICHE_SOUMISE",
            title: "Nouvelle fiche à valider",
            message: `${prospName} a soumis la fiche ${ref} — en attente de validation.`,
            fiche_id: fiche.id,
          })));
          // Référent : confirmation de soumission
          await createNotifications(supabase, [{
            user_id: profile.id,
            organization_id: orgId,
            type: "FICHE_SOUMISE",
            title: "Nouvelle fiche à valider",
            message: `Votre fiche ${ref} a bien été soumise et est en attente de validation par la direction.`,
            fiche_id: fiche.id,
          }]);
        }

        if (newStatus === "ACCEPTEE" || newStatus === "REFUSEE") {
          // Référent : vente validée ou refusée
          if (fiche.created_by) {
            const { data: prospProfile } = await supabase
              .from("profiles")
              .select("email, first_name")
              .eq("id", fiche.created_by)
              .single();
            if (prospProfile) {
              await createNotifications(supabase, [{
                user_id: fiche.created_by,
                organization_id: orgId,
                type: newStatus === "ACCEPTEE" ? "FICHE_ACCEPTEE" : "FICHE_REFUSEE",
                title: newStatus === "ACCEPTEE" ? "Vente validée 🎉" : "Vente refusée",
                message: newStatus === "ACCEPTEE"
                  ? `Félicitations ! La fiche ${ref} a été validée par le client.`
                  : `La fiche ${ref} a été refusée par le client${comment ? ` : ${comment}` : ""}.`,
                fiche_id: fiche.id,
              }]);
              await sendEmailFicheDecision(fiche.id, newStatus, comment);
            }
          }
          // Direction : vente validée ou refusée par le commercial
          const commercialName = `${profile.first_name} ${profile.last_name}`;
          const adminIds = await getAdminIds(supabase, orgId);
          await createNotifications(supabase, adminIds.map((uid) => ({
            user_id: uid,
            organization_id: orgId,
            type: newStatus === "ACCEPTEE" ? "FICHE_ACCEPTEE" : "FICHE_REFUSEE",
            title: newStatus === "ACCEPTEE" ? "Vente validée par le client" : "Vente refusée par le client",
            message: newStatus === "ACCEPTEE"
              ? `${commercialName} a obtenu la validation du client sur la fiche ${ref}.`
              : `${commercialName} a indiqué un refus du client sur la fiche ${ref}${comment ? ` : ${comment}` : ""}.`,
            fiche_id: fiche.id,
          })));
        }
      } catch { /* silencieux */ }
    })();

    setTransitioning(false);
  }

  async function handleDelete() {
    if (!fiche || !profile) return;
    if (!deleteMotif.trim()) { toast.error("Le motif de suppression est obligatoire"); return; }
    setDeleting(true);
    try {
      await supabase.from("fiche_history").insert({
        fiche_id: fiche.id,
        organization_id: profile.organization_id,
        user_id: profile.id,
        action: `Fiche supprimée — Motif : ${deleteMotif.trim()}`,
        old_status: fiche.status,
      });
      await deleteFicheCascade(supabase, fiche.id);
      toast.success("Fiche supprimée");
      router.push("/");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la suppression");
      setDeleting(false);
    }
  }

  function handleFinaliserAffectation() {
    if (!isValidated && !selectedCommercial) {
      toast.error("Veuillez valider la fiche et choisir un commercial avant de finaliser.");
      return;
    }
    if (!isValidated) {
      toast.error("Étape 1/2 manquante — veuillez d'abord valider la fiche.");
      return;
    }
    if (!selectedCommercial) {
      toast.error("Étape 2/2 manquante — veuillez choisir un commercial.");
      return;
    }
    // Ouvre le modal de confirmation avant d'envoyer
    setShowConfirmModal(true);
  }

  async function handleRejetFiche() {
    if (!fiche || !profile) return;
    if (!rejetMotif.trim()) { toast.error("Le motif de rejet est obligatoire."); return; }
    setTransitioning(true);
    const { error } = await supabase.rpc("transition_fiche", {
      p_fiche_id: fiche.id,
      p_new_status: "BROUILLON",
      p_comment: rejetMotif.trim(),
    });
    if (error) { toast.error("Rejet refusé : " + error.message); setTransitioning(false); return; }
    setFiche({ ...fiche, status: "BROUILLON" });
    window.dispatchEvent(new CustomEvent("phc:fiche-status-changed"));
    toast.success("Fiche rejetée — le référent a été notifié.");
    setShowRejetDialog(false);
    setRejetMotif("");
    setTransitioning(false);
    // Notification + email au référent (non bloquant)
    void (async () => {
      try {
        if (fiche.created_by) {
          await createNotifications(supabase, [{
            user_id: fiche.created_by,
            organization_id: profile.organization_id,
            type: "FICHE_REJETEE",
            title: "Validation rejetée",
            message: `Votre fiche ${fiche.reference} a été rejetée par la direction${rejetMotif.trim() ? ` : ${rejetMotif.trim()}` : ""}. Veuillez la corriger et la resoumettre.`,
            fiche_id: fiche.id,
          }]);
          await sendEmailFicheRejetee(fiche.id, rejetMotif.trim());
        }
      } catch { /* silencieux */ }
    })();
  }

  async function handleAnnulationValidation() {
    if (!fiche || !profile || !annulationMotif.trim()) {
      toast.error("Le motif d'annulation est obligatoire.");
      return;
    }
    setTransitioning(true);
    const { error } = await supabase.rpc("transition_fiche", {
      p_fiche_id: fiche.id,
      p_new_status: "SOUMISE",
      p_comment: annulationMotif.trim(),
    });
    if (error) { toast.error("Annulation refusée : " + error.message); setTransitioning(false); return; }
    setFiche({ ...fiche, status: "SOUMISE", assigned_to: null });
    window.dispatchEvent(new CustomEvent("phc:fiche-status-changed"));
    toast.success("Validation annulée — la fiche revient en statut À valider.");
    setShowAnnulationDialog(false);
    setAnnulationMotif("");
    setTransitioning(false);
    void (async () => {
      try {
        const orgId = profile.organization_id;
        const ref = fiche.reference;
        const motif = annulationMotif.trim();
        if (fiche.assigned_to) {
          await createNotifications(supabase, [{
            user_id: fiche.assigned_to,
            organization_id: orgId,
            type: "FICHE_REJETEE",
            title: "Affectation annulée",
            message: `La fiche ${ref} ne vous est plus affectée. Motif : ${motif}`,
            fiche_id: fiche.id,
          }]);
        }
        if (fiche.created_by) {
          await createNotifications(supabase, [{
            user_id: fiche.created_by,
            organization_id: orgId,
            type: "FICHE_REJETEE",
            title: "Validation annulée",
            message: `Votre fiche ${ref} n'est plus validée. Motif : ${motif}`,
            fiche_id: fiche.id,
          }]);
        }
      } catch { /* silencieux */ }
    })();
  }

  async function handleAssign(commercialId: string) {
    if (!fiche || !profile) return;
    setTransitioning(true);
    // Étape 1 : SOUMISE → VALIDEE (si la fiche est encore SOUMISE)
    if (fiche.status === "SOUMISE") {
      const { error: errValidate } = await supabase.rpc("transition_fiche", {
        p_fiche_id: fiche.id,
        p_new_status: "VALIDEE",
      });
      if (errValidate) { toast.error("Validation refusée : " + errValidate.message); setTransitioning(false); return; }
    }
    // Étape 2 : VALIDEE → AFFECTEE
    const { error } = await supabase.rpc("transition_fiche", {
      p_fiche_id: fiche.id,
      p_new_status: "AFFECTEE",
      p_assigned_to: commercialId,
    });
    if (error) { toast.error("Affectation refusée : " + error.message); setTransitioning(false); return; }
    toast.success("Fiche validée et affectée avec succès");
    setFiche({ ...fiche, assigned_to: commercialId, status: "AFFECTEE" });
    window.dispatchEvent(new CustomEvent("phc:fiche-status-changed"));
    setTransitioning(false);

    // Email + notifications (non bloquant)
    void (async () => {
      try {
        const { data: commProfile } = await supabase
          .from("profiles")
          .select("email, first_name, last_name")
          .eq("id", commercialId)
          .single();

        if (commProfile) {
          // Email au commercial (la notification est gérée par le RPC transition_fiche)
          await sendEmailFicheAffectee(fiche.id);
        }
      } catch { /* silencieux */ }
    })();

    router.refresh();
  }

  async function handleReassign() {
    if (!fiche || !profile || !reassignCommercialId) return;
    setTransitioning(true);
    // Mise à jour directe (le RPC interdit AFFECTEE→AFFECTEE)
    const { error } = await supabase
      .from("fiches")
      .update({ assigned_to: reassignCommercialId, status: "AFFECTEE", updated_at: new Date().toISOString() })
      .eq("id", fiche.id);
    if (error) { toast.error("Réaffectation refusée : " + error.message); setTransitioning(false); return; }
    setFiche({ ...fiche, assigned_to: reassignCommercialId, status: "AFFECTEE" });
    setShowReassignPanel(false);
    setReassignCommercialId("");
    setTransitioning(false);
    toast.success("Affectation modifiée avec succès");

    const oldCommercialId = fiche.assigned_to;
    void (async () => {
      try {
        const ref = fiche.reference;
        const orgId = profile.organization_id;

        const notifications: Parameters<typeof createNotifications>[1] = [];

        // Notifier l'ancien commercial que la fiche lui a été retirée
        if (oldCommercialId && oldCommercialId !== reassignCommercialId) {
          const { data: oldComm } = await supabase
            .from("profiles").select("first_name, last_name").eq("id", oldCommercialId).single();
          notifications.push({
            user_id: oldCommercialId,
            organization_id: orgId,
            type: "FICHE_AFFECTEE",
            title: "Fiche retirée de votre portefeuille",
            message: `La fiche ${ref} a été réaffectée à un autre commercial par la direction.`,
            fiche_id: fiche.id,
          });

          // Historique
          const newComm = commercials.find((c) => c.id === reassignCommercialId);
          await supabase.from("fiche_history").insert({
            fiche_id: fiche.id,
            organization_id: orgId,
            user_id: profile.id,
            action: `Réaffectation : ${oldComm ? `${oldComm.first_name} ${oldComm.last_name}` : "ancien commercial"} → ${newComm ? `${newComm.first_name} ${newComm.last_name}` : "nouveau commercial"}`,
            old_status: "AFFECTEE",
            new_status: "AFFECTEE",
          });
        }

        // Notifier le nouveau commercial
        notifications.push({
          user_id: reassignCommercialId,
          organization_id: orgId,
          type: "FICHE_AFFECTEE",
          title: "Fiche affectée",
          message: `La fiche ${ref} vous a été affectée par la direction.`,
          fiche_id: fiche.id,
        });

        if (notifications.length > 0) {
          await createNotifications(supabase, notifications);
        }
        await sendEmailFicheAffectee(fiche.id);
      } catch { /* silencieux */ }
    })();
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading || !fiche) {
    return (
      <>
        <Topbar title="Détail de la fiche" />
        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
          {/* Skeleton hero */}
          <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] p-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-muted animate-pulse shrink-0" />
              <div className="flex-1 space-y-3">
                <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                <div className="h-7 w-48 bg-muted rounded animate-pulse" />
                <div className="h-3 w-36 bg-muted rounded animate-pulse" />
              </div>
            </div>
            <div className="mt-5 pt-5 border-t border-border flex gap-2">
              <div className="h-8 w-28 bg-muted rounded-xl animate-pulse" />
              <div className="h-8 w-28 bg-muted rounded-xl animate-pulse" />
            </div>
          </div>
          {/* Skeleton content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="h-40 bg-muted rounded-2xl animate-pulse" />
              <div className="h-32 bg-muted rounded-2xl animate-pulse" />
            </div>
            <div className="space-y-4">
              <div className="h-48 bg-muted rounded-2xl animate-pulse" />
              <div className="h-24 bg-muted rounded-2xl animate-pulse" />
            </div>
          </div>
        </div>
      </>
    );
  }

  if (profile?.role === "COMMERCIAL" && fiche.assigned_to !== profile.id && fiche.created_by !== profile.id) {
    return (
      <>
        <Topbar title="Accès refusé" />
        <div className="p-4 sm:p-6 lg:p-8 max-w-lg mx-auto text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mx-auto">
            <Ban className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-lg font-bold">Accès non autorisé</h2>
          <p className="text-sm text-muted-foreground">
            Cette fiche ne vous est plus affectée. Vous ne pouvez pas y accéder.
          </p>
          <Button onClick={() => router.push("/fiches")} className="bg-[#F97316] hover:bg-[#EA580C] text-white">
            Retour aux fiches
          </Button>
        </div>
      </>
    );
  }

  if ((profile?.role === "PROSPECTEUR" || profile?.role === "CHEF_EQUIPE") && fiche.created_by !== profile.id) {
    return (
      <>
        <Topbar title="Accès refusé" />
        <div className="p-4 sm:p-6 lg:p-8 max-w-lg mx-auto text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mx-auto">
            <Ban className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-lg font-bold">Accès non autorisé</h2>
          <p className="text-sm text-muted-foreground">
            Vous ne pouvez accéder qu&#39;aux fiches que vous avez créées.
          </p>
          <Button onClick={() => router.push("/fiches")} className="bg-[#F97316] hover:bg-[#EA580C] text-white">
            Retour aux fiches
          </Button>
        </div>
      </>
    );
  }

  const rawTransitions = profile ? getAvailableTransitions(profile.role, fiche.status) : [];
  // Pour ADMIN sur fiche SOUMISE : la bannière gère validation/rejet — on masque ces boutons du hero
  // Pour ADMIN sur fiche AFFECTEE : SOUMISE (re-soumission) est géré via l'Assign card — masqué ici
  const availableTransitions = (() => {
    if (profile?.role === "ADMIN" && fiche.status === "SOUMISE")
      return rawTransitions.filter((s) => s !== "AFFECTEE" && s !== "BROUILLON");
    if (profile?.role === "ADMIN" && fiche.status === "AFFECTEE")
      return rawTransitions.filter((s) => s !== "SOUMISE");
    return rawTransitions;
  })();
  const hero = STATUS_HERO[fiche.status];
  const canEdit = profile && canEditFiche(profile.role, profile.id, fiche.created_by, fiche.assigned_to, fiche.status);

  return (
    <>
      <Topbar title="Détail de la fiche" actions={<div className="flex items-center gap-2"><DownloadFicheButton fiche={fiche} referentNom={creatorName || "Référent"} commercialNom={fiche.assigned_to ? (commercials.find((c) => c.id === fiche.assigned_to) ? `${commercials.find((c) => c.id === fiche.assigned_to)!.first_name} ${commercials.find((c) => c.id === fiche.assigned_to)!.last_name}` : undefined) : undefined} photoUrls={photos.map((p) => p.signedUrl).filter(Boolean)} /><ExportCsvButton filename={`fiche-${fiche.reference}`} getData={() => ({
        columns: [
          { key: "champ", label: "Champ" },
          { key: "valeur", label: "Valeur" },
        ] as { key: keyof { champ: string; valeur: string }; label: string }[],
        rows: [
          { champ: "Référence", valeur: fiche.reference },
          { champ: "Statut", valeur: STATUS_LABELS[fiche.status] },
          { champ: "Nom", valeur: fiche.prospect_nom || "" },
          { champ: "Prénom", valeur: fiche.prospect_prenom || "" },
          { champ: "Téléphone", valeur: fiche.prospect_telephone || "" },
          { champ: "Email", valeur: fiche.prospect_email || "" },
          { champ: "Adresse", valeur: fiche.prospect_adresse || "" },
          { champ: "Ville", valeur: fiche.prospect_ville || "" },
          { champ: "Code postal", valeur: fiche.prospect_cp || "" },
          { champ: "Montant HT", valeur: fiche.montant_ht ? String(fiche.montant_ht) : "" },
        ],
      })} /></div>} />
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">

        {/* ── Bannière "Fiche à valider" — visible direction uniquement ──── */}
        {fiche.status === "SOUMISE" && profile?.role === "ADMIN" && (
          <div data-no-print className="bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800 rounded-2xl p-5 space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="font-bold text-sm text-red-700 dark:text-red-400 uppercase tracking-wide">
                  Fiche à valider
                </p>
                <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-0.5">
                  Soumise par <span className="font-semibold">{creatorName || "un référent"}</span>
                  {" "}— ces 2 étapes sont requises pour finaliser.
                </p>
              </div>
            </div>

            {/* 2 étapes côte à côte */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Étape 1 : Validation */}
              <button
                type="button"
                onClick={() => setIsValidated((v) => !v)}
                className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
                  isValidated
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                    : "border-dashed border-border bg-background hover:border-emerald-400"
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  isValidated ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-muted"
                }`}>
                  <CheckCircle2 className={`w-4 h-4 ${isValidated ? "text-emerald-600" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <p className={`text-xs font-bold uppercase tracking-wide ${isValidated ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>
                    Étape 1 / 2
                  </p>
                  <p className={`text-sm font-semibold ${isValidated ? "text-emerald-800 dark:text-emerald-300" : "text-foreground"}`}>
                    {isValidated ? "✓ Fiche validée" : "Valider la fiche"}
                  </p>
                </div>
              </button>

              {/* Étape 2 : Affecter */}
              <div className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all ${
                selectedCommercial
                  ? "border-orange-400 bg-orange-50 dark:bg-orange-950/20"
                  : "border-dashed border-border bg-background"
              }`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  selectedCommercial ? "bg-orange-100 dark:bg-orange-900/40" : "bg-muted"
                }`}>
                  <UserCheck className={`w-4 h-4 ${selectedCommercial ? "text-orange-500" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold uppercase tracking-wide mb-1 ${selectedCommercial ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground"}`}>
                    Étape 2 / 2
                  </p>
                  <Select value={selectedCommercial} onValueChange={(v) => setSelectedCommercial(v ?? "")}>
                    <SelectTrigger className="h-7 rounded-lg text-xs border-0 bg-transparent p-0 shadow-none focus:ring-0">
                      <SelectValue placeholder="Choisir un commercial…">
                        {selectedCommercial
                          ? (() => {
                              const c = commercials.find((x) => x.id === selectedCommercial);
                              return c ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Commercial" : "Choisir un commercial…";
                            })()
                          : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {commercials.filter((c) => c.role === "COMMERCIAL").map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Commercial"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Alerte si une étape manque (affiché seulement quand l'une est faite) */}
            {(isValidated || selectedCommercial) && (!isValidated || !selectedCommercial) && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {!isValidated
                    ? "L'étape 1 (validation) est requise avant de pouvoir finaliser."
                    : "L'étape 2 (affectation à un commercial) est requise avant de pouvoir finaliser."}
                </p>
              </div>
            )}

            {/* CTAs */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setRejetMotif(""); setShowRejetDialog(true); }}
                className="gap-2 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30 rounded-xl"
              >
                <Ban className="w-4 h-4" />
                Validation rejetée
              </Button>
              <Button
                onClick={handleFinaliserAffectation}
                disabled={transitioning}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-2 font-semibold"
              >
                {transitioning
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <CheckCircle2 className="w-4 h-4" />}
                Affecter et finaliser
              </Button>
            </div>
          </div>
        )}

        {/* ── Hero card — statut vedette + montant HT en featured ─────────── */}
        <div className={`bg-card border border-border border-l-4 ${hero.border} rounded-2xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)]`}>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">

            {/* Left: identity avec status icon block */}
            <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
              <Button variant="outline" size="sm" onClick={() => router.push("/fiches")}
                className="rounded-xl mt-0.5 shrink-0 hidden sm:inline-flex" aria-label="Retour à la liste">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              {/* Icon statut vedette */}
              <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl ${hero.iconBg} flex items-center justify-center flex-shrink-0`}>
                <hero.Icon className={`w-6 h-6 sm:w-7 sm:h-7 ${hero.icon}`} />
              </div>
              <div className="min-w-0 flex-1">
                {/* Micro-typo référence */}
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <button
                    type="button"
                    title="Copier la référence"
                    onClick={() => {
                      navigator.clipboard.writeText(fiche.reference).then(() => {
                        toast.success("Référence copiée", { duration: 2000 });
                      });
                    }}
                    className="group flex items-center gap-1 text-[10px] font-medium tracking-[1px] uppercase text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {fiche.reference}
                    <Copy className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                  </button>
                  {(profile?.role === "PROSPECTEUR" || profile?.role === "CHEF_EQUIPE") && fiche.status === "AFFECTEE" ? (
                    <>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Validée
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                        Affectée
                      </span>
                    </>
                  ) : (
                    <FicheStatusBadge status={fiche.status} />
                  )}
                  {fiche.status === "REFUSEE" && fiche.motif_refus && (
                    <span className="text-[10px] font-medium text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full">
                      {MOTIF_REFUS_LABELS[fiche.motif_refus]}
                    </span>
                  )}
                </div>
                {/* Nom prospect + date RDV à droite sur la même ligne */}
                <div className="flex items-center gap-3 min-w-0">
                  <h2 className="font-heading text-2xl sm:text-3xl leading-tight tracking-tight truncate min-w-0">
                    {[fiche.prospect_prenom, fiche.prospect_nom].filter(Boolean).join(" ") || "—"}
                  </h2>
                  {fiche.rdv_date && (fiche.status === "AFFECTEE" || fiche.status === "RDV_A_REPRENDRE") && (
                    <div className="ml-auto shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 text-xs font-bold text-orange-700 dark:text-orange-300">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      Rendez-vous le{" "}
                      {new Date(fiche.rdv_date).toLocaleDateString("fr-FR", {
                        weekday: "long", day: "numeric", month: "long", year: "numeric",
                      })}
                    </div>
                  )}
                </div>
                {/* Meta : localisation + saisi par + affecté à */}
                <div className="flex items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-2 flex-wrap">
                  {fiche.prospect_ville && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {fiche.prospect_ville}{fiche.prospect_cp ? ` · ${fiche.prospect_cp}` : ""}
                    </span>
                  )}
                  {creatorName && (
                    <span>Saisi par <span className="font-medium text-foreground/80">{creatorName}</span></span>
                  )}
                  {fiche.assigned_to && (() => {
                    const c = commercials.find((x) => x.id === fiche.assigned_to);
                    return c ? (
                      <span className="inline-flex items-center gap-1 font-medium text-orange-600 dark:text-orange-400">
                        <UserCheck className="w-3 h-3" />
                        {c.first_name} {c.last_name}
                      </span>
                    ) : null;
                  })()}
                </div>
              </div>
            </div>

            {/* Right: montant vedette (accepted) + actions */}
            {fiche.status === "ACCEPTEE" && fiche.montant_ht != null && (
              <div className="flex-shrink-0 text-right pl-2 sm:border-l sm:border-border sm:pl-5">
                <div className="font-heading text-2xl sm:text-3xl text-emerald-700 dark:text-emerald-400 tracking-tight leading-none">
                  {Number(fiche.montant_ht).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                </div>
                <div className="text-[10px] tracking-[1px] uppercase text-muted-foreground mt-1">
                  Montant HT signé
                </div>
              </div>
            )}
          </div>

          {/* Actions — barre visible sous le hero */}
          <div className="mt-5 pt-5 border-t border-border space-y-3">

            <div className="flex items-center gap-2 flex-wrap">
              <DownloadFicheButton
                fiche={fiche}
                referentNom={creatorName || "Référent"}
                commercialNom={
                  fiche.assigned_to
                    ? commercials.find((c) => c.id === fiche.assigned_to)
                        ? `${commercials.find((c) => c.id === fiche.assigned_to)!.first_name} ${commercials.find((c) => c.id === fiche.assigned_to)!.last_name}`
                        : undefined
                    : undefined
                }
                photoUrls={photos.map((p) => p.signedUrl).filter(Boolean)}
              />

              {profile?.role === "ADMIN" && (
                <Button variant="outline" size="sm"
                  onClick={() => { setDeleteMotif(""); setShowDeleteConfirm(true); }}
                  className="rounded-xl gap-2 text-destructive hover:text-destructive border-destructive/30 hover:bg-red-50 dark:hover:bg-red-950/30"
                  aria-label="Supprimer cette fiche">
                  <Trash2 className="w-4 h-4" />Supprimer la fiche
                </Button>
              )}
              {(profile?.role === "PROSPECTEUR" || profile?.role === "CHEF_EQUIPE") && fiche.created_by === profile.id && fiche.status === "BROUILLON" && (
                <Button variant="outline" size="sm"
                  onClick={() => { setDeleteMotif(""); setShowDeleteConfirm(true); }}
                  className="rounded-xl gap-2 text-destructive hover:text-destructive border-destructive/30 hover:bg-red-50 dark:hover:bg-red-950/30"
                  aria-label="Supprimer cette fiche">
                  <Trash2 className="w-4 h-4" />Supprimer la fiche
                </Button>
              )}

              {fiche.status === "BROUILLON" && canEdit && (
                <Button size="sm" onClick={() => router.push(`/fiches/${fiche.id}/modifier`)}
                  className="rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white gap-2">
                  <Pencil className="w-4 h-4" />Reprendre la saisie
                </Button>
              )}

              {fiche.status !== "BROUILLON" && profile &&
                (profile.role === "ADMIN" || profile.role === "COMMERCIAL") && canEdit && (
                  <Button size="sm" variant="outline" onClick={() => router.push(`/fiches/${fiche.id}/modifier`)}
                    className="rounded-xl gap-2">
                    <Pencil className="w-4 h-4" />Modifier
                  </Button>
                )}

              {/* Menu déroulant de changement de statut (Direction & Commercial) */}
              {availableTransitions.length > 0 && (profile?.role === "ADMIN" || profile?.role === "COMMERCIAL") && (
                <div className="relative" data-status-dropdown>
                  <Button size="sm" disabled={transitioning}
                    onClick={() => setShowStatusDropdown((v) => !v)}
                    className="rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white gap-2">
                    {transitioning ? <Loader2 className="w-4 h-4 animate-spin" /> : "Changer le statut"}
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                  {showStatusDropdown && (
                    <div className="absolute right-0 top-full mt-1 w-64 bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] shadow-xl z-50 overflow-hidden">
                      {availableTransitions.map((status) => {
                        const dropdownLabels: Partial<Record<FicheStatus, string>> = {
                          RETRACTATION: "Attente Acceptation Client",
                          ACCEPTEE: "Acceptation Client",
                          REFUSEE: "Refus Client",
                          ARCHIVEE: "Archivé",
                          RDV_A_REPRENDRE: "Client absent — RDV à reprendre",
                        };
                        const dropdownColors: Partial<Record<FicheStatus, string>> = {
                          RETRACTATION: "text-purple-600",
                          ACCEPTEE: "text-emerald-600",
                          REFUSEE: "text-red-600",
                          ARCHIVEE: "text-slate-500",
                          SOUMISE: "text-blue-600",
                          RDV_A_REPRENDRE: "text-amber-600",
                        };
                        return (
                          <button key={status} type="button"
                            onClick={() => { setShowStatusDropdown(false); setPendingStatus(status); setStatusComment(""); }}
                            className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-secondary transition-colors ${dropdownColors[status] || "text-foreground"}`}>
                            {dropdownLabels[status] || STATUS_LABELS[status]}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              {/* Badge statique RDV_A_REPRENDRE pour le commercial (aucune transition disponible) */}
              {profile?.role === "COMMERCIAL" && fiche.status === "RDV_A_REPRENDRE" && availableTransitions.length === 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F97316] text-white text-sm font-medium">
                  <UserX className="w-4 h-4" />
                  RDV à reprendre
                </div>
              )}

              {/* Bouton Modifier le rendez-vous — visible si rdv_date défini et utilisateur autorisé */}
              {fiche.rdv_date && profile && canEditRdvDate(profile.role, profile.id, fiche.created_by, fiche.assigned_to, fiche.status) && (
                <Button size="sm" variant="outline"
                  onClick={() => setShowRdvEditDialog(true)}
                  className="ml-auto rounded-xl gap-2 bg-secondary text-foreground hover:bg-secondary/80 border-border">
                  <Calendar className="w-4 h-4" />Modifier le rendez-vous
                </Button>
              )}

              {/* Boutons classiques pour le référent */}
              {availableTransitions.length > 0 && (profile?.role === "PROSPECTEUR" || profile?.role === "CHEF_EQUIPE") && fiche.created_by === profile?.id && availableTransitions.map((status) => (
                <Button key={status}
                  onClick={() => { setPendingStatus(status); setStatusComment(""); }}
                  disabled={transitioning} size="sm"
                  className="rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white">
                  {transitioning ? <Loader2 className="w-4 h-4 animate-spin" /> : STATUS_LABELS[status]}
                </Button>
              ))}
            </div>

              {/* Bouton vert "Valider la fiche" — ADMIN + SOUMISE uniquement */}
              {profile?.role === "ADMIN" && fiche.status === "SOUMISE" && (
                <Button size="sm" disabled={transitioning}
                  onClick={() => setShowValidateSansAffectModal(true)}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-2 w-full sm:w-auto">
                  {transitioning ? <Loader2 className="w-4 h-4 animate-spin" /> : (<><CheckCircle2 className="w-4 h-4" />Valider la fiche</>)}
                </Button>
              )}

              {/* Section RDV à reprendre — référent uniquement */}
              {fiche.status === "RDV_A_REPRENDRE" && (profile?.role === "PROSPECTEUR" || profile?.role === "CHEF_EQUIPE" || profile?.role === "ADMIN") && (
                <div className="w-full bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-700 rounded-2xl px-4 py-3 space-y-2">
                  <p className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-2">
                    <UserX className="w-4 h-4" /> Client absent — RDV à reprendre
                  </p>
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    Le commercial n&apos;a pas pu rencontrer le client. Mettez à jour la date de rendez-vous sur la fiche puis confirmez ci-dessous.
                  </p>
                  <Button size="sm" disabled={transitioning}
                    onClick={() => { setPendingStatus("AFFECTEE"); setStatusComment(""); }}
                    className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white gap-2 mt-1">
                    {transitioning ? <Loader2 className="w-4 h-4 animate-spin" /> : (<><Calendar className="w-4 h-4" />Nouveau RDV fixé</>)}
                  </Button>
                </div>
              )}

              {/* Bouton vert "Affecter à un commercial" — ADMIN + VALIDEE uniquement */}
              {profile?.role === "ADMIN" && fiche.status === "VALIDEE" && (
                <div className="w-full bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl px-4 py-3 space-y-3">
                  <p className="text-xs uppercase tracking-wide text-emerald-600 font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Fiche validée — Affecter à un commercial
                  </p>
                  <div className="flex items-center gap-3">
                    <Select value={assignCommercialId} onValueChange={(v) => setAssignCommercialId(v ?? "")}>
                      <SelectTrigger className="flex-1 rounded-xl bg-white dark:bg-background">
                        <SelectValue placeholder="Choisir un commercial…">
                          {assignCommercialId
                            ? (() => { const c = commercials.find((x) => x.id === assignCommercialId); return c ? `${c.first_name} ${c.last_name}` : "Choisir…"; })()
                            : "Choisir un commercial…"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {commercials.filter((c) => c.role === "COMMERCIAL").map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" disabled={!assignCommercialId || transitioning}
                      onClick={async () => {
                        if (!assignCommercialId) return;
                        setTransitioning(true);
                        try {
                          const { error } = await supabase.rpc("transition_fiche", { p_fiche_id: fiche.id, p_new_status: "AFFECTEE" as FicheStatus, p_assigned_to: assignCommercialId });
                          if (error) throw error;
                          const comm = commercials.find((c) => c.id === assignCommercialId);
                          const commName = comm ? `${comm.first_name} ${comm.last_name}` : "un commercial";
                          toast.success(`Fiche ${fiche.reference} validée et affectée à ${commName}`, { duration: 5000 });
                          window.dispatchEvent(new CustomEvent("phc:fiche-status-changed"));
                          fetchData();
                        } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Erreur"); }
                        finally { setTransitioning(false); }
                      }}
                      className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shrink-0">
                      {transitioning ? <Loader2 className="w-4 h-4 animate-spin" /> : (<><UserCheck className="w-4 h-4" />Affecter</>)}
                    </Button>
                  </div>
                </div>
              )}
          </div>
        </div>

        {/* ── Modifier l'affectation (AFFECTEE / RDV_A_REPRENDRE · direction uniquement) ──── */}
        {profile && canAssignFiche(profile.role) && (fiche.status === "AFFECTEE" || fiche.status === "RDV_A_REPRENDRE") && (
          <div data-no-print className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-2xl px-6 py-4 space-y-3">
            <div className="flex items-center gap-4">
              <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0">
                <UserCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-wide text-blue-500 dark:text-blue-400 font-semibold">Commercial affecté</p>
                <p className="text-sm font-bold text-blue-900 dark:text-blue-100 truncate">
                  {(() => {
                    const c = commercials.find((x) => x.id === fiche.assigned_to);
                    return c ? `${c.first_name} ${c.last_name}` : "—";
                  })()}
                </p>
              </div>
              {!showReassignPanel && (
                <Button
                  size="sm"
                  onClick={() => { setShowReassignPanel(true); setReassignCommercialId(""); }}
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white gap-2 shrink-0"
                >
                  <Pencil className="w-4 h-4" />
                  Modifier l&apos;affectation
                </Button>
              )}
            </div>

            {showReassignPanel && (
              <div className="flex items-center gap-3 pt-1 border-t border-blue-200 dark:border-blue-800">
                <Select value={reassignCommercialId} onValueChange={(v) => setReassignCommercialId(v ?? "")}>
                  <SelectTrigger className="flex-1 rounded-xl bg-white dark:bg-background">
                    <SelectValue placeholder="Choisir un autre commercial…">
                      {reassignCommercialId
                        ? (() => {
                            const c = commercials.find((x) => x.id === reassignCommercialId);
                            return c ? `${c.first_name} ${c.last_name}` : "Choisir un autre commercial…";
                          })()
                        : "Choisir un autre commercial…"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {commercials.filter((c) => c.role === "COMMERCIAL").map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.first_name} {c.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={() => { if (reassignCommercialId) setShowReassignConfirmModal(true); }}
                  disabled={!reassignCommercialId || transitioning}
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white shrink-0"
                >
                  Confirmer
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setShowReassignPanel(false); setReassignCommercialId(""); }}
                  className="rounded-xl shrink-0"
                >
                  Annuler
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── Annuler la validation (AFFECTEE · direction uniquement) ──── */}
        {fiche.status === "AFFECTEE" && profile?.role === "ADMIN" && (
          <div className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50/60 dark:bg-red-950/20 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                <p className="text-sm font-medium text-red-700 dark:text-red-300">Annuler la validation de cette fiche</p>
              </div>
              <Button
                size="sm"
                variant="destructive"
                className="rounded-xl"
                onClick={() => setShowAnnulationDialog(true)}
              >
                <Ban className="w-4 h-4 mr-1" />
                Annuler la validation
              </Button>
            </div>
          </div>
        )}

        <Dialog open={showAnnulationDialog} onOpenChange={setShowAnnulationDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                <AlertTriangle className="w-5 h-5" />
                Annuler la validation de la fiche
              </DialogTitle>
              <DialogDescription>
                La fiche reviendra en statut &quot;À valider&quot;. Le commercial ne sera plus affecté et le référent sera notifié.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <label className="text-sm font-medium">
                Motif de l&apos;annulation <span className="text-red-500">*</span>
              </label>
              <Textarea
                placeholder="Indiquez le motif de l'annulation de la validation…"
                value={annulationMotif}
                onChange={(e) => setAnnulationMotif(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="ghost"
                onClick={() => { setShowAnnulationDialog(false); setAnnulationMotif(""); }}
                className="rounded-xl"
              >
                Annuler
              </Button>
              <Button
                variant="destructive"
                disabled={!annulationMotif.trim() || transitioning}
                onClick={handleAnnulationValidation}
                className="rounded-xl"
              >
                {transitioning ? "Annulation en cours…" : "Confirmer l'annulation"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Two-column layout ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          <FicheMainContent
            fiche={fiche}
            villeData={villeData}
            editingRdvDate={editingRdvDate}
            setEditingRdvDate={setEditingRdvDate}
            rdvDateValue={rdvDateValue}
            setRdvDateValue={setRdvDateValue}
            profile={profile}
            supabase={supabase}
            setFiche={setFiche}
            photos={photos}
            signatureUrl={signatureUrl}
            referentSignatureUrl={referentSignatureUrl}
            commercials={commercials}
          />

          <FicheSidebar
            fiche={fiche}
            history={history}
            showHistory={showHistory}
            setShowHistory={setShowHistory}
            commercials={commercials}
          />
        </div>

        {/* ── Barre de validation bas de page — direction uniquement ───────── */}
        {fiche.status === "SOUMISE" && profile?.role === "ADMIN" && (
          <div data-no-print className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] px-6 py-4">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className={`flex items-center gap-1.5 font-medium ${isValidated ? "text-emerald-600" : "text-muted-foreground"}`}>
                <CheckCircle2 className="w-4 h-4" />
                {isValidated ? "Fiche validée" : "Non validée"}
              </span>
              <span className="text-border">|</span>
              <span className={`flex items-center gap-1.5 font-medium ${selectedCommercial ? "text-orange-600" : "text-muted-foreground"}`}>
                <UserCheck className="w-4 h-4" />
                {selectedCommercial
                  ? (() => {
                      const c = commercials.find((x) => x.id === selectedCommercial);
                      return c ? `${c.first_name} ${c.last_name}` : "Commercial sélectionné";
                    })()
                  : "Aucun commercial"}
              </span>
            </div>
            <Button
              onClick={handleFinaliserAffectation}
              disabled={transitioning}
              className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-2 font-semibold"
            >
              {transitioning
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <CheckCircle2 className="w-4 h-4" />}
              Valider la fiche
            </Button>
          </div>
        )}
      </div>

      {/* ── Dialog : suppression ──────────────────────────────────────────── */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="w-5 h-5" />Supprimer cette fiche ?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              La fiche <span className="font-semibold text-foreground">{fiche?.reference}</span> sera
              définitivement supprimée avec toutes ses photos. Cette action est irréversible.
            </p>
            <div className="space-y-1.5">
              <label htmlFor="delete-motif" className="text-sm font-medium">Motif de suppression <span className="text-destructive">*</span></label>
              <textarea
                id="delete-motif"
                value={deleteMotif}
                onChange={(e) => setDeleteMotif(e.target.value)}
                placeholder="Indiquez la raison de la suppression…"
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-destructive/30"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setShowDeleteConfirm(false)}>Annuler</Button>
            <Button onClick={handleDelete} disabled={deleting || !deleteMotif.trim()}
              className="bg-destructive hover:bg-destructive/90 text-white rounded-xl gap-2">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog : motif obligatoire pour tout changement de statut ───── */}
      <FicheStatusChangeDialog
        fiche={fiche}
        pendingStatus={pendingStatus}
        setPendingStatus={setPendingStatus}
        statusComment={statusComment}
        setStatusComment={setStatusComment}
        selectedMotifRefus={selectedMotifRefus}
        setSelectedMotifRefus={setSelectedMotifRefus}
        montantHtInput={montantHtInput}
        setMontantHtInput={setMontantHtInput}
        newRdvDate={newRdvDate}
        setNewRdvDate={setNewRdvDate}
        transitioning={transitioning}
        handleStatusChange={handleStatusChange}
      />

      {/* ── Dialog : rejet de validation (direction) ──────────────────────── */}
      <Dialog open={showRejetDialog} onOpenChange={(open) => { if (!open) { setShowRejetDialog(false); setRejetMotif(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <Ban className="w-5 h-5" />Rejeter la validation
            </DialogTitle>
            <DialogDescription>
              La fiche <span className="font-semibold">{fiche?.reference}</span> sera renvoyée en brouillon.
              Le référent recevra une notification avec votre motif.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl">
              <Ban className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 dark:text-red-300">
                Le motif est <span className="font-bold">obligatoire</span>. Il sera transmis au référent par notification et email.
              </p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="textarea-rejet" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Motif du rejet <span className="text-red-500">*</span>
              </label>
              <Textarea
                id="textarea-rejet"
                placeholder="Ex : Informations manquantes, photos insuffisantes, données incorrectes…"
                value={rejetMotif}
                onChange={(e) => setRejetMotif(e.target.value)}
                rows={4}
                className={`bg-card resize-none transition-colors ${
                  rejetMotif.trim().length === 0
                    ? "border-red-300 dark:border-red-700 focus-visible:ring-red-400/30"
                    : "border-emerald-300 dark:border-emerald-700"
                }`}
              />
              {rejetMotif.trim().length === 0 && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />Veuillez saisir un motif.
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => { setShowRejetDialog(false); setRejetMotif(""); }}>Annuler</Button>
            <Button
              onClick={handleRejetFiche}
              disabled={transitioning || !rejetMotif.trim()}
              className="bg-red-600 hover:bg-red-700 text-white rounded-xl gap-2"
            >
              {transitioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
              Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal : confirmation d'affectation ───────────────────────────── */}
      {(() => {
        const commercial = commercials.find((c) => c.id === selectedCommercial);
        const now = new Date();
        const dateStr = now.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
        const timeStr = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
        return (
          <Dialog open={showConfirmModal} onOpenChange={(open) => { if (!open) setShowConfirmModal(false); }}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />Confirmer l&apos;affectation
                </DialogTitle>
                <DialogDescription>
                  Vérifiez les informations avant de finaliser.
                </DialogDescription>
              </DialogHeader>

              <div className="py-2 space-y-3">
                {/* Récapitulatif */}
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-emerald-600/70 dark:text-emerald-400/70">Référent</p>
                      <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">{creatorName || "—"}</p>
                    </div>
                  </div>
                  <div className="h-px bg-emerald-200 dark:bg-emerald-800" />
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center shrink-0">
                      <UserCheck className="w-4 h-4 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-orange-600/70 dark:text-orange-400/70">Commercial affecté</p>
                      <p className="text-sm font-semibold text-foreground">
                        {commercial ? `${commercial.first_name} ${commercial.last_name}` : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="h-px bg-emerald-200 dark:bg-emerald-800" />
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center shrink-0">
                      <Calendar className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-blue-600/70 dark:text-blue-400/70">Date d&apos;affectation</p>
                      <p className="text-sm font-semibold text-foreground capitalize">{dateStr} à {timeStr}</p>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  Le référent et le commercial recevront chacun une notification.
                </p>
              </div>

              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setShowConfirmModal(false)}>Annuler</Button>
                <Button
                  disabled={transitioning}
                  onClick={async () => {
                    setShowConfirmModal(false);
                    await handleAssign(selectedCommercial);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-2 font-semibold"
                >
                  {transitioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Confirmer l&apos;affectation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* ── Modal : avertissement validation sans affectation ───────────── */}
      <Dialog open={showValidateSansAffectModal} onOpenChange={(open) => { if (!open) setShowValidateSansAffectModal(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5" />Valider sans affecter ?
            </DialogTitle>
            <DialogDescription>
              Vous allez valider cette fiche sans l&apos;affecter à un commercial.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4 space-y-2">
              <p className="text-sm text-amber-900 dark:text-amber-100 font-medium">
                La fiche sera marquée comme <span className="font-semibold">Validée</span> mais aucun commercial ne lui sera encore assigné.
              </p>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Une fois validée, pensez à revenir sur la fiche pour l&apos;affecter à un commercial afin qu&apos;elle puisse être traitée.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setShowValidateSansAffectModal(false)}>
              Annuler
            </Button>
            <Button
              disabled={transitioning}
              onClick={() => {
                setShowValidateSansAffectModal(false);
                setPendingStatus("VALIDEE" as FicheStatus);
                setStatusComment("");
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl gap-2 font-semibold"
            >
              <CheckCircle2 className="w-4 h-4" />
              Valider quand même
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal : confirmation de ré-affectation ───────────────────────── */}
      {(() => {
        const newCommercial = commercials.find((c) => c.id === reassignCommercialId);
        const oldCommercial = commercials.find((c) => c.id === fiche?.assigned_to);
        const now = new Date();
        const dateStr = now.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
        const timeStr = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
        return (
          <Dialog open={showReassignConfirmModal} onOpenChange={(open) => { if (!open) setShowReassignConfirmModal(false); }}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                  <UserCheck className="w-5 h-5" />Confirmer la modification d&apos;affectation
                </DialogTitle>
                <DialogDescription>
                  Vérifiez les informations avant de confirmer le changement.
                </DialogDescription>
              </DialogHeader>

              <div className="py-2 space-y-3">
                <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 p-4 space-y-3">
                  {oldCommercial && (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <UserCheck className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Commercial actuel</p>
                          <p className="text-sm font-semibold text-foreground line-through text-muted-foreground">
                            {oldCommercial.first_name} {oldCommercial.last_name}
                          </p>
                        </div>
                      </div>
                      <div className="h-px bg-blue-200 dark:bg-blue-800" />
                    </>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                      <UserCheck className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-blue-600/70 dark:text-blue-400/70">Nouveau commercial</p>
                      <p className="text-sm font-semibold text-foreground">
                        {newCommercial ? `${newCommercial.first_name} ${newCommercial.last_name}` : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="h-px bg-blue-200 dark:bg-blue-800" />
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center shrink-0">
                      <Calendar className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-blue-600/70 dark:text-blue-400/70">Date de modification</p>
                      <p className="text-sm font-semibold text-foreground capitalize">{dateStr} à {timeStr}</p>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  L&apos;ancien et le nouveau commercial recevront chacun une notification.
                </p>
              </div>

              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setShowReassignConfirmModal(false)}>Annuler</Button>
                <Button
                  disabled={transitioning}
                  onClick={async () => {
                    setShowReassignConfirmModal(false);
                    await handleReassign();
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-2 font-semibold"
                >
                  {transitioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                  Confirmer la modification
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* ── Dialog : modifier la date de rendez-vous depuis le hero ──────── */}
      {fiche && profile && (
        <RdvEditDialog
          open={showRdvEditDialog}
          onOpenChange={setShowRdvEditDialog}
          ficheId={fiche.id}
          currentRdvDate={fiche.rdv_date}
          organizationId={profile.organization_id}
          userId={profile.id}
          onSaved={(newDate) => setFiche({ ...fiche, rdv_date: newDate })}
        />
      )}
    </>
  );
}
