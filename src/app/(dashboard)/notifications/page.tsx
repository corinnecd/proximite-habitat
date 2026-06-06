"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Topbar } from "@/components/layout/Topbar";
import { createClient } from "@/lib/supabase/client";
import { Bell, CheckCheck, FileText, Check, Loader2 } from "lucide-react";
import type { Notification } from "@/types/database";

const PAGE_SIZE = 20;

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();

  const fetchNotifications = useCallback(async (uid: string, pageToLoad = 0, append = false) => {
    if (append) setLoadingMore(true);
    const from = pageToLoad * PAGE_SIZE;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    const rows = (data as Notification[]) || [];
    setNotifications((prev) => (append ? [...prev, ...rows] : rows));
    setHasMore(rows.length === PAGE_SIZE);
    setPage(pageToLoad);
    if (append) setLoadingMore(false);
    setLoading(false);
  }, [supabase]);

  const loadMore = useCallback(() => {
    if (userId && !loadingMore && hasMore) fetchNotifications(userId, page + 1, true);
  }, [userId, loadingMore, hasMore, page, fetchNotifications]);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      fetchNotifications(user.id);
    }
    init();
  }, [supabase, fetchNotifications]);

  // Marque une notification individuelle comme lue
  async function markAsRead(notifId: string) {
    await supabase.from("notifications").update({ read: true }).eq("id", notifId);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, read: true } : n))
    );
  }

  // Marque toutes comme lues
  async function markAllRead() {
    if (!userId) return;
    await supabase.from("notifications").update({ read: true })
      .eq("user_id", userId).eq("read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  // Clic sur une notification : marque comme lue + navigation si fiche liée
  async function handleClick(notif: Notification) {
    if (!notif.read) await markAsRead(notif.id);
    if (notif.fiche_id) router.push(`/fiches/${notif.fiche_id}`);
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <>
      <Topbar title="Notifications" />
      <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">

        {/* En-tête */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0
              ? `${unreadCount} non lue${unreadCount > 1 ? "s" : ""}`
              : "Toutes les notifications sont lues"}
          </p>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead} className="rounded-xl gap-2">
              <CheckCheck className="w-4 h-4" />Tout marquer comme lu
            </Button>
          )}
        </div>

        {/* Liste */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 bg-white rounded-xl animate-pulse" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-12 text-center text-muted-foreground">
              <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Aucune notification pour le moment</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                className={`rounded-xl shadow-sm cursor-pointer transition-all hover:shadow-md
                  ${!n.read
                    ? "bg-blue-50/60 ring-1 ring-blue-100"
                    : "bg-white ring-1 ring-border/30"
                  } ${n.fiche_id ? "hover:ring-primary/30" : ""}`}
              >
                <div className="p-5 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {/* Icône + point non-lu */}
                    <div className="relative shrink-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center
                        ${!n.read ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-400"}`}>
                        <FileText className="w-5 h-5" />
                      </div>
                      {!n.read && (
                        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-[#F97316] rounded-full border-2 border-white" />
                      )}
                    </div>
                    {/* Texte */}
                    <div className="min-w-0">
                      <p className={`text-sm ${!n.read ? "font-semibold" : "font-medium text-foreground/80"}`}>
                        {n.title}
                      </p>
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(n.created_at).toLocaleDateString("fr-FR", {
                          day: "2-digit", month: "short", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Bouton individuel "marquer comme lu" */}
                  {!n.read && (
                    <button
                      type="button"
                      title="Marquer comme lu"
                      onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                      className="shrink-0 w-8 h-8 rounded-full hover:bg-blue-100 flex items-center justify-center text-blue-500 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {hasMore && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="rounded-xl gap-2"
                >
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
