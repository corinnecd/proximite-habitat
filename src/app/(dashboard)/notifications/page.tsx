"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Topbar } from "@/components/layout/Topbar";
import { ExportPdfButton } from "@/components/ui/export-pdf-button";
import { createClient } from "@/lib/supabase/client";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/data/notifications";
import {
  CheckCheck, FileText, Check, Loader2, Search, X, Calendar,
  SendHorizonal, UserCheck, ThumbsUp, ThumbsDown, RotateCcw,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useProfile } from "@/lib/hooks/use-profile";
import type { Notification } from "@/types/database";

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

// ── Statut ────────────────────────────────────────────────────────────────────
type NotifType = "FICHE_SOUMISE" | "FICHE_AFFECTEE" | "FICHE_ACCEPTEE" | "FICHE_REFUSEE" | "FICHE_REJETEE";

const ALL_STATUS_OPTIONS: { value: NotifType; label: string; icon: React.ElementType; color: string }[] = [
  { value: "FICHE_SOUMISE",  label: "Soumise",            icon: SendHorizonal, color: "text-blue-500"   },
  { value: "FICHE_AFFECTEE", label: "Affectée",           icon: UserCheck,     color: "text-purple-500" },
  { value: "FICHE_ACCEPTEE", label: "Acceptée",           icon: ThumbsUp,      color: "text-emerald-500"},
  { value: "FICHE_REFUSEE",  label: "Refusée",            icon: ThumbsDown,    color: "text-red-500"    },
  { value: "FICHE_REJETEE",  label: "Renvoyée brouillon", icon: RotateCcw,     color: "text-orange-500" },
];

// Statuts pertinents par rôle
const STATUS_BY_ROLE: Record<string, NotifType[]> = {
  ADMIN:        ["FICHE_SOUMISE", "FICHE_ACCEPTEE", "FICHE_REFUSEE"],
  COMMERCIAL:   ["FICHE_AFFECTEE"],
  PROSPECTEUR:  ["FICHE_SOUMISE", "FICHE_AFFECTEE", "FICHE_ACCEPTEE", "FICHE_REFUSEE", "FICHE_REJETEE"],
};

// Badge couleur par type sur la carte notification
const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  FICHE_SOUMISE:  { label: "Soumise",            cls: "bg-blue-100 text-blue-700"     },
  FICHE_AFFECTEE: { label: "Affectée",           cls: "bg-purple-100 text-purple-700" },
  FICHE_ACCEPTEE: { label: "Acceptée",           cls: "bg-emerald-100 text-emerald-700"},
  FICHE_REFUSEE:  { label: "Refusée",            cls: "bg-red-100 text-red-700"       },
  FICHE_REJETEE:  { label: "Brouillon",          cls: "bg-orange-100 text-orange-700" },
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  // Filtres
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<NotifType[]>([]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabase = createClient();
  const router = useRouter();
  const { profile } = useProfile();

  const statusOptions = ALL_STATUS_OPTIONS.filter((o) =>
    !profile?.role || (STATUS_BY_ROLE[profile.role] ?? []).includes(o.value)
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
    setNotifications((prev) => (append ? [...prev, ...rows] : rows));
    setHasMore(rows.length === PAGE_SIZE);
    setPage(pageToLoad);
    if (append) setLoadingMore(false);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      fetchNotifications(user.id);
    }
    init();
  }, [supabase, fetchNotifications]);

  // Relance sur changement période
  useEffect(() => {
    if (!userId) return;
    fetchNotifications(userId, 0, false, { search, period, customFrom, customTo, types: selectedTypes });
  }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  // Relance sur dates custom
  useEffect(() => {
    if (!userId || period !== "custom") return;
    if (customFrom || customTo)
      fetchNotifications(userId, 0, false, { search, period, customFrom, customTo, types: selectedTypes });
  }, [customFrom, customTo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Relance sur changement de types
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

  const unreadCount = notifications.filter((n) => !n.read).length;
  const isFiltered = !!(search || period !== "all" || selectedTypes.length > 0);

  return (
    <>
      <Topbar title="Notifications" actions={<ExportPdfButton title="Notifications" filename="notifications" />} />
      <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-4">

        {/* ── Bloc filtres ──────────────────────────────────────────────── */}
        <div className="bg-card rounded-2xl border border-border/40 shadow-sm p-4 space-y-4">

          {/* Recherche textuelle */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Rechercher dans les notifications…"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 pr-9 rounded-xl h-10"
            />
            {searchInput && (
              <button type="button" onClick={clearSearch} aria-label="Effacer"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Séparateur avec label */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60 whitespace-nowrap">Période</span>
            <div className="flex-1 h-px bg-border/50" />
          </div>

          {/* Filtres période */}
          <div className="flex flex-wrap gap-2">
            {(["all", "today", "week", "month", "custom"] as PeriodFilter[]).map((p) => (
              <button key={p} type="button" onClick={() => handlePeriodChange(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border
                  ${period === p
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                  }`}>
                {p === "custom" && <Calendar className="w-3 h-3 inline mr-1 -mt-px" />}
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          {/* Dates custom */}
          {period === "custom" && (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Du</label>
                <Input type="date" value={customFrom} max={customTo || undefined}
                  onChange={(e) => setCustomFrom(e.target.value)} className="rounded-xl h-9 text-sm" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Au</label>
                <Input type="date" value={customTo} min={customFrom || undefined}
                  onChange={(e) => setCustomTo(e.target.value)} className="rounded-xl h-9 text-sm" />
              </div>
              {(customFrom || customTo) && (
                <button type="button" onClick={() => { setCustomFrom(""); setCustomTo(""); }}
                  className="mb-0.5 text-muted-foreground hover:text-foreground transition-colors" aria-label="Réinitialiser">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Séparateur + pills statut — masqué si le rôle n'a qu'un seul type */}
          {statusOptions.length > 1 && (
            <>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60 whitespace-nowrap">
                  {profile?.role === "ADMIN" ? "Type de notification" : "Statut de fiche"}
                </span>
                <div className="flex-1 h-px bg-border/50" />
                {selectedTypes.length > 0 && (
                  <button type="button" onClick={() => setSelectedTypes([])}
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                    <X className="w-3 h-3" />Tout effacer
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {statusOptions.map(({ value, label, icon: Icon, color }) => {
                  const active = selectedTypes.includes(value);
                  return (
                    <button key={value} type="button" onClick={() => toggleType(value)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border
                        ${active
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-background border-border hover:border-primary/40 hover:text-foreground text-muted-foreground"
                        }`}>
                      <Icon className={`w-3 h-3 ${active ? "text-primary-foreground" : color}`} />
                      {label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* ── En-tête résultats ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-muted-foreground">
            {isFiltered
              ? `${notifications.length} résultat${notifications.length !== 1 ? "s" : ""}`
              : unreadCount > 0
                ? `${unreadCount} non lue${unreadCount > 1 ? "s" : ""}`
                : "Toutes les notifications sont lues"}
          </p>
          {unreadCount > 0 && !isFiltered && (
            <Button variant="outline" size="sm" onClick={markAllRead} className="rounded-xl gap-2">
              <CheckCheck className="w-4 h-4" />Tout marquer comme lu
            </Button>
          )}
        </div>

        {/* ── Liste ─────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 bg-card rounded-xl animate-pulse" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
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
          <div className="space-y-3">
            {notifications.map((n) => {
              const badge = TYPE_BADGE[n.type];
              return (
                <div
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${n.read ? "" : "Non lue. "}${n.title}${n.fiche_id ? " — ouvrir la fiche" : ""}`}
                  onClick={() => handleClick(n)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClick(n); } }}
                  className={`rounded-xl shadow-sm cursor-pointer transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
                    ${!n.read
                      ? "bg-blue-50/60 dark:bg-blue-950/20 ring-1 ring-blue-100 dark:ring-blue-900"
                      : "bg-card ring-1 ring-border/30"
                    } ${n.fiche_id ? "hover:ring-primary/30" : ""}`}
                >
                  <div className="p-5 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="relative shrink-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center
                          ${!n.read ? "bg-blue-100 text-blue-600" : "bg-muted text-muted-foreground"}`}>
                          <FileText className="w-5 h-5" />
                        </div>
                        {!n.read && (
                          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-[#F97316] rounded-full border-2 border-white" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm ${!n.read ? "font-semibold" : "font-medium text-foreground/80"}`}>
                            {n.title}
                          </p>
                          {badge && (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>
                              {badge.label}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(n.created_at).toLocaleDateString("fr-FR", {
                            day: "2-digit", month: "short", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                    {!n.read && (
                      <button
                        type="button"
                        title="Marquer comme lu"
                        aria-label="Marquer comme lu"
                        onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                        className="shrink-0 w-8 h-8 rounded-full hover:bg-blue-100 flex items-center justify-center text-blue-500 transition-colors"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {hasMore && (
              <div className="flex justify-center pt-2">
                <Button variant="outline" onClick={loadMore} disabled={loadingMore} className="rounded-xl gap-2">
                  {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Charger plus
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
