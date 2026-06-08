"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Topbar } from "@/components/layout/Topbar";
import { FicheStatusBadge } from "@/components/fiches/FicheStatusBadge";
import { createClient } from "@/lib/supabase/client";
import { getFichesForExport } from "@/lib/data/fiches";
import { toCsv, downloadCsv, type CsvColumn } from "@/lib/csv";
import { useProfile } from "@/lib/hooks/use-profile";
import { STATUS_LABELS } from "@/lib/permissions";
import type { FicheStatus } from "@/types/database";
import { toast } from "sonner";
import { Search, FilePlus, FileText, Filter, Loader2, Download } from "lucide-react";

type FicheCsvRow = {
  reference: string;
  statut: string;
  nom: string;
  prenom: string;
  adresse: string;
  code_postal: string;
  ville: string;
  telephone: string;
  date_visite: string;
  heure_visite: string;
  commercial: string;
  cree_le: string;
  modifie_le: string;
};

const CSV_COLUMNS: CsvColumn<FicheCsvRow>[] = [
  { key: "reference", label: "Référence" },
  { key: "statut", label: "Statut" },
  { key: "nom", label: "Nom" },
  { key: "prenom", label: "Prénom" },
  { key: "adresse", label: "Adresse" },
  { key: "code_postal", label: "Code postal" },
  { key: "ville", label: "Ville" },
  { key: "telephone", label: "Téléphone" },
  { key: "date_visite", label: "Date de visite" },
  { key: "heure_visite", label: "Heure de visite" },
  { key: "commercial", label: "Commercial" },
  { key: "cree_le", label: "Créée le" },
  { key: "modifie_le", label: "Modifiée le" },
];

const PAGE_SIZE = 20;

interface FicheRow { id: string; reference: string; status: FicheStatus; prospect_nom: string; prospect_prenom: string; prospect_ville: string; prospect_cp: string; updated_at: string; assigned_to_profile: { first_name: string; last_name: string } | null; }

export default function FichesPage() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") as FicheStatus | null;
  const { profile } = useProfile();
  const isProspecteur = profile?.role === "PROSPECTEUR";
  const [fiches, setFiches] = useState<FicheRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FicheStatus | "ALL">(initialStatus || "ALL");
  const [exporting, setExporting] = useState(false);
  const supabase = createClient();

  // Admin/commercial ne voient jamais les brouillons dans la liste
  const visibleStatuses: FicheStatus[] = isProspecteur
    ? ["BROUILLON", "SOUMISE", "AFFECTEE", "ACCEPTEE", "REFUSEE", "ARCHIVEE"]
    : ["SOUMISE", "AFFECTEE", "ACCEPTEE", "REFUSEE", "ARCHIVEE"];

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const fetchFiches = useCallback(async (pageToLoad = 0, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    let query = supabase
      .from("fiches")
      .select("id, reference, status, prospect_nom, prospect_prenom, prospect_ville, prospect_cp, updated_at, assigned_to_profile:profiles!fiches_assigned_to_fkey(first_name, last_name)")
      .order("updated_at", { ascending: false });

    if (statusFilter !== "ALL") {
      query = query.eq("status", statusFilter);
    } else if (!isProspecteur) {
      // Admin/commercial : exclure les brouillons de la vue globale
      query = query.neq("status", "BROUILLON");
    }

    // Prospecteur : ne voit que ses propres fiches
    if (isProspecteur && profile?.id) {
      query = query.eq("created_by", profile.id);
    }

    if (search) query = query.or(`prospect_nom.ilike.%${search}%,prospect_prenom.ilike.%${search}%,reference.ilike.%${search}%,prospect_ville.ilike.%${search}%`);

    const from = pageToLoad * PAGE_SIZE;
    const { data } = await query.range(from, from + PAGE_SIZE - 1);
    const rows = (data as unknown as FicheRow[]) || [];

    setFiches((prev) => (append ? [...prev, ...rows] : rows));
    setHasMore(rows.length === PAGE_SIZE);
    setPage(pageToLoad);
    if (append) setLoadingMore(false); else setLoading(false);
  }, [statusFilter, search, supabase, isProspecteur, profile?.id]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) fetchFiches(page + 1, true);
  }, [loadingMore, hasMore, page, fetchFiches]);

  // Export CSV de toutes les fiches du filtre courant (au-delà de la pagination)
  async function handleExport() {
    setExporting(true);
    try {
      const rows = await getFichesForExport(supabase, {
        statusFilter,
        isProspecteur,
        createdBy: profile?.id,
        search: search || undefined,
      });
      if (rows.length === 0) {
        toast.info("Aucune fiche à exporter");
        return;
      }
      const csvRows: FicheCsvRow[] = rows.map((f) => ({
        reference: f.reference,
        statut: STATUS_LABELS[f.status],
        nom: f.prospect_nom,
        prenom: f.prospect_prenom,
        adresse: f.prospect_adresse ?? "",
        code_postal: f.prospect_cp ?? "",
        ville: f.prospect_ville ?? "",
        telephone: f.prospect_telephone ?? "",
        date_visite: f.date_visite ? new Date(f.date_visite).toLocaleDateString("fr-FR") : "",
        heure_visite: f.heure_visite ?? "",
        commercial: f.assigned_to_profile
          ? `${f.assigned_to_profile.first_name} ${f.assigned_to_profile.last_name}`
          : "",
        cree_le: new Date(f.created_at).toLocaleDateString("fr-FR"),
        modifie_le: new Date(f.updated_at).toLocaleDateString("fr-FR"),
      }));
      const date = new Date().toISOString().slice(0, 10);
      downloadCsv(`fiches-${date}.csv`, toCsv(CSV_COLUMNS, csvRows));
      toast.success(`${rows.length} fiche${rows.length > 1 ? "s" : ""} exportée${rows.length > 1 ? "s" : ""}`);
    } catch {
      toast.error("Échec de l'export");
    } finally {
      setExporting(false);
    }
  }

  // Chargement initial + rechargement (page 0) à chaque changement de filtre/recherche
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFiches(0, false);
  }, [fetchFiches]);

  // Subscription temps réel : le libellé de statut se met à jour pour tous les profils
  useEffect(() => {
    const channel = supabase
      .channel("fiches-list-realtime")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "fiches" }, (payload) => {
        // Mise à jour locale instantanée du statut sans re-fetch complet
        if (payload.new?.id && payload.new?.status) {
          setFiches((prev) =>
            prev.map((f) =>
              f.id === payload.new.id
                ? { ...f, status: payload.new.status as FicheStatus, updated_at: payload.new.updated_at ?? f.updated_at }
                : f
            )
          );
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "fiches" }, () => {
        fetchFiches(); // nouvelle fiche → recharger la liste
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase, fetchFiches]);

  return (
    <>
      <Topbar title="Fiches de pré-visite" />
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Rechercher par nom, ville, référence..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-11 bg-card rounded-xl" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport} disabled={exporting} className="rounded-xl gap-2" aria-label="Exporter les fiches au format CSV">
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}Exporter CSV
            </Button>
            <Link href="/fiches/nouvelle"><Button className="bg-[#F97316] hover:bg-[#EA580C] text-white rounded-xl gap-2"><FilePlus className="w-4 h-4" />Nouvelle fiche</Button></Link>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button onClick={() => setStatusFilter("ALL")} aria-pressed={statusFilter === "ALL"} className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${statusFilter === "ALL" ? "bg-primary text-white" : "bg-card text-muted-foreground hover:bg-secondary border"}`}>
            <Filter className="w-4 h-4 inline mr-1" />Toutes
          </button>
          {visibleStatuses.map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} aria-pressed={statusFilter === s} className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${statusFilter === s ? "bg-primary text-white" : "bg-card text-muted-foreground hover:bg-secondary border"}`}>
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            {loading ? <div className="p-8 space-y-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-secondary/50 rounded-xl animate-pulse" />)}</div>
            : fiches.length === 0 ? <div className="text-center py-16 text-muted-foreground"><FileText className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="font-medium">Aucune fiche trouvée</p></div>
            : <div className="divide-y">{fiches.map((fiche) => (
              <Link key={fiche.id} href={`/fiches/${fiche.id}`}>
                <div className="flex items-center justify-between p-5 hover:bg-secondary/30 transition-colors cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center shrink-0"><FileText className="w-5 h-5 text-primary" /></div>
                    <div><p className="font-medium text-sm">{fiche.prospect_prenom} {fiche.prospect_nom}</p><p className="text-xs text-muted-foreground">{fiche.reference} · {fiche.prospect_ville} {fiche.prospect_cp}</p></div>
                  </div>
                  <div className="flex items-center gap-4">
                    {fiche.assigned_to_profile && <span className="text-xs text-muted-foreground hidden md:block">→ {fiche.assigned_to_profile.first_name} {fiche.assigned_to_profile.last_name}</span>}
                    <FicheStatusBadge status={fiche.status} />
                    <span className="text-xs text-muted-foreground hidden sm:block">{new Date(fiche.updated_at).toLocaleDateString("fr-FR")}</span>
                  </div>
                </div>
              </Link>
            ))}</div>}
          </CardContent>
        </Card>
        {!loading && hasMore && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={loadMore}
              disabled={loadingMore}
              className="rounded-xl gap-2"
            >
              {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Charger plus
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
