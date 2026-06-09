"use client";

import { Bell, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getUnreadNotificationCount } from "@/lib/data/notifications";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { toast } from "sonner";
import type { Notification } from "@/types/database";
import { useSearch } from "@/components/layout/SearchProvider";

export function Topbar({ title }: { title?: string }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const supabase = createClient();
  const { open: openSearch } = useSearch();

  const fetchUnread = useCallback(async (uid: string) => {
    setUnreadCount(await getUnreadNotificationCount(supabase, uid));
  }, [supabase]);

  useEffect(() => {
    let channelCleanup: (() => void) | undefined;

    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await fetchUnread(user.id);

      // Subscription temps réel : badge mis à jour dès qu'une notif est créée ou lue.
      // Nom de canal unique par instance : la Topbar est montée sur chaque page,
      // réutiliser un nom fixe renverrait un canal déjà souscrit et ferait échouer
      // l'ajout du callback (« cannot add postgres_changes callbacks after subscribe() »).
      const channel = supabase
        .channel(`topbar-notifications-${user.id}-${crypto.randomUUID()}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            fetchUnread(user.id);
            if (payload.eventType === "INSERT") {
              const n = payload.new as Notification;
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

      channelCleanup = () => supabase.removeChannel(channel);
    }

    init();
    return () => { channelCleanup?.(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-md border-b border-border/50">
      <div className="flex items-center justify-between h-16 px-4 lg:px-8 gap-2">
        <div className="lg:pl-0 pl-14 min-w-0 flex-1">
          {title && <h1 className="font-heading text-lg sm:text-2xl text-foreground truncate">{title}</h1>}
        </div>
        <div className="flex items-center gap-1">
          <button
              type="button"
              onClick={openSearch}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground bg-secondary hover:bg-secondary/80 rounded-xl transition-colors border border-border/50"
              aria-label="Recherche globale"
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Rechercher…</span>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-mono bg-background border border-border rounded px-1 py-0.5">⌘K</kbd>
          </button>
          <ThemeToggle />
          <Link
            href="/notifications"
            className="relative p-2 rounded-xl hover:bg-secondary transition-colors"
            aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} non lues)` : ""}`}
          >
            <Bell className="w-5 h-5 text-muted-foreground" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 bg-[#F97316] text-white text-xs font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
