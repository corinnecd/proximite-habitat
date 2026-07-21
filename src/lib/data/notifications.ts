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
  search?: string,
  dateFrom?: string,
  dateTo?: string,
  types?: string[],
): Promise<Notification[]> {
  let query = db
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(range.from, range.to);

  if (search?.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(`title.ilike.${term},message.ilike.${term}`);
  }
  if (dateFrom) query = query.gte("created_at", dateFrom);
  if (dateTo)   query = query.lte("created_at", dateTo);
  if (types && types.length > 0) query = query.in("type", types);

  const { data } = await query;
  return (data as Notification[]) ?? [];
}

/** Insère une notification pour un ou plusieurs utilisateurs (silencieux en cas d'erreur). */
export async function createNotifications(
  db: Db,
  rows: Array<{
    user_id: string;
    organization_id: string;
    type: string;
    title: string;
    message: string;
    fiche_id?: string | null;
  }>
) {
  if (!rows.length) return;
  await db.from("notifications").insert(rows);

  // Envoyer les pushes en arrière-plan — ne bloque pas si le service est indisponible
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const first = rows[0];
  try {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL
      ? (typeof window !== "undefined" ? "" : process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
      : "";
    await fetch(`${base}/api/push/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userIds,
        title: first.title,
        body: first.message,
        url: first.fiche_id ? `/fiches/${first.fiche_id}` : "/notifications",
      }),
    });
  } catch {
    // Push facultatif — l'in-app notification est déjà envoyée
  }
}

/** Récupère les ids de tous les admins d'une organisation. */
export async function getAdminIds(db: Db, organizationId: string): Promise<string[]> {
  const { data } = await db
    .from("profiles")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("role", "ADMIN")
    .eq("is_active", true);
  return (data ?? []).map((r) => r.id);
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
