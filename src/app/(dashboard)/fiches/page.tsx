"use client";

import { useEffect, useLayoutEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Topbar } from "@/components/layout/Topbar";
import { ExportPdfButton } from "@/components/ui/export-pdf-button";
import { ExportCsvButton } from "@/components/ui/export-csv-button";
import { FicheStatusBadge } from "@/components/fiches/FicheStatusBadge";
import { ImportCsvDialog } from "@/components/fiches/ImportCsvDialog";
import { createClient } from "@/lib/supabase/client";
import { getFichesForExport } from "@/lib/data/fiches";
import { toCsv, downloadCsv, type CsvColumn } from "@/lib/csv";
import { useProfile } from "@/lib/hooks/use-profile";
import { useBranch } from "@/lib/context/branch-context";
import { getCachedProfileId } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/permissions";
import type { FicheStatus } from "@/types/database";
import { toast } from "sonner";
import {
  Search, FilePlus, Filter, Loader2, Download, Send,
  UserCheck, CheckCircle2, XCircle, Archive, Clock, Calendar, CalendarRange, CalendarDays, X, AlertCircle,
  ChevronDown, ChevronUp, UserX, ArrowLeft,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

import { type PeriodFilter, PERIOD_LABELS, getPeriodDates, getPeriodLabel } from "@/lib/periods";

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
const VISIBLE_INIT = 5;

const STATUS_LABELS_PLURAL: Record<FicheStatus, string> = {
  BROUILLON: "brouillons", SOUMISE: "à valider", VALIDEE: "validées",
  AFFECTEE: "validées et affectées", RDV_A_REPRENDRE: "avec RDV à reprendre", ACCEPTEE: "acceptées",
  RETRACTATION: "en attente acceptation client", RDV_TECHNICIEN: "en RDV technicien", INSTALLEE: "installées",
  REFUSEE: "refusées", ARCHIVEE: "archivées",
};

const STATUS_CARD_STYLES: Record<FicheStatus, { border: string; icon: string; iconBg: string; Icon: React.ElementType }> = {
  BROUILLON:    { border: "border-l-slate-400",   icon: "text-slate-500",   iconBg: "bg-slate-100 dark:bg-slate-800",         Icon: Clock },
  SOUMISE:      { border: "border-l-blue-500",    icon: "text-blue-500",    iconBg: "bg-blue-50 dark:bg-blue-950/40",         Icon: Send },
  VALIDEE:      { border: "border-l-emerald-500", icon: "text-emerald-500", iconBg: "bg-emerald-50 dark:bg-emerald-950/40",   Icon: CheckCircle2 },
  AFFECTEE:         { border: "border-l-orange-500",  icon: "text-orange-500",  iconBg: "bg-orange-50 dark:bg-orange-950/40",     Icon: UserCheck },
  RDV_A_REPRENDRE:  { border: "border-l-amber-500",  icon: "text-amber-600",   iconBg: "bg-amber-50 dark:bg-amber-950/40",        Icon: UserX },
  ACCEPTEE:     { border: "border-l-emerald-500", icon: "text-emerald-600", iconBg: "bg-emerald-50 dark:bg-emerald-950/40",   Icon: CheckCircle2 },
  RETRACTATION:    { border: "border-l-purple-500",  icon: "text-purple-600",  iconBg: "bg-purple-50 dark:bg-purple-950/40",     Icon: AlertCircle },
  RDV_TECHNICIEN:  { border: "border-l-violet-500",  icon: "text-violet-600",  iconBg: "bg-violet-50 dark:bg-violet-950/40",     Icon: Calendar },
  INSTALLEE:       { border: "border-l-teal-500",    icon: "text-teal-600",    iconBg: "bg-teal-50 dark:bg-teal-950/40",         Icon: CheckCircle2 },
  REFUSEE:         { border: "border-l-red-500",     icon: "text-red-500",     iconBg: "bg-red-50 dark:bg-red-950/40",           Icon: XCircle },
  ARCHIVEE:        { border: "border-l-slate-400",   icon: "text-slate-400",   iconBg: "bg-slate-100 dark:bg-slate-800",         Icon: Archive },
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") as FicheStatus | null;
  const isValidationMode = initialStatus === "SOUMISE";
  const highlightIds = useMemo(() => new Set((searchParams.get("highlight") ?? "").split(",").filter(Boolean)), [searchParams]);
  const { profile } = useProfile();
  const { selectedBranchId, isDG } = useBranch();
  const isReferent = profile?.role === "PROSPECTEUR" || profile?.role === "CHEF_EQUIPE";
  const isAdmin       = profile?.role === "DIRECTION" || profile?.role === "SUPER_ADMIN";
  const isAdminOrDG   = isAdmin || profile?.role === "DIRECTION_GENERALE";
  const isCommercial  = profile?.role === "COMMERCIAL";

  const [hydrated, setHydrated] = useState(false);
  const [fiches, setFiches] = useState<FicheRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(VISIBLE_INIT);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [statusFilter, setStatusFilter] = useState<FicheStatus | "ALL">(initialStatus || "ALL");
  const [exporting, setExporting] = useState(false);

  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [firstFicheDate, setFirstFicheDate] = useState<string | null>(null);

  // Synchroniser statusFilter + restaurer le cache immédiatement quand on navigue
  const [prevInitialStatus, setPrevInitialStatus] = useState(initialStatus);
  if (initialStatus !== prevInitialStatus) {
    setPrevInitialStatus(initialStatus);
    const newStatus = initialStatus || "ALL";
    setStatusFilter(newStatus);
    const newEffective = initialStatus === "SOUMISE" ? "SOUMISE" : newStatus;
    const pid = getCachedProfileId();
    if (pid) {
      try {
        const raw = localStorage.getItem(`fiches_cache_${pid}_${newEffective}`);
        if (raw) {
          const c = JSON.parse(raw);
          if (c.fiches?.length) { setFiches(c.fiches); setLoading(false); }
          else { setFiches([]); setLoading(true); }
          if (c.statusCounts) setStatusCounts(c.statusCounts);
          if (c.firstFicheDate !== undefined) setFirstFicheDate(c.firstFicheDate);
        } else {
          setFiches([]);
          setLoading(true);
        }
      } catch { setFiches([]); setLoading(true); }
    }
  }

  // Filtres direction uniquement
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("ALL");
  const [referentFilter, setReferentFilter] = useState("ALL");
  const [commercialFilter, setCommercialFilter] = useState("ALL");
  const [referents, setReferents] = useState<ProfileOption[]>([]);
  const [commercials, setCommercials] = useState<ProfileOption[]>([]);
  const [anterieures, setAnterieures] = useState<{ id: string }[]>([]);

  // Plage de dates personnalisée (prioritaire sur les préréglages de période)
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Filtres ville / département
  const [villeFilter, setVilleFilter] = useState("ALL");
  const [departementFilter, setDepartementFilter] = useState("ALL");
  const [villeOptions, setVilleOptions] = useState<string[]>([]);
  const [departementOptions, setDepartementOptions] = useState<string[]>([]);

  // Panneau filtres avancés (référents, commerciaux, ville, département, dates)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Stable — ne change pas entre les renders
  const supabase = useMemo(() => createClient(), []);
  const fetchVersionRef = useRef(0);

  // ── Cache localStorage : affichage instantané ───────────────────────────
  const effectiveStatus = isValidationMode ? "SOUMISE" : statusFilter;
  const fichesCacheKey = profile ? `fiches_cache_${profile.id}_${effectiveStatus}` : null;
  useLayoutEffect(() => {
    setHydrated(true);
    const pid = getCachedProfileId();
    if (!pid) return;
    try {
      const raw = localStorage.getItem(`fiches_cache_${pid}_${effectiveStatus}`);
      if (!raw) return;
      const c = JSON.parse(raw);
      if (c.fiches?.length) { setFiches(c.fiches); setLoading(false); }
      if (c.statusCounts) setStatusCounts(c.statusCounts);
      if (c.firstFicheDate !== undefined) setFirstFicheDate(c.firstFicheDate);
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveStatus]);

  const fichesByStatus = useMemo(() => {
    if (statusFilter !== "ALL") return null;
    const groups: Partial<Record<string, FicheRow[]>> = {};
    for (const f of fiches) {
      if (!groups[f.status]) groups[f.status] = [];
      groups[f.status]!.push(f);
    }
    return groups;
  }, [fiches, statusFilter]);

  const visibleStatuses: FicheStatus[] = isReferent
    ? ["BROUILLON", "SOUMISE", "VALIDEE", "AFFECTEE", "RDV_A_REPRENDRE", "ACCEPTEE", "RETRACTATION", "RDV_TECHNICIEN", "INSTALLEE", "REFUSEE", "ARCHIVEE"]
    : isCommercial
    ? ["AFFECTEE", "RDV_A_REPRENDRE", "RETRACTATION", "ACCEPTEE", "RDV_TECHNICIEN", "INSTALLEE", "REFUSEE", "ARCHIVEE"]
    : ["SOUMISE", "AFFECTEE", "RDV_A_REPRENDRE", "ACCEPTEE", "RETRACTATION", "RDV_TECHNICIEN", "INSTALLEE", "REFUSEE", "ARCHIVEE"];

  // Labels adaptés selon le rôle
  const statusLabel = (s: FicheStatus): string => {
    if (isCommercial && s === "AFFECTEE") return "À traiter";
    return STATUS_LABELS[s];
  };

  // Chargement des listes de referents et commerciaux pour les filtres admin
  const _branchFilterForUsers = (isDG && selectedBranchId !== "all") ? selectedBranchId : null;
  useEffect(() => {
    if (!isAdminOrDG) return;
    async function loadUsers() {
      let q = supabase
        .from("profiles")
        .select("id, first_name, last_name, role")
        .in("role", ["PROSPECTEUR", "CHEF_EQUIPE", "COMMERCIAL"])
        .eq("is_active", true)
        .order("last_name");
      if (_branchFilterForUsers) q = q.eq("organization_id", _branchFilterForUsers);
      const { data } = await q;
      if (data) {
        setReferents(data.filter((u) => u.role === "PROSPECTEUR"));
        setCommercials(data.filter((u) => u.role === "COMMERCIAL"));
      }
    }
    loadUsers();
  }, [isAdminOrDG, _branchFilterForUsers]); // eslint-disable-line react-hooks/exhaustive-deps

  // Chargement des villes / départements distincts pour les filtres avancés
  useEffect(() => {
    if (!isAdminOrDG) return;
    async function loadVillesDepartements() {
      let q = supabase.from("fiches").select("prospect_ville, prospect_cp").not("prospect_ville", "is", null);
      if (_branchFilterForUsers) q = q.eq("organization_id", _branchFilterForUsers);
      const { data } = await q.limit(5000);
      if (data) {
        const villes = new Set<string>();
        const deps = new Set<string>();
        for (const row of data as { prospect_ville: string | null; prospect_cp: string | null }[]) {
          if (row.prospect_ville && row.prospect_ville.trim()) villes.add(row.prospect_ville.trim());
          if (row.prospect_cp && row.prospect_cp.trim().length >= 2) deps.add(row.prospect_cp.trim().slice(0, 2));
        }
        setVilleOptions(Array.from(villes).sort((a, b) => a.localeCompare(b, "fr")));
        setDepartementOptions(Array.from(deps).sort());
      }
    }
    loadVillesDepartements();
  }, [isAdminOrDG, _branchFilterForUsers]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchFiches = useCallback(async (pageToLoad = 0, append = false) => {
    if (!profile) return;
    const version = ++fetchVersionRef.current;
    if (!append) setHasMore(false);

    // Calculé ici pour éviter les closures périmées
    const role = profile.role;
    const _isAdmin       = role === "DIRECTION" || role === "DIRECTION_GENERALE" || role === "SUPER_ADMIN";
    const _isReferent = role === "PROSPECTEUR" || role === "CHEF_EQUIPE";
    const _branchFilter  = (isDG && selectedBranchId !== "all") ? selectedBranchId : null;

    let query = supabase
      .from("fiches")
      .select(
        "id, reference, status, prospect_nom, prospect_prenom, prospect_ville, prospect_cp, updated_at, created_at, " +
        "assigned_to_profile:profiles!fiches_assigned_to_fkey(first_name, last_name), " +
        "created_by_profile:profiles!fiches_created_by_fkey(first_name, last_name)"
      )
      .order("created_at", { ascending: false });

    // Filtre statut — en mode validation, toujours forcer SOUMISE
    if (effectiveStatus !== "ALL") {
      query = query.eq("status", effectiveStatus);
    } else if (!_isReferent) {
      query = query.neq("status", "BROUILLON");
    }

    // Plage de dates : la sélection personnalisée (du/au) est prioritaire sur les préréglages
    const effectiveDates = (customFrom || customTo)
      ? { from: customFrom || "1970-01-01", to: customTo || new Date().toISOString().slice(0, 10) }
      : getPeriodDates(periodFilter);

    // Référent : ne voit que ses propres fiches + filtre période
    if (_isReferent && profile?.id) {
      query = query.eq("created_by", profile.id);
      if (effectiveDates) {
        query = query
          .gte("updated_at", `${effectiveDates.from}T00:00:00Z`)
          .lte("updated_at", `${effectiveDates.to}T23:59:59Z`);
      }
    }

    // Commercial : ne voit que les fiches qui lui sont affectées
    if (role === "COMMERCIAL" && profile?.id) {
      query = query.eq("assigned_to", profile.id);
    }

    // Filtres direction
    if (_isAdmin) {
      if (effectiveDates) {
        query = query
          .gte("updated_at", `${effectiveDates.from}T00:00:00Z`)
          .lte("updated_at", `${effectiveDates.to}T23:59:59Z`);
      }
      if (referentFilter !== "ALL") query = query.eq("created_by", referentFilter);
      if (commercialFilter  !== "ALL") query = query.eq("assigned_to", commercialFilter);
    }

    if (_branchFilter) query = query.eq("organization_id", _branchFilter);

    if (villeFilter !== "ALL") query = query.eq("prospect_ville", villeFilter);
    if (departementFilter !== "ALL") query = query.like("prospect_cp", `${departementFilter}%`);

    if (search) {
      query = query.or(
        `prospect_nom.ilike.%${search}%,prospect_prenom.ilike.%${search}%,reference.ilike.%${search}%,prospect_ville.ilike.%${search}%`
      );
    }

    try {
      const from = pageToLoad * PAGE_SIZE;

      // En mode validation + admin : charger fiches ET stats en parallèle
      // ── Compteurs par statut (intégrés au même batch) ──
      const countStatuses: FicheStatus[] = _isReferent
        ? ["BROUILLON", "SOUMISE", "AFFECTEE", "RDV_A_REPRENDRE", "ACCEPTEE", "RETRACTATION", "RDV_TECHNICIEN", "INSTALLEE", "REFUSEE", "ARCHIVEE"]
        : isCommercial
        ? ["AFFECTEE", "RDV_A_REPRENDRE", "RETRACTATION", "ACCEPTEE", "RDV_TECHNICIEN", "INSTALLEE", "REFUSEE", "ARCHIVEE"]
        : ["SOUMISE", "AFFECTEE", "RDV_A_REPRENDRE", "ACCEPTEE", "RETRACTATION", "RDV_TECHNICIEN", "INSTALLEE", "REFUSEE", "ARCHIVEE"];
      const countPromises = !append ? countStatuses.map((s) => {
        let cq = supabase.from("fiches").select("*", { count: "exact", head: true }).eq("status", s);
        if (_isReferent && profile.id) cq = cq.eq("created_by", profile.id);
        else if (isCommercial && profile.id) cq = cq.eq("assigned_to", profile.id);
        if (_branchFilter) cq = cq.eq("organization_id", _branchFilter);
        return cq;
      }) : [];
      let firstQ = !append ? supabase.from("fiches").select("created_at").order("created_at", { ascending: true }).limit(1) : null;
      if (firstQ) {
        if (_isReferent && profile.id) firstQ = firstQ.eq("created_by", profile.id);
        else if (isCommercial && profile.id) firstQ = firstQ.eq("assigned_to", profile.id);
        else firstQ = firstQ.neq("status", "BROUILLON");
        if (_branchFilter) firstQ = firstQ.eq("organization_id", _branchFilter);
      }

      const [fichesResult, ...countResults] = await Promise.all([
        query.range(from, from + PAGE_SIZE - 1),
        ...countPromises,
        ...(firstQ ? [firstQ] : []),
      ]);

      if (fichesResult.error) throw fichesResult.error;
      if (version !== fetchVersionRef.current) return;
      const rows = (fichesResult.data as unknown as FicheRow[]) || [];

      // ── Compteurs par statut ──
      let freshCounts: Record<string, number> | null = null;
      let freshFirstDate: string | null = null;
      if (!append && countResults.length > 0) {
        const counts: Record<string, number> = {};
        let total = 0;
        const hasFirstQ = firstQ != null;
        const countData = hasFirstQ ? countResults.slice(0, -1) : countResults;
        countStatuses.forEach((s, i) => {
          const c = (countData[i] as { count: number | null })?.count ?? 0;
          counts[s] = c;
          total += c;
        });
        counts["ALL"] = total;
        freshCounts = counts;
        setStatusCounts(counts);
        if (hasFirstQ) {
          const firstData = (countResults[countResults.length - 1] as { data: { created_at: string }[] | null })?.data;
          freshFirstDate = firstData?.[0]?.created_at ?? null;
          setFirstFicheDate(freshFirstDate);
        }
      }

      // Tout mettre à jour en un seul batch → un seul rendu
      const newFiches = append ? [...fiches, ...rows] : rows;
      setFiches(newFiches);
      setHasMore(rows.length === PAGE_SIZE);
      if (append) setLoadingMore(false);
      if (!append) { setVisibleCount(VISIBLE_INIT); setExpandedGroups(new Set()); }
      setFetchError(null);
      if (!append && fichesCacheKey) {
        try { localStorage.setItem(fichesCacheKey, JSON.stringify({ fiches: newFiches.slice(0, 30), statusCounts: freshCounts, firstFicheDate: freshFirstDate })); } catch { /* ignore */ }
      }

    } catch (err) {
      if (version !== fetchVersionRef.current) return;
      console.error("fetchFiches error", err);
      setFetchError("Erreur lors du chargement des fiches.");
      toast.error("Erreur lors du chargement des fiches");
    } finally {
      if (version === fetchVersionRef.current && !append) setLoading(false);
    }
  // supabase est stable (useMemo), pas besoin dans les deps
  }, [statusFilter, search, profile, periodFilter, referentFilter, commercialFilter, selectedBranchId, isDG, customFrom, customTo, villeFilter, departementFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fiches antérieures au trimestre (toujours chargées)
  useEffect(() => {
    if (!profile || isReferent) return;
    async function loadAnterieures() {
      const branchFilter = (isDG && selectedBranchId !== "all") ? selectedBranchId : null;
      const now = new Date();
      const q = Math.floor(now.getMonth() / 3);
      const quarterStart = new Date(now.getFullYear(), q * 3, 1);
      const pad = (n: number) => String(n).padStart(2, "0");
      const qFrom = `${quarterStart.getFullYear()}-${pad(quarterStart.getMonth() + 1)}-${pad(quarterStart.getDate())}`;
      let aq = supabase.from("fiches").select("id").eq("status", "ARCHIVEE");
      if (isCommercial && profile.id) aq = aq.eq("assigned_to", profile.id);
      if (branchFilter) aq = aq.eq("organization_id", branchFilter);
      aq = aq.lt("updated_at", `${qFrom}T00:00:00Z`).limit(50);
      const { data } = await aq;
      setAnterieures((data as { id: string }[]) ?? []);
    }
    loadAnterieures();
  }, [profile, isReferent, isCommercial, supabase, isDG, selectedBranchId]);




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

  const hasAdminFilters = isAdminOrDG && (
    periodFilter !== "ALL" || referentFilter !== "ALL" || commercialFilter !== "ALL" ||
    villeFilter !== "ALL" || departementFilter !== "ALL" || !!customFrom || !!customTo
  );

  // Nombre de filtres avancés actifs (hors Période qui reste toujours visible)
  const advancedFiltersCount =
    (referentFilter !== "ALL" ? 1 : 0) +
    (commercialFilter !== "ALL" ? 1 : 0) +
    (villeFilter !== "ALL" ? 1 : 0) +
    (departementFilter !== "ALL" ? 1 : 0) +
    (customFrom ? 1 : 0) +
    (customTo ? 1 : 0);

  function resetAdminFilters() {
    setPeriodFilter("ALL");
    setReferentFilter("ALL"); setCommercialFilter("ALL");
    setVilleFilter("ALL"); setDepartementFilter("ALL");
    setCustomFrom(""); setCustomTo("");
  }

  return (
    <>
      <Topbar title={isValidationMode ? "Fiches à valider" : "Fiches de pré-visite"} actions={<div className="flex items-center gap-2"><ExportPdfButton title={isValidationMode ? "Fiches à valider" : "Fiches de pré-visite"} filename={isValidationMode ? "fiches-a-valider" : "fiches-preview"} /><ExportCsvButton filename="fiches" getData={() => ({
        columns: [
          { key: "reference", label: "Référence" },
          { key: "nom", label: "Nom" },
          { key: "prenom", label: "Prénom" },
          { key: "ville", label: "Ville" },
          { key: "status", label: "Statut" },
          { key: "date", label: "Date" },
        ] as { key: keyof { reference: string; nom: string; prenom: string; ville: string; status: string; date: string }; label: string }[],
        rows: fiches.map((f) => ({ reference: f.reference, nom: f.prospect_nom, prenom: f.prospect_prenom, ville: f.prospect_ville || "", status: f.status, date: f.created_at?.slice(0, 10) || "" })),
      })} />{(isReferent || isAdminOrDG) && profile && <ImportCsvDialog organizationId={profile.organization_id} createdBy={profile.id} onImported={() => fetchFiches(0, false)} />}</div>} />
      <div className="p-4 sm:p-6 lg:p-8 space-y-4">

        {/* ═══ HERO FICHES — navy signature avec recherche intégrée ═══════ */}
        <div className="hero-surface hero-surface-sm rounded-3xl p-6 sm:p-7">
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
              <div>
                {isValidationMode && (
                  <button
                    onClick={() => router.back()}
                    className="inline-flex items-center gap-1.5 text-white/60 hover:text-white text-sm font-medium mb-3 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Retour
                  </button>
                )}
                <span className="text-[10px] tracking-[1.2px] uppercase text-white/50 font-medium">
                  {isValidationMode ? "File d'attente" : "Gestion des fiches"}
                </span>
                <h1 className="font-heading text-3xl sm:text-4xl text-white tracking-tight leading-none mt-1.5">
                  {isValidationMode ? "Fiches à valider" : "Fiches de pré-visite"}
                </h1>
                <p className="text-sm text-white/60 mt-2">
                  {isValidationMode
                    ? <><span className="font-bold text-white">{fiches.length} fiche{fiches.length > 1 ? "s" : ""}</span> en attente de votre validation</>
                    : (
                      <>
                        {statusCounts["ALL"] ?? 0} fiche{(statusCounts["ALL"] ?? 0) > 1 ? "s" : ""} au total
                        {firstFicheDate && (
                          <> · depuis le <span className="text-white/80 font-medium">{new Date(firstFicheDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</span></>
                        )}
                      </>
                    )}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className="bg-white/8 hover:bg-white/15 border border-white/10 text-white text-sm font-medium px-4 py-2 rounded-full inline-flex items-center gap-2 transition-colors disabled:opacity-50"
                  aria-label="Exporter au format CSV"
                >
                  {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  <span className="hidden sm:inline">Exporter CSV</span>
                </button>
                {profile && !isDG && (
                  <Link href="/fiches/nouvelle">
                    <button className="bg-[#F97316] hover:bg-[#EA580C] text-white text-sm font-medium px-5 py-2 rounded-full inline-flex items-center gap-2 transition-colors">
                      <FilePlus className="w-4 h-4" />Nouvelle fiche
                    </button>
                  </Link>
                )}
              </div>
            </div>

            {/* Recherche intégrée */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
              <input
                type="text"
                placeholder="Rechercher par nom, ville, référence…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-11 pl-10 pr-4 bg-white/8 border border-white/10 rounded-full text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-[#F97316]/50 focus:border-[#F97316]/30 transition-all"
              />
            </div>

            {/* Filtre période — référents uniquement (admin l'a dans le panneau filtres) */}
            {isReferent && (
              <div className="pt-4 border-t border-white/10 mt-4">
                <div className="flex items-center gap-2 mb-2.5">
                  <CalendarDays className="w-3.5 h-3.5 text-white/50" />
                  <span className="text-[10px] tracking-[1.2px] uppercase text-white/50 font-medium">Période d&apos;activité</span>
                  {getPeriodLabel(periodFilter) && (
                    <span className="text-[11px] text-white/70">· {getPeriodLabel(periodFilter)}</span>
                  )}
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {(Object.keys(PERIOD_LABELS) as PeriodFilter[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPeriodFilter(p)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        periodFilter === p
                          ? "bg-[#F97316] text-white"
                          : "bg-white/8 text-white/70 hover:bg-white/15 border border-white/10"
                      }`}
                    >
                      {PERIOD_LABELS[p]}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => { setPeriodFilter("ALL"); setStatusFilter("ARCHIVEE"); }}
                    className="px-3 py-1.5 rounded-full text-xs font-medium transition-all bg-white/8 text-white/70 hover:bg-white/15 border border-white/10 inline-flex items-center gap-1.5"
                  >
                    <Archive className="w-3 h-3" />
                    Antérieures
                    {anterieures.length > 0 && (
                      <span className="bg-[#F97316]/20 text-[#F97316] text-[10px] font-bold px-1.5 py-0.5 rounded-full">{anterieures.length}</span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Filtres direction / période */}
        {!profile && null}
        {isAdminOrDG && (
          <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] p-4 space-y-3">
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
            <div className={isValidationMode ? "space-y-1" : "space-y-3"}>
              {/* Ligne unique : Période + Antérieures + Référents + Commerciaux */}
              <div className={isValidationMode ? "" : "space-y-1"}>
                <label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-2 flex-wrap">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" />{isValidationMode ? "Période d'activité" : "Période de soumission"}
                  </span>
                  <span className="text-sm font-bold text-foreground tracking-normal normal-case">{PERIOD_LABELS[periodFilter].toUpperCase()}</span>
                  {getPeriodLabel(periodFilter) && (
                    <span className="text-xs font-medium text-muted-foreground tracking-normal normal-case">{getPeriodLabel(periodFilter)}</span>
                  )}
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex gap-2 flex-wrap flex-1">
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
                  {!isValidationMode && (
                    <button
                      type="button"
                      onClick={() => setShowAdvancedFilters((v) => !v)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                        showAdvancedFilters || advancedFiltersCount > 0
                          ? "bg-primary/5 border-primary/30 text-foreground"
                          : "bg-slate-200 dark:bg-slate-700 border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                      aria-expanded={showAdvancedFilters}
                    >
                      <Filter className="w-3.5 h-3.5" />
                      Filtres avancés
                      {advancedFiltersCount > 0 && (
                        <span className="bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                          {advancedFiltersCount}
                        </span>
                      )}
                      {showAdvancedFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>

                {/* Panneau filtres avancés — rétractable */}
                {!isValidationMode && showAdvancedFilters && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3 mt-1 border-t border-border">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground uppercase tracking-wide">Référents</label>
                      <Select value={referentFilter} onValueChange={(v) => setReferentFilter(v ?? "ALL")}>
                        <SelectTrigger className="h-[34px] bg-slate-200 dark:bg-slate-700 rounded-xl text-sm">
                          <SelectValue>
                            {referentFilter === "ALL"
                              ? "Tous les référents"
                              : (() => { const p = referents.find((x) => x.id === referentFilter); return p ? `${p.first_name} ${p.last_name}` : "Tous"; })()}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">Tous les référents</SelectItem>
                          {referents.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.first_name} {p.last_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground uppercase tracking-wide">Commerciaux</label>
                      <Select value={commercialFilter} onValueChange={(v) => setCommercialFilter(v ?? "ALL")}>
                        <SelectTrigger className="h-[34px] bg-slate-200 dark:bg-slate-700 rounded-xl text-sm">
                          <SelectValue>
                            {commercialFilter === "ALL"
                              ? "Tous les commerciaux"
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
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground uppercase tracking-wide">Ville</label>
                      <Select value={villeFilter} onValueChange={(v) => setVilleFilter(v ?? "ALL")}>
                        <SelectTrigger className="h-[34px] bg-slate-200 dark:bg-slate-700 rounded-xl text-sm">
                          <SelectValue>{villeFilter === "ALL" ? "Toutes les villes" : villeFilter}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">Toutes les villes</SelectItem>
                          {villeOptions.map((v) => (
                            <SelectItem key={v} value={v}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground uppercase tracking-wide">Département</label>
                      <Select value={departementFilter} onValueChange={(v) => setDepartementFilter(v ?? "ALL")}>
                        <SelectTrigger className="h-[34px] bg-slate-200 dark:bg-slate-700 rounded-xl text-sm">
                          <SelectValue>{departementFilter === "ALL" ? "Tous les départements" : departementFilter}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">Tous les départements</SelectItem>
                          {departementOptions.map((d) => (
                            <SelectItem key={d} value={d}>{d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
                      <label className="text-xs text-muted-foreground uppercase tracking-wide">Période personnalisée</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={customFrom}
                          onChange={(e) => setCustomFrom(e.target.value)}
                          className="h-[34px] px-2 bg-slate-200 dark:bg-slate-700 border rounded-xl text-sm flex-1"
                          aria-label="Du"
                        />
                        <span className="text-xs text-muted-foreground">→</span>
                        <input
                          type="date"
                          value={customTo}
                          onChange={(e) => setCustomTo(e.target.value)}
                          className="h-[34px] px-2 bg-slate-200 dark:bg-slate-700 border rounded-xl text-sm flex-1"
                          aria-label="Au"
                        />
                        {(customFrom || customTo) && (
                          <button
                            type="button"
                            onClick={() => { setCustomFrom(""); setCustomTo(""); }}
                            className="text-muted-foreground hover:text-foreground shrink-0"
                            aria-label="Effacer les dates"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {(customFrom || customTo) && (
                  <p className="text-xs text-muted-foreground pt-1">
                    Période personnalisée : <span className="font-semibold text-foreground">du {customFrom || "…"} au {customTo || "…"}</span>
                  </p>
                )}
                {!customFrom && !customTo && periodFilter !== "ALL" && (
                  <p className="text-xs text-muted-foreground pt-1">
                    Affichage : <span className="font-semibold text-foreground">{fiches.length} fiche{fiches.length > 1 ? "s" : ""}</span> {PERIOD_LABELS[periodFilter].toLowerCase()}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}


        <div className="space-y-4">
        {/* Filtres par statut */}
        {!isValidationMode && (profile || hydrated) && (<div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setStatusFilter("ALL")}
            aria-pressed={statusFilter === "ALL"}
            className={`relative group px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              statusFilter === "ALL" ? "bg-primary text-white" : "bg-card text-muted-foreground hover:bg-secondary border"
            }`}
          >
            <Filter className="w-4 h-4 inline mr-1" />Toutes
            {statusCounts["ALL"] != null && (
              <span className="pointer-events-none absolute left-0 top-full mt-2 w-max px-3 py-1.5 rounded-lg bg-muted text-foreground text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-50">
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
                <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 w-max px-3 py-1.5 rounded-lg bg-muted text-foreground text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-50">
                  {statusCounts[s]} fiche{statusCounts[s] > 1 ? "s" : ""} {statusCounts[s] > 1 ? STATUS_LABELS_PLURAL[s] : statusLabel(s).toLowerCase()}
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
        {loading ? <div /> : fetchError ? (
          <div className="text-center py-16 bg-card rounded-2xl border border-border space-y-3">
            <AlertCircle className="w-10 h-10 mx-auto text-destructive opacity-60" />
            <p className="font-medium text-sm text-foreground">Erreur de chargement</p>
            <Button variant="outline" className="rounded-full" onClick={() => fetchFiches(0, false)}>
              Réessayer
            </Button>
          </div>
        ) : fiches.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border">
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
                !isValidationMode && !search && statusFilter === "ALL" && !isDG ? (
                  <Link href="/fiches/nouvelle" className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#F97316] hover:bg-[#EA580C] text-white text-sm font-medium transition-colors">
                    <FilePlus className="w-4 h-4" />Nouvelle fiche
                  </Link>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className={statusFilter === "ALL" ? "space-y-6" : "space-y-5"}>
            {statusFilter === "ALL" && fichesByStatus ? (
              visibleStatuses.filter(s => fichesByStatus[s]?.length).map(s => {
                const group = fichesByStatus[s]!;
                const isExpanded = expandedGroups.has(s);
                const shown = isExpanded ? group : group.slice(0, 5);
                const remaining = group.length - 5;
                return (
                  <div key={s}>
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {statusLabel(s)}
                      </span>
                      <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5 font-medium">
                        {group.length}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {shown.map((fiche) => {
                        const st = STATUS_CARD_STYLES[fiche.status];
                        const StatusIcon = st.Icon;
                        const isHighlighted = highlightIds.has(fiche.id);
                        return (
                          <Link key={fiche.id} href={`/fiches/${fiche.id}`}>
                            <div
                              className={`flex items-center gap-4 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,0,0,0.03)] border-l-4 ${st.border} rounded-2xl px-5 py-4 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 cursor-pointer ${isHighlighted ? "ring-2 ring-[#F97316] bg-[#F97316]/5 animate-[highlightPulse_1.5s_ease-in-out]" : ""}`}
                              style={{ animation: isHighlighted ? "highlightPulse 1.5s ease-in-out" : undefined }}
                            >
                              <div className={`w-10 h-10 rounded-xl ${st.iconBg} flex items-center justify-center shrink-0`}>
                                <StatusIcon className={`w-5 h-5 ${st.icon}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-foreground truncate">{fiche.prospect_prenom} {fiche.prospect_nom}</p>
                                <p className="text-xs text-muted-foreground mt-0.5 truncate">{fiche.reference}{fiche.prospect_ville ? ` · ${fiche.prospect_ville} ${fiche.prospect_cp ?? ""}` : ""}</p>
                                {isAdminOrDG && fiche.created_by_profile && (
                                  <p className="text-xs text-muted-foreground mt-0.5 truncate">Saisi par <span className="font-medium text-foreground/70">{fiche.created_by_profile.first_name} {fiche.created_by_profile.last_name}</span></p>
                                )}
                              </div>
                              <div className="flex items-center gap-4 shrink-0">
                                {fiche.assigned_to_profile && <span className="text-xs text-muted-foreground hidden md:block">→ {fiche.assigned_to_profile.first_name} {fiche.assigned_to_profile.last_name}</span>}
                                <FicheStatusBadge status={fiche.status} />
                                {isHighlighted && <span className="text-[10px] font-semibold text-[#F97316] bg-[#F97316]/10 px-2 py-0.5 rounded-full whitespace-nowrap">Antérieure</span>}
                                <span className="text-xs text-muted-foreground hidden sm:block">{new Date(fiche.created_at).toLocaleDateString("fr-FR")}</span>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                    {group.length > 5 && (
                      <button
                        type="button"
                        onClick={() => setExpandedGroups(prev => {
                          const next = new Set(prev);
                          if (isExpanded) next.delete(s); else next.add(s);
                          return next;
                        })}
                        className="mt-2 ml-1 text-xs text-primary hover:underline"
                      >
                        {isExpanded ? "Voir moins" : `Voir plus (${remaining} restant${remaining > 1 ? "s" : ""})`}
                      </button>
                    )}
                  </div>
                );
              })
            ) : (
              fiches.slice(0, visibleCount).map((fiche) => {
                const s = STATUS_CARD_STYLES[fiche.status];
                const StatusIcon = s.Icon;
                const isHighlighted = highlightIds.has(fiche.id);
                return (
                  <Link key={fiche.id} href={`/fiches/${fiche.id}`}>
                    <div
                      className={`flex items-center gap-4 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,0,0,0.03)] border-l-4 ${s.border} rounded-2xl px-5 py-4 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 cursor-pointer ${isHighlighted ? "ring-2 ring-[#F97316] bg-[#F97316]/5 animate-[highlightPulse_1.5s_ease-in-out]" : ""}`}
                      style={{ animation: isHighlighted ? "highlightPulse 1.5s ease-in-out" : undefined }}
                    >
                      <div className={`w-10 h-10 rounded-xl ${s.iconBg} flex items-center justify-center shrink-0`}>
                        <StatusIcon className={`w-5 h-5 ${s.icon}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-foreground truncate">{fiche.prospect_prenom} {fiche.prospect_nom}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{fiche.reference}{fiche.prospect_ville ? ` · ${fiche.prospect_ville} ${fiche.prospect_cp ?? ""}` : ""}</p>
                        {isAdminOrDG && fiche.created_by_profile && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">Saisi par <span className="font-medium text-foreground/70">{fiche.created_by_profile.first_name} {fiche.created_by_profile.last_name}</span></p>
                        )}
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        {fiche.assigned_to_profile && <span className="text-xs text-muted-foreground hidden md:block">→ {fiche.assigned_to_profile.first_name} {fiche.assigned_to_profile.last_name}</span>}
                        <FicheStatusBadge status={fiche.status} />
                        {isHighlighted && <span className="text-[10px] font-semibold text-[#F97316] bg-[#F97316]/10 px-2 py-0.5 rounded-full whitespace-nowrap">Antérieure</span>}
                        <span className="text-xs text-muted-foreground hidden sm:block">{new Date(fiche.created_at).toLocaleDateString("fr-FR")}</span>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        )}

        {!loading && statusFilter === "ALL" && hasMore && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              disabled={loadingMore}
              onClick={async () => {
                setLoadingMore(true);
                const nextPage = Math.floor(fiches.length / PAGE_SIZE);
                await fetchFiches(nextPage, true);
              }}
              className="rounded-xl gap-1.5 text-xs"
            >
              {loadingMore ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <ChevronDown className="w-3.5 h-3.5" />}
              Charger 100 de plus
            </Button>
          </div>
        )}
        {!loading && statusFilter !== "ALL" && fiches.length > VISIBLE_INIT && (
          <div className="flex justify-center gap-3 flex-wrap">
            {visibleCount < fiches.length ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setVisibleCount(fiches.length)}
                className="rounded-xl gap-1.5 text-muted-foreground hover:text-foreground text-xs"
              >
                <ChevronDown className="w-3.5 h-3.5" />
                Voir plus ({fiches.length - visibleCount})
              </Button>
            ) : null}
            {visibleCount >= fiches.length && hasMore ? (
              <Button
                variant="outline"
                size="sm"
                disabled={loadingMore}
                onClick={async () => {
                  setLoadingMore(true);
                  const nextPage = Math.floor(fiches.length / PAGE_SIZE);
                  await fetchFiches(nextPage, true);
                  setVisibleCount((v) => v + PAGE_SIZE);
                }}
                className="rounded-xl gap-1.5 text-xs"
              >
                {loadingMore ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <ChevronDown className="w-3.5 h-3.5" />}
                Charger 100 de plus
              </Button>
            ) : null}
            {visibleCount > VISIBLE_INIT ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setVisibleCount(VISIBLE_INIT)}
                className="rounded-xl gap-1.5 text-muted-foreground hover:text-foreground text-xs"
              >
                <ChevronUp className="w-3.5 h-3.5" />
                Voir moins
              </Button>
            ) : null}
          </div>
        )}


        </div>
      </div>
    </>
  );
}
