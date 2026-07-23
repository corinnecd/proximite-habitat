"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Topbar } from "@/components/layout/Topbar";
import { ExportPdfButton } from "@/components/ui/export-pdf-button";
import { ExportCsvButton } from "@/components/ui/export-csv-button";
import { createClient } from "@/lib/supabase/client";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/data/notifications";
import {
  CheckCheck, FileText, Check, Loader2, Search, X, Calendar,
  SendHorizonal, UserCheck, ThumbsUp, ThumbsDown, RotateCcw,
  Bell, BellOff, Clock, AlertCircle, Trash2, ChevronDown, UserX,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { deleteFicheCascade } from "@/lib/data/fiches";
import { EmptyState } from "@/components/ui/empty-state";
import { useProfile } from "@/lib/hooks/use-profile";
import type { Notification, FicheStatus } from "@/types/database";
import { FicheStatusBadge } from "@/components/fiches/FicheStatusBadge";
import { toast } from "sonner";

const PAGE_SIZE = 20;

// ── Période ──────────────────────────────────────────────────────────────────
type PeriodFilter = "all" | "today" | "week" | "month" | "custom";

const PERIOD_LABELS: Record<PeriodFilter, string> = {
  all:    "Toutes",
  today:  "Aujourd'hui",
  week:   "Cette semaine",
  month:  "Ce mois",
  custom: "Période",
};

function getDateRange(period: PeriodFilter, customFrom: string, customTo: string): { dateFrom?: string; dateTo?: string } {
  const now = new Date();
  if (period === "today") {
    const s = new Date(now); s.setHours(0, 0, 0, 0);
    const e = new Date(now); e.setHours(23, 59, 59, 999);
    return { dateFrom: s.toISOString(), dateTo: e.toISOString() };
  }
  if (period === "week") {
    const s = new Date(now);
    s.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
    s.setHours(0, 0, 0, 0);
    return { dateFrom: s.toISOString() };
  }
  if (period === "month") {
    return { dateFrom: new Date(now.getFullYear(), now.getMonth(), 1).toISOString() };
  }
  if (period === "custom") {
    return {
      dateFrom: customFrom ? new Date(customFrom).toISOString() : undefined,
      dateTo:   customTo   ? new Date(customTo + "T23:59:59").toISOString() : undefined,
    };
  }
  return {};
}

// ── Types de notification ─────────────────────────────────────────────────────
type NotifType = "FICHE_SOUMISE" | "FICHE_AFFECTEE" | "FICHE_ACCEPTEE" | "FICHE_REFUSEE" | "FICHE_REJETEE" | "CLIENT_ABSENT";

const TYPE_CONFIG: Record<NotifType, {
  label: string;
  icon: React.ElementType;
  filterColor: string;       // couleur pill filtre
  iconBg: string;            // fond icône carte
  iconColor: string;         // couleur icône carte
  badgeCls: string;          // badge type sur la carte
  priority: number;          // 1 = urgent, 2 = info, 3 = archivage
}> = {
  FICHE_SOUMISE:  {
    label: "Soumise",
    icon: SendHorizonal,
    filterColor: "text-blue-500",
    iconBg: "bg-blue-100 dark:bg-blue-900/40",
    iconColor: "text-blue-600 dark:text-blue-400",
    badgeCls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    priority: 1,
  },
  FICHE_AFFECTEE: {
    label: "Affectée",
    icon: UserCheck,
    filterColor: "text-purple-500",
    iconBg: "bg-purple-100 dark:bg-purple-900/40",
    iconColor: "text-purple-600 dark:text-purple-400",
    badgeCls: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    priority: 1,
  },
  FICHE_REJETEE:  {
    label: "Rejetée",
    icon: RotateCcw,
    filterColor: "text-orange-500",
    iconBg: "bg-orange-100 dark:bg-orange-900/40",
    iconColor: "text-orange-600 dark:text-orange-400",
    badgeCls: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    priority: 1,
  },
  FICHE_ACCEPTEE: {
    label: "Acceptation Client",
    icon: ThumbsUp,
    filterColor: "text-emerald-500",
    iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    badgeCls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    priority: 2,
  },
  FICHE_REFUSEE:  {
    label: "Refus Client",
    icon: ThumbsDown,
    filterColor: "text-red-500",
    iconBg: "bg-red-100 dark:bg-red-900/40",
    iconColor: "text-red-600 dark:text-red-400",
    badgeCls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    priority: 2,
  },
  CLIENT_ABSENT:  {
    label: "RDV à reprendre",
    icon: UserX,
    filterColor: "text-amber-500",
    iconBg: "bg-amber-100 dark:bg-amber-900/40",
    iconColor: "text-amber-600 dark:text-amber-400",
    badgeCls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    priority: 1,
  },
};

// Statuts disponibles par rôle (filtre)
const STATUS_BY_ROLE: Record<string, NotifType[]> = {
  ADMIN:       ["FICHE_SOUMISE", "FICHE_ACCEPTEE", "FICHE_REFUSEE"],
  COMMERCIAL:  ["FICHE_AFFECTEE", "FICHE_ACCEPTEE", "FICHE_REFUSEE"],
  PROSPECTEUR: ["FICHE_SOUMISE", "FICHE_AFFECTEE", "FICHE_REJETEE", "FICHE_ACCEPTEE", "FICHE_REFUSEE", "CLIENT_ABSENT"],
  CHEF_EQUIPE: ["FICHE_SOUMISE", "FICHE_AFFECTEE", "FICHE_REJETEE", "FICHE_ACCEPTEE", "FICHE_REFUSEE", "CLIENT_ABSENT"],
};

// ── Groupement temporel ───────────────────────────────────────────────────────
type Group = { label: string; icon: React.ElementType; notifications: Notification[] };

function groupByDate(notifications: Notification[]): Group[] {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const weekStart  = new Date(now); weekStart.setDate(now.getDate() - 6); weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now); monthStart.setDate(now.getDate() - 29); monthStart.setHours(0, 0, 0, 0);

  const today: Notification[]   = [];
  const week: Notification[]    = [];
  const month: Notification[]   = [];
  const older: Notification[]   = [];

  for (const n of notifications) {
    const d = new Date(n.created_at);
    if (d >= todayStart)  today.push(n);
    else if (d >= weekStart) week.push(n);
    else if (d >= monthStart) month.push(n);
    else older.push(n);
  }

  const groups: Group[] = [];
  if (today.length)  groups.push({ label: "Aujourd'hui",       icon: Bell,        notifications: today });
  if (week.length)   groups.push({ label: "Cette semaine",     icon: Clock,       notifications: week });
  if (month.length)  groups.push({ label: "Ce mois",           icon: Calendar,    notifications: month });
  if (older.length)  groups.push({ label: "Plus anciennes",    icon: BellOff,     notifications: older });
  return groups;
}

// ── Formatage date relative ───────────────────────────────────────────────────
function formatRelativeDate(dateStr: string): string {
  try {
    const d    = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const now  = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60)    return "À l'instant";
    if (diff < 3600)  return `Il y a ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

// ── Composant carte notification ──────────────────────────────────────────────
function NotifCard({
  notif,
  ficheStatus,
  onClick,
  onMarkRead,
  onDelete,
}: {
  notif: Notification;
  ficheStatus?: FicheStatus;
  onClick: (n: Notification) => void;
  onMarkRead: (id: string) => void;
  onDelete?: (ficheId: string) => void;
}) {
  const cfg = TYPE_CONFIG[notif.type as NotifType];
  const Icon = cfg?.icon ?? FileText;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${notif.read ? "" : "Non lue. "}${notif.title}${notif.fiche_id ? " — ouvrir la fiche" : ""}`}
      onClick={() => onClick(notif)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(notif); } }}
      className={`rounded-xl shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
        ${!notif.read
          ? "bg-blue-50/70 dark:bg-blue-950/25 ring-1 ring-blue-200 dark:ring-blue-800"
          : "bg-card ring-1 ring-border/30 opacity-80 hover:opacity-100"
        } ${notif.fiche_id ? "hover:ring-primary/40" : ""}`}
    >
      <div className="p-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">

          {/* Icône typée */}
          <div className="relative shrink-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors
              ${!notif.read ? (cfg?.iconBg ?? "bg-blue-100") : "bg-muted"}`}>
              <Icon className={`w-5 h-5 ${!notif.read ? (cfg?.iconColor ?? "text-blue-600") : "text-muted-foreground"}`} />
            </div>
            {!notif.read && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[#F97316] rounded-full border-2 border-white dark:border-background" />
            )}
          </div>

          {/* Contenu */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <p className={`text-sm leading-snug ${!notif.read ? "font-semibold text-foreground" : "font-medium text-foreground/75"}`}>
                {notif.title}
              </p>
              {ficheStatus
                ? <FicheStatusBadge status={ficheStatus} short />
                : cfg && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${cfg.badgeCls}`}>
                    {cfg.label}
                  </span>
                )
              }
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{notif.message}</p>
            <p className="text-xs text-muted-foreground/60 mt-1.5">{formatRelativeDate(notif.created_at)}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!notif.read && (
            <button
              type="button"
              title="Marquer comme lu"
              aria-label="Marquer comme lu"
              onClick={(e) => { e.stopPropagation(); onMarkRead(notif.id); }}
              className="w-8 h-8 rounded-full hover:bg-primary/10 flex items-center justify-center text-primary/60 hover:text-primary transition-colors"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          {notif.fiche_id && onDelete && (
            <button
              type="button"
              title="Supprimer la fiche"
              aria-label="Supprimer la fiche"
              onClick={(e) => { e.stopPropagation(); onDelete(notif.fiche_id!); }}
              className="w-8 h-8 rounded-full hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [ficheStatuses, setFicheStatuses] = useState<Record<string, FicheStatus>>({});
  const [loading, setLoading] = useState(true);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [deleteFicheId, setDeleteFicheId] = useState<string | null>(null);
  const [deleteMotif, setDeleteMotif] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showAllUnread, setShowAllUnread] = useState(false);
  const [showAllRead, setShowAllRead] = useState(false);

  const VISIBLE_COUNT = 5;

  // Filtres
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<NotifType[]>([]);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { profile } = useProfile();

  const role = profile?.role ?? null;
  const statusOptions = useMemo(() =>
    role ? (STATUS_BY_ROLE[role] ?? []).map((v) => ({ value: v, ...TYPE_CONFIG[v] })) : [],
    [role],
  );

  const fetchNotifications = useCallback(async (
    uid: string,
    pageToLoad = 0,
    append = false,
    opts: {
      search?: string;
      period?: PeriodFilter;
      customFrom?: string;
      customTo?: string;
      types?: NotifType[];
    } = {},
  ) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const from = pageToLoad * PAGE_SIZE;
      const { dateFrom, dateTo } = getDateRange(opts.period ?? "all", opts.customFrom ?? "", opts.customTo ?? "");
      const rows = await getNotifications(
        supabase, uid,
        { from, to: from + PAGE_SIZE - 1 },
        opts.search || undefined,
        dateFrom,
        dateTo,
        opts.types?.length ? opts.types : undefined,
      );
      const allRows = append ? [...notifications, ...rows] : rows;
      setNotifications(allRows);
      setHasMore(rows.length === PAGE_SIZE);
      setPage(pageToLoad);

      // Fetch statuts des fiches en arrière-plan (badge décoratif — non bloquant)
      const ficheIds = [...new Set(allRows.filter((n) => n.fiche_id).map((n) => n.fiche_id!))];
      if (ficheIds.length > 0) {
        void supabase.from("fiches").select("id, status").in("id", ficheIds).then(({ data: fiches }) => {
          if (fiches) {
            const map: Record<string, FicheStatus> = {};
            for (const f of fiches as { id: string; status: FicheStatus }[]) map[f.id] = f.status;
            setFicheStatuses((prev) => ({ ...prev, ...map }));
          }
        });
      }
    } catch (e) {
      console.error("[fetchNotifications]", e);
      if (!append) setNotifications([]);
    } finally {
      if (append) setLoadingMore(false);
      setLoading(false);
      setInitialLoaded(true);
    }
  }, [supabase]);

  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setUserId(user.id);
        fetchNotifications(user.id);
      } catch (e) {
        console.error("[notifications init]", e);
        setLoading(false);
      }
    }
    init();
  }, [supabase, fetchNotifications]);

  useEffect(() => {
    if (!userId) return;
    fetchNotifications(userId, 0, false, { search, period, customFrom, customTo, types: selectedTypes });
  }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!userId || period !== "custom") return;
    if (customFrom || customTo)
      fetchNotifications(userId, 0, false, { search, period, customFrom, customTo, types: selectedTypes });
  }, [customFrom, customTo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!userId) return;
    fetchNotifications(userId, 0, false, { search, period, customFrom, customTo, types: selectedTypes });
  }, [selectedTypes]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value);
      if (userId) fetchNotifications(userId, 0, false, { search: value, period, customFrom, customTo, types: selectedTypes });
    }, 300);
  }

  function clearSearch() {
    setSearchInput(""); setSearch("");
    if (userId) fetchNotifications(userId, 0, false, { search: "", period, customFrom, customTo, types: selectedTypes });
  }

  function handlePeriodChange(p: PeriodFilter) {
    setPeriod(p);
    if (p !== "custom") { setCustomFrom(""); setCustomTo(""); }
  }

  function toggleType(t: NotifType) {
    setSelectedTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  }

  function loadMore() {
    if (userId && !loadingMore && hasMore)
      fetchNotifications(userId, page + 1, true, { search, period, customFrom, customTo, types: selectedTypes });
  }

  async function markAsRead(notifId: string) {
    await markNotificationRead(supabase, notifId);
    setNotifications((prev) => prev.map((n) => (n.id === notifId ? { ...n, read: true } : n)));
  }

  async function markAllRead() {
    if (!userId) return;
    await markAllNotificationsRead(supabase, userId);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  async function handleClick(notif: Notification) {
    if (!notif.read) await markAsRead(notif.id);
    if (notif.fiche_id) router.push(`/fiches/${notif.fiche_id}`);
  }

  function handleDeleteRequest(ficheId: string) {
    setDeleteFicheId(ficheId);
    setDeleteMotif("");
  }

  async function handleDeleteConfirm() {
    if (!deleteFicheId || !deleteMotif.trim() || !profile) return;
    setDeleting(true);
    try {
      await supabase.from("fiche_history").insert({
        fiche_id: deleteFicheId,
        organization_id: profile.organization_id,
        user_id: profile.id,
        action: `Fiche supprimée — Motif : ${deleteMotif.trim()}`,
      });
      await deleteFicheCascade(supabase, deleteFicheId);
      setNotifications((prev) => prev.filter((n) => n.fiche_id !== deleteFicheId));
      setDeleteFicheId(null);
      toast.success("Fiche supprimée");
    } catch {
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeleting(false);
    }
  }

  // Notifications filtrées localement (non lues seulement)
  const displayed = useMemo(
    () => showUnreadOnly ? notifications.filter((n) => !n.read) : notifications,
    [notifications, showUnreadOnly],
  );

  // Tri : non lues d'abord (par priorité de type), puis lues (chronologiques)
  const sorted = useMemo(() => {
    const unread = [...displayed.filter((n) => !n.read)].sort((a, b) => {
      const pa = TYPE_CONFIG[a.type as NotifType]?.priority ?? 9;
      const pb = TYPE_CONFIG[b.type as NotifType]?.priority ?? 9;
      if (pa !== pb) return pa - pb;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    const read = displayed.filter((n) => n.read); // déjà triées par created_at desc depuis l'API
    return { unread, read };
  }, [displayed]);

  const groups = useMemo(() => groupByDate(sorted.read), [sorted.read]);

  const allRead   = useMemo(() => groups.flatMap((g) => g.notifications), [groups]);
  const totalRead = allRead.length;
  const visibleRead = showAllRead ? allRead : allRead.slice(0, VISIBLE_COUNT);

  const unreadCount    = notifications.filter((n) => !n.read).length;
  const isFiltered     = !!(search || period !== "all" || selectedTypes.length > 0 || showUnreadOnly);
  const totalDisplayed = displayed.length;
  const isReferent     = profile?.role === "PROSPECTEUR";

  if (loading) return null;

  return (
    <>
      <Topbar title="Notifications" actions={!isReferent ? <div className="flex items-center gap-2"><ExportPdfButton title="Notifications" filename="notifications" /><ExportCsvButton filename="notifications" getData={() => ({
        columns: [
          { key: "date", label: "Date" },
          { key: "titre", label: "Titre" },
          { key: "message", label: "Message" },
          { key: "lu", label: "Lu" },
        ] as { key: keyof { date: string; titre: string; message: string; lu: string }; label: string }[],
        rows: notifications.map((n) => ({ date: n.created_at?.slice(0, 10) || "", titre: n.title, message: n.message || "", lu: n.read ? "Oui" : "Non" })),
      })} /></div> : undefined} />
      <div className="p-4 sm:p-6 lg:p-8 space-y-4">

        {/* ═══ HERO NOTIFICATIONS — navy signature ═══════════════════════ */}
        <div className="hero-surface hero-surface-sm rounded-3xl p-6 sm:p-7">
          <div className="relative z-10">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  {unreadCount > 0 && <span className="w-2 h-2 rounded-full bg-[#F97316] animate-pulse" />}
                  <span className="text-[10px] tracking-[1.2px] uppercase text-white/50 font-medium">
                    Boîte de réception
                  </span>
                </div>
                <h1 className="font-heading text-3xl sm:text-4xl text-white tracking-tight leading-none">
                  Notifications
                </h1>
                <p className="text-sm text-white/60 mt-1.5">
                  {loading
                    ? <span className="inline-block h-4 w-48 bg-white/10 rounded animate-pulse align-middle" />
                    : unreadCount > 0
                    ? <><span className="text-[#F97316] font-medium">{unreadCount} non lue{unreadCount > 1 ? "s" : ""}</span> · {totalDisplayed} au total</>
                    : "Toutes les notifications sont lues"}
                </p>
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="flex-shrink-0 flex items-center gap-1.5 text-xs font-medium text-white/70 hover:text-white bg-white/8 hover:bg-white/15 border border-white/10 rounded-full px-3 py-2 transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Tout marquer lu</span>
                </button>
              )}
            </div>

            {/* Recherche intégrée */}
            <div className="relative mb-3">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
              <input
                type="text"
                placeholder="Rechercher dans les notifications…"
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full h-10 pl-10 pr-10 bg-white/8 border border-white/10 rounded-full text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-[#F97316]/50 focus:border-[#F97316]/30 transition-all"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={clearSearch}
                  aria-label="Effacer"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filtres période chips */}
            <div className="flex flex-wrap gap-1.5">
              {(["all", "today", "week", "month"] as PeriodFilter[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePeriodChange(p)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    period === p
                      ? "bg-[#F97316] text-white"
                      : "bg-white/8 text-white/70 hover:bg-white/15 border border-white/10"
                  }`}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowUnreadOnly((v) => !v)}
                  className={`ml-1 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    showUnreadOnly
                      ? "bg-[#F97316] text-white"
                      : "bg-white/8 text-white/70 hover:bg-white/15 border border-white/10"
                  }`}
                >
                  <AlertCircle className="w-3 h-3" />
                  Non lues ({unreadCount})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ═══ Filtre par type (si plusieurs) ══════════════════════════════ */}
        {statusOptions.length > 1 && (
          <div className="bg-card rounded-2xl border border-border/40 shadow-sm p-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60">
                Type
              </span>
              <div className="flex-1 h-px bg-border/50" />
              {selectedTypes.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedTypes([])}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  <X className="w-3 h-3" />Tout effacer
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map(({ value, label, icon: Icon, filterColor }) => {
                const active = selectedTypes.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleType(value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                      active
                        ? "bg-[#0F1E3D] text-white border-[#0F1E3D] shadow-sm"
                        : "bg-background border-border hover:border-primary/40 hover:text-foreground text-muted-foreground"
                    }`}
                  >
                    <Icon className={`w-3 h-3 ${active ? "text-white" : filterColor}`} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Contenu ───────────────────────────────────────────────────── */}
        <div>
        {displayed.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <EmptyState
                illustration="notifications"
                title={isFiltered ? "Aucun résultat" : "Aucune notification"}
                description={
                  isFiltered
                    ? "Aucune notification ne correspond à vos critères."
                    : "Vous serez notifié lors de nouvelles soumissions, affectations ou changements de statut."
                }
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">

            {/* ── Section : À traiter (non lues) ── */}
            {sorted.unread.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#F97316] animate-pulse" />
                    <h2 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">
                      À valider · {sorted.unread.length}
                    </h2>
                  </div>
                  <div className="flex-1 h-px bg-border/50" />
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    <CheckCheck className="w-3 h-3" />Tout marquer lu
                  </button>
                </div>
                <div className="space-y-2">
                  {(showAllUnread ? sorted.unread : sorted.unread.slice(0, VISIBLE_COUNT)).map((n) => (
                    <NotifCard key={n.id} notif={n} ficheStatus={n.fiche_id ? ficheStatuses[n.fiche_id] : undefined} onClick={handleClick} onMarkRead={markAsRead} onDelete={profile?.role === "DIRECTION" || profile?.role === "SUPER_ADMIN" ? handleDeleteRequest : undefined} />
                  ))}
                </div>
                {sorted.unread.length > VISIBLE_COUNT && (
                  <div className="flex justify-center mt-3">
                    <Button variant="ghost" size="sm" onClick={() => setShowAllUnread((v) => !v)} className="gap-1.5 text-muted-foreground hover:text-foreground rounded-xl text-xs">
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAllUnread ? "rotate-180" : ""}`} />
                      {showAllUnread ? "Voir moins" : `Voir plus (${sorted.unread.length - VISIBLE_COUNT})`}
                    </Button>
                  </div>
                )}
              </section>
            )}

            {/* ── Section : Lues, groupées par date ── */}
            {!showUnreadOnly && groups.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground/60">
                    Historique · {totalRead}
                  </h2>
                  <div className="flex-1 h-px bg-border/40" />
                </div>
                <div className="space-y-2">
                  {visibleRead.map((n) => (
                    <NotifCard key={n.id} notif={n} ficheStatus={n.fiche_id ? ficheStatuses[n.fiche_id] : undefined} onClick={handleClick} onMarkRead={markAsRead} onDelete={profile?.role === "DIRECTION" || profile?.role === "SUPER_ADMIN" ? handleDeleteRequest : undefined} />
                  ))}
                </div>
                {totalRead > VISIBLE_COUNT && (
                  <div className="flex justify-center mt-1">
                    <Button variant="ghost" size="sm" onClick={() => setShowAllRead((v) => !v)} className="gap-1.5 text-muted-foreground hover:text-foreground rounded-xl text-xs">
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAllRead ? "rotate-180" : ""}`} />
                      {showAllRead ? "Voir moins" : `Voir plus (${totalRead - VISIBLE_COUNT})`}
                    </Button>
                  </div>
                )}
              </section>
            )}

            {/* Charger plus */}
            {hasMore && (
              <div className="flex justify-center pt-1">
                <Button variant="outline" onClick={loadMore} disabled={loadingMore} className="rounded-xl gap-2">
                  {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Charger plus
                </Button>
              </div>
            )}
          </div>
        )}
        </div>
      </div>
      {/* Dialog suppression fiche */}
      <Dialog open={deleteFicheId !== null} onOpenChange={(open) => { if (!open) setDeleteFicheId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="w-5 h-5" />Supprimer cette fiche ?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              La fiche sera définitivement supprimée avec toutes ses photos. Cette action est irréversible.
            </p>
            <div className="space-y-1.5">
              <label htmlFor="notif-delete-motif" className="text-sm font-medium">Motif de suppression <span className="text-destructive">*</span></label>
              <textarea
                id="notif-delete-motif"
                value={deleteMotif}
                onChange={(e) => setDeleteMotif(e.target.value)}
                placeholder="Indiquez la raison de la suppression…"
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-destructive/30"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setDeleteFicheId(null)}>Annuler</Button>
            <Button onClick={handleDeleteConfirm} disabled={deleting || !deleteMotif.trim()}
              className="bg-destructive hover:bg-destructive/90 text-white rounded-xl gap-2">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
