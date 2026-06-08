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
import type { FicheStatus, Fiche } from "@/types/database";
import Image from "next/image";
import { toast } from "sonner";
import {
  User, Home, Flame, Wind, Shield, Camera, FileText,
  Clock, ArrowLeft, UserCheck, Loader2, Pencil, Printer, Trash2,
  Phone, MapPin, Calendar, CheckCircle2, ShieldCheck,
} from "lucide-react";

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
  BROUILLON: { border: "border-l-slate-400",   iconBg: "bg-slate-100",   icon: "text-slate-500" },
  SOUMISE:   { border: "border-l-blue-500",    iconBg: "bg-blue-50",     icon: "text-blue-500" },
  AFFECTEE:  { border: "border-l-orange-500",  iconBg: "bg-orange-50",   icon: "text-orange-500" },
  ACCEPTEE:  { border: "border-l-emerald-500", iconBg: "bg-emerald-50",  icon: "text-emerald-600" },
  REFUSEE:   { border: "border-l-red-500",     iconBg: "bg-red-50",      icon: "text-red-500" },
  ARCHIVEE:  { border: "border-l-slate-300",   iconBg: "bg-slate-100",   icon: "text-slate-400" },
};

// ── Small helpers ─────────────────────────────────────────────────────────────

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
    <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
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

  const { profile } = useProfile();
  const router = useRouter();
  const supabase = createClient();

  const fetchData = useCallback(async () => {
    const [ficheData, historyData, photosData, commercialsData] = await Promise.all([
      getFicheById(supabase, id),
      getFicheHistory(supabase, id),
      getFichePhotos(supabase, id),
      getActiveCommercialsAndAdmins(supabase),
    ]);
    setFiche(ficheData);
    setHistory(historyData);
    setPhotos(photosData);
    setCommercials(commercialsData);
    if (ficheData?.created_by) {
      const name = await getProfileFullName(supabase, ficheData.created_by);
      if (name) setCreatorName(name);
    }
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
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
    const { error } = await supabase.rpc("transition_fiche", {
      p_fiche_id: fiche.id,
      p_new_status: "AFFECTEE",
      p_assigned_to: commercialId,
    });
    if (error) { toast.error("Affectation refusée : " + error.message); return; }
    toast.success("Fiche affectée avec succès");
    router.refresh();
    setFiche({ ...fiche, assigned_to: commercialId, status: "AFFECTEE" });
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

        {/* ── Hero card ──────────────────────────────────────────────────── */}
        <div className={`bg-card border border-border border-l-4 ${hero.border} rounded-2xl p-6`}>
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
                <p className="text-sm text-muted-foreground mt-1">{fiche.reference}</p>
                {creatorName && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Saisi par <span className="font-medium text-foreground">{creatorName}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm"
                onClick={() => window.open(`/fiches/${fiche.id}/imprimer`, "_blank")}
                className="rounded-xl gap-2" aria-label="Exporter en PDF">
                <Printer className="w-4 h-4" />PDF
              </Button>

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
                      <div key={photo.id} className="relative h-32 rounded-xl overflow-hidden bg-muted">
                        <Image
                          src={data.publicUrl}
                          alt={photo.original_name ?? ""}
                          fill
                          sizes="(max-width: 640px) 50vw, 33vw"
                          className="object-cover"
                        />
                      </div>
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
              </div>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun historique</p>
              ) : (
                <div className="space-y-0">
                  {history.map((entry, idx) => (
                    <div key={entry.id} className="relative pl-6">
                      {/* line */}
                      {idx < history.length - 1 && (
                        <div className="absolute left-[7px] top-4 bottom-0 w-[2px] bg-border" />
                      )}
                      {/* dot */}
                      <div className="absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full bg-primary/15 border-2 border-primary/40 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      </div>
                      <div className="pb-5">
                        <p className="text-sm font-medium leading-snug">{entry.action}</p>
                        {entry.comment && (
                          <p className="text-xs text-muted-foreground mt-1 italic">"{entry.comment}"</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {entry.profiles
                            ? `${entry.profiles.first_name} ${entry.profiles.last_name}`
                            : "Système"}
                          {" · "}
                          {new Date(entry.created_at).toLocaleDateString("fr-FR", {
                            day: "2-digit", month: "short", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Infos */}
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4 text-sm">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-0.5">Créée le</p>
                <p className="font-medium">
                  {new Date(fiche.created_at).toLocaleDateString("fr-FR", {
                    day: "2-digit", month: "long", year: "numeric",
                  })}
                </p>
              </div>
              <Separator />
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-0.5">Dernière modification</p>
                <p className="font-medium">
                  {new Date(fiche.updated_at).toLocaleDateString("fr-FR", {
                    day: "2-digit", month: "long", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              </div>
              {fiche.consentement_rgpd && (
                <>
                  <Separator />
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-medium">Consentement RGPD obtenu</span>
                  </div>
                </>
              )}
              {fiche.assigned_to && (
                <>
                  <Separator />
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-0.5">Commercial affecté</p>
                    <p className="font-medium">
                      {commercials.find((c) => c.id === fiche.assigned_to)
                        ? `${commercials.find((c) => c.id === fiche.assigned_to)!.first_name} ${commercials.find((c) => c.id === fiche.assigned_to)!.last_name}`
                        : "—"}
                    </p>
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

      {/* ── Dialog : commentaire changement de statut ─────────────────────── */}
      <Dialog open={pendingStatus !== null} onOpenChange={(open) => { if (!open) setPendingStatus(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Passer en : <span className="text-primary">{pendingStatus ? STATUS_LABELS[pendingStatus] : ""}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">
              Ajoutez un commentaire pour expliquer ce changement de statut (optionnel).
            </p>
            <Textarea
              placeholder="Motif, observations, informations complémentaires…"
              value={statusComment}
              onChange={(e) => setStatusComment(e.target.value)}
              rows={3}
              className="bg-card resize-none"
            />
          </div>
          <DialogFooter className="gap-2">
            <DialogClose>
              <Button type="button" variant="outline" className="rounded-xl">Annuler</Button>
            </DialogClose>
            <Button
              onClick={async () => {
                if (!pendingStatus) return;
                await handleStatusChange(pendingStatus, statusComment.trim() || undefined);
                setPendingStatus(null);
                setStatusComment("");
              }}
              disabled={transitioning}
              className="bg-[#F97316] hover:bg-[#EA580C] text-white rounded-xl gap-2"
            >
              {transitioning ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
