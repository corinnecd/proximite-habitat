import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Profile } from "@/types/database";

type Db = SupabaseClient<Database>;

/** Un profil par son id, ou `null` si introuvable. */
export async function getProfileById(db: Db, id: string): Promise<Profile | null> {
  const { data } = await db.from("profiles").select("*").eq("id", id).single();
  return data;
}

/** Nom complet (« Prénom Nom ») d'un profil, ou `null` si introuvable. */
export async function getProfileFullName(db: Db, id: string): Promise<string | null> {
  const { data } = await db
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", id)
    .single();
  return data ? `${data.first_name} ${data.last_name}` : null;
}

/** Tous les profils (du plus récent au plus ancien) — réservé à l'administration. */
export async function getAllProfiles(db: Db): Promise<Profile[]> {
  const { data } = await db
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  return data ?? [];
}

/** Active ou désactive un compte utilisateur. */
export async function setProfileActive(db: Db, id: string, isActive: boolean) {
  return db.from("profiles").update({ is_active: isActive }).eq("id", id);
}

/** Met à jour les données modifiables d'un profil (prénom, nom, téléphone, rôle). */
export async function updateProfile(
  db: Db,
  id: string,
  data: { first_name: string; last_name: string; phone: string | null; role: import("@/types/database").UserRole }
) {
  return db.from("profiles").update(data).eq("id", id).select().single();
}
