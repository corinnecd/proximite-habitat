"use client";

import React, { useEffect, useLayoutEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Topbar } from "@/components/layout/Topbar";
import { ExportPdfButton } from "@/components/ui/export-pdf-button";
import { ExportCsvButton } from "@/components/ui/export-csv-button";
import { FicheStatusBadge } from "@/components/fiches/FicheStatusBadge";
import { createClient } from "@/lib/supabase/client";
import {
  deleteFicheCascade,
  getActiveCommercialsAndAdmins,
  FICHE_LIST_COLUMNS,
  type FicheListItem,
} from "@/lib/data/fiches";
import { useProfile } from "@/lib/hooks/use-profile";
import { useBranch } from "@/lib/context/branch-context";
import type { FicheStatus } from "@/types/database";
import {
  FilePlus, Clock, CheckCircle2, XCircle, Send,
  UserCheck, Archive, Trash2, AlertCircle, ArrowRight,
  CalendarDays, Calendar, User,
  ChevronDown, ChevronUp, Loader2, Euro, BarChart3, Building2, UserX,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { getCachedProfileId, getCachedProfileRole } from "@/lib/utils";
import { sendEmailFicheAffectee, sendEmailFicheDecision } from "@/lib/email";
import { toast } from "sonner";
import { StatusBlock } from "@/components/dashboard/StatusBlock";
import { PrimeSection } from "@/components/dashboard/PrimeSection";
import { AdminKpiSection } from "@/components/dashboard/AdminKpiSection";
import { CollapsibleList } from "@/components/dashboard/CollapsibleList";
import { CommercialRdvDuJour } from "@/components/dashboard/CommercialRdvDuJour";
import type { FicheAffectee, ReferentStat, CommercialStat } from "@/components/dashboard/dashboard-types";

// ── Filtre période dashboard ──────────────────────────────────────────────────
import { type PeriodFilter as DashPeriod, PERIOD_LABELS as DASH_PERIOD_LABELS, getPeriodDates as getDashPeriodDates, getPeriodLabel } from "@/lib/periods";

// ── Styles compteurs ──────────────────────────────────────────────────────────

const STATUS_ICONS: Record<FicheStatus, React.ReactNode> = {
  BROUILLON:    <Clock className="w-5 h-5" />,
  SOUMISE:      <Send className="w-5 h-5" />,
  VALIDEE:      <CheckCircle2 className="w-5 h-5" />,
  AFFECTEE:         <UserCheck className="w-5 h-5" />,
  RDV_A_REPRENDRE:  <UserX className="w-5 h-5" />,
  ACCEPTEE:         <CheckCircle2 className="w-5 h-5" />,
  RETRACTATION:   <AlertCircle className="w-5 h-5" />,
  RDV_TECHNICIEN: <Calendar className="w-5 h-5" />,
  INSTALLEE:      <CheckCircle2 className="w-5 h-5" />,
  REFUSEE:        <XCircle className="w-5 h-5" />,
  ARCHIVEE:       <Archive className="w-5 h-5" />,
};

const COUNTER_STYLES: Record<FicheStatus, string> = {
  BROUILLON:    "border-l-slate-300   text-muted-foreground",
  SOUMISE:      "border-l-blue-500    text-blue-600   dark:text-blue-400",
  VALIDEE:      "border-l-emerald-500 text-emerald-600 dark:text-emerald-400",
  AFFECTEE:         "border-l-orange-500  text-orange-600 dark:text-orange-400",
  RDV_A_REPRENDRE:  "border-l-[#F97316]  text-[#F97316]  dark:text-[#F97316]",
  ACCEPTEE:         "border-l-emerald-500 text-emerald-600 dark:text-emerald-400",
  RETRACTATION:   "border-l-purple-500  text-purple-600 dark:text-purple-400",
  RDV_TECHNICIEN: "border-l-violet-500  text-violet-600 dark:text-violet-400",
  INSTALLEE:      "border-l-teal-500    text-teal-600   dark:text-teal-400",
  REFUSEE:        "border-l-red-500     text-red-600    dark:text-red-400",
  ARCHIVEE:       "border-l-slate-300   text-muted-foreground",
};

// ── Types locaux ──────────────────────────────────────────────────────────────

interface FicheEnAttente {
  id: string;
  reference: string;
  prospect_nom: string;
  prospect_prenom: string;
  prospect_ville: string | null;
  created_at: string;
  created_by: string;
  created_by_profile: { first_name: string; last_name: string } | null;
}

interface VenteRow {
  id: string;
  created_by: string;
  assigned_to: string | null;
  updated_at: string;
  montant_ht: number | null;
  created_by_profile: { first_name: string; last_name: string } | null;
  assigned_to_profile: { first_name: string; last_name: string } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

function UrgencyBadge({ days }: { days: number }) {
  if (days === 0) return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
      Aujourd&apos;hui
    </span>
  );
  if (days <= 2) return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
      {days}j
    </span>
  );
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 flex items-center gap-1">
      <AlertCircle className="w-2.5 h-2.5" />{days}j
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { profile } = useProfile();
  const { selectedBranchId, isDG, selectedBranchName, setSelectedBranchId, branches } = useBranch();
  const [counts, setCounts] = useState<Record<FicheStatus, number>>({
    BROUILLON: 0, SOUMISE: 0, VALIDEE: 0, AFFECTEE: 0, RDV_A_REPRENDRE: 0, ACCEPTEE: 0, RETRACTATION: 0, RDV_TECHNICIEN: 0, INSTALLEE: 0, REFUSEE: 0, ARCHIVEE: 0,
  });
  const [anterieures, setAnterieures] = useState<{ id: string; reference: string; prospect_nom: string; prospect_prenom: string; status: FicheStatus; updated_at: string }[]>([]);
  const [fichesPending,         setFichesPending]         = useState<FicheEnAttente[]>([]);
  const [fichesAffectees,       setFichesAffectees]       = useState<FicheAffectee[]>([]);
  const [fichesAffecteesAdmin,  setFichesAffecteesAdmin]  = useState<FicheAffectee[]>([]);
  const [fichesAcceptees,       setFichesAcceptees]       = useState<FicheAffectee[]>([]);
  const [fichesRefusees,        setFichesRefusees]        = useState<FicheAffectee[]>([]);
  const [fichesArchivees,         setFichesArchivees]         = useState<FicheAffectee[]>([]);
  const [fichesRetractationComm,  setFichesRetractationComm]  = useState<FicheAffectee[]>([]);
  // Référent : fiches par statut
  const [prospBrouillons,   setProspBrouillons]   = useState<FicheListItem[]>([]);
  const [prospSoumises,     setProspSoumises]     = useState<FicheListItem[]>([]);
  const [prospAffectees,      setProspAffectees]      = useState<FicheListItem[]>([]);
  const [prospRdvAReprendre,  setProspRdvAReprendre]  = useState<FicheListItem[]>([]);
  const [prospAcceptees,      setProspAcceptees]      = useState<FicheListItem[]>([]);
  const [prospRetractees,   setProspRetractees]   = useState<FicheListItem[]>([]);
  const [prospRefusees,     setProspRefusees]     = useState<FicheListItem[]>([]);
  const [prospArchivees,    setProspArchivees]    = useState<FicheListItem[]>([]);
  const [referentsStats, setReferentsStats] = useState<ReferentStat[]>([]);
  const [commerciauxStats,  setCommerciauxStats]  = useState<CommercialStat[]>([]);
  const [totalVentes,       setTotalVentes]       = useState(0);
  const [mesVentes,         setMesVentes]          = useState(0);
  const [caTotal,           setCaTotal]            = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [statusOpenMobile, setStatusOpenMobile] = useState(false);
  const [ficheToDelete, setFicheToDelete] = useState<{ id: string; reference: string; nom?: string } | null>(null);
  const [ficheToAssign, setFicheToAssign] = useState<{ id: string; reference: string; nom: string; created_by: string } | null>(null);
  const [assignCommercialId, setAssignCommercialId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [commercials, setCommercials] = useState<{ id: string; first_name: string; last_name: string; role: string }[]>([]);
  const [ficheToTraiter, setFicheToTraiter] = useState<{ id: string; reference: string; nom: string; created_by: string } | null>(null);
  const [traiterDecision, setTraiterDecision] = useState<"RETRACTATION" | "REFUSEE">("RETRACTATION");
  const [traiterComment, setTraiterComment] = useState("");
  const [traiting, setTraiting] = useState(false);
  const [dashPeriod, setDashPeriod] = useState<DashPeriod>("ALL");
  const supabase = useMemo(() => createClient(), []);

  // ── Cache localStorage : affichage instantané au chargement ─────────────
  // Le rôle fait partie de la clé : un changement de rôle ne doit pas restaurer
  // le dashboard de l'ancien rôle (sections et chiffres différents).
  const cacheKey = profile ? `dash_cache_${profile.id}_${profile.role}` : null;

  useLayoutEffect(() => {
    const pid = getCachedProfileId();
    const prole = getCachedProfileRole();
    if (!pid) return;
    try {
      const raw = localStorage.getItem(`dash_cache_${pid}_${prole}`);
      if (!raw) return;
      const c = JSON.parse(raw);
      if (c.counts) setCounts(c.counts);
      if (c.caTotal != null) setCaTotal(c.caTotal);
      if (c.totalVentes != null) setTotalVentes(c.totalVentes);
      if (c.mesVentes != null) setMesVentes(c.mesVentes);
      if (c.referentsStats) setReferentsStats(c.referentsStats);
      if (c.commerciauxStats) setCommerciauxStats(c.commerciauxStats);
      if (c.fichesPending) setFichesPending(c.fichesPending);
      if (c.fichesAffecteesAdmin) setFichesAffecteesAdmin(c.fichesAffecteesAdmin);
      if (c.fichesAcceptees) setFichesAcceptees(c.fichesAcceptees);
      if (c.fichesRefusees) setFichesRefusees(c.fichesRefusees);
      if (c.fichesArchivees) setFichesArchivees(c.fichesArchivees);
      if (c.fichesAffectees) setFichesAffectees(c.fichesAffectees);
      if (c.fichesRetractationComm) setFichesRetractationComm(c.fichesRetractationComm);
      if (c.prospBrouillons) setProspBrouillons(c.prospBrouillons);
      if (c.prospSoumises) setProspSoumises(c.prospSoumises);
      if (c.prospAffectees) setProspAffectees(c.prospAffectees);
      if (c.prospRdvAReprendre) setProspRdvAReprendre(c.prospRdvAReprendre);
      if (c.prospRetractees) setProspRetractees(c.prospRetractees);
      if (c.prospAcceptees) setProspAcceptees(c.prospAcceptees);
      if (c.prospRefusees) setProspRefusees(c.prospRefusees);
      if (c.prospArchivees) setProspArchivees(c.prospArchivees);
      setLoading(false);
    } catch { /* ignore */ }
  }, []);

  const saveCache = useCallback((data: Record<string, unknown>) => {
    if (!cacheKey) return;
    try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch { /* ignore */ }
  }, [cacheKey]);

  const fetchData = useCallback(async (period: DashPeriod = "ALL") => {
    if (!profile) return;
    const isReferent = profile.role === "PROSPECTEUR" || profile.role === "CHEF_EQUIPE";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cd: Record<string, any> = {};
    try {
    const isAdmin       = profile.role === "DIRECTION" || profile.role === "DIRECTION_GENERALE" || profile.role === "SUPER_ADMIN";
    const isCommercial  = profile.role === "COMMERCIAL";
    const branchFilter  = (isDG && selectedBranchId !== "all") ? selectedBranchId : null;
    const periodDates = getDashPeriodDates(period);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bq = (q: any) => branchFilter ? q.eq("organization_id", branchFilter) : q;

    // ── Toutes les requêtes lancées en parallèle ──────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const promises: PromiseLike<any>[] = [];
    const keys: string[] = [];

    // Compteurs par statut — une seule requête au lieu de 6-7
    const statusesToCount: FicheStatus[] = isReferent
      ? ["BROUILLON", "SOUMISE", "VALIDEE", "AFFECTEE", "RDV_A_REPRENDRE", "ACCEPTEE", "RETRACTATION", "RDV_TECHNICIEN", "INSTALLEE", "REFUSEE", "ARCHIVEE"]
      : ["SOUMISE", "VALIDEE", "AFFECTEE", "RDV_A_REPRENDRE", "ACCEPTEE", "RETRACTATION", "RDV_TECHNICIEN", "INSTALLEE", "REFUSEE", "ARCHIVEE"];
    {
      let q = supabase.from("fiches").select("status").in("status", statusesToCount);
      if (isReferent) q = q.eq("created_by", profile.id);
      if (isCommercial) q = q.eq("assigned_to", profile.id);
      if (branchFilter) q = q.eq("organization_id", branchFilter);
      if (periodDates) q = q.gte("updated_at", `${periodDates.from}T00:00:00Z`).lte("updated_at", `${periodDates.to}T23:59:59Z`);
      keys.push("statusCounts");
      promises.push(q);
    }

    // Admin/DG : fiches par statut (sans fiche_history pour aller vite, limité à 20)
    const ficheAdminCols =
      "id, reference, prospect_nom, prospect_prenom, prospect_ville, prospect_cp, created_at, updated_at, created_by, montant_ht, " +
      "created_by_profile:profiles!fiches_created_by_fkey(first_name, last_name), " +
      "fiche_history(action, old_status, new_status, comment, created_at, user:profiles!fiche_history_user_id_fkey(first_name, last_name))";
    const ficheAdminColsLight =
      "id, reference, prospect_nom, prospect_prenom, prospect_ville, prospect_cp, created_at, updated_at, created_by, montant_ht, " +
      "created_by_profile:profiles!fiches_created_by_fkey(first_name, last_name)";

    if (isAdmin) {
      keys.push("commercials");
      promises.push(getActiveCommercialsAndAdmins(supabase));

      keys.push("pending");
      let pq = bq(supabase.from("fiches").select(ficheAdminCols).eq("status", "SOUMISE"));
      if (periodDates) pq = pq.gte("created_at", `${periodDates.from}T00:00:00Z`).lte("created_at", `${periodDates.to}T23:59:59Z`);
      promises.push(pq.order("created_at", { ascending: false }).limit(30));

      keys.push("affecteesAdmin");
      let aq = bq(supabase.from("fiches").select(ficheAdminCols).eq("status", "AFFECTEE"));
      if (periodDates) aq = aq.gte("updated_at", `${periodDates.from}T00:00:00Z`).lte("updated_at", `${periodDates.to}T23:59:59Z`);
      promises.push(aq.order("updated_at", { ascending: false }).limit(30));

      keys.push("acceptees");
      let accq = bq(supabase.from("fiches").select(ficheAdminColsLight).eq("status", "ACCEPTEE"));
      if (periodDates) accq = accq.gte("updated_at", `${periodDates.from}T00:00:00Z`).lte("updated_at", `${periodDates.to}T23:59:59Z`);
      promises.push(accq.order("updated_at", { ascending: false }).limit(30));

      keys.push("refusees");
      let rq = bq(supabase.from("fiches").select(ficheAdminColsLight).eq("status", "REFUSEE"));
      if (periodDates) rq = rq.gte("updated_at", `${periodDates.from}T00:00:00Z`).lte("updated_at", `${periodDates.to}T23:59:59Z`);
      promises.push(rq.order("updated_at", { ascending: false }).limit(30));

      keys.push("archivees");
      let arq = bq(supabase.from("fiches").select(ficheAdminColsLight).eq("status", "ARCHIVEE"));
      if (periodDates) arq = arq.gte("updated_at", `${periodDates.from}T00:00:00Z`).lte("updated_at", `${periodDates.to}T23:59:59Z`);
      promises.push(arq.order("updated_at", { ascending: false }).limit(30));
    }

    // Ventes (ADMIN + REFERENT). Le COMMERCIAL est exclu : son CA et son nombre
    // de ventes sont calculés depuis `commAcceptees` (bloc dédié plus bas), qui
    // sert aussi à l'affichage de la liste — une seule source évite deux écritures
    // concurrentes de caTotal/mesVentes.
    if (isAdmin || isReferent) {
      let vq = supabase.from("fiches").select(
        "id, created_by, assigned_to, updated_at, montant_ht, " +
        "created_by_profile:profiles!fiches_created_by_fkey(first_name, last_name), " +
        "assigned_to_profile:profiles!fiches_assigned_to_fkey(first_name, last_name)"
      ).eq("status", "ACCEPTEE");
      if (isReferent) vq = vq.eq("created_by", profile.id);
      if (branchFilter) vq = vq.eq("organization_id", branchFilter);
      if (periodDates) vq = vq.gte("updated_at", `${periodDates.from}T00:00:00Z`).lte("updated_at", `${periodDates.to}T23:59:59Z`);
      // Agrégation côté client : on borne explicitement le volume rapatrié
      // (PostgREST plafonne déjà à 1000, on garde les ventes les plus récentes).
      vq = vq.order("updated_at", { ascending: false }).limit(1000);
      keys.push("ventes");
      promises.push(vq);
    }

    if (isAdmin) {
      keys.push("allReferents");
      { let rq = supabase.from("profiles").select("id, first_name, last_name").eq("role", "PROSPECTEUR").eq("is_active", true);
        if (branchFilter) rq = rq.eq("organization_id", branchFilter);
        promises.push(rq); }
      keys.push("allCommerciaux");
      { let cq = supabase.from("profiles").select("id, first_name, last_name").eq("role", "COMMERCIAL").eq("is_active", true);
        if (branchFilter) cq = cq.eq("organization_id", branchFilter);
        promises.push(cq); }
    }

    // Commercial : ses fiches
    if (isCommercial) {
      const commCols =
        "id, reference, prospect_nom, prospect_prenom, prospect_ville, prospect_cp, updated_at, created_by, montant_ht, " +
        "created_by_profile:profiles!fiches_created_by_fkey(first_name, last_name)";
      keys.push("commAffectees", "commRetract", "commAcceptees", "commRefusees", "commArchivees");

      const addPeriodFilter = (q: any) => {
        if (periodDates) q = q.gte("updated_at", `${periodDates.from}T00:00:00Z`).lte("updated_at", `${periodDates.to}T23:59:59Z`);
        return q;
      };

      promises.push(
        addPeriodFilter(supabase.from("fiches").select(commCols).eq("status", "AFFECTEE").eq("assigned_to", profile.id)).order("updated_at", { ascending: true }),
        addPeriodFilter(supabase.from("fiches").select(commCols).eq("status", "RETRACTATION").eq("assigned_to", profile.id)).order("updated_at", { ascending: false }),
        addPeriodFilter(supabase.from("fiches").select(commCols).eq("status", "ACCEPTEE").eq("assigned_to", profile.id)).order("updated_at", { ascending: false }),
        addPeriodFilter(supabase.from("fiches").select(commCols).eq("status", "REFUSEE").eq("assigned_to", profile.id)).order("updated_at", { ascending: false }),
        addPeriodFilter(supabase.from("fiches").select(commCols).eq("status", "ARCHIVEE").eq("assigned_to", profile.id)).order("updated_at", { ascending: false }),
      );
    }

    // Antérieures
    if (!isReferent) {
      const pad2 = (n: number) => String(n).padStart(2, "0");
      const now2 = new Date();
      const q2 = Math.floor(now2.getMonth() / 3);
      const quarterStart = new Date(now2.getFullYear(), q2 * 3, 1);
      const qFrom = `${quarterStart.getFullYear()}-${pad2(quarterStart.getMonth() + 1)}-${pad2(quarterStart.getDate())}`;
      let aq = supabase.from("fiches").select("id, reference, prospect_nom, prospect_prenom, status, updated_at");
      if (isCommercial) aq = aq.eq("assigned_to", profile.id);
      else aq = aq.neq("status", "BROUILLON");
      aq = bq(aq);
      aq = aq.lt("updated_at", `${qFrom}T00:00:00Z`).order("updated_at", { ascending: false }).limit(50);
      keys.push("anterieures");
      promises.push(aq);
    }

    // Référent : fiches par statut
    if (isReferent) {
      const statuses: FicheStatus[] = ["BROUILLON", "SOUMISE", "AFFECTEE", "RDV_A_REPRENDRE", "RETRACTATION", "ACCEPTEE", "RDV_TECHNICIEN", "INSTALLEE", "REFUSEE", "ARCHIVEE"];
      for (const s of statuses) {
        keys.push(`prosp_${s}`);
        let rq = supabase.from("fiches").select(FICHE_LIST_COLUMNS).eq("created_by", profile.id).eq("status", s);
        if (periodDates) rq = rq.gte("updated_at", `${periodDates.from}T00:00:00Z`).lte("updated_at", `${periodDates.to}T23:59:59Z`);
        promises.push(rq.order("created_at", { ascending: false }));
      }
    }


    // ── Exécution parallèle ───────────────────────────────────────────────
    const settled = await Promise.all(promises);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = new Map<string, any>();
    keys.forEach((k, i) => r.set(k, settled[i]));

    // ── Dispatch des résultats ────────────────────────────────────────────
    const allCounts: Record<FicheStatus, number> = {
      BROUILLON: 0, SOUMISE: 0, VALIDEE: 0, AFFECTEE: 0, RDV_A_REPRENDRE: 0, ACCEPTEE: 0, RETRACTATION: 0, RDV_TECHNICIEN: 0, INSTALLEE: 0, REFUSEE: 0, ARCHIVEE: 0,
    };
    const statusRows = (r.get("statusCounts")?.data ?? []) as { status: FicheStatus }[];
    for (const row of statusRows) {
      if (allCounts[row.status] !== undefined) allCounts[row.status]++;
    }
    setCounts(allCounts);
    cd.counts = allCounts;

    if (isAdmin) {
      setCommercials(r.get("commercials") ?? []);
      const _pending = (r.get("pending")?.data as unknown as FicheEnAttente[]) ?? [];
      const _affAdmin = (r.get("affecteesAdmin")?.data as unknown as FicheAffectee[]) ?? [];
      const _acc = (r.get("acceptees")?.data as unknown as FicheAffectee[]) ?? [];
      const _ref = (r.get("refusees")?.data as unknown as FicheAffectee[]) ?? [];
      const _arch = (r.get("archivees")?.data as unknown as FicheAffectee[]) ?? [];
      setFichesPending(_pending);
      setFichesAffecteesAdmin(_affAdmin);
      setFichesAcceptees(_acc);
      setFichesRefusees(_ref);
      setFichesArchivees(_arch);
      cd.fichesPending = _pending.slice(0, 20);
      cd.fichesAffecteesAdmin = _affAdmin.slice(0, 20);
      cd.fichesAcceptees = _acc.slice(0, 20);
      cd.fichesRefusees = _ref.slice(0, 20);
      cd.fichesArchivees = _arch.slice(0, 20);
    }

    if (isAdmin || isReferent) {
      const rows = ((r.get("ventes")?.data ?? r.get("ventes")) as unknown as VenteRow[]) ?? [];
      const computedCa = rows.reduce((sum, v) => sum + (v.montant_ht ? Number(v.montant_ht) : 0), 0);
      setTotalVentes(rows.length);
      setCaTotal(computedCa);
      if (isReferent) setMesVentes(rows.length);
      cd.totalVentes = rows.length; cd.caTotal = computedCa; cd.mesVentes = rows.length;

      if (isAdmin) {
        const now = new Date();
        const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const pMap = new Map<string, { id: string; nom: string; ventes: number; ventesMoisCourant: number; ventesParMois: Map<string, number>; ca: number }>();
        for (const p of (r.get("allReferents")?.data ?? [])) {
          pMap.set(p.id, { id: p.id, nom: `${p.first_name} ${p.last_name}`, ventes: 0, ventesMoisCourant: 0, ventesParMois: new Map(), ca: 0 });
        }
        for (const v of rows) {
          if (!v.created_by) continue;
          if (!pMap.has(v.created_by) && v.created_by_profile) {
            pMap.set(v.created_by, { id: v.created_by, nom: `${v.created_by_profile.first_name} ${v.created_by_profile.last_name}`, ventes: 0, ventesMoisCourant: 0, ventesParMois: new Map(), ca: 0 });
          }
          const entry = pMap.get(v.created_by);
          if (!entry) continue;
          entry.ventes++;
          entry.ca += v.montant_ht ? Number(v.montant_ht) : 0;
          const d = new Date(v.updated_at);
          const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          entry.ventesParMois.set(ym, (entry.ventesParMois.get(ym) ?? 0) + 1);
          if (ym === currentYM) entry.ventesMoisCourant++;
        }
        const sortedRef = Array.from(pMap.values()).map((p) => {
          const primes = Array.from(p.ventesParMois.values()).filter((x) => x >= 3).length;
          return { id: p.id, nom: p.nom, ventes: p.ventes, ventesMoisCourant: p.ventesMoisCourant, primes, prochainPalier: Math.max(0, 3 - p.ventesMoisCourant), ca: p.ca };
        }).sort((a, b) => b.ventes - a.ventes);
        setReferentsStats(sortedRef);
        cd.referentsStats = sortedRef;

        const cMap = new Map<string, CommercialStat>();
        for (const p of (r.get("allCommerciaux")?.data ?? [])) {
          cMap.set(p.id, { id: p.id, nom: `${p.first_name} ${p.last_name}`, ventes: 0, ca: 0 });
        }
        for (const v of rows) {
          if (!v.assigned_to) continue;
          const existing = cMap.get(v.assigned_to);
          const mt = v.montant_ht ? Number(v.montant_ht) : 0;
          if (existing) { existing.ventes++; existing.ca += mt; }
          else {
            const nom = v.assigned_to_profile ? `${v.assigned_to_profile.first_name} ${v.assigned_to_profile.last_name}` : "Inconnu";
            cMap.set(v.assigned_to, { id: v.assigned_to, nom, ventes: 1, ca: mt });
          }
        }
        const sortedComm = Array.from(cMap.values()).sort((a, b) => b.ventes - a.ventes);
        setCommerciauxStats(sortedComm);
        cd.commerciauxStats = sortedComm;
      }
    }

    if (isCommercial) {
      const _commAff = (r.get("commAffectees")?.data as unknown as FicheAffectee[]) ?? [];
      const _commRetract = (r.get("commRetract")?.data as unknown as FicheAffectee[]) ?? [];
      const commAccepteesRows = (r.get("commAcceptees")?.data as unknown as FicheAffectee[]) ?? [];
      const _commRef = (r.get("commRefusees")?.data as unknown as FicheAffectee[]) ?? [];
      const _commArch = (r.get("commArchivees")?.data as unknown as FicheAffectee[]) ?? [];
      setFichesAffectees(_commAff);
      setFichesRetractationComm(_commRetract);
      setFichesAcceptees(commAccepteesRows);
      setFichesRefusees(_commRef);
      setFichesArchivees(_commArch);
      cd.fichesAffectees = _commAff.slice(0, 20);
      cd.fichesRetractationComm = _commRetract.slice(0, 20);
      cd.fichesAcceptees = commAccepteesRows.slice(0, 20);
      cd.fichesRefusees = _commRef.slice(0, 20);
      cd.fichesArchivees = _commArch.slice(0, 20);
      const commCA = commAccepteesRows.reduce((sum, f) => sum + (f.montant_ht ? Number(f.montant_ht) : 0), 0);
      setMesVentes(commAccepteesRows.length);
      setCaTotal(commCA);
      cd.mesVentes = commAccepteesRows.length; cd.caTotal = commCA;
    }

    if (!isReferent) setAnterieures((r.get("anterieures")?.data as typeof anterieures) ?? []);

    if (isReferent) {
      const _pB = (r.get("prosp_BROUILLON")?.data as FicheListItem[]) ?? [];
      const _pS = (r.get("prosp_SOUMISE")?.data as FicheListItem[]) ?? [];
      const _pA = (r.get("prosp_AFFECTEE")?.data as FicheListItem[]) ?? [];
      const _pR = (r.get("prosp_RDV_A_REPRENDRE")?.data as FicheListItem[]) ?? [];
      const _pRt = (r.get("prosp_RETRACTATION")?.data as FicheListItem[]) ?? [];
      const _pAc = (r.get("prosp_ACCEPTEE")?.data as FicheListItem[]) ?? [];
      const _pRf = (r.get("prosp_REFUSEE")?.data as FicheListItem[]) ?? [];
      const _pAr = (r.get("prosp_ARCHIVEE")?.data as FicheListItem[]) ?? [];
      setProspBrouillons(_pB);
      setProspSoumises(_pS);
      setProspAffectees(_pA);
      setProspRdvAReprendre(_pR);
      setProspRetractees(_pRt);
      setProspAcceptees(_pAc);
      setProspRefusees(_pRf);
      setProspArchivees(_pAr);
      cd.prospBrouillons = _pB.slice(0, 20);
      cd.prospSoumises = _pS.slice(0, 20);
      cd.prospAffectees = _pA.slice(0, 20);
      cd.prospRdvAReprendre = _pR.slice(0, 20);
      cd.prospRetractees = _pRt.slice(0, 20);
      cd.prospAcceptees = _pAc.slice(0, 20);
      cd.prospRefusees = _pRf.slice(0, 20);
      cd.prospArchivees = _pAr.slice(0, 20);
    }


    saveCache(cd);
    setLoading(false);
    } catch (err) {
      console.error("fetchData error", err);
      setFetchError("Erreur lors du chargement des données. Veuillez recharger la page.");
      setLoading(false);
    }
  }, [profile, supabase, isDG, selectedBranchId, saveCache]);

  useEffect(() => {
    if (!profile) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData(dashPeriod);

    const channel = supabase
      .channel("fiches-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "fiches" }, () => {
        fetchData(dashPeriod);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile, supabase, fetchData, dashPeriod, selectedBranchId]);

  // ── Affectation rapide ───────────────────────────────────────────────────────
  async function handleQuickAssign() {
    if (!ficheToAssign || !assignCommercialId || !profile) return;
    setAssigning(true);
    try {
      const { error } = await supabase.rpc("transition_fiche", {
        p_fiche_id: ficheToAssign.id,
        p_new_status: "AFFECTEE",
        p_assigned_to: assignCommercialId,
      });
      if (error) throw error;
      // Retirer la fiche de la liste d'attente
      setFichesPending((prev) => prev.filter((f) => f.id !== ficheToAssign.id));
      setCounts((prev) => ({ ...prev, SOUMISE: Math.max(0, prev.SOUMISE - 1), AFFECTEE: prev.AFFECTEE + 1 }));
      toast.success(`Fiche ${ficheToAssign.reference} affectée`);
      // Email au commercial (non bloquant)
      await sendEmailFicheAffectee(ficheToAssign.id).catch(() => {});
      setFicheToAssign(null);
      setAssignCommercialId("");
    } catch {
      toast.error("Erreur lors de l'affectation");
    } finally {
      setAssigning(false);
    }
  }

  // ── Traitement rapide fiche (commercial) ─────────────────────────────────────
  async function handleTraiter() {
    if (!ficheToTraiter || !profile) return;
    setTraiting(true);
    try {
      const { error } = await supabase.rpc("transition_fiche", {
        p_fiche_id: ficheToTraiter.id,
        p_new_status: traiterDecision,
        p_comment: traiterComment.trim() || null,
      });
      if (error) throw error;
      setFichesAffectees((prev) => prev.filter((f) => f.id !== ficheToTraiter.id));
      setCounts((prev) => ({
        ...prev,
        AFFECTEE: Math.max(0, prev.AFFECTEE - 1),
        [traiterDecision]: prev[traiterDecision] + 1,
      }));
      toast.success(`Fiche ${ficheToTraiter.reference} ${traiterDecision === "RETRACTATION" ? "en attente de validation ✓" : "refusée"}`);

      // Email au référent uniquement pour REFUSEE (RETRACTATION = étape intermédiaire)
      if (traiterDecision === "REFUSEE" && ficheToTraiter.created_by) {
        void (async () => {
          try {
            await sendEmailFicheDecision(ficheToTraiter.id, "REFUSEE", traiterComment.trim() || undefined);
          } catch { /* silencieux */ }
        })();
      }

      setFicheToTraiter(null);
      setTraiterComment("");
    } catch {
      toast.error("Erreur lors du traitement");
    } finally {
      setTraiting(false);
    }
  }

  const totalFiches   = Object.values(counts).reduce((a, b) => a + b, 0);
  const isReferent = profile?.role === "PROSPECTEUR" || profile?.role === "CHEF_EQUIPE";
  const isAdmin       = profile?.role === "DIRECTION" || profile?.role === "SUPER_ADMIN";
  const isAdminOrDG   = isAdmin || profile?.role === "DIRECTION_GENERALE";
  const isCommercial  = profile?.role === "COMMERCIAL";

  const _dashPl = getPeriodLabel(dashPeriod);
  const dashPeriodSuffix = _dashPl ? ` (${_dashPl})` : "";
  const isAllPeriod = dashPeriod === "ALL";

  const getDashboardCsvData = useCallback(() => {
    if (isAdminOrDG && referentsStats.length > 0) {
      return {
        columns: [
          { key: "nom", label: "Référent" },
          { key: "ventes", label: "Ventes" },
          { key: "bonus", label: "Ventes en +" },
          { key: "ca", label: "CA HT (€)" },
        ] as { key: keyof { nom: string; ventes: number; bonus: number; ca: number }; label: string }[],
        rows: referentsStats.map((r) => ({ nom: r.nom, ventes: r.ventes, bonus: Math.max(0, r.ventes - 3), ca: r.ca })),
      };
    }
    return {
      columns: [{ key: "info", label: "Info" }, { key: "valeur", label: "Valeur" }] as { key: keyof { info: string; valeur: string }; label: string }[],
      rows: [
        { info: "CA Total HT", valeur: String(caTotal) },
        { info: "Ventes totales", valeur: String(totalVentes) },
        { info: "Période", valeur: DASH_PERIOD_LABELS[dashPeriod] },
      ],
    };
  }, [isAdminOrDG, referentsStats, caTotal, totalVentes, dashPeriod]);

  const visibleStatuses: FicheStatus[] = isReferent
    ? ["BROUILLON", "SOUMISE", "AFFECTEE", "RDV_A_REPRENDRE", "ACCEPTEE", "REFUSEE", "ARCHIVEE"]
    : isCommercial
    ? ["AFFECTEE", "RDV_A_REPRENDRE", "RETRACTATION", "ACCEPTEE", "REFUSEE", "ARCHIVEE"]
    : isAdminOrDG
    ? ["SOUMISE", "AFFECTEE", "RDV_A_REPRENDRE", "ACCEPTEE", "RETRACTATION", "REFUSEE", "ARCHIVEE"]
    : ["SOUMISE", "AFFECTEE", "RDV_A_REPRENDRE", "ACCEPTEE", "RETRACTATION", "REFUSEE", "ARCHIVEE"];


  // ── Dialog affectation rapide ────────────────────────────────────────────
  const assignDialog = (
    <Dialog open={!!ficheToAssign} onOpenChange={(open) => { if (!open) { setFicheToAssign(null); setAssignCommercialId(""); } }}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Affecter la fiche</DialogTitle>
          <DialogDescription>
            Choisissez un commercial pour la{" "}
            <span className="font-semibold text-foreground">fiche de {ficheToAssign?.nom}</span>
          </DialogDescription>
        </DialogHeader>
        <Select value={assignCommercialId} onValueChange={(v) => setAssignCommercialId(v ?? "")}>
          <SelectTrigger className="rounded-xl h-11">
            <SelectValue placeholder="Choisir un commercial…" />
        </SelectTrigger>
          <SelectContent>
            {commercials
              .filter((c) => c.role === "COMMERCIAL" || c.role === "DIRECTION")
              .map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
              ))}
          </SelectContent>
        </Select>
        {/* Workaround: Base UI Select passes null on clear — guard handled in onValueChange */}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" className="rounded-xl" />}>Annuler</DialogClose>
          <Button
            className="bg-[#F97316] hover:bg-[#EA580C] text-white rounded-full px-4 gap-2"
            onClick={handleQuickAssign}
            disabled={!assignCommercialId || assigning}
          >
            {assigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
            Affecter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // ── Dialog suppression brouillon ─────────────────────────────────────────
  const deleteDialog = (
    <Dialog open={!!ficheToDelete} onOpenChange={(open) => { if (!open) setFicheToDelete(null); }}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Supprimer le brouillon</DialogTitle>
          <DialogDescription>
            Supprimer définitivement la{" "}
            <span className="font-semibold text-foreground">fiche de {ficheToDelete?.nom ?? ""}</span>
            {" "}? Cette action est irréversible.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" className="rounded-xl" />}>
            Annuler
          </DialogClose>
          <Button
            variant="destructive"
            className="rounded-xl"
            onClick={async () => {
              if (!ficheToDelete) return;
              try {
                await deleteFicheCascade(supabase, ficheToDelete.id);
                setFicheToDelete(null);
                fetchData();
              } catch {
                toast.error("Erreur lors de la suppression, veuillez réessayer.");
              }
            }}
          >
            Supprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (fetchError) {
    return (
      <>
        <Topbar titleAs="p"
          title="Tableau de bord"
          actions={!isReferent ? (
            <div className="flex items-center gap-2">
              <ExportPdfButton
                title="Tableau de bord"
                subtitle={getPeriodLabel(dashPeriod)
                  ? `Période : ${DASH_PERIOD_LABELS[dashPeriod]} (${getPeriodLabel(dashPeriod)})`
                  : undefined}
                filename="dashboard"
              />
              <ExportCsvButton filename="dashboard" getData={getDashboardCsvData} />
            </div>
          ) : undefined}
        />
        <div className="p-4 sm:p-6 lg:p-8 flex items-center justify-center min-h-[40vh]">
          <div className="text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
            <p className="font-medium text-foreground">{fetchError}</p>
            <Button variant="outline" className="rounded-xl" onClick={() => { setFetchError(null); setLoading(true); fetchData(); }}>
              Réessayer
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar
        title="Tableau de bord"
        actions={!isReferent ? (
          <div className="flex items-center gap-2">
            <ExportPdfButton
              title="Tableau de bord"
              subtitle={getPeriodLabel(dashPeriod)
                ? `Période : ${DASH_PERIOD_LABELS[dashPeriod]} (${getPeriodLabel(dashPeriod)})`
                : undefined}
              filename="dashboard"
            />
            <ExportCsvButton filename="dashboard" getData={getDashboardCsvData} />
          </div>
        ) : undefined}
      />
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">

        {/* ═══════════════════════════════════════════════════════════════════
            HERO DASHBOARD — bloc navy signature avec greeting + KPI vedette
            + filtre période intégré + sélecteur succursale DG
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="hero-surface rounded-3xl p-6 sm:p-8">
          <div className="relative z-10">
            {/* Sélecteur succursale (DG uniquement) */}
            {isDG && (
              <div className="mb-6 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-4 h-4 text-[#F97316]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] tracking-[1.2px] uppercase text-white/50 font-medium">
                    {selectedBranchName ? "Succursale filtrée" : "Vue consolidée"}
                  </div>
                  <div className="text-sm text-white font-medium truncate">
                    {selectedBranchName ?? "Toutes les succursales"}
                  </div>
                </div>
                <div className="relative flex-shrink-0">
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    className="appearance-none bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-medium pl-3 pr-8 py-1.5 rounded-lg cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#F97316]/50 transition-colors"
                  >
                    <option value="all" className="text-foreground">Toutes les succursales</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id} className="text-foreground">
                        {b.name}{b.is_hq ? " (Siège)" : ""}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/60 pointer-events-none" />
                </div>
              </div>
            )}

            {/* Greeting + KPI vedette */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-6">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-white/60">
                    {(() => {
                      const h = new Date().getHours();
                      return h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";
                    })()}
                  </span>
                </div>
                <h1 className="font-heading text-4xl sm:text-5xl text-white tracking-tight leading-none mb-2">
                  {profile?.first_name}
                </h1>
                <p className="text-sm text-white/60 max-w-md leading-relaxed">
                  {isReferent
                    ? `${counts.BROUILLON} brouillon${counts.BROUILLON > 1 ? "s" : ""} en cours · ${counts.SOUMISE} soumise${counts.SOUMISE > 1 ? "s" : ""} en attente de validation`
                    : isCommercial
                    ? `${counts.AFFECTEE} fiche${counts.AFFECTEE > 1 ? "s" : ""} à traiter · ${counts.ACCEPTEE} contrat${counts.ACCEPTEE > 1 ? "s" : ""} signé${counts.ACCEPTEE > 1 ? "s" : ""}`
                    : `${totalFiches} fiche${totalFiches > 1 ? "s" : ""} au total · ${counts.SOUMISE} à valider`}
                </p>
                {profile?.role !== "DIRECTION_GENERALE" && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link href="/fiches/nouvelle">
                      <button className="bg-[#F97316] hover:bg-[#EA580C] text-white rounded-full px-5 py-2 text-sm font-medium inline-flex items-center gap-2 transition-colors">
                        <FilePlus className="w-4 h-4" />Nouvelle fiche
                      </button>
                    </Link>
                    {counts.SOUMISE > 0 && !isCommercial && (
                      <Link href="/fiches?status=SOUMISE">
                        <button className="bg-white/10 hover:bg-white/15 text-white border border-white/15 rounded-full px-4 py-2 text-sm font-medium inline-flex items-center gap-2 transition-colors">
                          <CheckCircle2 className="w-4 h-4" />{counts.SOUMISE} à valider
                        </button>
                      </Link>
                    )}
                  </div>
                )}
              </div>

            </div>

            {/* Filtre période intégré */}
            {(
              <div className="pt-5 border-t border-white/10">
                <div className="flex items-center gap-2 mb-3">
                  <CalendarDays className="w-3.5 h-3.5 text-white/50" />
                  <span className="text-[10px] tracking-[1.2px] uppercase text-white/50 font-medium">Période d&apos;activité</span>
                  {getPeriodLabel(dashPeriod) && (
                    <span className="text-[11px] text-white/70">· {getPeriodLabel(dashPeriod)}</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start">
                  {(Object.keys(DASH_PERIOD_LABELS) as DashPeriod[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setDashPeriod(p)}
                      className={`px-3 min-h-9 sm:min-h-0 py-1.5 rounded-full text-xs font-medium transition-all ${
                        dashPeriod === p
                          ? "bg-[#F97316] text-white"
                          : "bg-white/8 text-white/70 hover:bg-white/12 border border-white/10"
                      }`}
                    >
                      {DASH_PERIOD_LABELS[p]}
                    </button>
                  ))}
                  <Link
                    href={`/fiches?status=ARCHIVEE${anterieures.length > 0 ? `&highlight=${anterieures.map(f => f.id).join(",")}` : ""}`}
                    className="px-3 min-h-9 sm:min-h-0 py-1.5 rounded-full text-xs font-medium transition-all bg-white/8 text-white/70 hover:bg-white/12 border border-white/10 inline-flex items-center gap-1.5"
                  >
                    <Archive className="w-3 h-3" />
                    Antérieures
                    {anterieures.length > 0 && (
                      <span className="bg-[#F97316]/20 text-[#F97316] text-[10px] font-bold px-1.5 py-0.5 rounded-full">{anterieures.length}</span>
                    )}
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tout le contenu data-driven apparaît d'un coup */}
        <div className="space-y-6">

        {/* Compteurs par statut */}
        <div>
          {/* Mobile : bouton repliable */}
          <button
            type="button"
            onClick={() => setStatusOpenMobile(!statusOpenMobile)}
            className="sm:hidden w-full flex items-center justify-between px-5 py-3.5 bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] mb-3"
            aria-expanded={statusOpenMobile}
          >
            <span className="text-sm font-semibold tracking-tight">Statuts des fiches ({totalFiches})</span>
            {statusOpenMobile ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          <div className={`${statusOpenMobile ? "grid" : "hidden"} sm:grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-flow-col xl:auto-cols-fr gap-3`}>
            {visibleStatuses.map((status) => (
              <Link key={status} href={`/fiches?status=${status}`}>
                <Card className={`border border-border border-l-4 shadow-sm ${COUNTER_STYLES[status]} hover:-translate-y-1.5 hover:shadow-xl transition-all duration-200 cursor-pointer`}>
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-3">{STATUS_ICONS[status]}</div>
                    <AnimatedCounter value={counts[status]} className="text-2xl sm:text-3xl font-bold tracking-tight" loading={loading} />
                    <div className="text-xs mt-2 opacity-70 overflow-hidden">
                      {isCommercial && status === "AFFECTEE"
                        ? <span className="inline-flex items-center rounded-full px-2 py-0.5 font-medium bg-orange-100 text-orange-700">À traiter</span>
                        : <FicheStatusBadge status={status} short />}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 truncate">
                      {dashPeriod === "ALL" ? "Toutes les dates" : getPeriodLabel(dashPeriod)}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Prime du mois (référent) ─────────────────────────────────── */}
        {isReferent && <PrimeSection prospAcceptees={prospAcceptees} />}

        {/* ── Section REFERENT : KPIs ventes / CA / taux de conversion ──────── */}
        {isReferent && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-card border border-border border-l-4 border-l-emerald-500 rounded-2xl p-5 shadow-sm hover:-translate-y-1.5 hover:shadow-xl transition-all duration-200">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
              </div>
              <AnimatedCounter value={mesVentes} className="text-2xl sm:text-3xl font-bold" loading={loading} />
              <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">{isAllPeriod ? "Ventes réalisées" : <>Ventes<span className="normal-case"> ({getPeriodLabel(dashPeriod)})</span></>}</p>
            </div>
            <div className="bg-card border border-border border-l-4 border-l-amber-500 rounded-2xl p-5 shadow-sm hover:-translate-y-1.5 hover:shadow-xl transition-all duration-200">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Euro className="w-5 h-5 text-amber-600" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-bold tabular-nums">{caTotal.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">{isAllPeriod ? "CA HT total" : <>CA HT<span className="normal-case"> ({getPeriodLabel(dashPeriod)})</span></>}</p>
            </div>
            <div className="bg-card border border-border border-l-4 border-l-blue-500 rounded-2xl p-5 shadow-sm hover:-translate-y-1.5 hover:shadow-xl transition-all duration-200">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-bold tabular-nums">{mesVentes > 0 ? Math.round(caTotal / mesVentes).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }) : "0 €"}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">{isAllPeriod ? "CA moyen par fiche" : <>CA moyen<span className="normal-case"> ({getPeriodLabel(dashPeriod)})</span></>}</p>
            </div>
            {(() => {
              const totalTraitees = mesVentes + prospRefusees.length;
              const convRate = totalTraitees > 0 ? Math.round((mesVentes / totalTraitees) * 100) : 0;
              return (
                <div className="bg-card border border-border border-l-4 border-l-orange-500 rounded-2xl p-5 shadow-sm hover:-translate-y-1.5 hover:shadow-xl transition-all duration-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                      <BarChart3 className="w-5 h-5 text-orange-600" />
                    </div>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold tabular-nums">{`${convRate}%`}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">Taux de conversion</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{mesVentes} acceptée{mesVentes > 1 ? "s" : ""} / {totalTraitees} traitée{totalTraitees > 1 ? "s" : ""}</p>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── Section ADMIN/DG : KPI CA consolidé ────────────────────────────── */}
        {isAdminOrDG && (
          <AdminKpiSection
            caTotal={caTotal}
            totalVentes={totalVentes}
            counts={counts}
            referentsStats={referentsStats}
            commerciauxStats={commerciauxStats}
            isAllPeriod={isAllPeriod}
            dashPeriod={dashPeriod}
            loading={loading}
          />
        )}

        {/* ── Section ADMIN/DG : fiches en attente (priorité haute) ──────────── */}
        {isAdminOrDG && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="font-semibold text-base">Fiches en attente de validation{dashPeriodSuffix}</h3>
                {fichesPending.length > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {fichesPending.length}
                  </span>
                )}
              </div>
              <Link href="/fiches?status=SOUMISE">
                <Button variant="ghost" size="sm" className="text-muted-foreground gap-1">
                  Voir toutes <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>

            {fichesPending.length === 0 ? (
              <div className="flex items-center gap-4 p-5 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 shrink-0" />
                <div>
                  <p className="font-medium text-sm text-emerald-800 dark:text-emerald-300">Aucune fiche en attente</p>
                  <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70 mt-0.5">Toutes les fiches soumises ont été traitées.</p>
                </div>
              </div>
            ) : (
              <div className="bg-card border border-red-200 dark:border-red-900/50 rounded-2xl overflow-hidden">
                <CollapsibleList items={fichesPending} renderItem={(fiche: FicheEnAttente, idx: number, total: number) => {
                  const days = daysSince(fiche.created_at);
                  return (
                    <Link key={fiche.id} href={`/fiches/${fiche.id}`}>
                      <div className={`flex items-center gap-4 px-5 py-4 hover:bg-red-50/40 dark:hover:bg-red-950/20 transition-colors cursor-pointer ${
                        idx < total - 1 ? "border-b border-border" : ""
                      }`}>
                        <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/40 flex items-center justify-center shrink-0">
                          <AlertCircle className="w-4.5 h-4.5 text-red-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-foreground truncate">
                            Fiche de {fiche.prospect_prenom} {fiche.prospect_nom}
                          </p>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            
                            {fiche.prospect_ville && <span className="text-xs text-muted-foreground">{fiche.prospect_ville}</span>}
                            {fiche.created_by_profile && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {fiche.created_by_profile.first_name} {fiche.created_by_profile.last_name}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarDays className="w-3.5 h-3.5" />
                            {new Date(fiche.created_at).toLocaleDateString("fr-FR")}
                          </div>
                          <UrgencyBadge days={days} />
                          <span className="bg-[#F97316] hover:bg-[#EA580C] text-white rounded-full px-4 text-xs gap-1.5 h-8 font-medium inline-flex items-center transition-colors">
                            <CheckCircle2 className="w-3.5 h-3.5" />À Valider
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                }} />
              </div>
            )}
          </div>
        )}

        {/* ── Section ADMIN/DG : 4 blocs statut (sans À valider, déjà au-dessus) ─ */}
        {isAdminOrDG && (
          <div className="space-y-8">
            <StatusBlock
              title={`Affectées${dashPeriodSuffix}`}
              total={counts.AFFECTEE}
              icon={<UserCheck className="w-4 h-4 text-orange-600 dark:text-orange-400" />}
              iconBg="bg-orange-100 dark:bg-orange-900/40"
              badge="bg-[#F97316]"
              borderColor="border-orange-200 dark:border-orange-900/50"
              hoverColor="hover:bg-orange-50/40 dark:hover:bg-orange-950/20"
              href="/fiches?status=AFFECTEE"
              fiches={fichesAffecteesAdmin}
            />
            <StatusBlock
              title={`Validées par le Client${dashPeriodSuffix}`}
              total={counts.ACCEPTEE}
              icon={<CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
              iconBg="bg-emerald-100 dark:bg-emerald-900/40"
              badge="bg-emerald-500"
              borderColor="border-emerald-200 dark:border-emerald-900/50"
              hoverColor="hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20"
              href="/fiches?status=ACCEPTEE"
              fiches={fichesAcceptees}
            />
            <StatusBlock
              title={`Refusées par le client${dashPeriodSuffix}`}
              total={counts.REFUSEE}
              icon={<XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />}
              iconBg="bg-red-100 dark:bg-red-900/40"
              badge="bg-red-500"
              borderColor="border-red-200 dark:border-red-900/50"
              hoverColor="hover:bg-red-50/40 dark:hover:bg-red-950/20"
              href="/fiches?status=REFUSEE"
              fiches={fichesRefusees}
            />
            <StatusBlock
              title={`Archivées${dashPeriodSuffix}`}
              total={counts.ARCHIVEE}
              icon={<Archive className="w-4 h-4 text-slate-500 dark:text-slate-400" />}
              iconBg="bg-slate-100 dark:bg-slate-800/40"
              badge="bg-slate-500"
              borderColor="border-slate-200 dark:border-slate-700/50"
              hoverColor="hover:bg-slate-50/40 dark:hover:bg-slate-800/20"
              href="/fiches?status=ARCHIVEE"
              fiches={fichesArchivees}
            />
          </div>
        )}

        {/* ── Section COMMERCIAL : CA et statistiques ventes ─────────────────── */}
        {isCommercial && (
          <div className="space-y-6">
            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-card border border-border border-l-4 border-l-emerald-500 rounded-2xl p-5 shadow-sm hover:-translate-y-1.5 hover:shadow-xl transition-all duration-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  </div>
                </div>
                <AnimatedCounter value={mesVentes} className="text-2xl sm:text-3xl font-bold" loading={loading} />
                <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">{isAllPeriod ? "Ventes globales réalisées" : <>Ventes réalisées<span className="normal-case"> ({getPeriodLabel(dashPeriod)})</span></>}</p>
              </div>
              <div className="bg-card border border-border border-l-4 border-l-amber-500 rounded-2xl p-5 shadow-sm hover:-translate-y-1.5 hover:shadow-xl transition-all duration-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Euro className="w-5 h-5 text-amber-600" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-bold tabular-nums">{caTotal.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">{isAllPeriod ? "CA global HT total" : <>CA HT total<span className="normal-case"> ({getPeriodLabel(dashPeriod)})</span></>}</p>
              </div>
              <div className="bg-card border border-border border-l-4 border-l-blue-500 rounded-2xl p-5 shadow-sm hover:-translate-y-1.5 hover:shadow-xl transition-all duration-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-bold tabular-nums">{mesVentes > 0 ? Math.round(caTotal / mesVentes).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }) : "0 €"}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">{isAllPeriod ? "Chiffre d'affaires moyen global" : <>Chiffre d&apos;affaires moyen<span className="normal-case"> ({getPeriodLabel(dashPeriod)})</span></>}</p>
              </div>
              {(() => {
                const totalTraitees = mesVentes + fichesRefusees.length;
                const convRate = totalTraitees > 0 ? Math.round((mesVentes / totalTraitees) * 100) : 0;
                return (
                  <div className="bg-card border border-border border-l-4 border-l-orange-500 rounded-2xl p-5 shadow-sm hover:-translate-y-1.5 hover:shadow-xl transition-all duration-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                        <XCircle className="w-5 h-5 text-orange-600" />
                      </div>
                    </div>
                    <p className="text-2xl sm:text-3xl font-bold tabular-nums">{`${convRate}%`}</p>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">Taux de conversion</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{mesVentes} acceptée{mesVentes > 1 ? "s" : ""} / {totalTraitees} traitée{totalTraitees > 1 ? "s" : ""}</p>
                  </div>
                );
              })()}
            </div>

            {/* RDV du jour */}
            {profile && <CommercialRdvDuJour profileId={profile.id} />}

            {/* Détail CA par fiche acceptée */}
            {fichesAcceptees.length > 0 && (
              <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                      <Euro className="w-4 h-4 text-amber-600" />
                    </div>
                    <h3 className="font-semibold text-sm">{isAllPeriod ? "Détail global chiffre d'affaires" : `Détail chiffre d'affaires${dashPeriodSuffix}`}</h3>
                  </div>
                  <Link href="/reporting">
                    <Button variant="ghost" size="sm" className="text-muted-foreground gap-1">
                      Mon reporting <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </div>
                <div className="space-y-1">
                  <div className="grid grid-cols-[1fr_100px] sm:grid-cols-[1fr_100px_100px] gap-2 text-[10px] text-muted-foreground uppercase tracking-wide font-semibold pb-2 border-b border-border">
                    <span>Client</span>
                    <span className="text-right hidden sm:block">Date</span>
                    <span className="text-right">Montant HT</span>
                  </div>
                  <CollapsibleList items={fichesAcceptees} renderItem={(fiche: FicheAffectee) => (
                    <Link key={fiche.id} href={`/fiches/${fiche.id}`}>
                      <div className="grid grid-cols-[1fr_100px] sm:grid-cols-[1fr_100px_100px] gap-2 items-center py-2.5 hover:bg-secondary/40 rounded-lg px-1 transition-colors cursor-pointer">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">Fiche de {fiche.prospect_prenom} {fiche.prospect_nom}</p>

                        </div>
                        <span className="text-xs text-muted-foreground text-right hidden sm:block">{new Date(fiche.updated_at).toLocaleDateString("fr-FR")}</span>
                        <span className={`text-sm font-bold text-right tabular-nums ${fiche.montant_ht ? "text-amber-600" : "text-muted-foreground"}`}>
                          {fiche.montant_ht ? Number(fiche.montant_ht).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }) : "—"}
                        </span>
                      </div>
                    </Link>
                  )} />
                  <div className="grid grid-cols-[1fr_100px] sm:grid-cols-[1fr_100px_100px] gap-2 pt-3 border-t border-border">
                    <span className="text-sm font-bold">Total</span>
                    <span />
                    <span className="text-sm font-bold text-right tabular-nums text-amber-600">
                      {fichesAcceptees
                        .reduce((sum, f) => sum + (f.montant_ht ? Number(f.montant_ht) : 0), 0)
                        .toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Section COMMERCIAL : fiches affectées à traiter ────────────── */}
        {isCommercial && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
                  <UserCheck className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                </div>
                <h3 className="font-semibold text-base">Mes fiches à traiter{dashPeriodSuffix}</h3>
                {fichesAffectees.length > 0 && (
                  <span className="bg-[#F97316] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {fichesAffectees.length}
                  </span>
                )}
              </div>
              <Link href="/fiches?status=AFFECTEE">
                <Button variant="ghost" size="sm" className="text-muted-foreground gap-1">
                  Voir toutes <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>

            {fichesAffectees.length === 0 ? (
              <div className="flex items-center gap-4 p-5 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 shrink-0" />
                <div>
                  <p className="font-medium text-sm text-emerald-800 dark:text-emerald-300">
                    Aucune fiche en attente
                  </p>
                  <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70 mt-0.5">
                    Toutes vos fiches affectées ont été traitées.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] overflow-hidden">
                <CollapsibleList items={fichesAffectees} renderItem={(fiche: FicheAffectee, idx: number, total: number) => {
                  const days = daysSince(fiche.updated_at);
                  return (
                    <Link key={fiche.id} href={`/fiches/${fiche.id}`}>
                      <div className={`flex items-center gap-4 px-5 py-4 hover:bg-orange-50/40 dark:hover:bg-orange-950/20 transition-colors cursor-pointer ${
                        idx < total - 1 ? "border-b border-border" : ""
                      }`}>
                        <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/40 flex items-center justify-center shrink-0">
                          <UserCheck className="w-4.5 h-4.5 text-orange-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-foreground truncate">
                            Fiche de {fiche.prospect_prenom} {fiche.prospect_nom}
                          </p>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            
                            {fiche.prospect_ville && (
                              <span className="text-xs text-muted-foreground">
                                {fiche.prospect_ville} {fiche.prospect_cp}
                              </span>
                            )}
                            {fiche.created_by_profile && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {fiche.created_by_profile.first_name} {fiche.created_by_profile.last_name}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarDays className="w-3.5 h-3.5" />
                            {new Date(fiche.updated_at).toLocaleDateString("fr-FR")}
                          </div>
                          <UrgencyBadge days={days} />
                          <Button
                            size="sm"
                            className="bg-[#F97316] hover:bg-[#EA580C] text-white rounded-full px-4 text-xs gap-1.5 h-8"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setTraiterDecision("RETRACTATION");
                              setTraiterComment("");
                              setFicheToTraiter({ id: fiche.id, reference: fiche.reference, nom: `${fiche.prospect_prenom} ${fiche.prospect_nom}`, created_by: fiche.created_by });
                            }}
                          >
                            <ArrowRight className="w-3.5 h-3.5" />Traiter
                          </Button>
                        </div>
                      </div>
                    </Link>
                  );
                }} />
              </div>
            )}
          </div>
        )}


        {/* ── Section PROSPECTEUR : 6 blocs fiches ───────────────────────────── */}
        {isReferent && (() => {
          const blocs: { status: FicheStatus; label: string; fiches: FicheListItem[]; color: string; badgeBg: string; iconBg: string; iconColor: string; hoverBg: string; emptyMsg: string }[] = [
            { status: "BROUILLON",    label: "Mes brouillons",           fiches: prospBrouillons, color: "border-l-slate-400",   badgeBg: "bg-slate-400",   iconBg: "bg-slate-100 dark:bg-slate-800/40",    iconColor: "text-slate-500",   hoverBg: "hover:bg-slate-50/60",   emptyMsg: "Aucun brouillon en cours." },
            { status: "SOUMISE",      label: "À valider par la direction", fiches: prospSoumises,   color: "border-l-blue-500",    badgeBg: "bg-blue-500",    iconBg: "bg-blue-50 dark:bg-blue-950/40",       iconColor: "text-blue-500",    hoverBg: "hover:bg-blue-50/40",    emptyMsg: "Aucune fiche en attente." },
            { status: "AFFECTEE",         label: "Fiches affectées",                        fiches: prospAffectees,       color: "border-l-orange-500",  badgeBg: "bg-orange-500",  iconBg: "bg-orange-50 dark:bg-orange-950/40",   iconColor: "text-orange-500",  hoverBg: "hover:bg-orange-50/40",  emptyMsg: "Aucune fiche affectée." },
            { status: "RDV_A_REPRENDRE",  label: "RDV à reprendre — client absent",         fiches: prospRdvAReprendre,   color: "border-l-[#F97316]",   badgeBg: "bg-[#F97316]",   iconBg: "bg-orange-50 dark:bg-orange-950/40",   iconColor: "text-[#F97316]",   hoverBg: "hover:bg-orange-50/40",  emptyMsg: "Aucun RDV à reprendre." },
            { status: "RETRACTATION",     label: "En attente de validation par le client",  fiches: prospRetractees,      color: "border-l-purple-500",  badgeBg: "bg-purple-500",  iconBg: "bg-purple-50 dark:bg-purple-950/40",   iconColor: "text-purple-500",  hoverBg: "hover:bg-purple-50/40",  emptyMsg: "Aucune fiche en attente de validation client." },
            { status: "ACCEPTEE",     label: "Validées par le client",                    fiches: prospAcceptees,  color: "border-l-emerald-500", badgeBg: "bg-emerald-500", iconBg: "bg-emerald-50 dark:bg-emerald-950/40", iconColor: "text-emerald-500", hoverBg: "hover:bg-emerald-50/40", emptyMsg: "Aucune fiche validée." },
            { status: "REFUSEE",      label: "Refusées par le client",    fiches: prospRefusees,   color: "border-l-red-500",     badgeBg: "bg-red-500",     iconBg: "bg-red-50 dark:bg-red-950/40",         iconColor: "text-red-500",     hoverBg: "hover:bg-red-50/40",     emptyMsg: "Aucune fiche refusée." },
            { status: "ARCHIVEE",     label: "Archivées",                 fiches: prospArchivees,  color: "border-l-slate-300",   badgeBg: "bg-slate-400",   iconBg: "bg-slate-100 dark:bg-slate-800/40",    iconColor: "text-slate-400",   hoverBg: "hover:bg-slate-50/60",   emptyMsg: "Aucune fiche archivée." },
          ];
          return (
            <>
              {blocs.map(({ status, label, fiches, badgeBg, iconBg, iconColor, hoverBg, emptyMsg }) => (
                <div key={status} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-xl ${iconBg} flex items-center justify-center`}>
                        {STATUS_ICONS[status]}
                      </div>
                      <h3 className="font-semibold text-base">{label}{dashPeriodSuffix}</h3>
                      {fiches.length > 0 && (
                        <span className={`${badgeBg} text-white text-xs font-bold px-2 py-0.5 rounded-full`}>{fiches.length}</span>
                      )}
                    </div>
                    <Link href={`/fiches?status=${status}`}>
                      <Button variant="ghost" size="sm" className="text-muted-foreground gap-1">Voir toutes <ArrowRight className="w-3.5 h-3.5" /></Button>
                    </Link>
                  </div>
                  {fiches.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-1">{emptyMsg}</p>
                  ) : (
                    <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] overflow-hidden">
                      <CollapsibleList items={fiches} renderItem={(fiche: FicheListItem, idx: number, total: number) => (
                        <Link key={fiche.id} href={`/fiches/${fiche.id}`}>
                          <div className={`flex items-center gap-4 px-5 py-4 ${hoverBg} dark:hover:bg-white/5 transition-colors cursor-pointer ${idx < total - 1 ? "border-b border-border" : ""}`}>
                            <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
                              <span className={iconColor}>{STATUS_ICONS[status]}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm truncate">Fiche de {fiche.prospect_prenom} {fiche.prospect_nom}</p>
                              <p className="text-xs text-muted-foreground">{fiche.prospect_ville || ""}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-muted-foreground hidden sm:block">{new Date(fiche.created_at).toLocaleDateString("fr-FR")}</span>
                              {status === "BROUILLON" && (
                                <button
                                  type="button"
                                  aria-label={`Supprimer ${fiche.reference}`}
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setFicheToDelete({ id: fiche.id, reference: fiche.reference, nom: `${fiche.prospect_prenom} ${fiche.prospect_nom}` }); }}
                                  className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-red-400 hover:text-red-600 transition-all"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </Link>
                      )} />
                    </div>
                  )}
                </div>
              ))}
            </>
          );
        })()}

        {/* ── Section COMMERCIAL : 4 blocs fiches traitées ───────────────────── */}
        {isCommercial && (
          <>
            {/* Attente Validation Client (RETRACTATION) */}
            {(() => {
              const list = fichesRetractationComm;
              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                        <AlertCircle className="w-4 h-4 text-purple-600" />
                      </div>
                      <h3 className="font-semibold text-base">Attente Validation Client{dashPeriodSuffix}</h3>
                      {list.length > 0 && <span className="bg-purple-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{list.length}</span>}
                    </div>
                    <Link href="/fiches?status=RETRACTATION"><Button variant="ghost" size="sm" className="text-muted-foreground gap-1">Voir toutes <ArrowRight className="w-3.5 h-3.5" /></Button></Link>
                  </div>
                  {list.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-1">Aucune fiche en attente de validation.</p>
                  ) : (
                    <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] overflow-hidden">
                      <CollapsibleList items={list} renderItem={(fiche: FicheAffectee, idx: number, total: number) => (
                        <Link key={fiche.id} href={`/fiches/${fiche.id}`}>
                          <div className={`flex items-center gap-4 px-5 py-4 hover:bg-purple-50/40 dark:hover:bg-purple-950/20 transition-colors cursor-pointer ${idx < total - 1 ? "border-b border-border" : ""}`}>
                            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/40 flex items-center justify-center shrink-0">
                              <AlertCircle className="w-4 h-4 text-purple-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm truncate">Fiche de {fiche.prospect_prenom} {fiche.prospect_nom}</p>
                              <p className="text-xs text-muted-foreground">{fiche.prospect_ville || ""}</p>
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">{new Date(fiche.updated_at).toLocaleDateString("fr-FR")}</span>
                          </div>
                        </Link>
                      )} />
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Validées par le client */}
            {(() => {
              const list = fichesAcceptees;
              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      </div>
                      <h3 className="font-semibold text-base">Validées par le client{dashPeriodSuffix}</h3>
                      {list.length > 0 && <span className="bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{list.length}</span>}
                    </div>
                    <Link href="/fiches?status=ACCEPTEE"><Button variant="ghost" size="sm" className="text-muted-foreground gap-1">Voir toutes <ArrowRight className="w-3.5 h-3.5" /></Button></Link>
                  </div>
                  {list.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-1">Aucune fiche validée pour le moment.</p>
                  ) : (
                    <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] overflow-hidden">
                      <CollapsibleList items={list} renderItem={(fiche: FicheAffectee, idx: number, total: number) => (
                        <Link key={fiche.id} href={`/fiches/${fiche.id}`}>
                          <div className={`flex items-center gap-4 px-5 py-4 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition-colors cursor-pointer ${idx < total - 1 ? "border-b border-border" : ""}`}>
                            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm truncate">Fiche de {fiche.prospect_prenom} {fiche.prospect_nom}</p>
                              <p className="text-xs text-muted-foreground">{fiche.prospect_ville || ""}</p>
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">{new Date(fiche.updated_at).toLocaleDateString("fr-FR")}</span>
                          </div>
                        </Link>
                      )} />
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Refusées par le client */}
            {(() => {
              const list = fichesRefusees;
              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                        <XCircle className="w-4 h-4 text-red-500" />
                      </div>
                      <h3 className="font-semibold text-base">Refusées par le client{dashPeriodSuffix}</h3>
                      {list.length > 0 && <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{list.length}</span>}
                    </div>
                    <Link href="/fiches?status=REFUSEE"><Button variant="ghost" size="sm" className="text-muted-foreground gap-1">Voir toutes <ArrowRight className="w-3.5 h-3.5" /></Button></Link>
                  </div>
                  {list.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-1">Aucune fiche refusée.</p>
                  ) : (
                    <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] overflow-hidden">
                      <CollapsibleList items={list} renderItem={(fiche: FicheAffectee, idx: number, total: number) => (
                        <Link key={fiche.id} href={`/fiches/${fiche.id}`}>
                          <div className={`flex items-center gap-4 px-5 py-4 hover:bg-red-50/40 dark:hover:bg-red-950/20 transition-colors cursor-pointer ${idx < total - 1 ? "border-b border-border" : ""}`}>
                            <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/40 flex items-center justify-center shrink-0">
                              <XCircle className="w-4 h-4 text-red-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm truncate">Fiche de {fiche.prospect_prenom} {fiche.prospect_nom}</p>
                              <p className="text-xs text-muted-foreground">{fiche.prospect_ville || ""}</p>
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">{new Date(fiche.updated_at).toLocaleDateString("fr-FR")}</span>
                          </div>
                        </Link>
                      )} />
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Archivées */}
            {(() => {
              const list = fichesArchivees;
              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800/40 flex items-center justify-center">
                        <Archive className="w-4 h-4 text-slate-500" />
                      </div>
                      <h3 className="font-semibold text-base">Archivées{dashPeriodSuffix}</h3>
                      {list.length > 0 && <span className="bg-slate-400 text-white text-xs font-bold px-2 py-0.5 rounded-full">{list.length}</span>}
                    </div>
                    <Link href="/fiches?status=ARCHIVEE"><Button variant="ghost" size="sm" className="text-muted-foreground gap-1">Voir toutes <ArrowRight className="w-3.5 h-3.5" /></Button></Link>
                  </div>
                  {list.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-1">Aucune fiche archivée.</p>
                  ) : (
                    <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] overflow-hidden">
                      <CollapsibleList items={list} renderItem={(fiche: FicheAffectee, idx: number, total: number) => (
                        <Link key={fiche.id} href={`/fiches/${fiche.id}`}>
                          <div className={`flex items-center gap-4 px-5 py-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/20 transition-colors cursor-pointer ${idx < total - 1 ? "border-b border-border" : ""}`}>
                            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800/40 flex items-center justify-center shrink-0">
                              <Archive className="w-4 h-4 text-slate-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm truncate">Fiche de {fiche.prospect_prenom} {fiche.prospect_nom}</p>
                              <p className="text-xs text-muted-foreground">{fiche.prospect_ville || ""}</p>
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">{new Date(fiche.updated_at).toLocaleDateString("fr-FR")}</span>
                          </div>
                        </Link>
                      )} />
                    </div>
                  )}
                </div>
              );
            })()}
          </>
        )}

        </div>{/* fin wrapper opacity */}
      </div>

      {assignDialog}
      {/* Dialog traitement rapide (commercial) */}
      <Dialog open={!!ficheToTraiter} onOpenChange={(open) => { if (!open) { setFicheToTraiter(null); setTraiterComment(""); setTraiterDecision("RETRACTATION"); } }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Traiter la fiche</DialogTitle>
            <DialogDescription>
              <span className="font-semibold text-foreground">Fiche de {ficheToTraiter?.nom}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTraiterDecision("RETRACTATION")}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                traiterDecision === "RETRACTATION"
                  ? "border-purple-500 bg-purple-50 dark:bg-purple-950/30"
                  : "border-border hover:border-purple-300"
              }`}
            >
              <CheckCircle2 className={`w-6 h-6 ${traiterDecision === "RETRACTATION" ? "text-purple-600" : "text-muted-foreground"}`} />
              <span className={`text-sm font-medium ${traiterDecision === "RETRACTATION" ? "text-purple-700 dark:text-purple-400" : "text-muted-foreground"}`}>Attente Validation</span>
            </button>
            <button
              type="button"
              onClick={() => setTraiterDecision("REFUSEE")}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                traiterDecision === "REFUSEE"
                  ? "border-red-500 bg-red-50 dark:bg-red-950/30"
                  : "border-border hover:border-red-300"
              }`}
            >
              <XCircle className={`w-6 h-6 ${traiterDecision === "REFUSEE" ? "text-red-500" : "text-muted-foreground"}`} />
              <span className={`text-sm font-medium ${traiterDecision === "REFUSEE" ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>Refusée</span>
            </button>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Commentaire <span className="text-muted-foreground font-normal">(optionnel)</span></label>
            <Textarea
              value={traiterComment}
              onChange={(e) => setTraiterComment(e.target.value)}
              placeholder={traiterDecision === "REFUSEE" ? "Motif du refus…" : "Notes sur la visite / attente client…"}
              className="min-h-[80px] rounded-xl resize-none"
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" className="rounded-xl" />}>Annuler</DialogClose>
            <Button
              onClick={handleTraiter}
              disabled={traiting}
              className={`rounded-xl gap-2 text-white ${traiterDecision === "RETRACTATION" ? "bg-purple-600 hover:bg-purple-700" : "bg-red-500 hover:bg-red-600"}`}
            >
              {traiting ? <Loader2 className="w-4 h-4 animate-spin" /> : traiterDecision === "RETRACTATION" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {traiterDecision === "RETRACTATION" ? "Mettre en attente" : "Refuser"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {deleteDialog}
    </>
  );
}
