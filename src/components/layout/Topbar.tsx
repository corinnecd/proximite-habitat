"use client";

import { Bell, Search, FileText, CheckCheck, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { getUnreadNotificationCount, getNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/data/notifications";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { toast } from "sonner";
import type { Notification } from "@/types/database";
import { useSearch } from "@/components/layout/SearchProvider";
import { usePathname, useRouter } from "next/navigation";
import { useProfile } from "@/lib/hooks/use-profile";

export function Topbar({ title, actions }: { title?: string; actions?: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [recentNotifs, setRecentNotifs] = useState<Notification[]>([]);
  const supabase = useMemo(() => createClient(), []);
  const { open: openSearch } = useSearch();
  const router = useRouter();
  const pathname = usePathname();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { profile } = useProfile();
  const userId = profile?.id ?? null;

  const fetchUnread = useCallback(async (uid: string) => {
    setUnreadCount(await getUnreadNotificationCount(supabase, uid));
  }, [supabase]);

  const fetchRecent = useCallback(async (uid: string) => {
    const rows = await getNotifications(supabase, uid, { from: 0, to: 4 });
    setRecentNotifs(rows);
  }, [supabase]);

  useEffect(() => {
    if (!userId) return;
    fetchUnread(userId);

    const channel = supabase
      .channel(`topbar-notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          fetchUnread(userId);
          if (payload.eventType === "INSERT") {
            const n = payload.new as Notification;
            setRecentNotifs((prev) => [n, ...prev].slice(0, 5));
            toast(n.title, {
              description: n.message,
              duration: 6000,
              action: n.fiche_id
                ? { label: "Voir la fiche", onClick: () => { window.location.href = `/fiches/${n.fiche_id}`; } }
                : undefined,
              icon: "🔔",
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (userId) fetchUnread(userId);
    setDropdownOpen(false);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fermer le dropdown en cliquant en dehors
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  async function handleBellClick() {
    if (pathname === "/notifications") return;
    if (!dropdownOpen && userId) await fetchRecent(userId);
    setDropdownOpen((v) => !v);
  }

  async function handleNotifClick(n: Notification) {
    setDropdownOpen(false);
    if (!n.read && userId) {
      await markNotificationRead(supabase, n.id);
      setRecentNotifs((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    if (n.fiche_id) router.push(`/fiches/${n.fiche_id}`);
  }

  async function handleMarkAllRead() {
    if (!userId) return;
    await markAllNotificationsRead(supabase, userId);
    setRecentNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  return (
    <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-md border-b border-border/50">
      <div className="flex items-start sm:items-center justify-between min-h-16 px-4 lg:px-8 gap-2 py-2.5 sm:py-0">
        <div className="lg:pl-0 pl-14 min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
          {title && <h1 className="font-heading text-lg sm:text-2xl font-bold tracking-tight text-foreground truncate">{title}</h1>}
          {actions && <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:shrink-0" data-no-print>{actions}</div>}
        </div>
        <div className="flex items-center gap-1 shrink-0 pt-1 sm:pt-0" data-no-print>
          <button
            type="button"
            onClick={openSearch}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground bg-secondary hover:bg-secondary/80 rounded-full transition-colors border border-border/50"
            aria-label="Recherche globale"
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">Rechercher…</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-mono bg-background border border-border rounded px-1 py-0.5">⌘K</kbd>
          </button>
          <ThemeToggle />

          {/* Cloche + dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={handleBellClick}
              className="relative p-2 rounded-full hover:bg-secondary transition-colors"
              aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} non lues)` : ""}`}
            >
              <Bell className="w-5 h-5 text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 bg-[#F97316] text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-card rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.1),0_2px_8px_rgba(0,0,0,0.06)] ring-1 ring-foreground/5 z-50 overflow-hidden">
                {/* En-tête */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <span className="font-semibold text-sm">Notifications</span>
                  <div className="flex items-center gap-1">
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-secondary transition-colors"
                        title="Tout marquer comme lu"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />Tout lire
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label="Fermer les notifications"
                      onClick={() => setDropdownOpen(false)}
                      className="p-1 rounded-lg hover:bg-secondary transition-colors text-muted-foreground"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Liste */}
                <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
                  {recentNotifs.length === 0 ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      Aucune notification
                    </div>
                  ) : (
                    recentNotifs.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => handleNotifClick(n)}
                        className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-secondary/50 transition-colors ${!n.read ? "bg-blue-50/60 dark:bg-blue-950/20" : ""}`}
                      >
                        <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${!n.read ? "bg-blue-100 text-blue-600 dark:bg-blue-900/40" : "bg-muted text-muted-foreground"}`}>
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-xs leading-tight ${!n.read ? "font-semibold text-foreground" : "font-medium text-foreground/80"}`}>
                              {n.title}
                            </p>
                            {!n.read && <span className="w-2 h-2 rounded-full bg-[#F97316] shrink-0 mt-1" />}
                          </div>
                          {n.message && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground/60 mt-1">
                            {new Date(n.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                {/* Pied */}
                <div className="border-t border-border">
                  <Link
                    href="/notifications"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center justify-center py-3 text-xs font-medium text-primary hover:bg-secondary/50 transition-colors"
                  >
                    Voir toutes les notifications →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
