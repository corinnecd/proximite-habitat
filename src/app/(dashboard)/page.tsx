"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
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
  FileText, FilePlus, Clock, CheckCircle2, XCircle, Send,
  UserCheck, Archive, Trash2, AlertCircle, ArrowRight,
  CalendarDays, User, Trophy, TrendingUp, Star,
  ChevronDown, ChevronUp, Loader2, Euro, BarChart3, Building2,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { sendEmailFicheAffectee, sendEmailFicheDecision } from "@/lib/email";
import { toast } from "sonner";

// ── Filtre période dashboard ──────────────────────────────────────────────────
import { type PeriodFilter as DashPeriod, PERIOD_LABELS as DASH_PERIOD_LABELS, getPeriodDates as getDashPeriodDates, getPeriodLabel } from "@/lib/periods";

// ── Styles compteurs ──────────────────────────────────────────────────────────

const STATUS_ICONS: Record<FicheStatus, React.ReactNode> = {
  BROUILLON:    <Clock className="w-5 h-5" />,
  SOUMISE:      <Send className="w-5 h-5" />,
  VALIDEE:      <CheckCircle2 className="w-5 h-5" />,
  AFFECTEE:     <UserCheck className="w-5 h-5" />,
  ACCEPTEE:     <CheckCircle2 className="w-5 h-5" />,
  RETRACTATION: <AlertCircle className="w-5 h-5" />,
  REFUSEE:      <XCircle className="w-5 h-5" />,
  ARCHIVEE:     <Archive className="w-5 h-5" />,
};

const COUNTER_STYLES: Record<FicheStatus, string> = {
  BROUILLON:    "border-l-slate-300   text-muted-foreground",
  SOUMISE:      "border-l-blue-500    text-blue-600   dark:text-blue-400",
  VALIDEE:      "border-l-emerald-500 text-emerald-600 dark:text-emerald-400",
  AFFECTEE:     "border-l-orange-500  text-orange-600 dark:text-orange-400",
  ACCEPTEE:     "border-l-emerald-500 text-emerald-600 dark:text-emerald-400",
  RETRACTATION: "border-l-purple-500  text-purple-600 dark:text-purple-400",
  REFUSEE:      "border-l-red-500     text-red-600    dark:text-red-400",
  ARCHIVEE:     "border-l-slate-300   text-muted-foreground",
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

interface ReferentStat {
  id: string;
  nom: string;
  ventes: number;        // total ventes
  ventesMoisCourant: number; // ventes ce mois-ci
  primes: number;        // mois avec ≥3 ventes
  prochainPalier: number; // ventes restantes ce mois avant la prime
  ca: number;            // CA HT total
}

interface CommercialStat {
  id: string;
  nom: string;
  ventes: number;
  ca: number;
}


interface HistoryEntry {
  action: string;
  old_status: string | null;
  new_status: string | null;
  comment: string | null;
  created_at: string;
  user: { first_name: string; last_name: string } | null;
}

interface FicheAffectee {
  id: string;
  reference: string;
  prospect_nom: string;
  prospect_prenom: string;
  prospect_ville: string | null;
  prospect_cp: string | null;
  updated_at: string;
  created_at: string;
  created_by: string;
  montant_ht: number | null;
  created_by_profile: { first_name: string; last_name: string } | null;
  fiche_history: HistoryEntry[];
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

// ── Composant bloc par statut ─────────────────────────────────────────────────

const STATUS_LABELS_FR: Record<string, string> = {
  BROUILLON: "Brouillon", SOUMISE: "À valider", VALIDEE: "Validée", AFFECTEE: "Validée et affectée",
  RETRACTATION: "Attente Acceptation Client", ACCEPTEE: "Acceptation Client", REFUSEE: "Refus Client", ARCHIVEE: "Archivé",
};

function StatusBlock({
  title, total, icon, iconBg, badge, borderColor, hoverColor, href, fiches,
}: {
  title: string;
  total: number;
  icon: React.ReactNode;
  iconBg: string;
  badge: string;
  borderColor: string;
  hoverColor: string;
  href: string;
  fiches: FicheAffectee[];
}) {
  const [showAll, setShowAll] = React.useState(false);
  const shown  = showAll ? fiches : fiches.slice(0, 5);
  const hasMore = fiches.length > 5;
  return (
    <div className="space-y-3">
      {/* En-tête du bloc */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${iconBg}`}>{icon}</div>
          <h3 className="font-semibold text-base">{title}</h3>
          {total > 0 && (
            <span className={`${badge} text-white text-xs font-bold px-2 py-0.5 rounded-full`}>{total}</span>
          )}
        </div>
        <Link href={href}>
          <Button variant="ghost" size="sm" className="text-muted-foreground gap-1">
            Voir toutes <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </Link>
      </div>

      {/* Contenu */}
      {shown.length === 0 ? (
        <div className="flex items-center gap-3 p-4 bg-muted/30 border border-border rounded-2xl">
          <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">Aucune fiche dans cette catégorie</p>
        </div>
      ) : (
        <div className={`bg-card border rounded-2xl overflow-hidden ${borderColor}`}>
          {shown.map((fiche, idx) => {
            // Historique trié du plus récent au plus ancien
            const history = [...(fiche.fiche_history ?? [])].sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
            return (
              <Link key={fiche.id} href={`/fiches/${fiche.id}`}>
                <div
                  className={`px-5 py-4 transition-colors cursor-pointer ${hoverColor} ${idx < shown.length - 1 ? "border-b border-border" : ""}`}
                  style={{ animation: "fadeSlideIn 0.22s ease both", animationDelay: `${idx * 35}ms` }}
                >
                  {/* Ligne principale */}
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">
                        {fiche.prospect_prenom} {fiche.prospect_nom}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-muted-foreground">{fiche.reference}</span>
                        {fiche.prospect_ville && <span className="text-xs text-muted-foreground">{fiche.prospect_ville}</span>}
                        {fiche.created_by_profile && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {fiche.created_by_profile.first_name} {fiche.created_by_profile.last_name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                      <CalendarDays className="w-3.5 h-3.5" />
                      {new Date(fiche.updated_at).toLocaleDateString("fr-FR")}
                    </div>
                  </div>

                  {/* Dernière action */}
                  {history.length > 0 && (() => { const h = history[0]; return (
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                      {h.user && (
                        <span className="font-medium text-foreground/70">
                          {h.user.first_name} {h.user.last_name}
                        </span>
                      )}
                      {h.old_status && h.new_status ? (
                        <span>{STATUS_LABELS_FR[h.old_status] ?? h.old_status}{" → "}{STATUS_LABELS_FR[h.new_status] ?? h.new_status}</span>
                      ) : (
                        <span>{h.action}</span>
                      )}
                      {h.comment && <span className="italic truncate max-w-[120px]">&quot;{h.comment}&quot;</span>}
                      <span className="ml-auto shrink-0">
                        {new Date(h.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                        {" "}{new Date(h.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ); })()}
                </div>
              </Link>
            );
          })}
          {hasMore && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="w-full px-4 py-2.5 text-center text-xs text-muted-foreground hover:bg-secondary/40 transition-colors border-t border-border flex items-center justify-center gap-1"
            >
              {showAll
                ? <><ChevronUp className="w-3.5 h-3.5" />Voir moins</>
                : <><ChevronDown className="w-3.5 h-3.5" />Voir plus ({fiches.length - 5} restante{fiches.length - 5 > 1 ? "s" : ""})</>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CollapsibleList<T extends { id: string }>({ items, renderItem, limit = 5 }: { items: T[]; renderItem: (item: T, idx: number, total: number) => React.ReactNode; limit?: number }) {
  const [showAll, setShowAll] = React.useState(false);
  const visible = showAll ? items : items.slice(0, limit);
  const hasMore = items.length > limit;
  return (
    <>
      {visible.map((item, idx) => renderItem(item, idx, visible.length))}
      {hasMore && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="w-full px-4 py-2.5 text-center text-xs text-muted-foreground hover:bg-secondary/40 transition-colors border-t border-border flex items-center justify-center gap-1"
        >
          {showAll
            ? <><ChevronUp className="w-3.5 h-3.5" />Voir moins</>
            : <><ChevronDown className="w-3.5 h-3.5" />Voir plus ({items.length - limit} restante{items.length - limit > 1 ? "s" : ""})</>}
        </button>
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { profile, loading: profileLoading } = useProfile();
  const { selectedBranchId, isDG, selectedBranchName, setSelectedBranchId, branches } = useBranch();
  const [counts, setCounts] = useState<Record<FicheStatus, number>>({
    BROUILLON: 0, SOUMISE: 0, VALIDEE: 0, AFFECTEE: 0, ACCEPTEE: 0, RETRACTATION: 0, REFUSEE: 0, ARCHIVEE: 0,
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
  const [prospAffectees,    setProspAffectees]    = useState<FicheListItem[]>([]);
  const [prospAcceptees,    setProspAcceptees]    = useState<FicheListItem[]>([]);
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
  const [ficheToDelete, setFicheToDelete] = useState<{ id: string; reference: string } | null>(null);
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

  const fetchData = useCallback(async (period: DashPeriod = "ALL") => {
    if (!profile) return;
    const isReferent = profile.role === "PROSPECTEUR";
    try {
    const isAdmin       = profile.role === "ADMIN" || profile.role === "DIRECTION_GENERALE";
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
      ? ["BROUILLON", "SOUMISE", "AFFECTEE", "ACCEPTEE", "RETRACTATION", "REFUSEE", "ARCHIVEE"]
      : ["SOUMISE", "AFFECTEE", "ACCEPTEE", "RETRACTATION", "REFUSEE", "ARCHIVEE"];
    {
      let q = supabase.from("fiches").select("status").in("status", statusesToCount);
      if (isReferent) q = q.eq("created_by", profile.id);
      if (isCommercial) q = q.eq("assigned_to", profile.id);
      if (branchFilter) q = q.eq("organization_id", branchFilter);
      if (periodDates) q = q.gte("created_at", `${periodDates.from}T00:00:00Z`).lte("created_at", `${periodDates.to}T23:59:59Z`);
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
      promises.push(bq(supabase.from("fiches").select(ficheAdminCols).eq("status", "SOUMISE")).order("created_at", { ascending: false }).limit(30));
      keys.push("affecteesAdmin");
      promises.push(bq(supabase.from("fiches").select(ficheAdminCols).eq("status", "AFFECTEE")).order("updated_at", { ascending: false }).limit(30));
      keys.push("acceptees");
      promises.push(bq(supabase.from("fiches").select(ficheAdminColsLight).eq("status", "ACCEPTEE")).order("updated_at", { ascending: false }).limit(30));
      keys.push("refusees");
      promises.push(bq(supabase.from("fiches").select(ficheAdminColsLight).eq("status", "REFUSEE")).order("updated_at", { ascending: false }).limit(30));
      keys.push("archivees");
      promises.push(bq(supabase.from("fiches").select(ficheAdminColsLight).eq("status", "ARCHIVEE")).order("updated_at", { ascending: false }).limit(30));
    }

    // Ventes (ADMIN + COMMERCIAL)
    if (isAdmin || isCommercial) {
      let vq = supabase.from("fiches").select(
        "id, created_by, assigned_to, updated_at, montant_ht, " +
        "created_by_profile:profiles!fiches_created_by_fkey(first_name, last_name), " +
        "assigned_to_profile:profiles!fiches_assigned_to_fkey(first_name, last_name)"
      ).eq("status", "ACCEPTEE");
      if (isCommercial) vq = vq.eq("assigned_to", profile.id);
      if (branchFilter) vq = vq.eq("organization_id", branchFilter);
      if (periodDates) vq = vq.gte("updated_at", `${periodDates.from}T00:00:00`).lte("updated_at", `${periodDates.to}T23:59:59`);
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
      promises.push(
        supabase.from("fiches").select(commCols).eq("status", "AFFECTEE").eq("assigned_to", profile.id).order("updated_at", { ascending: true }),
        supabase.from("fiches").select(commCols).eq("status", "RETRACTATION").eq("assigned_to", profile.id).order("updated_at", { ascending: false }).limit(50),
        supabase.from("fiches").select(commCols).eq("status", "ACCEPTEE").eq("assigned_to", profile.id).order("updated_at", { ascending: false }).limit(50),
        supabase.from("fiches").select(commCols).eq("status", "REFUSEE").eq("assigned_to", profile.id).order("updated_at", { ascending: false }).limit(50),
        supabase.from("fiches").select(commCols).eq("status", "ARCHIVEE").eq("assigned_to", profile.id).order("updated_at", { ascending: false }).limit(50),
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
      const statuses: FicheStatus[] = ["BROUILLON", "SOUMISE", "AFFECTEE", "RETRACTATION", "ACCEPTEE", "REFUSEE", "ARCHIVEE"];
      for (const s of statuses) {
        keys.push(`prosp_${s}`);
        promises.push(supabase.from("fiches").select(FICHE_LIST_COLUMNS).eq("created_by", profile.id).eq("status", s).order("created_at", { ascending: false }));
      }
    }


    // ── Exécution parallèle ───────────────────────────────────────────────
    const settled = await Promise.all(promises);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = new Map<string, any>();
    keys.forEach((k, i) => r.set(k, settled[i]));

    // ── Dispatch des résultats ────────────────────────────────────────────
    const allCounts: Record<FicheStatus, number> = {
      BROUILLON: 0, SOUMISE: 0, VALIDEE: 0, AFFECTEE: 0, ACCEPTEE: 0, RETRACTATION: 0, REFUSEE: 0, ARCHIVEE: 0,
    };
    const statusRows = (r.get("statusCounts")?.data ?? []) as { status: FicheStatus }[];
    for (const row of statusRows) {
      if (allCounts[row.status] !== undefined) allCounts[row.status]++;
    }
    setCounts(allCounts);

    if (isAdmin) {
      setCommercials(r.get("commercials") ?? []);
      setFichesPending((r.get("pending")?.data as unknown as FicheEnAttente[]) ?? []);
      setFichesAffecteesAdmin((r.get("affecteesAdmin")?.data as unknown as FicheAffectee[]) ?? []);
      setFichesAcceptees((r.get("acceptees")?.data as unknown as FicheAffectee[]) ?? []);
      setFichesRefusees((r.get("refusees")?.data as unknown as FicheAffectee[]) ?? []);
      setFichesArchivees((r.get("archivees")?.data as unknown as FicheAffectee[]) ?? []);
    }

    if (isAdmin || isCommercial) {
      const rows = ((r.get("ventes")?.data ?? r.get("ventes")) as unknown as VenteRow[]) ?? [];
      setTotalVentes(rows.length);
      setCaTotal(rows.reduce((sum, v) => sum + (v.montant_ht ? Number(v.montant_ht) : 0), 0));
      if (isCommercial) setMesVentes(rows.length);

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
        setReferentsStats(Array.from(pMap.values()).map((p) => {
          const primes = Array.from(p.ventesParMois.values()).filter((x) => x >= 3).length;
          return { id: p.id, nom: p.nom, ventes: p.ventes, ventesMoisCourant: p.ventesMoisCourant, primes, prochainPalier: Math.max(0, 3 - p.ventesMoisCourant), ca: p.ca };
        }).sort((a, b) => b.ventes - a.ventes));

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
        setCommerciauxStats(Array.from(cMap.values()).sort((a, b) => b.ventes - a.ventes));
      }
    }

    if (isCommercial) {
      setFichesAffectees((r.get("commAffectees")?.data as unknown as FicheAffectee[]) ?? []);
      setFichesRetractationComm((r.get("commRetract")?.data as unknown as FicheAffectee[]) ?? []);
      setFichesAcceptees((r.get("commAcceptees")?.data as unknown as FicheAffectee[]) ?? []);
      setFichesRefusees((r.get("commRefusees")?.data as unknown as FicheAffectee[]) ?? []);
      setFichesArchivees((r.get("commArchivees")?.data as unknown as FicheAffectee[]) ?? []);
    }

    if (!isReferent) setAnterieures((r.get("anterieures")?.data as typeof anterieures) ?? []);

    if (isReferent) {
      setProspBrouillons((r.get("prosp_BROUILLON")?.data as FicheListItem[]) ?? []);
      setProspSoumises((r.get("prosp_SOUMISE")?.data as FicheListItem[]) ?? []);
      setProspAffectees((r.get("prosp_AFFECTEE")?.data as FicheListItem[]) ?? []);
      setProspRetractees((r.get("prosp_RETRACTATION")?.data as FicheListItem[]) ?? []);
      setProspAcceptees((r.get("prosp_ACCEPTEE")?.data as FicheListItem[]) ?? []);
      setProspRefusees((r.get("prosp_REFUSEE")?.data as FicheListItem[]) ?? []);
      setProspArchivees((r.get("prosp_ARCHIVEE")?.data as FicheListItem[]) ?? []);
    }


    setLoading(false);
    } catch (err) {
      console.error("fetchData error", err);
      setFetchError("Erreur lors du chargement des données. Veuillez recharger la page.");
      setLoading(false);
    }
  }, [profile, supabase, isDG, selectedBranchId]);

  useEffect(() => {
    if (profileLoading || !profile) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData(dashPeriod);

    const channel = supabase
      .channel("fiches-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "fiches" }, () => {
        fetchData(dashPeriod);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile, profileLoading, supabase, fetchData, dashPeriod, selectedBranchId]);

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
  const isReferent = profile?.role === "PROSPECTEUR";
  const isAdmin       = profile?.role === "ADMIN";
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
    ? ["BROUILLON", "SOUMISE", "AFFECTEE", "ACCEPTEE", "REFUSEE", "ARCHIVEE"]
    : isCommercial
    ? ["AFFECTEE", "RETRACTATION", "ACCEPTEE", "REFUSEE", "ARCHIVEE"]
    : isAdminOrDG
    ? ["SOUMISE", "AFFECTEE", "ACCEPTEE", "RETRACTATION", "REFUSEE", "ARCHIVEE"]
    : ["SOUMISE", "AFFECTEE", "ACCEPTEE", "RETRACTATION", "REFUSEE", "ARCHIVEE"];

  // ── Skeleton ─────────────────────────────────────────────────────────────
  if (profileLoading || loading) {
    return (
      <>
        <Topbar title="Tableau de bord" actions={<div className="flex items-center gap-2"><ExportPdfButton title="Tableau de bord" subtitle={getPeriodLabel(dashPeriod) ? `Période : ${DASH_PERIOD_LABELS[dashPeriod]} (${getPeriodLabel(dashPeriod)})` : undefined} filename="dashboard" /><ExportCsvButton filename="dashboard" getData={getDashboardCsvData} /></div>} />
        <div className="p-6 lg:p-8 space-y-8 animate-pulse">
          {/* Greeting */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-5 bg-card rounded w-48" />
              <div className="h-3.5 bg-card rounded w-32" />
            </div>
            <div className="h-9 bg-card rounded-xl w-36" />
          </div>
          {/* Compteurs */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] border-l-4 border-l-muted" style={{ animationDelay: `${i * 50}ms` }} />
            ))}
          </div>
          {/* Bloc ventes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-48 bg-card rounded-2xl border border-border" />
            <div className="h-48 bg-card rounded-2xl border border-border" />
          </div>
          {/* StatusBlocks */}
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-card rounded-xl" />
                  <div className="h-4 bg-card rounded w-28" />
                  <div className="h-5 bg-card rounded-full w-8" />
                </div>
                <div className="h-7 bg-card rounded-xl w-24" />
              </div>
              <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] overflow-hidden">
                {Array.from({ length: 2 }).map((_, j) => (
                  <div key={j} className={`px-5 py-4 flex items-start gap-3 ${j > 0 ? "border-t border-border" : ""}`}>
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 bg-muted rounded w-1/3" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                    <div className="h-3 bg-muted rounded w-16" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  // ── Dialog affectation rapide ────────────────────────────────────────────
  const assignDialog = (
    <Dialog open={!!ficheToAssign} onOpenChange={(open) => { if (!open) { setFicheToAssign(null); setAssignCommercialId(""); } }}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Affecter la fiche</DialogTitle>
          <DialogDescription>
            Choisissez un commercial pour{" "}
            <span className="font-semibold text-foreground">{ficheToAssign?.nom}</span>{" "}
            ({ficheToAssign?.reference})
          </DialogDescription>
        </DialogHeader>
        <Select value={assignCommercialId} onValueChange={(v) => setAssignCommercialId(v ?? "")}>
          <SelectTrigger className="rounded-xl h-11">
            <SelectValue placeholder="Choisir un commercial…" />
        </SelectTrigger>
          <SelectContent>
            {commercials
              .filter((c) => c.role === "COMMERCIAL" || c.role === "ADMIN")
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
            Supprimer définitivement{" "}
            <span className="font-semibold text-foreground">{ficheToDelete?.reference}</span>
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
              await deleteFicheCascade(supabase, ficheToDelete.id);
              setFicheToDelete(null);
              fetchData();
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
        <Topbar title="Tableau de bord" actions={<div className="flex items-center gap-2"><ExportPdfButton title="Tableau de bord" subtitle={getPeriodLabel(dashPeriod) ? `Période : ${DASH_PERIOD_LABELS[dashPeriod]} (${getPeriodLabel(dashPeriod)})` : undefined} filename="dashboard" /><ExportCsvButton filename="dashboard" getData={getDashboardCsvData} /></div>} />
        <div className="p-6 lg:p-8 flex items-center justify-center min-h-[40vh]">
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
      {assignDialog}

      {/* Dialog traitement rapide (commercial) */}
      <Dialog open={!!ficheToTraiter} onOpenChange={(open) => { if (!open) { setFicheToTraiter(null); setTraiterComment(""); setTraiterDecision("RETRACTATION"); } }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Traiter la fiche</DialogTitle>
            <DialogDescription>
              <span className="font-semibold text-foreground">{ficheToTraiter?.nom}</span>{" "}
              — {ficheToTraiter?.reference}
            </DialogDescription>
          </DialogHeader>

          {/* Décision */}
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

          {/* Commentaire */}
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
      <Topbar title="Tableau de bord" actions={<div className="flex items-center gap-2"><ExportPdfButton title="Tableau de bord" subtitle={getPeriodLabel(dashPeriod) ? `Période : ${DASH_PERIOD_LABELS[dashPeriod]} (${getPeriodLabel(dashPeriod)})` : undefined} filename="dashboard" /><ExportCsvButton filename="dashboard" getData={getDashboardCsvData} /></div>} />
      <div className="p-6 lg:p-8 space-y-8">

        {/* Bandeau succursale (DG — toujours visible) */}
        {isDG && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gradient-to-r from-rose-50 to-orange-50 dark:from-rose-950/30 dark:to-orange-950/20 border border-rose-200 dark:border-rose-800/40 rounded-2xl px-4 sm:px-5 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center shrink-0">
                <Building2 className="w-4.5 h-4.5 text-rose-600 dark:text-rose-400" />
              </div>
              <div className="min-w-0">
                <p className="text-base sm:text-lg font-extrabold text-rose-700 dark:text-rose-300 truncate">
                  {selectedBranchName ?? "Toutes les succursales"}
                </p>
                <p className="text-xs text-rose-500/70 dark:text-rose-400/60">
                  {selectedBranchName ? "Tableau de bord filtré sur cette succursale" : "Vue consolidée de toutes les succursales"}
                </p>
              </div>
            </div>
            <div className="relative w-full sm:w-auto">
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full sm:w-auto appearance-none bg-white dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-300 text-sm font-medium pl-3 pr-8 py-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-rose-400/50"
              >
                <option value="all">Toutes les succursales</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}{b.is_hq ? " (Siège)" : ""}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-rose-400 pointer-events-none" />
            </div>
          </div>
        )}

        {/* En-tête */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Bonjour, {profile?.first_name}</h2>
            <p className="text-muted-foreground">
              {isReferent
                ? `${counts.BROUILLON} brouillon${counts.BROUILLON > 1 ? "s" : ""} en cours`
                : `${totalFiches} fiche${totalFiches > 1 ? "s" : ""} au total`}
            </p>
          </div>
          {profile?.role !== "DIRECTION_GENERALE" && (
            <Link href="/fiches/nouvelle">
              <Button className="bg-[#F97316] hover:bg-[#EA580C] text-white rounded-full px-5 gap-2">
                <FilePlus className="w-4 h-4" />Nouvelle fiche
              </Button>
            </Link>
          )}
        </div>

        {/* Filtre période — direction uniquement */}
        {!isReferent && (() => {
          const dynamicLabel = DASH_PERIOD_LABELS[dashPeriod].toUpperCase();
          const dynamicRange = getPeriodLabel(dashPeriod);
          return (
          <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <CalendarDays className="w-3.5 h-3.5" />Période d&apos;activité
              <span className="text-sm font-bold text-foreground tracking-normal">{dynamicLabel}</span>
              {dynamicRange && (
                <span className="text-xs font-medium text-muted-foreground tracking-normal">{dynamicRange}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(DASH_PERIOD_LABELS) as DashPeriod[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setDashPeriod(p)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                    dashPeriod === p ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-secondary border border-border"
                  }`}
                >
                  {DASH_PERIOD_LABELS[p]}
                </button>
              ))}
              {/* Antérieures */}
              <Link href={`/fiches?status=ARCHIVEE${anterieures.length > 0 ? `&highlight=${anterieures.map(f => f.id).join(",")}` : ""}`}
                className="relative group px-3 py-1.5 rounded-xl text-sm font-medium transition-all bg-muted text-muted-foreground hover:bg-secondary border border-border inline-flex items-center gap-1.5">
                <Archive className="w-3.5 h-3.5" />
                Antérieures
                {anterieures.length > 0 && (
                  <span className="bg-primary/10 text-primary text-xs font-bold px-1.5 py-0.5 rounded-full">{anterieures.length}</span>
                )}
                <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 w-max max-w-xs px-3 py-2 rounded-lg bg-foreground text-background text-xs leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-50">
                  {anterieures.length} fiche{anterieures.length > 1 ? "s" : ""} archivée{anterieures.length > 1 ? "s" : ""} au cours du trimestre en cours.
                  <br />Cliquer pour les visualiser.
                </span>
              </Link>
            </div>
          </div>
          );
        })()}

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
          <div className={`${statusOpenMobile ? "grid" : "hidden"} sm:grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4`}>
            {visibleStatuses.map((status) => (
              <Link key={status} href={`/fiches?status=${status}`}>
                <Card className={`border border-border border-l-4 shadow-sm ${COUNTER_STYLES[status]} hover:-translate-y-1.5 hover:shadow-xl transition-all duration-200 cursor-pointer`}>
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-3">{STATUS_ICONS[status]}</div>
                    <AnimatedCounter value={counts[status]} className="text-2xl sm:text-3xl font-bold tracking-tight" />
                    <div className="text-xs mt-2 opacity-70 overflow-hidden">
                      {isCommercial && status === "AFFECTEE"
                        ? <span className="inline-flex items-center rounded-full px-2 py-0.5 font-medium bg-orange-100 text-orange-700">À traiter</span>
                        : <FicheStatusBadge status={status} short />}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Prime du mois (référent) ─────────────────────────────────── */}
        {isReferent && (() => {
          const SEUIL = 3;
          const now = new Date();
          const ventesMonth = prospAcceptees.filter((f) => {
            const d = new Date(f.updated_at);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
          }).length;
          const restantes = Math.max(0, SEUIL - ventesMonth);
          const pct = Math.min(100, Math.round((ventesMonth / SEUIL) * 100));
          const gained = ventesMonth >= SEUIL;
          const moisFr = now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

          return (
            <div className={`rounded-2xl border p-5 ${gained ? "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800" : "bg-card border-border"}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${gained ? "bg-amber-100 dark:bg-amber-900/40" : "bg-muted"}`}>
                    <Trophy className={`w-5 h-5 ${gained ? "text-amber-500" : "text-muted-foreground"}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">Prime exceptionnelle — {moisFr}</h3>
                    <p className="text-xs text-muted-foreground">3 ventes validées dans le mois = prime exceptionnelle</p>
                  </div>
                </div>
                {gained && (
                  <span className="flex items-center gap-1 bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    <Star className="w-3 h-3" /> Prime décrochée !
                  </span>
                )}
              </div>

              {/* Barre de progression */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium">
                  <span className={gained ? "text-amber-700 dark:text-amber-400" : "text-foreground"}>
                    {ventesMonth} vente{ventesMonth > 1 ? "s" : ""} validée{ventesMonth > 1 ? "s" : ""} ce mois
                  </span>
                  <span className="text-muted-foreground">{ventesMonth} / {SEUIL}</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${gained ? "bg-amber-400" : "bg-primary"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {!gained && (
                  <p className="text-xs text-muted-foreground">
                    {restantes} vente{restantes > 1 ? "s" : ""} restante{restantes > 1 ? "s" : ""} pour décrocher la prime exceptionnelle 🎯
                  </p>
                )}
              </div>
            </div>
          );
        })()}

        {/* ── Section ADMIN/DG : KPI CA consolidé ────────────────────────────── */}
        {isAdminOrDG && (
          <div className="space-y-6">
            {/* KPI Cards CA */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-card border border-border border-l-4 border-l-amber-500 rounded-2xl p-5 shadow-sm hover:-translate-y-1.5 hover:shadow-xl transition-all duration-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Euro className="w-5 h-5 text-amber-600" />
                  </div>
                </div>
                <p className="text-3xl font-bold tabular-nums">{caTotal.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">{isAllPeriod ? "CA global HT consolidé" : <>CA HT consolidé<span className="normal-case"> ({getPeriodLabel(dashPeriod)})</span></>}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{totalVentes} contrat{totalVentes > 1 ? "s" : ""} signé{totalVentes > 1 ? "s" : ""}</p>
              </div>
              <div className="bg-card border border-border border-l-4 border-l-emerald-500 rounded-2xl p-5 shadow-sm hover:-translate-y-1.5 hover:shadow-xl transition-all duration-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  </div>
                </div>
                <AnimatedCounter value={totalVentes} className="text-3xl font-bold" />
                <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">{isAllPeriod ? "Ventes globales totales" : <>Ventes totales<span className="normal-case"> ({getPeriodLabel(dashPeriod)})</span></>}</p>
              </div>
              <div className="bg-card border border-border border-l-4 border-l-blue-500 rounded-2xl p-5 shadow-sm hover:-translate-y-1.5 hover:shadow-xl transition-all duration-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
                <p className="text-3xl font-bold tabular-nums">{totalVentes > 0 ? Math.round(caTotal / totalVentes).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }) : "—"}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">{isAllPeriod ? "Chiffre d'affaires moyen global" : <>Chiffre d&apos;affaires moyen<span className="normal-case"> ({getPeriodLabel(dashPeriod)})</span></>}</p>
              </div>
            </div>

            {/* KPI Cards secondaires */}
            {(() => {
              const assignedBase = counts.AFFECTEE + counts.RETRACTATION + counts.ACCEPTEE + counts.REFUSEE + counts.ARCHIVEE;
              const refusalRate = assignedBase > 0 ? Math.round((counts.REFUSEE / assignedBase) * 100) : 0;
              const inProgress = counts.SOUMISE + counts.AFFECTEE + counts.RETRACTATION;
              const totalAll = Object.values(counts).reduce((a, b) => a + b, 0);
              const inProgressRate = totalAll > 0 ? Math.round((inProgress / totalAll) * 100) : 0;
              return (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-card border border-border border-l-4 border-l-emerald-500 rounded-2xl p-5 shadow-sm hover:-translate-y-1.5 hover:shadow-xl transition-all duration-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold tabular-nums">{assignedBase > 0 ? Math.round((counts.ACCEPTEE / assignedBase) * 100) : 0}%</p>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">{isAllPeriod ? "Taux global d'acceptation" : <>Taux d&apos;acceptation<span className="normal-case"> ({getPeriodLabel(dashPeriod)})</span></>}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{counts.ACCEPTEE} acceptée{counts.ACCEPTEE > 1 ? "s" : ""} / {assignedBase} affectée{assignedBase > 1 ? "s" : ""}</p>
                  </div>
                  <div className="bg-card border border-border border-l-4 border-l-red-500 rounded-2xl p-5 shadow-sm hover:-translate-y-1.5 hover:shadow-xl transition-all duration-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                        <XCircle className="w-5 h-5 text-red-500" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold tabular-nums">{refusalRate}%</p>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">{isAllPeriod ? "Taux global de refus" : <>Taux de refus<span className="normal-case"> ({getPeriodLabel(dashPeriod)})</span></>}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{counts.REFUSEE} refusée{counts.REFUSEE > 1 ? "s" : ""} / {assignedBase} affectée{assignedBase > 1 ? "s" : ""}</p>
                  </div>
                  <div className="bg-card border border-border border-l-4 border-l-orange-500 rounded-2xl p-5 shadow-sm hover:-translate-y-1.5 hover:shadow-xl transition-all duration-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-orange-600" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold tabular-nums">{inProgressRate}%</p>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">{isAllPeriod ? "Taux global en cours" : <>Taux en cours<span className="normal-case"> ({getPeriodLabel(dashPeriod)})</span></>}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{inProgress} fiche{inProgress > 1 ? "s" : ""} · à valider, affectées, attente client</p>
                  </div>
                </div>
              );
            })()}

            {/* Tableaux référents + commerciaux */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Classement référents — ventes uniquement */}
              <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                      <Trophy className="w-4 h-4 text-amber-600" />
                    </div>
                    <h3 className="font-semibold text-sm">Objectif mensuel de prime (3 ventes) · {referentsStats.length} Référent{referentsStats.length > 1 ? "s" : ""}</h3>
                  </div>
                </div>
                {referentsStats.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucune vente enregistrée</p>
                ) : (
                  <div className="space-y-1">
                    <div className="grid grid-cols-[1fr_60px_70px] gap-2 text-[10px] text-muted-foreground uppercase tracking-wide font-semibold pb-2 border-b border-border">
                      <span>Référent</span>
                      <span className="text-right">Ventes</span>
                      <span className="text-right">En +</span>
                    </div>
                    <CollapsibleList items={referentsStats} renderItem={(p: typeof referentsStats[0], idx: number) => {
                      const bonus = Math.max(0, p.ventes - 3);
                      return (
                        <div key={p.id} className="grid grid-cols-[1fr_60px_70px] gap-2 items-center py-2 hover:bg-secondary/30 rounded-lg px-1 transition-colors">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-4 text-center text-xs font-bold text-muted-foreground shrink-0">{idx+1}</span>
                            <span className="text-sm font-medium truncate">{p.nom}</span>
                            {p.ventes >= 3 && <Star className="w-3 h-3 text-amber-500 shrink-0" />}
                          </div>
                          <span className="text-sm font-bold text-right tabular-nums">{p.ventes}</span>
                          <span className={`text-xs text-right tabular-nums ${bonus > 0 ? "text-emerald-600 font-bold" : "text-muted-foreground"}`}>{bonus > 0 ? `+${bonus}` : "—"}</span>
                        </div>
                      );
                    }} />
                    {referentsStats.length > 0 && (
                      <div className="grid grid-cols-[1fr_60px_70px] gap-2 pt-3 border-t border-border">
                        <span className="text-sm font-bold">Total</span>
                        <span className="text-sm font-bold text-right tabular-nums">{referentsStats.reduce((s, r) => s + r.ventes, 0)}</span>
                        <span className="text-sm font-bold text-right tabular-nums text-emerald-600">+{referentsStats.reduce((s, r) => s + Math.max(0, r.ventes - 3), 0)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Classement commerciaux avec CA */}
              <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                    </div>
                    <h3 className="font-semibold text-sm">CA par commercial ({commerciauxStats.length} {commerciauxStats.length > 1 ? "Commerciaux" : "Commercial"})</h3>
                  </div>
                </div>
                {commerciauxStats.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucune vente enregistrée</p>
                ) : (
                  <div className="space-y-1">
                    <div className="grid grid-cols-[1fr_60px_80px_60px] gap-2 text-[10px] text-muted-foreground uppercase tracking-wide font-semibold pb-2 border-b border-border">
                      <span>Commercial</span>
                      <span className="text-right">Ventes</span>
                      <span className="text-right">CA HT</span>
                      <span className="text-right">CA moy.</span>
                    </div>
                    <CollapsibleList items={commerciauxStats} renderItem={(c: typeof commerciauxStats[0], idx: number) => {
                      const rate = c.ventes > 0 ? Math.round((c.ventes / (commerciauxStats[0]?.ventes ?? 1)) * 100) : 0;
                      return (
                        <div key={c.id} className="space-y-1">
                          <div className="grid grid-cols-[1fr_60px_80px_60px] gap-2 items-center py-2 hover:bg-secondary/30 rounded-lg px-1 transition-colors">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-4 text-center text-xs font-bold text-muted-foreground shrink-0">{idx+1}</span>
                              <span className="text-sm font-medium truncate">{c.nom}</span>
                            </div>
                            <span className="text-sm font-bold text-right tabular-nums">{c.ventes}</span>
                            <span className={`text-sm font-bold text-right tabular-nums ${c.ca > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                              {c.ca > 0 ? c.ca.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }) : "—"}
                            </span>
                            <span className="text-xs text-right tabular-nums text-muted-foreground">{c.ventes > 0 && c.ca > 0 ? Math.round(c.ca / c.ventes).toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + "€/v" : "—"}</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden mx-1">
                            <div className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                              style={{ width: `${rate}%` }} />
                          </div>
                        </div>
                      );
                    }} />
                    {commerciauxStats.length > 0 && (
                      <div className="grid grid-cols-[1fr_60px_80px_60px] gap-2 pt-3 border-t border-border">
                        <span className="text-sm font-bold">Total</span>
                        <span className="text-sm font-bold text-right tabular-nums">{commerciauxStats.reduce((s, c) => s + c.ventes, 0)}</span>
                        <span className="text-sm font-bold text-right tabular-nums text-amber-600">
                          {commerciauxStats.reduce((s, c) => s + c.ca, 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                        </span>
                        <span />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
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
                            {fiche.prospect_prenom} {fiche.prospect_nom}
                          </p>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            <span className="text-xs text-muted-foreground">{fiche.reference}</span>
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
                          {isAdmin && (
                          <Button
                            size="sm"
                            className="bg-[#F97316] hover:bg-[#EA580C] text-white rounded-full px-4 text-xs gap-1.5 h-8"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setAssignCommercialId("");
                              setFicheToAssign({ id: fiche.id, reference: fiche.reference, nom: `${fiche.prospect_prenom} ${fiche.prospect_nom}`, created_by: fiche.created_by });
                            }}
                          >
                            <UserCheck className="w-3.5 h-3.5" />Affecter
                          </Button>
                          )}
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-card border border-border border-l-4 border-l-emerald-500 rounded-2xl p-5 shadow-sm hover:-translate-y-1.5 hover:shadow-xl transition-all duration-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  </div>
                </div>
                <AnimatedCounter value={mesVentes} className="text-3xl font-bold" />
                <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">{isAllPeriod ? "Ventes globales réalisées" : <>Ventes réalisées<span className="normal-case"> ({getPeriodLabel(dashPeriod)})</span></>}</p>
              </div>
              <div className="bg-card border border-border border-l-4 border-l-amber-500 rounded-2xl p-5 shadow-sm hover:-translate-y-1.5 hover:shadow-xl transition-all duration-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Euro className="w-5 h-5 text-amber-600" />
                  </div>
                </div>
                <p className="text-3xl font-bold tabular-nums">{caTotal.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">{isAllPeriod ? "CA global HT total" : <>CA HT total<span className="normal-case"> ({getPeriodLabel(dashPeriod)})</span></>}</p>
              </div>
              <div className="bg-card border border-border border-l-4 border-l-blue-500 rounded-2xl p-5 shadow-sm hover:-translate-y-1.5 hover:shadow-xl transition-all duration-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
                <p className="text-3xl font-bold tabular-nums">{mesVentes > 0 ? Math.round(caTotal / mesVentes).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }) : "—"}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">{isAllPeriod ? "Chiffre d'affaires moyen global" : <>Chiffre d&apos;affaires moyen<span className="normal-case"> ({getPeriodLabel(dashPeriod)})</span></>}</p>
              </div>
            </div>

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
                  <div className="grid grid-cols-[1fr_100px_100px] gap-2 text-[10px] text-muted-foreground uppercase tracking-wide font-semibold pb-2 border-b border-border">
                    <span>Client</span>
                    <span className="text-right">Date</span>
                    <span className="text-right">Montant HT</span>
                  </div>
                  <CollapsibleList items={fichesAcceptees} renderItem={(fiche: FicheAffectee) => (
                    <Link key={fiche.id} href={`/fiches/${fiche.id}`}>
                      <div className="grid grid-cols-[1fr_100px_100px] gap-2 items-center py-2.5 hover:bg-secondary/40 rounded-lg px-1 transition-colors cursor-pointer">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{fiche.prospect_prenom} {fiche.prospect_nom}</p>
                          <p className="text-xs text-muted-foreground">{fiche.reference}</p>
                        </div>
                        <span className="text-xs text-muted-foreground text-right">{new Date(fiche.updated_at).toLocaleDateString("fr-FR")}</span>
                        <span className={`text-sm font-bold text-right tabular-nums ${fiche.montant_ht ? "text-amber-600" : "text-muted-foreground"}`}>
                          {fiche.montant_ht ? Number(fiche.montant_ht).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }) : "—"}
                        </span>
                      </div>
                    </Link>
                  )} />
                  <div className="grid grid-cols-[1fr_100px_100px] gap-2 pt-3 border-t border-border">
                    <span className="text-sm font-bold">Total</span>
                    <span />
                    <span className="text-sm font-bold text-right tabular-nums text-amber-600">
                      {caTotal.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
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
                            {fiche.prospect_prenom} {fiche.prospect_nom}
                          </p>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            <span className="text-xs text-muted-foreground">{fiche.reference}</span>
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
            { status: "AFFECTEE",     label: "Fiches affectées",                           fiches: prospAffectees,  color: "border-l-orange-500",  badgeBg: "bg-orange-500",  iconBg: "bg-orange-50 dark:bg-orange-950/40",   iconColor: "text-orange-500",  hoverBg: "hover:bg-orange-50/40",  emptyMsg: "Aucune fiche affectée." },
            { status: "RETRACTATION", label: "En attente de validation par le client",    fiches: prospRetractees, color: "border-l-purple-500",  badgeBg: "bg-purple-500",  iconBg: "bg-purple-50 dark:bg-purple-950/40",   iconColor: "text-purple-500",  hoverBg: "hover:bg-purple-50/40",  emptyMsg: "Aucune fiche en attente de validation client." },
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
                              <p className="font-semibold text-sm truncate">{fiche.prospect_prenom} {fiche.prospect_nom}</p>
                              <p className="text-xs text-muted-foreground">{fiche.reference}{fiche.prospect_ville ? ` · ${fiche.prospect_ville}` : ""}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-muted-foreground hidden sm:block">{new Date(fiche.created_at).toLocaleDateString("fr-FR")}</span>
                              {status === "BROUILLON" && (
                                <button
                                  type="button"
                                  aria-label={`Supprimer ${fiche.reference}`}
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setFicheToDelete({ id: fiche.id, reference: fiche.reference }); }}
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
                              <p className="font-semibold text-sm truncate">{fiche.prospect_prenom} {fiche.prospect_nom}</p>
                              <p className="text-xs text-muted-foreground">{fiche.reference}{fiche.prospect_ville ? ` · ${fiche.prospect_ville}` : ""}</p>
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
                              <p className="font-semibold text-sm truncate">{fiche.prospect_prenom} {fiche.prospect_nom}</p>
                              <p className="text-xs text-muted-foreground">{fiche.reference}{fiche.prospect_ville ? ` · ${fiche.prospect_ville}` : ""}</p>
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
                              <p className="font-semibold text-sm truncate">{fiche.prospect_prenom} {fiche.prospect_nom}</p>
                              <p className="text-xs text-muted-foreground">{fiche.reference}{fiche.prospect_ville ? ` · ${fiche.prospect_ville}` : ""}</p>
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
                              <p className="font-semibold text-sm truncate">{fiche.prospect_prenom} {fiche.prospect_nom}</p>
                              <p className="text-xs text-muted-foreground">{fiche.reference}{fiche.prospect_ville ? ` · ${fiche.prospect_ville}` : ""}</p>
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

      </div>
    </>
  );
}
