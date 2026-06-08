import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Notification } from "@/types/database";

type Db = SupabaseClient<Database>;

/** Nombre de notifications non lues d'un utilisateur. */
export async function getUnreadNotificationCount(db: Db, userId: string): Promise<number> {
  const { count } = await db
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);
  return count ?? 0;
}

/** Une page de notifications (du plus récent au plus ancien) via `range()`. */
export async function getNotifications(
  db: Db,
  userId: string,
  range: { from: number; to: number },
): Promise<Notification[]> {
  const { data } = await db
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(range.from, range.to);
  return (data as Notification[]) ?? [];
}

/** Marque une notification comme lue. */
export async function markNotificationRead(db: Db, id: string) {
  return db.from("notifications").update({ read: true }).eq("id", id);
}

/** Marque toutes les notifications non lues d'un utilisateur comme lues. */
export async function markAllNotificationsRead(db: Db, userId: string) {
  return db
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);
}
