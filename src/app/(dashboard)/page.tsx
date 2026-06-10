"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Topbar } from "@/components/layout/Topbar";
import { FicheStatusBadge } from "@/components/fiches/FicheStatusBadge";
import { createClient } from "@/lib/supabase/client";
import {
  countFichesByStatus,
  deleteFicheCascade,
  getActiveCommercialsAndAdmins,
  FICHE_LIST_COLUMNS,
  type FicheListItem,
} from "@/lib/data/fiches";
import { useProfile } from "@/lib/hooks/use-profile";
import type { FicheStatus } from "@/types/database";
import {
  FileText, FilePlus, Clock, CheckCircle2, XCircle, Send,
  UserCheck, Archive, History, Trash2, AlertCircle, ArrowRight,
  CalendarDays, User, Trophy, Medal, TrendingUp, Star, Activity,
  ChevronDown, ChevronUp, Loader2,
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
type DashPeriod = "ALL" | "TODAY" | "WEEK" | "MONTH" | "QUARTER";
const DASH_PERIOD_LABELS: Record<DashPeriod, string> = {
  ALL: "Toutes les dates", TODAY: "Aujourd'hui",
  WEEK: "Cette semaine", MONTH: "Ce mois", QUARTER: "Ce trimestre",
};
function getDashPeriodDates(period: DashPeriod): { from: string; to: string } | null {
  if (period === "ALL") return null;
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (period === "TODAY") { const t = fmt(now); return { from: t, to: t }; }
  if (period === "WEEK") {
    const day = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const mon = new Date(now); mon.setDate(now.getDate() - day);
    return { from: fmt(mon), to: fmt(now) };
  }
  if (period === "MONTH") return { from: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, to: fmt(now) };
  if (period === "QUARTER") {
    const q = Math.floor(now.getMonth() / 3);
    return { from: `${now.getFullYear()}-${pad(q * 3 + 1)}-01`, to: fmt(now) };
  }
  return null;
}

// ── Styles compteurs ──────────────────────────────────────────────────────────

const STATUS_ICONS: Record<FicheStatus, React.ReactNode> = {
  BROUILLON:    <Clock className="w-5 h-5" />,
  SOUMISE:      <Send className="w-5 h-5" />,
  AFFECTEE:     <UserCheck className="w-5 h-5" />,
  ACCEPTEE:     <CheckCircle2 className="w-5 h-5" />,
  RETRACTATION: <AlertCircle className="w-5 h-5" />,
  REFUSEE:      <XCircle className="w-5 h-5" />,
  ARCHIVEE:     <Archive className="w-5 h-5" />,
};

const COUNTER_STYLES: Record<FicheStatus, string> = {
  BROUILLON:    "border-l-slate-400   bg-card/80  backdrop-blur-sm text-muted-foreground",
  SOUMISE:      "border-l-blue-500    bg-blue-50/80   dark:bg-blue-950/30   backdrop-blur-sm text-blue-700   dark:text-blue-400",
  AFFECTEE:     "border-l-orange-500  bg-orange-50/80 dark:bg-orange-950/30 backdrop-blur-sm text-orange-700 dark:text-orange-400",
  ACCEPTEE:     "border-l-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/30 backdrop-blur-sm text-emerald-700 dark:text-emerald-400",
  RETRACTATION: "border-l-purple-500  bg-purple-50/80 dark:bg-purple-950/30 backdrop-blur-sm text-purple-700 dark:text-purple-400",
  REFUSEE:      "border-l-red-500     bg-red-50/80    dark:bg-red-950/30    backdrop-blur-sm text-red-700    dark:text-red-400",
  ARCHIVEE:     "border-l-slate-400   bg-muted/80 backdrop-blur-sm text-muted-foreground",
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
  created_by_profile: { first_name: string; last_name: string } | null;
  assigned_to_profile: { first_name: string; last_name: string } | null;
}

interface ProspecteurStat {
  id: string;
  nom: string;
  ventes: number;        // total ventes
  ventesMoisCourant: number; // ventes ce mois-ci
  primes: number;        // mois avec ≥3 ventes
  prochainPalier: number; // ventes restantes ce mois avant la prime
}

interface CommercialStat {
  id: string;
  nom: string;
  ventes: number;
}

interface ActivityEntry {
  id: string;
  action: string;
  old_status: FicheStatus | null;
  new_status: FicheStatus | null;
  comment: string | null;
  created_at: string;
  fiche: { id: string; reference: string; prospect_nom: string; prospect_prenom: string } | null;
  author: { first_name: string; last_name: string; role: string } | null;
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
  BROUILLON: "Brouillon", SOUMISE: "À valider", AFFECTEE: "Affectée",
  RETRACTATION: "Att. Validation", ACCEPTEE: "Validée", REFUSEE: "Refusée", ARCHIVEE: "Archivée",
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
  const [showOlder, setShowOlder] = React.useState(false);
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent = fiches.filter((f) => new Date(f.updated_at).getTime() >= cutoff);
  const older  = fiches.filter((f) => new Date(f.updated_at).getTime() <  cutoff);
  const shown  = recent;
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
          {showOlder && older.length > 0 && older.map((fiche, idx) => {
            const history = [...(fiche.fiche_history ?? [])].sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
            return (
              <Link key={fiche.id} href={`/fiches/${fiche.id}`}>
                <div className={`px-5 py-4 transition-colors cursor-pointer bg-muted/20 ${hoverColor} border-t border-border`}>
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
                  {history.length > 0 && (() => { const h = history[0]; return (
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                      {h.user && <span className="font-medium text-foreground/70">{h.user.first_name} {h.user.last_name}</span>}
                      {h.old_status && h.new_status
                        ? <span>{STATUS_LABELS_FR[h.old_status] ?? h.old_status}{" → "}{STATUS_LABELS_FR[h.new_status] ?? h.new_status}</span>
                        : <span>{h.action}</span>}
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
          {older.length > 0 && (
            <button
              type="button"
              onClick={() => setShowOlder((v) => !v)}
              className="w-full px-4 py-2.5 text-center text-xs text-muted-foreground hover:bg-secondary/40 transition-colors border-t border-border flex items-center justify-center gap-1"
            >
              {showOlder
                ? <><ChevronUp className="w-3.5 h-3.5" />Voir moins</>
                : <><ChevronDown className="w-3.5 h-3.5" />+{older.length} fiche{older.length > 1 ? "s" : ""} antérieure{older.length > 1 ? "s" : ""} — Voir plus</>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { profile, loading: profileLoading } = useProfile();
  const [counts, setCounts] = useState<Record<FicheStatus, number>>({
    BROUILLON: 0, SOUMISE: 0, AFFECTEE: 0, ACCEPTEE: 0, RETRACTATION: 0, REFUSEE: 0, ARCHIVEE: 0,
  });
  const [recentFiches, setRecentFiches]   = useState<FicheListItem[]>([]);
  const [historyFiches, setHistoryFiches] = useState<FicheListItem[]>([]);
  const [fichesPending,         setFichesPending]         = useState<FicheEnAttente[]>([]);
  const [fichesAffectees,       setFichesAffectees]       = useState<FicheAffectee[]>([]);
  const [fichesAffecteesAdmin,  setFichesAffecteesAdmin]  = useState<FicheAffectee[]>([]);
  const [fichesAcceptees,       setFichesAcceptees]       = useState<FicheAffectee[]>([]);
  const [fichesRefusees,        setFichesRefusees]        = useState<FicheAffectee[]>([]);
  const [fichesArchivees,         setFichesArchivees]         = useState<FicheAffectee[]>([]);
  const [fichesRetractationComm,  setFichesRetractationComm]  = useState<FicheAffectee[]>([]);
  // Prospecteur : fiches par statut
  const [prospBrouillons,   setProspBrouillons]   = useState<FicheListItem[]>([]);
  const [prospSoumises,     setProspSoumises]     = useState<FicheListItem[]>([]);
  const [prospAffectees,    setProspAffectees]    = useState<FicheListItem[]>([]);
  const [prospAcceptees,    setProspAcceptees]    = useState<FicheListItem[]>([]);
  const [prospRefusees,     setProspRefusees]     = useState<FicheListItem[]>([]);
  const [prospArchivees,    setProspArchivees]    = useState<FicheListItem[]>([]);
  const [prospecteursStats, setProspecteursStats] = useState<ProspecteurStat[]>([]);
  const [commerciauxStats,  setCommerciauxStats]  = useState<CommercialStat[]>([]);
  const [totalVentes,       setTotalVentes]       = useState(0);
  const [mesVentes,         setMesVentes]          = useState(0);
  const [activityLog,       setActivityLog]        = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
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
  const supabase = createClient();

  const fetchData = useCallback(async (period: DashPeriod = "ALL") => {
    if (!profile) return;
    const isProspecteur = profile.role === "PROSPECTEUR";
    try {
    const isAdmin       = profile.role === "ADMIN";
    const isCommercial  = profile.role === "COMMERCIAL";

    // ── Compteurs ────────────────────────────────────────────────────────────
    const statusesToCount: FicheStatus[] = isProspecteur
      ? ["BROUILLON", "SOUMISE", "AFFECTEE", "ACCEPTEE", "RETRACTATION", "REFUSEE", "ARCHIVEE"]
      : ["SOUMISE", "AFFECTEE", "ACCEPTEE", "RETRACTATION", "REFUSEE", "ARCHIVEE"];

    const dates = getDashPeriodDates(period);
    const results = await Promise.all(
      statusesToCount.map(async (s) => {
        if (isProspecteur) {
          const count = await countFichesByStatus(supabase, s, { createdBy: profile.id });
          return [s, count] as const;
        }
        let q = supabase.from("fiches").select("*", { count: "exact", head: true }).eq("status", s);
        // Commercial : uniquement ses fiches affectées
        if (isCommercial) q = q.eq("assigned_to", profile.id);
        if (dates) {
          q = q.gte("created_at", `${dates.from}T00:00:00Z`).lte("created_at", `${dates.to}T23:59:59Z`);
        }
        const { count } = await q;
        return [s, count ?? 0] as const;
      })
    );
    const allCounts: Record<FicheStatus, number> = {
      BROUILLON: 0, SOUMISE: 0, AFFECTEE: 0, ACCEPTEE: 0, RETRACTATION: 0, REFUSEE: 0, ARCHIVEE: 0,
    };
    results.forEach(([s, c]) => { allCounts[s] = c; });
    setCounts(allCounts);

    // ── Commerciaux disponibles pour affectation (ADMIN) ────────────────────
    if (isAdmin) {
      const commercialsList = await getActiveCommercialsAndAdmins(supabase);
      setCommercials(commercialsList);
    }

    // ── Fiches par statut (ADMIN uniquement) ────────────────────────────────
    if (isAdmin) {
      const ficheAdminCols =
        "id, reference, prospect_nom, prospect_prenom, prospect_ville, prospect_cp, created_at, updated_at, created_by, " +
        "created_by_profile:profiles!fiches_created_by_fkey(first_name, last_name), " +
        "fiche_history(action, old_status, new_status, comment, created_at, user:profiles!fiche_history_user_id_fkey(first_name, last_name))";

      const [pendingRes, affecteesRes, accepteesRes, refuseesRes, archiveesRes] = await Promise.all([
        supabase.from("fiches").select(ficheAdminCols).eq("status", "SOUMISE").order("created_at", { ascending: false }),
        supabase.from("fiches").select(ficheAdminCols).eq("status", "AFFECTEE").order("updated_at", { ascending: false }).limit(100),
        supabase.from("fiches").select(ficheAdminCols).eq("status", "ACCEPTEE").order("updated_at", { ascending: false }).limit(100),
        supabase.from("fiches").select(ficheAdminCols).eq("status", "REFUSEE").order("updated_at", { ascending: false }).limit(100),
        supabase.from("fiches").select(ficheAdminCols).eq("status", "ARCHIVEE").order("updated_at", { ascending: false }).limit(100),
      ]);
      setFichesPending((pendingRes.data as unknown as FicheEnAttente[]) ?? []);
      setFichesAffecteesAdmin((affecteesRes.data as unknown as FicheAffectee[]) ?? []);
      setFichesAcceptees((accepteesRes.data as unknown as FicheAffectee[]) ?? []);
      setFichesRefusees((refuseesRes.data as unknown as FicheAffectee[]) ?? []);
      setFichesArchivees((archiveesRes.data as unknown as FicheAffectee[]) ?? []);
    }

    // ── Stats ventes (ADMIN + COMMERCIAL) ────────────────────────────────────
    if (isAdmin || isCommercial) {
      let ventesQuery = supabase
        .from("fiches")
        .select(
          "id, created_by, assigned_to, updated_at, " +
          "created_by_profile:profiles!fiches_created_by_fkey(first_name, last_name), " +
          "assigned_to_profile:profiles!fiches_assigned_to_fkey(first_name, last_name)"
        )
        .eq("status", "ACCEPTEE");

      if (isCommercial) ventesQuery = ventesQuery.eq("assigned_to", profile.id);

      const { data: ventes } = await ventesQuery;
      const rows = (ventes as unknown as VenteRow[]) ?? [];
      setTotalVentes(rows.length);
      if (isCommercial) setMesVentes(rows.length);

      if (isAdmin) {
        // Tous les prospecteurs actifs (même ceux sans vente)
        const { data: allProspecteurs } = await supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .eq("role", "PROSPECTEUR")
          .eq("is_active", true);

        const now = new Date();
        const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

        const pMap = new Map<string, { id: string; nom: string; ventes: number; ventesMoisCourant: number; ventesParMois: Map<string, number> }>();
        for (const p of (allProspecteurs ?? [])) {
          pMap.set(p.id, { id: p.id, nom: `${p.first_name} ${p.last_name}`, ventes: 0, ventesMoisCourant: 0, ventesParMois: new Map() });
        }
        for (const r of rows) {
          if (!r.created_by) continue;
          if (!pMap.has(r.created_by) && r.created_by_profile) {
            pMap.set(r.created_by, { id: r.created_by, nom: `${r.created_by_profile.first_name} ${r.created_by_profile.last_name}`, ventes: 0, ventesMoisCourant: 0, ventesParMois: new Map() });
          }
          const entry = pMap.get(r.created_by);
          if (!entry) continue;
          entry.ventes++;
          // Mois de la vente (basé sur updated_at = date d'acceptation)
          const d = new Date(r.updated_at);
          const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          entry.ventesParMois.set(ym, (entry.ventesParMois.get(ym) ?? 0) + 1);
          if (ym === currentYM) entry.ventesMoisCourant++;
        }
        // Primes = nombre de mois où le prospecteur a atteint ≥3 ventes
        const pStats: ProspecteurStat[] = Array.from(pMap.values()).map((p) => {
          const primes = Array.from(p.ventesParMois.values()).filter((v) => v >= 3).length;
          const ventesCeMois = p.ventesMoisCourant;
          const prochainPalier = ventesCeMois >= 3 ? 0 : 3 - ventesCeMois;
          return { id: p.id, nom: p.nom, ventes: p.ventes, ventesMoisCourant: ventesCeMois, primes, prochainPalier };
        }).sort((a, b) => b.ventes - a.ventes);
        setProspecteursStats(pStats);

        // Agrégation par commercial
        const cMap = new Map<string, CommercialStat>();
        for (const r of rows) {
          if (!r.assigned_to || !r.assigned_to_profile) continue;
          const nom = `${r.assigned_to_profile.first_name} ${r.assigned_to_profile.last_name}`;
          const existing = cMap.get(r.assigned_to);
          if (existing) { existing.ventes++; }
          else { cMap.set(r.assigned_to, { id: r.assigned_to, nom, ventes: 1 }); }
        }
        setCommerciauxStats(Array.from(cMap.values()).sort((a, b) => b.ventes - a.ventes));
      }
    }

    // ── Fiches du commercial connecté ───────────────────────────────────────
    if (isCommercial) {
      const commCols =
        "id, reference, prospect_nom, prospect_prenom, prospect_ville, prospect_cp, updated_at, created_by, " +
        "created_by_profile:profiles!fiches_created_by_fkey(first_name, last_name)";
      const [affecteesRes, retractRes, accepteesRes, refuseesRes, archiveesRes] = await Promise.all([
        supabase.from("fiches").select(commCols).eq("status", "AFFECTEE").eq("assigned_to", profile.id).order("updated_at", { ascending: true }),
        supabase.from("fiches").select(commCols).eq("status", "RETRACTATION").eq("assigned_to", profile.id).order("updated_at", { ascending: false }).limit(50),
        supabase.from("fiches").select(commCols).eq("status", "ACCEPTEE").eq("assigned_to", profile.id).order("updated_at", { ascending: false }).limit(50),
        supabase.from("fiches").select(commCols).eq("status", "REFUSEE").eq("assigned_to", profile.id).order("updated_at", { ascending: false }).limit(50),
        supabase.from("fiches").select(commCols).eq("status", "ARCHIVEE").eq("assigned_to", profile.id).order("updated_at", { ascending: false }).limit(50),
      ]);
      setFichesAffectees((affecteesRes.data as unknown as FicheAffectee[]) ?? []);
      setFichesRetractationComm((retractRes.data as unknown as FicheAffectee[]) ?? []);
      setFichesAcceptees((accepteesRes.data as unknown as FicheAffectee[]) ?? []);
      setFichesRefusees((refuseesRes.data as unknown as FicheAffectee[]) ?? []);
      setFichesArchivees((archiveesRes.data as unknown as FicheAffectee[]) ?? []);
    }

    // ── Fiches récentes ──────────────────────────────────────────────────────
    let recentQuery = supabase
      .from("fiches")
      .select(FICHE_LIST_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(5);

    if (isProspecteur) {
      recentQuery = recentQuery.eq("created_by", profile.id).eq("status", "BROUILLON");
    } else if (isCommercial) {
      // Commercial : activité récente = ses fiches ACCEPTEE / REFUSEE / ARCHIVEE
      recentQuery = recentQuery
        .eq("assigned_to", profile.id)
        .in("status", ["ACCEPTEE", "REFUSEE", "ARCHIVEE"]);
    } else {
      // Admin : toutes sauf brouillons et soumises (déjà en section dédiée)
      recentQuery = recentQuery.neq("status", "BROUILLON").neq("status", "SOUMISE");
    }

    const { data } = await recentQuery;
    setRecentFiches((data as FicheListItem[]) || []);

    // ── Fiches prospecteur par statut ────────────────────────────────────────
    if (isProspecteur) {
      const [bRes, sRes, affRes, accRes, refRes, arcRes] = await Promise.all([
        supabase.from("fiches").select(FICHE_LIST_COLUMNS).eq("created_by", profile.id).eq("status", "BROUILLON").order("created_at", { ascending: false }),
        supabase.from("fiches").select(FICHE_LIST_COLUMNS).eq("created_by", profile.id).eq("status", "SOUMISE").order("created_at", { ascending: false }),
        supabase.from("fiches").select(FICHE_LIST_COLUMNS).eq("created_by", profile.id).eq("status", "AFFECTEE").order("created_at", { ascending: false }),
        supabase.from("fiches").select(FICHE_LIST_COLUMNS).eq("created_by", profile.id).eq("status", "ACCEPTEE").order("created_at", { ascending: false }),
        supabase.from("fiches").select(FICHE_LIST_COLUMNS).eq("created_by", profile.id).eq("status", "REFUSEE").order("created_at", { ascending: false }),
        supabase.from("fiches").select(FICHE_LIST_COLUMNS).eq("created_by", profile.id).eq("status", "ARCHIVEE").order("created_at", { ascending: false }),
      ]);
      setProspBrouillons((bRes.data as FicheListItem[]) ?? []);
      setProspSoumises((sRes.data as FicheListItem[]) ?? []);
      setProspAffectees((affRes.data as FicheListItem[]) ?? []);
      setProspAcceptees((accRes.data as FicheListItem[]) ?? []);
      setProspRefusees((refRes.data as FicheListItem[]) ?? []);
      setProspArchivees((arcRes.data as FicheListItem[]) ?? []);
    }

    // ── Journal d'activité global (ADMIN uniquement) ─────────────────────────
    if (isAdmin) {
      const { data: logs } = await supabase
        .from("fiche_history")
        .select(
          "id, action, old_status, new_status, comment, created_at, " +
          "fiche:fiches!fiche_history_fiche_id_fkey(id, reference, prospect_nom, prospect_prenom), " +
          "author:profiles!fiche_history_user_id_fkey(first_name, last_name, role)"
        )
        .order("created_at", { ascending: false })
        .limit(30);
      setActivityLog((logs as unknown as ActivityEntry[]) ?? []);
    }

    setLoading(false);
    } catch (err) {
      console.error("fetchData error", err);
      setFetchError("Erreur lors du chargement des données. Veuillez recharger la page.");
      setLoading(false);
    }
  }, [profile, supabase]);

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
  }, [profile, profileLoading, supabase, fetchData, dashPeriod]);

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
      const commercial = commercials.find((c) => c.id === assignCommercialId);
      if (commercial) {
        await sendEmailFicheAffectee({
          ficheId: ficheToAssign.id,
          reference: ficheToAssign.reference,
          commercialPrenom: commercial.first_name,
          commercialEmail: (commercial as { email?: string }).email ?? "",
        }).catch(() => {});
      }
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

      // Email au prospecteur uniquement pour REFUSEE (RETRACTATION = étape intermédiaire)
      if (traiterDecision === "REFUSEE" && ficheToTraiter.created_by) {
        void (async () => {
          try {
            const { data: prospProfile } = await supabase
              .from("profiles")
              .select("email, first_name")
              .eq("id", ficheToTraiter.created_by)
              .single();
            if (prospProfile) {
              await sendEmailFicheDecision({
                ficheId: ficheToTraiter.id,
                reference: ficheToTraiter.reference,
                decision: "REFUSEE",
                prospecteurPrenom: prospProfile.first_name,
                prospecteurEmail: prospProfile.email,
                motif: traiterComment.trim() || undefined,
              });
            }
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
  const isProspecteur = profile?.role === "PROSPECTEUR";
  const isAdmin       = profile?.role === "ADMIN";
  const isCommercial  = profile?.role === "COMMERCIAL";

  const visibleStatuses: FicheStatus[] = isProspecteur
    ? ["BROUILLON", "SOUMISE", "AFFECTEE", "ACCEPTEE", "REFUSEE", "ARCHIVEE"]
    : isCommercial
    ? ["AFFECTEE", "RETRACTATION", "ACCEPTEE", "REFUSEE", "ARCHIVEE"]
    : ["SOUMISE", "AFFECTEE", "ACCEPTEE", "RETRACTATION", "REFUSEE", "ARCHIVEE"];

  // ── Skeleton ─────────────────────────────────────────────────────────────
  if (profileLoading || loading) {
    return (
      <>
        <Topbar title="Tableau de bord" />
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
              <div key={i} className="h-28 bg-card rounded-xl border border-border border-l-4 border-l-muted" style={{ animationDelay: `${i * 50}ms` }} />
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
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
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
            className="bg-[#F97316] hover:bg-[#EA580C] text-white rounded-xl gap-2"
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
        <Topbar title="Tableau de bord" />
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
      <Topbar title="Tableau de bord" />
      <div className="p-6 lg:p-8 space-y-8">

        {/* En-tête */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-medium text-foreground">Bonjour, {profile?.first_name}</h2>
            <p className="text-muted-foreground">
              {isProspecteur
                ? `${counts.BROUILLON} brouillon${counts.BROUILLON > 1 ? "s" : ""} en cours`
                : `${totalFiches} fiche${totalFiches > 1 ? "s" : ""} au total`}
            </p>
          </div>
          <Link href="/fiches/nouvelle">
            <Button className="bg-[#F97316] hover:bg-[#EA580C] text-white rounded-xl gap-2">
              <FilePlus className="w-4 h-4" />Nouvelle fiche
            </Button>
          </Link>
        </div>

        {/* Filtre période — direction uniquement */}
        {!isProspecteur && (
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <CalendarDays className="w-3.5 h-3.5" />Période de soumission
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
            </div>
          </div>
        )}

        {/* Compteurs par statut */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {visibleStatuses.map((status) => (
            <Link key={status} href={`/fiches?status=${status}`}>
              <Card className={`border border-border border-l-4 shadow-sm ${COUNTER_STYLES[status]} hover:-translate-y-1.5 hover:shadow-xl transition-all duration-200 cursor-pointer`}>
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-3">{STATUS_ICONS[status]}</div>
                  <AnimatedCounter value={counts[status]} className="text-2xl sm:text-3xl font-bold" />
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

        {/* ── Section ADMIN : tableau des ventes (en haut) ────────────────── */}
        {isAdmin && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Classement prospecteurs */}
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                    <Trophy className="w-4 h-4 text-amber-600" />
                  </div>
                  <h3 className="font-semibold text-sm">Ventes par prospecteur</h3>
                </div>
                <span className="text-xs text-muted-foreground">{totalVentes} vente{totalVentes > 1 ? "s" : ""} au total</span>
              </div>
              {prospecteursStats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Aucune vente enregistrée</p>
              ) : (
                <div className="space-y-3">
                  {prospecteursStats.map((p, i) => {
                    // Prime mensuelle : 3 ventes dans le même mois calendaire
                    const primeCeMois = p.ventesMoisCourant >= 3;
                    const progressPct = Math.min((p.ventesMoisCourant / 3) * 100, 100);
                    return (
                      <div key={p.id} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {i === 0 && <Medal className="w-4 h-4 text-amber-500 shrink-0" />}
                            {i === 1 && <Medal className="w-4 h-4 text-slate-400 shrink-0" />}
                            {i === 2 && <Medal className="w-4 h-4 text-amber-700 shrink-0" />}
                            {i >= 3  && <span className="w-4 text-center text-xs font-bold text-muted-foreground">{i+1}</span>}
                            <span className="text-sm font-medium">{p.nom}</span>
                            {primeCeMois && (
                              <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                <Star className="w-2.5 h-2.5" />Prime ce mois !
                              </span>
                            )}
                            {p.primes > 0 && !primeCeMois && (
                              <span className="text-[10px] text-muted-foreground">
                                {p.primes} prime{p.primes > 1 ? "s" : ""} débloquée{p.primes > 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-bold text-foreground">{p.ventes} total</span>
                            <span className="text-muted-foreground">· {p.ventesMoisCourant}/3 ce mois</span>
                          </div>
                        </div>
                        {/* Barre progression vers la prime mensuelle */}
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-700 ${primeCeMois ? "bg-amber-400" : "bg-emerald-500"}`}
                            style={{ width: `${progressPct}%` }} />
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {primeCeMois
                            ? "🏆 Prime exceptionnelle débloquée ce mois !"
                            : `encore ${p.prochainPalier} vente${p.prochainPalier > 1 ? "s" : ""} ce mois pour la prime`}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {/* Classement commerciaux */}
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
                <h3 className="font-semibold text-sm">Ventes par commercial</h3>
              </div>
              {commerciauxStats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Aucune vente enregistrée</p>
              ) : (
                <div className="space-y-3">
                  {commerciauxStats.map((c, i) => {
                    const maxVentes = commerciauxStats[0]?.ventes ?? 1;
                    return (
                      <div key={c.id} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {i === 0 && <Medal className="w-4 h-4 text-amber-500 shrink-0" />}
                            {i === 1 && <Medal className="w-4 h-4 text-slate-400 shrink-0" />}
                            {i === 2 && <Medal className="w-4 h-4 text-amber-700 shrink-0" />}
                            {i >= 3  && <span className="w-4 text-center text-xs font-bold text-muted-foreground">{i+1}</span>}
                            <span className="text-sm font-medium">{c.nom}</span>
                          </div>
                          <span className="text-xs font-bold text-foreground">{c.ventes} vente{c.ventes > 1 ? "s" : ""}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                            style={{ width: `${(c.ventes / maxVentes) * 100}%` }} />
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {c.ventes} vente{c.ventes > 1 ? "s" : ""} acceptée{c.ventes > 1 ? "s" : ""}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Section ADMIN : fiches en attente (priorité haute) ──────────── */}
        {isAdmin && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="font-semibold text-base">Fiches en attente de validation</h3>
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
                {fichesPending.map((fiche, idx) => {
                  const days = daysSince(fiche.created_at);
                  return (
                    <Link key={fiche.id} href={`/fiches/${fiche.id}`}>
                      <div className={`flex items-center gap-4 px-5 py-4 hover:bg-red-50/40 dark:hover:bg-red-950/20 transition-colors cursor-pointer ${
                        idx < fichesPending.length - 1 ? "border-b border-border" : ""
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
                          <Button
                            size="sm"
                            className="bg-[#F97316] hover:bg-[#EA580C] text-white rounded-xl text-xs gap-1.5 h-8"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setAssignCommercialId("");
                              setFicheToAssign({ id: fiche.id, reference: fiche.reference, nom: `${fiche.prospect_prenom} ${fiche.prospect_nom}`, created_by: fiche.created_by });
                            }}
                          >
                            <UserCheck className="w-3.5 h-3.5" />Affecter
                          </Button>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Section ADMIN : 4 blocs statut (sans À valider, déjà au-dessus) ─ */}
        {isAdmin && (
          <div className="space-y-8">
            <StatusBlock
              title="Affectées"
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
              title="Validées par le Client"
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
              title="Refusées par le client"
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
              title="Archivées"
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

        {/* ── Section COMMERCIAL : KPI ventes personnelles ─────────────────── */}
        {isCommercial && mesVentes > 0 && (
          <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm text-emerald-800 dark:text-emerald-300">
                {mesVentes} vente{mesVentes > 1 ? "s" : ""} réalisée{mesVentes > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70 mt-0.5">
                Total de vos fiches validées par le client
              </p>
            </div>
            <Link href="/reporting">
              <Button variant="outline" size="sm" className="rounded-xl gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-300">
                <TrendingUp className="w-3.5 h-3.5" />Mon reporting
              </Button>
            </Link>
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
                <h3 className="font-semibold text-base">Mes fiches à traiter</h3>
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
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                {fichesAffectees.map((fiche, idx) => {
                  const days = daysSince(fiche.updated_at);
                  return (
                    <Link key={fiche.id} href={`/fiches/${fiche.id}`}>
                      <div className={`flex items-center gap-4 px-5 py-4 hover:bg-orange-50/40 dark:hover:bg-orange-950/20 transition-colors cursor-pointer ${
                        idx < fichesAffectees.length - 1 ? "border-b border-border" : ""
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
                            className="bg-[#F97316] hover:bg-[#EA580C] text-white rounded-xl text-xs gap-1.5 h-8"
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
                })}
              </div>
            )}
          </div>
        )}


        {/* ── Section PROSPECTEUR : 6 blocs fiches ───────────────────────────── */}
        {isProspecteur && (() => {
          const blocs: { status: FicheStatus; label: string; fiches: FicheListItem[]; color: string; badgeBg: string; iconBg: string; iconColor: string; hoverBg: string; emptyMsg: string }[] = [
            { status: "BROUILLON",    label: "Mes brouillons",           fiches: prospBrouillons, color: "border-l-slate-400",   badgeBg: "bg-slate-400",   iconBg: "bg-slate-100 dark:bg-slate-800/40",    iconColor: "text-slate-500",   hoverBg: "hover:bg-slate-50/60",   emptyMsg: "Aucun brouillon en cours." },
            { status: "SOUMISE",      label: "En attente de validation",  fiches: prospSoumises,   color: "border-l-blue-500",    badgeBg: "bg-blue-500",    iconBg: "bg-blue-50 dark:bg-blue-950/40",       iconColor: "text-blue-500",    hoverBg: "hover:bg-blue-50/40",    emptyMsg: "Aucune fiche en attente." },
            { status: "AFFECTEE",     label: "Fiches affectées",          fiches: prospAffectees,  color: "border-l-orange-500",  badgeBg: "bg-orange-500",  iconBg: "bg-orange-50 dark:bg-orange-950/40",   iconColor: "text-orange-500",  hoverBg: "hover:bg-orange-50/40",  emptyMsg: "Aucune fiche affectée." },
            { status: "ACCEPTEE",     label: "Validées par le client",    fiches: prospAcceptees,  color: "border-l-emerald-500", badgeBg: "bg-emerald-500", iconBg: "bg-emerald-50 dark:bg-emerald-950/40", iconColor: "text-emerald-500", hoverBg: "hover:bg-emerald-50/40", emptyMsg: "Aucune fiche validée." },
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
                      <h3 className="font-semibold text-base">{label}</h3>
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
                    <div className="bg-card border border-border rounded-2xl overflow-hidden">
                      {fiches.map((fiche, idx) => (
                        <Link key={fiche.id} href={`/fiches/${fiche.id}`}>
                          <div className={`flex items-center gap-4 px-5 py-4 ${hoverBg} dark:hover:bg-white/5 transition-colors cursor-pointer ${idx < fiches.length - 1 ? "border-b border-border" : ""}`}>
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
                      ))}
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
                      <h3 className="font-semibold text-base">Attente Validation Client</h3>
                      {list.length > 0 && <span className="bg-purple-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{list.length}</span>}
                    </div>
                    <Link href="/fiches?status=RETRACTATION"><Button variant="ghost" size="sm" className="text-muted-foreground gap-1">Voir toutes <ArrowRight className="w-3.5 h-3.5" /></Button></Link>
                  </div>
                  {list.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-1">Aucune fiche en attente de validation.</p>
                  ) : (
                    <div className="bg-card border border-border rounded-2xl overflow-hidden">
                      {list.map((fiche, idx) => (
                        <Link key={fiche.id} href={`/fiches/${fiche.id}`}>
                          <div className={`flex items-center gap-4 px-5 py-4 hover:bg-purple-50/40 dark:hover:bg-purple-950/20 transition-colors cursor-pointer ${idx < list.length - 1 ? "border-b border-border" : ""}`}>
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
                      ))}
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
                      <h3 className="font-semibold text-base">Validées par le client</h3>
                      {list.length > 0 && <span className="bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{list.length}</span>}
                    </div>
                    <Link href="/fiches?status=ACCEPTEE"><Button variant="ghost" size="sm" className="text-muted-foreground gap-1">Voir toutes <ArrowRight className="w-3.5 h-3.5" /></Button></Link>
                  </div>
                  {list.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-1">Aucune fiche validée pour le moment.</p>
                  ) : (
                    <div className="bg-card border border-border rounded-2xl overflow-hidden">
                      {list.map((fiche, idx) => (
                        <Link key={fiche.id} href={`/fiches/${fiche.id}`}>
                          <div className={`flex items-center gap-4 px-5 py-4 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition-colors cursor-pointer ${idx < list.length - 1 ? "border-b border-border" : ""}`}>
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
                      ))}
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
                      <h3 className="font-semibold text-base">Refusées par le client</h3>
                      {list.length > 0 && <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{list.length}</span>}
                    </div>
                    <Link href="/fiches?status=REFUSEE"><Button variant="ghost" size="sm" className="text-muted-foreground gap-1">Voir toutes <ArrowRight className="w-3.5 h-3.5" /></Button></Link>
                  </div>
                  {list.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-1">Aucune fiche refusée.</p>
                  ) : (
                    <div className="bg-card border border-border rounded-2xl overflow-hidden">
                      {list.map((fiche, idx) => (
                        <Link key={fiche.id} href={`/fiches/${fiche.id}`}>
                          <div className={`flex items-center gap-4 px-5 py-4 hover:bg-red-50/40 dark:hover:bg-red-950/20 transition-colors cursor-pointer ${idx < list.length - 1 ? "border-b border-border" : ""}`}>
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
                      ))}
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
                      <h3 className="font-semibold text-base">Archivées</h3>
                      {list.length > 0 && <span className="bg-slate-400 text-white text-xs font-bold px-2 py-0.5 rounded-full">{list.length}</span>}
                    </div>
                    <Link href="/fiches?status=ARCHIVEE"><Button variant="ghost" size="sm" className="text-muted-foreground gap-1">Voir toutes <ArrowRight className="w-3.5 h-3.5" /></Button></Link>
                  </div>
                  {list.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-1">Aucune fiche archivée.</p>
                  ) : (
                    <div className="bg-card border border-border rounded-2xl overflow-hidden">
                      {list.map((fiche, idx) => (
                        <Link key={fiche.id} href={`/fiches/${fiche.id}`}>
                          <div className={`flex items-center gap-4 px-5 py-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/20 transition-colors cursor-pointer ${idx < list.length - 1 ? "border-b border-border" : ""}`}>
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
                      ))}
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
