"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Topbar } from "@/components/layout/Topbar";
import { FicheStatusBadge } from "@/components/fiches/FicheStatusBadge";
import { createClient } from "@/lib/supabase/client";
import { getFichesForExport } from "@/lib/data/fiches";
import { toCsv, downloadCsv, type CsvColumn } from "@/lib/csv";
import { useProfile } from "@/lib/hooks/use-profile";
import { STATUS_LABELS } from "@/lib/permissions";
import type { FicheStatus } from "@/types/database";
import { toast } from "sonner";
import {
  Search, FilePlus, FileText, Filter, Loader2, Download, Send,
  UserCheck, CheckCircle2, XCircle, Archive, Clock, CalendarRange, CalendarDays, X, AlertCircle,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

type PeriodFilter = "ALL" | "TODAY" | "WEEK" | "MONTH" | "QUARTER";

const PERIOD_LABELS: Record<PeriodFilter, string> = {
  ALL: "Toutes les dates", TODAY: "Aujourd'hui",
  WEEK: "Cette semaine", MONTH: "Ce mois", QUARTER: "Ce trimestre",
};

function getPeriodDates(period: PeriodFilter): { from: string; to: string } | null {
  if (period === "ALL") return null;
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (period === "TODAY") {
    const today = fmt(now);
    return { from: today, to: today };
  }
  if (period === "WEEK") {
    const day = now.getDay() === 0 ? 6 : now.getDay() - 1; // lundi=0
    const monday = new Date(now); monday.setDate(now.getDate() - day);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    return { from: fmt(monday), to: fmt(sunday) };
  }
  if (period === "MONTH") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: fmt(from), to: fmt(to) };
  }
  if (period === "QUARTER") {
    const q = Math.floor(now.getMonth() / 3);
    const from = new Date(now.getFullYear(), q * 3, 1);
    const to   = new Date(now.getFullYear(), q * 3 + 3, 0);
    return { from: fmt(from), to: fmt(to) };
  }
  return null;
}

type FicheCsvRow = {
  reference: string; statut: string; nom: string; prenom: string;
  adresse: string; code_postal: string; ville: string; telephone: string;
  date_visite: string; heure_visite: string; commercial: string;
  cree_le: string; modifie_le: string;
};

const CSV_COLUMNS: CsvColumn<FicheCsvRow>[] = [
  { key: "reference", label: "Référence" }, { key: "statut", label: "Statut" },
  { key: "nom", label: "Nom" }, { key: "prenom", label: "Prénom" },
  { key: "adresse", label: "Adresse" }, { key: "code_postal", label: "Code postal" },
  { key: "ville", label: "Ville" }, { key: "telephone", label: "Téléphone" },
  { key: "date_visite", label: "Date de visite" }, { key: "heure_visite", label: "Heure de visite" },
  { key: "commercial", label: "Commercial" }, { key: "cree_le", label: "Créée le" },
  { key: "modifie_le", label: "Modifiée le" },
];

const PAGE_SIZE = 100;
const VISIBLE_INIT = 6;

const STATUS_CARD_STYLES: Record<FicheStatus, { border: string; icon: string; iconBg: string; Icon: React.ElementType }> = {
  BROUILLON:    { border: "border-l-slate-400",   icon: "text-slate-500",   iconBg: "bg-slate-100 dark:bg-slate-800",         Icon: Clock },
  SOUMISE:      { border: "border-l-blue-500",    icon: "text-blue-500",    iconBg: "bg-blue-50 dark:bg-blue-950/40",         Icon: Send },
  AFFECTEE:     { border: "border-l-orange-500",  icon: "text-orange-500",  iconBg: "bg-orange-50 dark:bg-orange-950/40",     Icon: UserCheck },
  ACCEPTEE:     { border: "border-l-emerald-500", icon: "text-emerald-600", iconBg: "bg-emerald-50 dark:bg-emerald-950/40",   Icon: CheckCircle2 },
  RETRACTATION: { border: "border-l-purple-500",  icon: "text-purple-600",  iconBg: "bg-purple-50 dark:bg-purple-950/40",     Icon: AlertCircle },
  REFUSEE:      { border: "border-l-red-500",     icon: "text-red-500",     iconBg: "bg-red-50 dark:bg-red-950/40",           Icon: XCircle },
  ARCHIVEE:     { border: "border-l-slate-400",   icon: "text-slate-400",   iconBg: "bg-slate-100 dark:bg-slate-800",         Icon: Archive },
};

interface FicheRow {
  id: string; reference: string; status: FicheStatus;
  prospect_nom: string; prospect_prenom: string; prospect_ville: string; prospect_cp: string;
  updated_at: string; created_at: string;
  assigned_to_profile: { first_name: string; last_name: string } | null;
  created_by_profile: { first_name: string; last_name: string } | null;
}

interface ProfileOption { id: string; first_name: string; last_name: string; }

export default function FichesPage() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") as FicheStatus | null;
  const { profile } = useProfile();
  const isProspecteur = profile?.role === "PROSPECTEUR";
  const isAdmin = profile?.role === "ADMIN";

  const [fiches, setFiches] = useState<FicheRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [visibleCount, setVisibleCount] = useState(VISIBLE_INIT);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FicheStatus | "ALL">(initialStatus || "ALL");
  const [exporting, setExporting] = useState(false);

  // Filtres direction uniquement
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("ALL");
  const [prospecteurFilter, setProspecteurFilter] = useState("ALL");
  const [commercialFilter, setCommercialFilter] = useState("ALL");
  const [prospecteurs, setProspecteurs] = useState<ProfileOption[]>([]);
  const [commercials, setCommercials] = useState<ProfileOption[]>([]);

  // Stable — ne change pas entre les renders
  const supabase = useMemo(() => createClient(), []);

  const visibleStatuses: FicheStatus[] = isProspecteur
    ? ["BROUILLON", "SOUMISE", "AFFECTEE", "ACCEPTEE", "RETRACTATION", "REFUSEE", "ARCHIVEE"]
    : ["SOUMISE", "AFFECTEE", "ACCEPTEE", "RETRACTATION", "REFUSEE", "ARCHIVEE"];

  // Chargement des listes de prospecteurs et commerciaux pour les filtres admin
  useEffect(() => {
    if (!isAdmin) return;
    async function loadUsers() {
      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, role")
        .in("role", ["PROSPECTEUR", "COMMERCIAL"])
        .eq("is_active", true)
        .order("last_name");
      if (data) {
        setProspecteurs(data.filter((u) => u.role === "PROSPECTEUR"));
        setCommercials(data.filter((u) => u.role === "COMMERCIAL"));
      }
    }
    loadUsers();
  }, [isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchFiches = useCallback(async (pageToLoad = 0, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);

    // Calculé ici pour éviter les closures périmées
    const role = profile?.role;
    const _isAdmin       = role === "ADMIN";
    const _isProspecteur = role === "PROSPECTEUR";

    let query = supabase
      .from("fiches")
      .select(
        "id, reference, status, prospect_nom, prospect_prenom, prospect_ville, prospect_cp, updated_at, created_at, " +
        "assigned_to_profile:profiles!fiches_assigned_to_fkey(first_name, last_name), " +
        "created_by_profile:profiles!fiches_created_by_fkey(first_name, last_name)"
      )
      .order("created_at", { ascending: false });

    // Filtre statut
    if (statusFilter !== "ALL") {
      query = query.eq("status", statusFilter);
    } else if (!_isProspecteur) {
      query = query.neq("status", "BROUILLON");
    }

    // Prospecteur : ne voit que ses propres fiches
    if (_isProspecteur && profile?.id) {
      query = query.eq("created_by", profile.id);
    }

    // Commercial : ne voit que les fiches qui lui sont affectées
    if (role === "COMMERCIAL" && profile?.id) {
      query = query.eq("assigned_to", profile.id);
    }

    // Filtres direction
    if (_isAdmin) {
      const dates = getPeriodDates(periodFilter);
      if (dates) {
        // Suffixe Z = UTC explicite, évite les ambiguïtés de timezone
        const from = `${dates.from}T00:00:00Z`;
        const to   = `${dates.to}T23:59:59Z`;

        // IDs via l'historique (fiches soumises via le workflow RPC)
        const { data: historyRows } = await supabase
          .from("fiche_history")
          .select("fiche_id")
          .eq("new_status", "SOUMISE")
          .gte("created_at", from)
          .lte("created_at", to);
        const idsFromHistory = new Set((historyRows ?? []).map((h) => h.fiche_id));

        // IDs des fiches sans historique (seed / import direct) filtrées par created_at
        const { data: legacyRows } = await supabase
          .from("fiches")
          .select("id")
          .neq("status", "BROUILLON")
          .gte("created_at", from)
          .lte("created_at", to);
        (legacyRows ?? []).forEach((f) => idsFromHistory.add(f.id));

        const ficheIds = Array.from(idsFromHistory);
        if (ficheIds.length === 0) {
          setFiches([]); setHasMore(false); setPage(0);
          if (append) setLoadingMore(false); else setLoading(false);
          return;
        }
        query = query.in("id", ficheIds);
      }
      if (prospecteurFilter !== "ALL") query = query.eq("created_by", prospecteurFilter);
      if (commercialFilter  !== "ALL") query = query.eq("assigned_to", commercialFilter);
    }

    if (search) {
      query = query.or(
        `prospect_nom.ilike.%${search}%,prospect_prenom.ilike.%${search}%,reference.ilike.%${search}%,prospect_ville.ilike.%${search}%`
      );
    }

    try {
      const from = pageToLoad * PAGE_SIZE;
      const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      const rows = (data as unknown as FicheRow[]) || [];
      setFiches((prev) => (append ? [...prev, ...rows] : rows));
      if (!append) setVisibleCount(VISIBLE_INIT);
      setHasMore(rows.length === PAGE_SIZE);
      setPage(pageToLoad);
      setFetchError(null);
    } catch (err) {
      console.error("fetchFiches error", err);
      setFetchError("Erreur lors du chargement des fiches.");
      toast.error("Erreur lors du chargement des fiches");
    } finally {
      if (append) setLoadingMore(false); else setLoading(false);
    }
  // supabase est stable (useMemo), pas besoin dans les deps
  }, [statusFilter, search, profile, periodFilter, prospecteurFilter, commercialFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore && !fetchError) fetchFiches(page + 1, true);
  }, [loadingMore, hasMore, page, fetchFiches, fetchError]);

  async function handleExport() {
    setExporting(true);
    try {
      const rows = await getFichesForExport(supabase, {
        statusFilter, isProspecteur, createdBy: profile?.id, search: search || undefined,
      });
      if (rows.length === 0) { toast.info("Aucune fiche à exporter"); return; }
      const csvRows: FicheCsvRow[] = rows.map((f) => ({
        reference: f.reference, statut: STATUS_LABELS[f.status],
        nom: f.prospect_nom, prenom: f.prospect_prenom,
        adresse: f.prospect_adresse ?? "", code_postal: f.prospect_cp ?? "",
        ville: f.prospect_ville ?? "", telephone: f.prospect_telephone ?? "",
        date_visite: f.date_visite ? new Date(f.date_visite).toLocaleDateString("fr-FR") : "",
        heure_visite: f.heure_visite ?? "",
        commercial: f.assigned_to_profile
          ? `${f.assigned_to_profile.first_name} ${f.assigned_to_profile.last_name}` : "",
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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFiches(0, false);
  }, [fetchFiches]);

  useEffect(() => {
    const channel = supabase
      .channel("fiches-list-realtime")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "fiches" }, (payload) => {
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
        fetchFiches();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchFiches]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasAdminFilters = isAdmin && (periodFilter !== "ALL" || prospecteurFilter !== "ALL" || commercialFilter !== "ALL");

  function resetAdminFilters() {
    setPeriodFilter("ALL");
    setProspecteurFilter("ALL"); setCommercialFilter("ALL");
  }

  return (
    <>
      <Topbar title="Fiches de pré-visite" />
      <div className="p-6 lg:p-8 space-y-4">

        {/* Barre principale : recherche + export + nouvelle fiche */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom, ville, référence..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 bg-card rounded-xl"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport} disabled={exporting} className="rounded-xl gap-2" aria-label="Exporter les fiches au format CSV">
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}Exporter CSV
            </Button>
            <Link href="/fiches/nouvelle">
              <Button className="bg-[#F97316] hover:bg-[#EA580C] text-white rounded-xl gap-2">
                <FilePlus className="w-4 h-4" />Nouvelle fiche
              </Button>
            </Link>
          </div>
        </div>

        {/* Filtres direction */}
        {isAdmin && (
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CalendarRange className="w-4 h-4" />
                Filtres direction
              </div>
              {hasAdminFilters && (
                <button
                  type="button"
                  onClick={resetAdminFilters}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Réinitialiser les filtres"
                >
                  <X className="w-3 h-3" />Réinitialiser
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Période de soumission */}
              <div className="col-span-2 space-y-1">
                <label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" />Période de soumission
                </label>
                <div className="flex gap-2 flex-wrap">
                  {(Object.keys(PERIOD_LABELS) as PeriodFilter[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPeriodFilter(p)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                        periodFilter === p
                          ? "bg-primary text-white border-primary"
                          : "bg-background border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      {PERIOD_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>
              {/* Filtre prospecteur */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">Prospecteurs</label>
                <Select value={prospecteurFilter} onValueChange={(v) => setProspecteurFilter(v ?? "ALL")}>
                  <SelectTrigger className="h-10 bg-background rounded-xl text-sm">
                    <SelectValue>
                      {prospecteurFilter === "ALL"
                        ? "Tous"
                        : (() => { const p = prospecteurs.find((x) => x.id === prospecteurFilter); return p ? `${p.first_name} ${p.last_name}` : "Tous"; })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tous les prospecteurs</SelectItem>
                    {prospecteurs.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.first_name} {p.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Filtre commercial */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">Commerciaux</label>
                <Select value={commercialFilter} onValueChange={(v) => setCommercialFilter(v ?? "ALL")}>
                  <SelectTrigger className="h-10 bg-background rounded-xl text-sm">
                    <SelectValue>
                      {commercialFilter === "ALL"
                        ? "Tous"
                        : (() => { const c = commercials.find((x) => x.id === commercialFilter); return c ? `${c.first_name} ${c.last_name}` : "Tous"; })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tous les commerciaux</SelectItem>
                    {commercials.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.first_name} {c.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Filtres par statut */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setStatusFilter("ALL")}
            aria-pressed={statusFilter === "ALL"}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              statusFilter === "ALL" ? "bg-primary text-white" : "bg-card text-muted-foreground hover:bg-secondary border"
            }`}
          >
            <Filter className="w-4 h-4 inline mr-1" />Toutes
          </button>
          {visibleStatuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              aria-pressed={statusFilter === s}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                statusFilter === s ? "bg-primary text-white" : "bg-card text-muted-foreground hover:bg-secondary border"
              }`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Liste des fiches */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 bg-card border border-border border-l-4 border-l-muted rounded-xl px-5 py-4 animate-pulse"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="w-10 h-10 rounded-xl bg-muted shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-muted rounded w-1/3" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="h-5 w-20 bg-muted rounded-full hidden sm:block" />
                  <div className="h-4 w-16 bg-muted rounded hidden sm:block" />
                </div>
              </div>
            ))}
          </div>
        ) : fetchError ? (
          <div className="text-center py-16 bg-card rounded-xl border border-border space-y-3">
            <AlertCircle className="w-10 h-10 mx-auto text-destructive opacity-60" />
            <p className="font-medium text-sm text-foreground">Erreur de chargement</p>
            <Button variant="outline" className="rounded-xl" onClick={() => fetchFiches(0, false)}>
              Réessayer
            </Button>
          </div>
        ) : fiches.length === 0 ? (
          <div className="bg-card rounded-xl border border-border">
            <EmptyState
              illustration={search ? "search" : "fiches"}
              title="Aucune fiche trouvée"
              description={
                statusFilter !== "ALL"
                  ? `Aucune fiche avec le statut "${STATUS_LABELS[statusFilter as FicheStatus]}"${search ? ` pour "${search}"` : ""}`
                  : search
                  ? `Aucun résultat pour "${search}"`
                  : "Commencez par créer votre première fiche de pré-visite"
              }
              action={
                !search && statusFilter === "ALL" ? (
                  <Link href="/fiches/nouvelle" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-sm font-medium transition-colors">
                    <FilePlus className="w-4 h-4" />Nouvelle fiche
                  </Link>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="space-y-2">
            {fiches.slice(0, visibleCount).map((fiche, idx) => {
              const s = STATUS_CARD_STYLES[fiche.status];
              const StatusIcon = s.Icon;
              return (
                <Link key={fiche.id} href={`/fiches/${fiche.id}`}>
                  <div
                    className={`flex items-center gap-4 bg-card border border-border border-l-4 ${s.border} rounded-xl px-5 py-4 hover:translate-x-1 hover:shadow-md transition-all duration-200 cursor-pointer`}
                    style={{
                      animation: "fadeSlideIn 0.25s ease both",
                      animationDelay: `${Math.min(idx, 10) * 40}ms`,
                    }}
                  >
                    <div className={`w-10 h-10 rounded-xl ${s.iconBg} flex items-center justify-center shrink-0`}>
                      <StatusIcon className={`w-5 h-5 ${s.icon}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">
                        {fiche.prospect_prenom} {fiche.prospect_nom}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {fiche.reference}{fiche.prospect_ville ? ` · ${fiche.prospect_ville} ${fiche.prospect_cp ?? ""}` : ""}
                      </p>
                      {isAdmin && fiche.created_by_profile && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          Saisi par{" "}
                          <span className="font-medium text-foreground/70">
                            {fiche.created_by_profile.first_name} {fiche.created_by_profile.last_name}
                          </span>
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      {fiche.assigned_to_profile && (
                        <span className="text-xs text-muted-foreground hidden md:block">
                          → {fiche.assigned_to_profile.first_name} {fiche.assigned_to_profile.last_name}
                        </span>
                      )}
                      <FicheStatusBadge status={fiche.status} />
                      <span className="text-xs text-muted-foreground hidden sm:block">
                        {new Date(fiche.created_at).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {!loading && fiches.length > VISIBLE_INIT && (
          <div className="flex justify-center gap-3">
            {visibleCount < fiches.length ? (
              <Button
                variant="outline"
                onClick={() => setVisibleCount((n) => n + VISIBLE_INIT)}
                className="rounded-xl gap-2"
              >
                <ChevronDown className="w-4 h-4" />
                Voir plus
                <span className="text-xs text-muted-foreground">
                  ({fiches.length - visibleCount} restante{fiches.length - visibleCount > 1 ? "s" : ""})
                </span>
              </Button>
            ) : null}
            {visibleCount > VISIBLE_INIT ? (
              <Button
                variant="outline"
                onClick={() => setVisibleCount(VISIBLE_INIT)}
                className="rounded-xl gap-2"
              >
                <ChevronUp className="w-4 h-4" />
                Voir moins
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}
