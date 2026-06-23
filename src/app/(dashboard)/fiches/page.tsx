"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Topbar } from "@/components/layout/Topbar";
import { ExportPdfButton } from "@/components/ui/export-pdf-button";
import { FicheStatusBadge } from "@/components/fiches/FicheStatusBadge";
import { createClient } from "@/lib/supabase/client";
import { getFichesForExport } from "@/lib/data/fiches";
import { toCsv, downloadCsv, type CsvColumn } from "@/lib/csv";
import { useProfile } from "@/lib/hooks/use-profile";
import { STATUS_LABELS } from "@/lib/permissions";
import type { FicheStatus } from "@/types/database";
import { toast } from "sonner";
import {
  Search, FilePlus, Filter, Loader2, Download, Send,
  UserCheck, CheckCircle2, XCircle, Archive, Clock, CalendarRange, CalendarDays, X, AlertCircle,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

import { type PeriodFilter, PERIOD_LABELS, getPeriodDates } from "@/lib/periods";

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
  VALIDEE:      { border: "border-l-emerald-500", icon: "text-emerald-500", iconBg: "bg-emerald-50 dark:bg-emerald-950/40",   Icon: CheckCircle2 },
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
  const isValidationMode = initialStatus === "SOUMISE";
  const highlightIds = useMemo(() => new Set((searchParams.get("highlight") ?? "").split(",").filter(Boolean)), [searchParams]);
  const { profile } = useProfile();
  const isReferent = profile?.role === "PROSPECTEUR" || profile?.role === "CHEF_EQUIPE";
  const isAdmin       = profile?.role === "ADMIN";
  const isCommercial  = profile?.role === "COMMERCIAL";

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
  const [referentFilter, setReferentFilter] = useState("ALL");
  const [commercialFilter, setCommercialFilter] = useState("ALL");
  const [referents, setReferents] = useState<ProfileOption[]>([]);
  const [commercials, setCommercials] = useState<ProfileOption[]>([]);
  const [anterieures, setAnterieures] = useState<{ id: string }[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [validationStats, setValidationStats] = useState<{ label: string; soumises: number; affectees: number; validees: number }[]>([]);
  const [quarterLabel, setQuarterLabel] = useState("");

  // Stable — ne change pas entre les renders
  const supabase = useMemo(() => createClient(), []);

  const visibleStatuses: FicheStatus[] = isReferent
    ? ["BROUILLON", "SOUMISE", "VALIDEE", "AFFECTEE", "ACCEPTEE", "RETRACTATION", "REFUSEE", "ARCHIVEE"]
    : isCommercial
    ? ["AFFECTEE", "RETRACTATION", "ACCEPTEE", "REFUSEE", "ARCHIVEE"]
    : ["SOUMISE", "AFFECTEE", "ACCEPTEE", "RETRACTATION", "REFUSEE", "ARCHIVEE"];

  // Labels adaptés selon le rôle
  const statusLabel = (s: FicheStatus): string => {
    if (isCommercial && s === "AFFECTEE") return "À traiter";
    return STATUS_LABELS[s];
  };

  // Chargement des listes de referents et commerciaux pour les filtres admin
  useEffect(() => {
    if (!isAdmin) return;
    async function loadUsers() {
      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, role")
        .in("role", ["PROSPECTEUR", "CHEF_EQUIPE", "COMMERCIAL"])
        .eq("is_active", true)
        .order("last_name");
      if (data) {
        setReferents(data.filter((u) => u.role === "PROSPECTEUR"));
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
    const _isReferent = role === "PROSPECTEUR" || role === "CHEF_EQUIPE";

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
    } else if (!_isReferent) {
      query = query.neq("status", "BROUILLON");
    }

    // Référent : ne voit que ses propres fiches
    if (_isReferent && profile?.id) {
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
        query = query
          .gte("updated_at", `${dates.from}T00:00:00Z`)
          .lte("updated_at", `${dates.to}T23:59:59Z`);
      }
      if (referentFilter !== "ALL") query = query.eq("created_by", referentFilter);
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
  }, [statusFilter, search, profile, periodFilter, referentFilter, commercialFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fiches antérieures au trimestre (toujours chargées)
  useEffect(() => {
    if (!profile || isReferent) return;
    async function loadAnterieures() {
      const now = new Date();
      const q = Math.floor(now.getMonth() / 3);
      const quarterStart = new Date(now.getFullYear(), q * 3, 1);
      const pad = (n: number) => String(n).padStart(2, "0");
      const qFrom = `${quarterStart.getFullYear()}-${pad(quarterStart.getMonth() + 1)}-${pad(quarterStart.getDate())}`;
      let aq = supabase.from("fiches").select("id");
      if (isCommercial && profile.id) aq = aq.eq("assigned_to", profile.id);
      else aq = aq.neq("status", "BROUILLON");
      aq = aq.lt("updated_at", `${qFrom}T00:00:00Z`).limit(50);
      const { data } = await aq;
      setAnterieures((data as { id: string }[]) ?? []);
    }
    loadAnterieures();
  }, [profile, isReferent, isCommercial, supabase]);

  // Compteurs par statut
  useEffect(() => {
    if (!profile) return;
    async function loadStatusCounts() {
      const statuses: FicheStatus[] = isReferent
        ? ["BROUILLON", "SOUMISE", "AFFECTEE", "ACCEPTEE", "RETRACTATION", "REFUSEE", "ARCHIVEE"]
        : isCommercial
        ? ["AFFECTEE", "RETRACTATION", "ACCEPTEE", "REFUSEE", "ARCHIVEE"]
        : ["SOUMISE", "AFFECTEE", "ACCEPTEE", "RETRACTATION", "REFUSEE", "ARCHIVEE"];
      const counts: Record<string, number> = {};
      let total = 0;
      await Promise.all(statuses.map(async (s) => {
        let q = supabase.from("fiches").select("*", { count: "exact", head: true }).eq("status", s);
        if (isReferent && profile.id) q = q.eq("created_by", profile.id);
        else if (isCommercial && profile.id) q = q.eq("assigned_to", profile.id);
        const { count } = await q;
        counts[s] = count ?? 0;
        total += count ?? 0;
      }));
      counts["ALL"] = total;
      setStatusCounts(counts);
    }
    loadStatusCounts();
  }, [profile, isReferent, isCommercial, supabase]);

  // Évolution des validations par semaine (trimestre en cours) — mode validation uniquement
  useEffect(() => {
    if (!isValidationMode || !profile || !isAdmin) return;
    async function loadValidationStats() {
      const now = new Date();
      const q = Math.floor(now.getMonth() / 3);
      const quarterStart = new Date(now.getFullYear(), q * 3, 1);
      const quarterEnd = new Date(now.getFullYear(), q * 3 + 3, 0);
      const pad = (n: number) => String(n).padStart(2, "0");
      const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

      const weeks: { label: string; from: string; to: string }[] = [];
      const current = new Date(quarterStart);
      // Align to Monday
      const dayOfWeek = current.getDay() === 0 ? 6 : current.getDay() - 1;
      current.setDate(current.getDate() - dayOfWeek);
      let weekNum = 1;
      while (current <= quarterEnd) {
        const monday = new Date(current);
        const sunday = new Date(current);
        sunday.setDate(sunday.getDate() + 6);
        const effMonday = monday < quarterStart ? quarterStart : monday;
        const effSunday = sunday > quarterEnd ? quarterEnd : sunday;
        const shortDate = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
        weeks.push({
          label: `S${weekNum} (${shortDate(effMonday)}-${shortDate(effSunday)})`,
          from: fmt(effMonday),
          to: fmt(effSunday),
        });
        current.setDate(current.getDate() + 7);
        weekNum++;
      }

      const results = await Promise.all(weeks.map(async (w) => {
        // Fiches soumises dans cette semaine
        const { count: soumises } = await supabase
          .from("fiche_history")
          .select("*", { count: "exact", head: true })
          .eq("new_status", "SOUMISE")
          .gte("created_at", `${w.from}T00:00:00Z`)
          .lte("created_at", `${w.to}T23:59:59Z`);

        // Fiches affectées dans cette semaine
        const { count: affectees } = await supabase
          .from("fiche_history")
          .select("*", { count: "exact", head: true })
          .eq("new_status", "AFFECTEE")
          .gte("created_at", `${w.from}T00:00:00Z`)
          .lte("created_at", `${w.to}T23:59:59Z`);

        // Fiches validées (acceptées) dans cette semaine
        const { count: validees } = await supabase
          .from("fiche_history")
          .select("*", { count: "exact", head: true })
          .eq("new_status", "ACCEPTEE")
          .gte("created_at", `${w.from}T00:00:00Z`)
          .lte("created_at", `${w.to}T23:59:59Z`);

        return { label: w.label, soumises: soumises ?? 0, affectees: affectees ?? 0, validees: validees ?? 0 };
      }));

      setValidationStats(results);
      const shortDate = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
      setQuarterLabel(`du ${shortDate(quarterStart)} au ${shortDate(quarterEnd)}`);
    }
    loadValidationStats();
  }, [isValidationMode, profile, isAdmin, supabase]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore && !fetchError) fetchFiches(page + 1, true);
  }, [loadingMore, hasMore, page, fetchFiches, fetchError]);

  async function handleExport() {
    setExporting(true);
    try {
      const rows = await getFichesForExport(supabase, {
        statusFilter, isReferent, createdBy: profile?.id, search: search || undefined,
      });
      if (rows.length === 0) { toast.info("Aucune fiche à exporter"); return; }
      const csvRows: FicheCsvRow[] = rows.map((f) => ({
        reference: f.reference, statut: STATUS_LABELS[f.status],
        nom: f.prospect_nom, prenom: f.prospect_prenom,
        adresse: f.prospect_adresse ?? "", code_postal: f.prospect_cp ?? "",
        ville: f.prospect_ville ?? "", telephone: isAdmin ? (f.prospect_telephone ?? "") : "—",
        date_visite: f.date_visite ? new Date(f.date_visite).toLocaleDateString("fr-FR") : "",
        heure_visite: f.heure_visite ?? "",
        commercial: f.assigned_to_profile
          ? `${f.assigned_to_profile.first_name} ${f.assigned_to_profile.last_name}` : "",
        cree_le: new Date(f.created_at).toLocaleDateString("fr-FR"),
        modifie_le: new Date(f.updated_at).toLocaleDateString("fr-FR"),
      }));
      const now = new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
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

  const hasAdminFilters = isAdmin && (periodFilter !== "ALL" || referentFilter !== "ALL" || commercialFilter !== "ALL");

  function resetAdminFilters() {
    setPeriodFilter("ALL");
    setReferentFilter("ALL"); setCommercialFilter("ALL");
  }

  return (
    <>
      <Topbar title={isValidationMode ? "Fiches à valider" : "Fiches de pré-visite"} actions={<ExportPdfButton title={isValidationMode ? "Fiches à valider" : "Fiches de pré-visite"} filename={isValidationMode ? "fiches-a-valider" : "fiches-preview"} />} />
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

        {/* Filtres direction / période */}
        {isAdmin && (
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            {!isValidationMode && (
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
            )}
            <div className={isValidationMode ? "space-y-1" : "grid grid-cols-2 lg:grid-cols-4 gap-3"}>
              {/* Période */}
              <div className={isValidationMode ? "" : "col-span-2 space-y-1"}>
                <label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" />{isValidationMode ? "Période d'activité" : "Période de soumission"}
                </label>
                <div className="flex gap-2 flex-wrap">
                  {(Object.keys(PERIOD_LABELS) as PeriodFilter[])
                    .filter((p) => !isValidationMode || (p !== "QUARTER"))
                    .map((p) => (
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
                  {!isValidationMode && (
                    <button
                      type="button"
                      onClick={() => { setPeriodFilter("ALL"); setStatusFilter("ARCHIVEE"); }}
                      className="relative group px-3 py-1.5 rounded-xl text-xs font-medium border transition-all bg-background border-border text-muted-foreground hover:border-primary/40 hover:text-foreground inline-flex items-center gap-1.5"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      Antérieures
                      {anterieures.length > 0 && (
                        <span className="bg-primary/10 text-primary text-xs font-bold px-1.5 py-0.5 rounded-full">{anterieures.length}</span>
                      )}
                      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 w-max max-w-xs px-3 py-2 rounded-lg bg-foreground text-background text-xs leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-50">
                        {anterieures.length} fiche{anterieures.length > 1 ? "s" : ""} archivée{anterieures.length > 1 ? "s" : ""} au cours du trimestre en cours.
                        <br />Cliquer pour les visualiser.
                      </span>
                    </button>
                  )}
                </div>
                {periodFilter !== "ALL" && (
                  <p className="text-xs text-muted-foreground pt-1">
                    Affichage : <span className="font-semibold text-foreground">{fiches.length} fiche{fiches.length > 1 ? "s" : ""}</span> {PERIOD_LABELS[periodFilter].toLowerCase()}
                  </p>
                )}
              </div>
              {!isValidationMode && (<>
              {/* Filtre référent */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">Référents</label>
                <Select value={referentFilter} onValueChange={(v) => setReferentFilter(v ?? "ALL")}>
                  <SelectTrigger className="h-10 bg-background rounded-xl text-sm">
                    <SelectValue>
                      {referentFilter === "ALL"
                        ? "Tous"
                        : (() => { const p = referents.find((x) => x.id === referentFilter); return p ? `${p.first_name} ${p.last_name}` : "Tous"; })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tous les referents</SelectItem>
                    {referents.map((p) => (
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
              </>)}
            </div>
          </div>
        )}

        {/* Filtres par statut */}
        {!isValidationMode && (<div className="flex gap-2 overflow-x-auto overflow-y-visible pb-12">
          <button
            onClick={() => setStatusFilter("ALL")}
            aria-pressed={statusFilter === "ALL"}
            className={`relative group px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              statusFilter === "ALL" ? "bg-primary text-white" : "bg-card text-muted-foreground hover:bg-secondary border"
            }`}
          >
            <Filter className="w-4 h-4 inline mr-1" />Toutes
            {statusCounts["ALL"] != null && (
              <span className="pointer-events-none absolute left-0 top-full mt-2 w-max px-3 py-1.5 rounded-lg bg-[#9B2335] text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-50">
                {statusCounts["ALL"]} fiche{statusCounts["ALL"] > 1 ? "s" : ""} au total
              </span>
            )}
          </button>
          {visibleStatuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              aria-pressed={statusFilter === s}
              className={`relative group px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                statusFilter === s ? "bg-primary text-white" : "bg-card text-muted-foreground hover:bg-secondary border"
              }`}
            >
              {statusLabel(s)}
              {statusCounts[s] != null && (
                <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 w-max px-3 py-1.5 rounded-lg bg-[#9B2335] text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-50">
                  {statusCounts[s]} fiche{statusCounts[s] > 1 ? "s" : ""} {statusLabel(s).toLowerCase()}
                </span>
              )}
            </button>
          ))}
        </div>)}

        {/* Résumé période en mode validation */}
        {isValidationMode && periodFilter !== "ALL" && (
          <p className="text-xs text-muted-foreground">
            Affichage : <span className="font-semibold text-foreground">{fiches.length} fiche{fiches.length > 1 ? "s" : ""} à valider</span> {PERIOD_LABELS[periodFilter].toLowerCase()}
          </p>
        )}

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
              title={isValidationMode ? "Aucune fiche à valider" : "Aucune fiche trouvée"}
              description={
                isValidationMode
                  ? (search ? `Aucun résultat pour "${search}"` : "Toutes les fiches ont été traitées")
                  : statusFilter !== "ALL"
                  ? `Aucune fiche avec le statut "${STATUS_LABELS[statusFilter as FicheStatus]}"${search ? ` pour "${search}"` : ""}`
                  : search
                  ? `Aucun résultat pour "${search}"`
                  : "Commencez par créer votre première fiche de pré-visite"
              }
              action={
                !isValidationMode && !search && statusFilter === "ALL" ? (
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
              const isHighlighted = highlightIds.has(fiche.id);
              return (
                <Link key={fiche.id} href={`/fiches/${fiche.id}`}>
                  <div
                    className={`flex items-center gap-4 bg-card border border-border border-l-4 ${s.border} rounded-xl px-5 py-4 hover:translate-x-1 hover:shadow-md transition-all duration-200 cursor-pointer ${isHighlighted ? "ring-2 ring-[#F97316] bg-[#F97316]/5 animate-[highlightPulse_1.5s_ease-in-out]" : ""}`}
                    style={{
                      animation: isHighlighted
                        ? "fadeSlideIn 0.25s ease both, highlightPulse 1.5s ease-in-out"
                        : "fadeSlideIn 0.25s ease both",
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
                      {isHighlighted && (
                        <span className="text-[10px] font-semibold text-[#F97316] bg-[#F97316]/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                          Antérieure
                        </span>
                      )}
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

        {isValidationMode && validationStats.length > 0 && (
          <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-4">Évolution des validations — Trimestre en cours {quarterLabel}</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={validationStats} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: "0.75rem", border: "1px solid var(--border)", background: "var(--card)" }}
                  formatter={(value, name) => [value, name]}
                />
                <Bar dataKey="soumises" name="À valider" fill="#F97316" radius={[4, 4, 0, 0]} />
                <Bar dataKey="affectees" name="Validées et affectées" fill="#1B2659" radius={[4, 4, 0, 0]} />
                <Bar dataKey="validees" name="Acceptation Client" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </>
  );
}
