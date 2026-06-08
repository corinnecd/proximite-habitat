"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Topbar } from "@/components/layout/Topbar";
import { FicheStatusBadge } from "@/components/fiches/FicheStatusBadge";
import { createClient } from "@/lib/supabase/client";
import {
  getFicheById,
  getFicheHistory,
  getFichePhotos,
  getActiveCommercialsAndAdmins,
  deleteFicheCascade,
} from "@/lib/data/fiches";
import { getProfileFullName } from "@/lib/data/profiles";
import { useProfile } from "@/lib/hooks/use-profile";
import {
  getAvailableTransitions,
  canAssignFiche,
  canEditFiche,
  STATUS_LABELS,
} from "@/lib/permissions";
import type { FicheStatus, Fiche } from "@/types/database";
import Image from "next/image";
import { toast } from "sonner";
import {
  User, Home, Flame, Wind, Shield, Camera,
  Clock, ArrowLeft, UserCheck, Loader2, Pencil, Printer, Trash2,
} from "lucide-react";

interface HistoryEntry {
  id: string;
  action: string;
  old_status: FicheStatus | null;
  new_status: FicheStatus | null;
  comment: string | null;
  created_at: string;
  profiles: { first_name: string; last_name: string } | null;
}

interface PhotoEntry {
  id: string;
  storage_path: string;
  original_name: string | null;
}

interface ProfileEntry {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
}

export default function FicheDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  // Chargement initial
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  // Subscription temps réel sur cette fiche — statut mis à jour instantanément pour tous les profils
  useEffect(() => {
    const channel = supabase
      .channel(`fiche-detail-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "fiches", filter: `id=eq.${id}` },
        (payload) => {
          // Met à jour le statut localement sans re-fetch complet
          if (payload.new?.status) {
            setFiche((prev) => prev ? { ...prev, status: payload.new.status as FicheStatus } : prev);
          }
          // Recharge l'historique pour afficher le nouveau commentaire
          getFicheHistory(supabase, id).then(setHistory);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, supabase]);

  async function handleStatusChange(newStatus: FicheStatus, comment?: string) {
    if (!fiche || !profile) return;
    setTransitioning(true);

    // Transition validée et écrite côté serveur (fiche + historique + notification,
    // de façon atomique). Voir supabase/migrations/0003_rpc_transitions.sql.
    const { error } = await supabase.rpc("transition_fiche", {
      p_fiche_id: fiche.id,
      p_new_status: newStatus,
      p_comment: comment || null,
    });

    if (error) {
      toast.error("Transition refusée : " + error.message);
      setTransitioning(false);
      return;
    }

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

    // Affectation atomique côté serveur (fiche + historique + notification).
    const { error } = await supabase.rpc("transition_fiche", {
      p_fiche_id: fiche.id,
      p_new_status: "AFFECTEE",
      p_assigned_to: commercialId,
    });

    if (error) {
      toast.error("Affectation refusée : " + error.message);
      return;
    }

    toast.success("Fiche affectée avec succès");
    router.refresh();
    setFiche({ ...fiche, assigned_to: commercialId, status: "AFFECTEE" });
  }

  if (loading || !fiche) {
    return (
      <>
        <Topbar title="Détail de la fiche" />
        <div className="p-6 lg:p-8 animate-pulse space-y-4">
          <div className="h-32 bg-card rounded-xl" />
          <div className="h-64 bg-card rounded-xl" />
        </div>
      </>
    );
  }

  const availableTransitions = profile
    ? getAvailableTransitions(profile.role, fiche.status)
    : [];

  return (
    <>
      <Topbar title={fiche.reference} />
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => router.push("/fiches")} className="rounded-xl">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h2 className="font-heading text-2xl">
                {fiche.prospect_prenom} {fiche.prospect_nom}
              </h2>
              <p className="text-sm text-muted-foreground">{fiche.reference}</p>
              {creatorName && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Prospecteur : <span className="font-medium text-foreground">{creatorName}</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <FicheStatusBadge status={fiche.status} />

            {/* Export PDF */}
            <Button variant="outline" size="sm"
              onClick={() => window.open(`/fiches/${fiche.id}/imprimer`, "_blank")}
              className="rounded-xl gap-2">
              <Printer className="w-4 h-4" />PDF
            </Button>

            {/* Supprimer brouillon */}
            {fiche.status === "BROUILLON" && profile &&
              canEditFiche(profile.role, profile.id, fiche.created_by, fiche.assigned_to, fiche.status) && (
                <Button variant="outline" size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="rounded-xl gap-2 text-destructive hover:text-destructive border-destructive/30 hover:bg-red-50">
                  <Trash2 className="w-4 h-4" />Supprimer
                </Button>
              )}

            {/* Reprendre la saisie (brouillon — prospecteur/admin) */}
            {fiche.status === "BROUILLON" &&
              profile &&
              canEditFiche(profile.role, profile.id, fiche.created_by, fiche.assigned_to, fiche.status) && (
                <Button size="sm" onClick={() => router.push(`/fiches/${fiche.id}/modifier`)}
                  className="rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white gap-2">
                  <Pencil className="w-4 h-4" />Reprendre la saisie
                </Button>
              )}

            {/* Modifier la fiche (admin/commercial — fiches soumises, hors archivées) */}
            {fiche.status !== "BROUILLON" &&
              profile &&
              (profile.role === "ADMIN" || profile.role === "COMMERCIAL") &&
              canEditFiche(profile.role, profile.id, fiche.created_by, fiche.assigned_to, fiche.status) && (
                <Button size="sm" variant="outline" onClick={() => router.push(`/fiches/${fiche.id}/modifier`)}
                  className="rounded-xl gap-2">
                  <Pencil className="w-4 h-4" />Modifier la fiche
                </Button>
              )}

            {/* Transitions de statut → ouvre le dialog commentaire */}
            {availableTransitions.map((status) => (
              <Button key={status} onClick={() => { setPendingStatus(status); setStatusComment(""); }}
                disabled={transitioning} size="sm"
                className="rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white">
                {transitioning ? <Loader2 className="w-4 h-4 animate-spin" /> : STATUS_LABELS[status]}
              </Button>
            ))}
          </div>
        </div>

        {/* Assign to commercial (admin only) */}
        {profile &&
          canAssignFiche(profile.role) &&
          (fiche.status === "SOUMISE" || fiche.status === "AFFECTEE") && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-5 flex items-center gap-4">
                <UserCheck className="w-5 h-5 text-primary shrink-0" />
                <p className="text-sm font-medium">Affecter à :</p>
                <Select onValueChange={(v) => v && handleAssign(v)} value={fiche.assigned_to || ""}>
                  <SelectTrigger className="w-64 rounded-xl">
                    <SelectValue placeholder="Choisir un commercial" />
                  </SelectTrigger>
                  <SelectContent>
                    {commercials.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.first_name} {c.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Coordonnées */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="w-4 h-4" /> Coordonnées
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Nom</p>
                  <p className="font-medium">{fiche.prospect_nom}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Prénom</p>
                  <p className="font-medium">{fiche.prospect_prenom}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Adresse</p>
                  <p className="font-medium">
                    {fiche.prospect_adresse}, {fiche.prospect_cp}{" "}
                    {fiche.prospect_ville}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Téléphone</p>
                  <p className="font-medium">{fiche.prospect_telephone}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Disponibilités</p>
                  <div className="flex gap-1 flex-wrap">
                    {(fiche.disponibilites || []).map((j) => (
                      <Badge key={j} variant="secondary" className="text-xs">
                        {j}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Visite souhaitée</p>
                  <p className="font-medium">
                    {fiche.date_visite
                      ? new Date(fiche.date_visite).toLocaleDateString("fr-FR", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })
                      : "—"}
                    {fiche.heure_visite ? ` à ${fiche.heure_visite}` : ""}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Habitation */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Home className="w-4 h-4" /> Habitation
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Année construction</p>
                  <p className="font-medium">{fiche.annee_construction || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Surface chauffée</p>
                  <p className="font-medium">
                    {fiche.surface_chauffee ? `${fiche.surface_chauffee} m²` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Nb habitants</p>
                  <p className="font-medium">{fiche.nb_habitants || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">T° confort</p>
                  <p className="font-medium">
                    {fiche.temperature_confort ? `${fiche.temperature_confort}°C` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">En vente</p>
                  <p className="font-medium">
                    {fiche.maison_en_vente === true ? "Oui" : fiche.maison_en_vente === false ? "Non" : "—"}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Chauffage */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Flame className="w-4 h-4" /> Chauffage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  {(fiche.modes_chauffage || []).map((m) => (
                    <Badge key={m} variant="secondary">{m}</Badge>
                  ))}
                  {(fiche.systemes_chauffage || []).map((s) => (
                    <Badge key={s} variant="outline">{s}</Badge>
                  ))}
                </div>
                {fiche.cout_annuel && (
                  <p className="text-muted-foreground">
                    Coût annuel : <span className="text-foreground font-medium">{fiche.cout_annuel} €</span>
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Ventilation + Isolation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Wind className="w-4 h-4" /> Ventilation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex flex-wrap gap-2">
                    {(fiche.systemes_ventilation || []).map((v) => (
                      <Badge key={v} variant="secondary">{v}</Badge>
                    ))}
                  </div>
                  {fiche.age_ventilation && (
                    <p className="text-muted-foreground">Âge : {fiche.age_ventilation}</p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Shield className="w-4 h-4" /> Isolation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex flex-wrap gap-2">
                    {(fiche.nature_isolant || []).map((n) => (
                      <Badge key={n} variant="secondary">{n}</Badge>
                    ))}
                  </div>
                  {fiche.epaisseur_isolant && (
                    <p className="text-muted-foreground">
                      Épaisseur : {fiche.epaisseur_isolant}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Photos */}
            {photos.length > 0 && (
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Camera className="w-4 h-4" /> Photos ({photos.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {photos.map((photo) => {
                      const { data } = supabase.storage
                        .from("photos")
                        .getPublicUrl(photo.storage_path);
                      return (
                        <div key={photo.id} className="relative h-32 rounded-xl overflow-hidden">
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
                </CardContent>
              </Card>
            )}

            {/* Observations */}
            {fiche.observations && (
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Observations</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{fiche.observations}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar — History */}
          <div className="space-y-6">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="w-4 h-4" /> Historique
                </CardTitle>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucun historique
                  </p>
                ) : (
                  <div className="space-y-4">
                    {history.map((entry) => (
                      <div key={entry.id} className="relative pl-6 pb-4 border-l-2 border-border last:border-0">
                        <div className="absolute left-[-5px] top-0 w-2 h-2 rounded-full bg-primary" />
                        <p className="text-sm font-medium">{entry.action}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {entry.profiles
                            ? `${entry.profiles.first_name} ${entry.profiles.last_name}`
                            : "Système"}
                          {" · "}
                          {new Date(entry.created_at).toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Info card */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-5 space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Créée le</p>
                  <p className="font-medium">
                    {new Date(fiche.created_at).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <Separator />
                <div>
                  <p className="text-muted-foreground">Dernière modification</p>
                  <p className="font-medium">
                    {new Date(fiche.updated_at).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                {fiche.consentement_rgpd && (
                  <>
                    <Separator />
                    <Badge variant="secondary" className="bg-green-50 text-green-700">
                      Consentement RGPD obtenu
                    </Badge>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* ── Dialog : confirmation suppression ───────────────────────────── */}
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

      {/* ── Dialog : commentaire de changement de statut ─────────────────── */}
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
