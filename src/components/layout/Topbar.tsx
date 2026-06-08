"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getUnreadNotificationCount } from "@/lib/data/notifications";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export function Topbar({ title }: { title?: string }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const supabase = createClient();

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
          () => fetchUnread(user.id)
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
      <div className="flex items-center justify-between h-16 px-6 lg:px-8">
        <div className="lg:pl-0 pl-14">
          {title && <h1 className="font-heading text-2xl text-foreground">{title}</h1>}
        </div>
        <div className="flex items-center gap-1">
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
