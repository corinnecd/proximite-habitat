"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Topbar } from "@/components/layout/Topbar";
import { FicheStatusBadge } from "@/components/fiches/FicheStatusBadge";
import { createClient } from "@/lib/supabase/client";
import {
  getFicheById, getFicheHistory, getFichePhotos,
  getActiveCommercialsAndAdmins, deleteFicheCascade,
} from "@/lib/data/fiches";
import { getProfileFullName } from "@/lib/data/profiles";
import { useProfile } from "@/lib/hooks/use-profile";
import {
  getAvailableTransitions, canAssignFiche, canEditFiche, STATUS_LABELS,
} from "@/lib/permissions";
import { sendEmailFicheAffectee } from "@/lib/email";
import type { FicheStatus, Fiche } from "@/types/database";
import Image from "next/image";
import { toast } from "sonner";
import {
  User, Home, Flame, Wind, Shield, Camera, FileText,
  Clock, ArrowLeft, UserCheck, Loader2, Pencil, Trash2,
  Phone, MapPin, Calendar, CheckCircle2, ShieldCheck, AlertTriangle, Ban, Copy,
} from "lucide-react";
import { DownloadFicheButton } from "@/components/pdf/DownloadFicheButton";
import confetti from "canvas-confetti";

// ── Types ─────────────────────────────────────────────────────────────────────

interface HistoryEntry {
  id: string;
  action: string;
  old_status: FicheStatus | null;
  new_status: FicheStatus | null;
  comment: string | null;
  created_at: string;
  profiles: { first_name: string; last_name: string } | null;
}
interface PhotoEntry { id: string; storage_path: string; original_name: string | null; }
interface ProfileEntry { id: string; first_name: string; last_name: string; role: string; }

// ── Status accent colors (same palette as fiches list) ────────────────────────

const STATUS_HERO: Record<FicheStatus, { border: string; iconBg: string; icon: string }> = {
  BROUILLON: { border: "border-l-slate-400",   iconBg: "bg-slate-100 dark:bg-slate-800",      icon: "text-slate-500" },
  SOUMISE:   { border: "border-l-blue-500",    iconBg: "bg-blue-50 dark:bg-blue-950/40",      icon: "text-blue-500" },
  AFFECTEE:  { border: "border-l-orange-500",  iconBg: "bg-orange-50 dark:bg-orange-950/40",  icon: "text-orange-500" },
  ACCEPTEE:  { border: "border-l-emerald-500", iconBg: "bg-emerald-50 dark:bg-emerald-950/40", icon: "text-emerald-600 dark:text-emerald-400" },
  REFUSEE:   { border: "border-l-red-500",     iconBg: "bg-red-50 dark:bg-red-950/40",        icon: "text-red-500" },
  ARCHIVEE:  { border: "border-l-slate-300",   iconBg: "bg-slate-100 dark:bg-slate-800",      icon: "text-slate-400" },
};

// ── Small helpers ─────────────────────────────────────────────────────────────

function PhotoThumb({ url, name }: { url: string; name: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <div className="relative h-32 rounded-xl overflow-hidden bg-muted flex items-center justify-center">
        <span className="text-xs text-muted-foreground text-center px-2">Image indisponible</span>
      </div>
    );
  }
  return (
    <div className="relative h-32 rounded-xl overflow-hidden bg-muted group cursor-zoom-in">
      <Image
        src={url}
        alt={name}
        fill
        sizes="(max-width: 640px) 50vw, 33vw"
        className="object-cover transition-transform duration-300 group-hover:scale-105"
        onError={() => setBroken(true)}
      />
    </div>
  );
}

function SectionCard({
  icon, iconBg, iconColor, title, children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-4 hover:shadow-md transition-all duration-200">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
          <span className={iconColor}>{icon}</span>
        </div>
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-0.5">{label}</p>
      <div className="text-sm font-medium text-foreground">{value || <span className="text-muted-foreground/60">—</span>}</div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function FicheDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [fiche, setFiche] = useState<Fiche | null>(null);
  const [creatorName, setCreatorName] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [commercials, setCommercials] = useState<ProfileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<FicheStatus | null>(null);
  const [statusComment, setStatusComment] = useState("");
  const [showValidateDialog, setShowValidateDialog] = useState(false);
  const [selectedCommercial, setSelectedCommercial] = useState("");

  const { profile } = useProfile();
  const router = useRouter();
  const supabase = createClient();

  const fetchData = useCallback(async () => {
    try {
      const [ficheData, historyData, photosData, commercialsData] = await Promise.all([
        getFicheById(supabase, id),
        getFicheHistory(supabase, id),
        getFichePhotos(supabase, id),
        getActiveCommercialsAndAdmins(supabase),
      ]);
      setFiche(ficheData);
      if (ficheData?.reference) {
        document.title = `${ficheData.reference} · Proximité Habitat Conseil`;
      }
      setHistory(historyData);
      setPhotos(photosData);
      setCommercials(commercialsData);
      if (ficheData?.created_by) {
        const name = await getProfileFullName(supabase, ficheData.created_by);
        if (name) setCreatorName(name);
      }
    } catch (err) {
      console.error("fetchData error", err);
      toast.error("Erreur lors du chargement de la fiche");
    } finally {
      setLoading(false);
    }
  }, [id, supabase]);

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
        (payload) => {
          if (payload.new?.status) {
            setFiche((prev) => prev ? { ...prev, status: payload.new.status as FicheStatus } : prev);
          }
          getFicheHistory(supabase, id).then(setHistory);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, supabase]);

  async function handleStatusChange(newStatus: FicheStatus, comment?: string) {
    if (!fiche || !profile) return;
    setTransitioning(true);
    const { error } = await supabase.rpc("transition_fiche", {
      p_fiche_id: fiche.id,
      p_new_status: newStatus,
      p_comment: comment || null,
    });
    if (error) { toast.error("Transition refusée : " + error.message); setTransitioning(false); return; }
    setFiche({ ...fiche, status: newStatus });
    toast.success(`Statut changé : ${STATUS_LABELS[newStatus]}`);
    if (newStatus === "ACCEPTEE") {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ["#1E3A5F", "#F97316", "#10B981", "#F59E0B"] });
    }
    setTransitioning(false);
  }

  async function handleDelete() {
    if (!fiche || !profile) return;
    setDeleting(true);
    try {
      await deleteFicheCascade(supabase, fiche.id);
      toast.success("Brouillon supprimé");
      router.push("/");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la suppression");
      setDeleting(false);
    }
  }

  async function handleAssign(commercialId: string) {
    if (!fiche || !profile) return;
    setTransitioning(true);
    const { error } = await supabase.rpc("transition_fiche", {
      p_fiche_id: fiche.id,
      p_new_status: "AFFECTEE",
      p_assigned_to: commercialId,
    });
    if (error) { toast.error("Affectation refusée : " + error.message); setTransitioning(false); return; }
    toast.success("Fiche validée et affectée avec succès");
    setFiche({ ...fiche, assigned_to: commercialId, status: "AFFECTEE" });
    setTransitioning(false);

    // Email au commercial (non bloquant)
    const commercial = commercials.find((c) => c.id === commercialId);
    if (commercial) {
      const { data: commProfile } = await supabase
        .from("profiles")
        .select("email, first_name")
        .eq("id", commercialId)
        .single();
      if (commProfile) {
        await sendEmailFicheAffectee({
          ficheId: fiche.id,
          reference: fiche.reference,
          commercialPrenom: commProfile.first_name,
          commercialEmail: commProfile.email,
        });
      }
    }

    router.refresh();
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading || !fiche) {
    return (
      <>
        <Topbar title="Détail de la fiche" />
        <div className="p-6 lg:p-8 space-y-4 animate-pulse">
          <div className="h-36 bg-card rounded-2xl border border-border" />
          <div className="h-48 bg-card rounded-2xl border border-border" />
          <div className="h-32 bg-card rounded-2xl border border-border" />
        </div>
      </>
    );
  }

  const availableTransitions = profile ? getAvailableTransitions(profile.role, fiche.status) : [];
  const hero = STATUS_HERO[fiche.status];
  const canEdit = profile && canEditFiche(profile.role, profile.id, fiche.created_by, fiche.assigned_to, fiche.status);

  return (
    <>
      <Topbar title={fiche.reference} />
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">

        {/* ── Bannière "Fiche à valider" — visible direction uniquement ──── */}
        {fiche.status === "SOUMISE" && profile?.role === "ADMIN" && (
          <div className="flex items-center gap-3 px-5 py-4 bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800 rounded-2xl">
            <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/50 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm text-red-700 dark:text-red-400 uppercase tracking-wide">
                Fiche à valider
              </p>
              <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-0.5">
                Cette fiche a été soumise par{" "}
                <span className="font-semibold">{creatorName || "un prospecteur"}</span>
                {" "}et attend votre affectation à un commercial.
              </p>
            </div>
            <Button
              onClick={() => { setSelectedCommercial(""); setShowValidateDialog(true); }}
              className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-2 font-semibold"
            >
              <CheckCircle2 className="w-4 h-4" />
              Valider la fiche
            </Button>
          </div>
        )}

        {/* ── Hero card ──────────────────────────────────────────────────── */}
        <div className={`bg-card/80 backdrop-blur-sm border border-border border-l-4 ${hero.border} rounded-2xl p-6 shadow-sm`}>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">

            {/* Left: back + identity */}
            <div className="flex items-start gap-4">
              <Button variant="outline" size="sm" onClick={() => router.push("/fiches")}
                className="rounded-xl mt-0.5 shrink-0" aria-label="Retour à la liste">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="font-heading text-2xl leading-tight">
                    {fiche.prospect_prenom} {fiche.prospect_nom}
                  </h2>
                  <FicheStatusBadge status={fiche.status} />
                </div>
                <button
                  type="button"
                  title="Copier la référence"
                  onClick={() => {
                    navigator.clipboard.writeText(fiche.reference).then(() => {
                      toast.success("Référence copiée !", { duration: 2000 });
                    });
                  }}
                  className="group flex items-center gap-1.5 text-sm text-muted-foreground mt-1 hover:text-foreground transition-colors"
                >
                  {fiche.reference}
                  <Copy className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity" />
                </button>
                {creatorName && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Saisi par <span className="font-medium text-foreground">{creatorName}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <DownloadFicheButton
                fiche={fiche}
                prospecteurNom={creatorName || "Prospecteur"}
                commercialNom={
                  fiche.assigned_to
                    ? commercials.find((c) => c.id === fiche.assigned_to)
                        ? `${commercials.find((c) => c.id === fiche.assigned_to)!.first_name} ${commercials.find((c) => c.id === fiche.assigned_to)!.last_name}`
                        : undefined
                    : undefined
                }
                photoUrls={photos.map((p) => supabase.storage.from("photos").getPublicUrl(p.storage_path).data.publicUrl)}
              />

              {fiche.status === "BROUILLON" && canEdit && (
                <Button variant="outline" size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="rounded-xl gap-2 text-destructive hover:text-destructive border-destructive/30 hover:bg-red-50 dark:hover:bg-red-950/30"
                  aria-label="Supprimer ce brouillon">
                  <Trash2 className="w-4 h-4" />Supprimer
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

              {availableTransitions.map((status) => (
                <Button key={status}
                  onClick={() => { setPendingStatus(status); setStatusComment(""); }}
                  disabled={transitioning} size="sm"
                  className="rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white">
                  {transitioning ? <Loader2 className="w-4 h-4 animate-spin" /> : STATUS_LABELS[status]}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Assign card ────────────────────────────────────────────────── */}
        {profile && canAssignFiche(profile.role) &&
          (fiche.status === "SOUMISE" || fiche.status === "AFFECTEE") && (
            <div className="bg-card border border-border rounded-2xl px-6 py-4 flex items-center gap-4">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <UserCheck className="w-5 h-5 text-primary" />
              </div>
              <p className="text-sm font-medium">Affecter à un commercial</p>
              <Select onValueChange={(v) => v && handleAssign(v)} value={fiche.assigned_to || ""}>
                <SelectTrigger className="w-56 rounded-xl ml-auto">
                  <SelectValue placeholder="Choisir…" />
                </SelectTrigger>
                <SelectContent>
                  {commercials.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

        {/* ── Two-column layout ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Main content */}
          <div className="lg:col-span-2 space-y-4">

            {/* Coordonnées */}
            <SectionCard
              icon={<User className="w-4 h-4" />}
              iconBg="bg-blue-50 dark:bg-blue-950/30"
              iconColor="text-blue-600"
              title="Coordonnées du prospect"
            >
              <div className="grid grid-cols-2 gap-4">
                <DataRow label="Nom" value={fiche.prospect_nom} />
                <DataRow label="Prénom" value={fiche.prospect_prenom} />
                <div className="col-span-2">
                  <DataRow
                    label="Adresse"
                    value={
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        {fiche.prospect_adresse}, {fiche.prospect_cp} {fiche.prospect_ville}
                      </span>
                    }
                  />
                </div>
                <DataRow
                  label="Téléphone"
                  value={
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      {fiche.prospect_telephone}
                    </span>
                  }
                />
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Disponibilités</p>
                  <div className="flex gap-1 flex-wrap">
                    {(fiche.disponibilites || []).length > 0
                      ? (fiche.disponibilites || []).map((j) => (
                          <Badge key={j} variant="secondary" className="text-xs rounded-lg">{j}</Badge>
                        ))
                      : <span className="text-sm text-muted-foreground/60">—</span>
                    }
                  </div>
                </div>
                <div className="col-span-2">
                  <DataRow
                    label="Visite souhaitée"
                    value={
                      fiche.date_visite ? (
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          {new Date(fiche.date_visite).toLocaleDateString("fr-FR", {
                            weekday: "long", day: "numeric", month: "long", year: "numeric",
                          })}
                          {fiche.heure_visite && ` à ${fiche.heure_visite}`}
                        </span>
                      ) : null
                    }
                  />
                </div>
              </div>
            </SectionCard>

            {/* Habitation */}
            <SectionCard
              icon={<Home className="w-4 h-4" />}
              iconBg="bg-primary/10"
              iconColor="text-primary"
              title="Caractéristiques du logement"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <DataRow label="Année construction" value={fiche.annee_construction} />
                <DataRow label="Année emménagement" value={fiche.annee_emmenagement} />
                <DataRow label="Surface chauffée" value={fiche.surface_chauffee ? `${fiche.surface_chauffee} m²` : null} />
                <DataRow label="Nb habitants" value={fiche.nb_habitants} />
                <DataRow label="T° confort" value={fiche.temperature_confort ? `${fiche.temperature_confort} °C` : null} />
                <DataRow
                  label="Maison en vente"
                  value={
                    fiche.maison_en_vente === true ? (
                      <span className="text-orange-600 font-semibold">Oui</span>
                    ) : fiche.maison_en_vente === false ? "Non" : null
                  }
                />
              </div>
            </SectionCard>

            {/* Chauffage */}
            <SectionCard
              icon={<Flame className="w-4 h-4" />}
              iconBg="bg-orange-50 dark:bg-orange-950/30"
              iconColor="text-orange-500"
              title="Chauffage"
            >
              <div className="space-y-3">
                {(fiche.modes_chauffage || []).length > 0 || (fiche.systemes_chauffage || []).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {(fiche.modes_chauffage || []).map((m) => (
                      <Badge key={m} variant="secondary" className="rounded-lg">{m}</Badge>
                    ))}
                    {(fiche.systemes_chauffage || []).map((s) => (
                      <Badge key={s} variant="outline" className="rounded-lg">{s}</Badge>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground/60">Non renseigné</p>}
                <div className="grid grid-cols-2 gap-4 pt-1">
                  <DataRow label="Consommation" value={fiche.consommation} />
                  <DataRow label="Coût annuel" value={fiche.cout_annuel ? `${fiche.cout_annuel} €` : null} />
                </div>
              </div>
            </SectionCard>

            {/* Ventilation + Isolation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SectionCard
                icon={<Wind className="w-4 h-4" />}
                iconBg="bg-cyan-50 dark:bg-cyan-950/30"
                iconColor="text-cyan-600"
                title="Ventilation"
              >
                <div className="space-y-2">
                  {(fiche.systemes_ventilation || []).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {(fiche.systemes_ventilation || []).map((v) => (
                        <Badge key={v} variant="secondary" className="rounded-lg">{v}</Badge>
                      ))}
                    </div>
                  ) : <p className="text-sm text-muted-foreground/60">Non renseigné</p>}
                  <DataRow label="Âge" value={fiche.age_ventilation} />
                </div>
              </SectionCard>

              <SectionCard
                icon={<Shield className="w-4 h-4" />}
                iconBg="bg-emerald-50 dark:bg-emerald-950/30"
                iconColor="text-emerald-600"
                title="Isolation & Toiture"
              >
                <div className="space-y-2">
                  {(fiche.nature_isolant || []).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {(fiche.nature_isolant || []).map((n) => (
                        <Badge key={n} variant="secondary" className="rounded-lg">{n}</Badge>
                      ))}
                    </div>
                  ) : <p className="text-sm text-muted-foreground/60">Non renseigné</p>}
                  <DataRow label="Épaisseur" value={fiche.epaisseur_isolant} />
                  {(fiche.materiaux_toiture || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {(fiche.materiaux_toiture || []).map((m) => (
                        <Badge key={m} variant="outline" className="rounded-lg text-xs">{m}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </SectionCard>
            </div>

            {/* Photos */}
            {photos.length > 0 && (
              <SectionCard
                icon={<Camera className="w-4 h-4" />}
                iconBg="bg-slate-100 dark:bg-slate-800"
                iconColor="text-slate-600"
                title={`Photos (${photos.length})`}
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {photos.map((photo) => {
                    const { data } = supabase.storage.from("photos").getPublicUrl(photo.storage_path);
                    return (
                      <PhotoThumb key={photo.id} url={data.publicUrl} name={photo.original_name ?? ""} />
                    );
                  })}
                </div>
              </SectionCard>
            )}

            {/* Observations */}
            {fiche.observations && (
              <SectionCard
                icon={<FileText className="w-4 h-4" />}
                iconBg="bg-slate-100 dark:bg-slate-800"
                iconColor="text-slate-600"
                title="Observations"
              >
                <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                  {fiche.observations}
                </p>
              </SectionCard>
            )}
          </div>

          {/* ── Sidebar ──────────────────────────────────────────────────── */}
          <div className="space-y-4">

            {/* Historique */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-primary" />
                </div>
                <h3 className="font-semibold text-sm">Historique</h3>
                {history.length > 0 && (
                  <span className="ml-auto text-xs text-muted-foreground">{history.length} action{history.length > 1 ? "s" : ""}</span>
                )}
              </div>
              {history.length === 0 ? (
                <div className="flex flex-col items-center py-6 gap-2 text-muted-foreground">
                  <Clock className="w-8 h-8 opacity-20" />
                  <p className="text-sm">Aucun historique</p>
                </div>
              ) : (
                <div className="space-y-0">
                  {history.map((entry, idx) => {
                    // Couleur du point selon le nouveau statut
                    const dotColors: Record<string, string> = {
                      SOUMISE:  "border-blue-500 bg-blue-50",
                      AFFECTEE: "border-orange-500 bg-orange-50",
                      ACCEPTEE: "border-emerald-500 bg-emerald-50",
                      REFUSEE:  "border-red-500 bg-red-50",
                      ARCHIVEE: "border-slate-400 bg-slate-50",
                      BROUILLON:"border-slate-400 bg-slate-50",
                    };
                    const innerColors: Record<string, string> = {
                      SOUMISE:  "bg-blue-500",
                      AFFECTEE: "bg-orange-500",
                      ACCEPTEE: "bg-emerald-500",
                      REFUSEE:  "bg-red-500",
                      ARCHIVEE: "bg-slate-400",
                      BROUILLON:"bg-slate-400",
                    };
                    const dotClass = entry.new_status
                      ? (dotColors[entry.new_status] ?? "border-primary/40 bg-primary/10")
                      : (idx === 0 ? "border-[#F97316] bg-[#F97316]/10" : "border-primary/40 bg-primary/10");
                    const innerClass = entry.new_status
                      ? (innerColors[entry.new_status] ?? "bg-primary")
                      : (idx === 0 ? "bg-[#F97316]" : "bg-primary");
                    const statusLabels: Record<string, string> = {
                      BROUILLON: "Brouillon", SOUMISE: "À valider", AFFECTEE: "Affectée",
                      ACCEPTEE: "Acceptée", REFUSEE: "Refusée", ARCHIVEE: "Archivée",
                    };
                    return (
                      <div
                        key={entry.id}
                        className="relative pl-6"
                        style={{ animation: "fadeSlideIn 0.2s ease both", animationDelay: `${idx * 50}ms` }}
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
                                entry.new_status === "ACCEPTEE" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                                entry.new_status === "REFUSEE"  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                                entry.new_status === "AFFECTEE" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" :
                                entry.new_status === "SOUMISE"  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                                entry.new_status === "ARCHIVEE" ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" :
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
              )}
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
            <div className="bg-card border border-border rounded-2xl p-5 space-y-3 text-sm hover:shadow-md transition-all duration-200">
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
        </div>
      </div>

      {/* ── Dialog : suppression ──────────────────────────────────────────── */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="w-5 h-5" />Supprimer ce brouillon ?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            La fiche <span className="font-semibold text-foreground">{fiche?.reference}</span> sera
            définitivement supprimée avec toutes ses photos. Cette action est irréversible.
          </p>
          <DialogFooter className="gap-2">
            <DialogClose>
              <Button type="button" variant="outline" className="rounded-xl">Annuler</Button>
            </DialogClose>
            <Button onClick={handleDelete} disabled={deleting}
              className="bg-destructive hover:bg-destructive/90 text-white rounded-xl gap-2">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog : valider la fiche (affecter depuis la bannière) ─────────── */}
      <Dialog open={showValidateDialog} onOpenChange={(open) => { if (!open) { setShowValidateDialog(false); setSelectedCommercial(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
              Valider et affecter la fiche
            </DialogTitle>
          </DialogHeader>
          <div className="py-3 space-y-4">
            <p className="text-sm text-muted-foreground">
              Sélectionnez le commercial à qui affecter la fiche{" "}
              <span className="font-semibold text-foreground">{fiche?.reference}</span>.
              Le prospecteur et le commercial recevront une notification.
            </p>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Commercial
              </label>
              <Select value={selectedCommercial} onValueChange={(v) => setSelectedCommercial(v ?? "")}>
                <SelectTrigger className="rounded-xl bg-card">
                  <SelectValue placeholder="Choisir un commercial…" />
                </SelectTrigger>
                <SelectContent>
                  {commercials
                    .filter((c) => c.role === "COMMERCIAL")
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.first_name} {c.last_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <DialogClose render={<Button type="button" variant="outline" className="rounded-xl">Annuler</Button>} />
            <Button
              disabled={!selectedCommercial || transitioning}
              onClick={async () => {
                if (!selectedCommercial) return;
                await handleAssign(selectedCommercial);
                setShowValidateDialog(false);
                setSelectedCommercial("");
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-2"
            >
              {transitioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Confirmer la validation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog : motif de refus / commentaire de statut ─────────────── */}
      <Dialog open={pendingStatus !== null} onOpenChange={(open) => { if (!open) { setPendingStatus(null); setStatusComment(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${
              pendingStatus === "REFUSEE"
                ? "text-red-600 dark:text-red-400"
                : pendingStatus === "ACCEPTEE"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-foreground"
            }`}>
              {pendingStatus === "REFUSEE"
                ? <><Ban className="w-5 h-5" />Refuser la fiche</>
                : pendingStatus === "ACCEPTEE"
                  ? <><CheckCircle2 className="w-5 h-5" />Accepter la fiche</>
                  : <>Passer en : {pendingStatus ? STATUS_LABELS[pendingStatus] : ""}</>
              }
            </DialogTitle>
          </DialogHeader>

          <div className="py-2 space-y-3">
            {pendingStatus === "REFUSEE" ? (
              <>
                {/* Alerte motif obligatoire */}
                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl">
                  <Ban className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700 dark:text-red-300">
                    Le motif du refus est <span className="font-bold">obligatoire</span>. Il sera transmis au prospecteur et conservé dans l&apos;historique de la fiche.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Motif du refus <span className="text-red-500">*</span>
                  </label>
                  <Textarea
                    placeholder="Ex : Le client n'est pas propriétaire, logement non éligible, déjà équipé…"
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
                      <AlertTriangle className="w-3 h-3" />Veuillez saisir un motif de refus.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Commentaire optionnel pour ce changement de statut.
                </p>
                <Textarea
                  placeholder="Observations, informations complémentaires…"
                  value={statusComment}
                  onChange={(e) => setStatusComment(e.target.value)}
                  rows={3}
                  className="bg-card resize-none"
                />
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            <DialogClose>
              <Button type="button" variant="outline" className="rounded-xl">Annuler</Button>
            </DialogClose>
            <Button
              onClick={async () => {
                if (!pendingStatus) return;
                // Motif obligatoire pour REFUSEE
                if (pendingStatus === "REFUSEE" && !statusComment.trim()) {
                  toast.error("Veuillez saisir un motif de refus avant de confirmer.");
                  return;
                }
                await handleStatusChange(pendingStatus, statusComment.trim() || undefined);
                setPendingStatus(null);
                setStatusComment("");
              }}
              disabled={transitioning || (pendingStatus === "REFUSEE" && !statusComment.trim())}
              className={`rounded-xl gap-2 text-white ${
                pendingStatus === "REFUSEE"
                  ? "bg-red-600 hover:bg-red-700"
                  : pendingStatus === "ACCEPTEE"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-[#F97316] hover:bg-[#EA580C]"
              }`}
            >
              {transitioning
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : pendingStatus === "REFUSEE"
                  ? <Ban className="w-4 h-4" />
                  : pendingStatus === "ACCEPTEE"
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
    </>
  );
}
